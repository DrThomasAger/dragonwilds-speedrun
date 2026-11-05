;; Raid Lab bridge — runs on your own PC only.
;;
;;   bb lab            (or: bb scripts/bridge.clj)   → http://localhost:5180
;;
;; What it does
;; * Serves the app, and tells it to reload the moment a file changes.
;; * Live feed: collects game events and pushes them to the app's Claude panel.
;;     - the app posts its own events (splits, PBs, practice) to /api/feed
;;     - if the RuneLite client REPL is up (osrs client_repl, port 7889) it polls a
;;       snapshot of the live game every few seconds
;;     - it tails the knowledge-base ingest log, live Twitch chat (and starts the
;;       Twitch chat monitor), LAB_OSRS_EVENTS and LAB_GAME_FILE (see "live tails")
;; * Claude: /api/claude runs Claude Code headless in this project folder with the
;;   recent feed as context, streams its output back to the panel, and keeps the
;;   session so follow-ups remember the conversation.
;; * REPL: its own nREPL server on port 1667 (connect your editor: localhost:1667),
;;   plus /api/eval to evaluate code in the game client's REPL.
;;
;; Nothing here is reachable from other machines: every server binds 127.0.0.1.

(ns bridge
  (:require [babashka.fs :as fs]
            [babashka.process :as p]
            [babashka.nrepl.server :as nrepl-server]
            [bencode.core :as b]
            [cheshire.core :as json]
            [clojure.java.io :as io]
            [clojure.string :as str]
            [org.httpkit.server :as http])
  (:import [java.net Socket InetSocketAddress]
           [java.io PushbackInputStream]))

(def root (str (fs/parent (fs/parent (fs/absolutize *file*)))))
(def port (parse-long (or (System/getenv "LAB_PORT") "5180")))
(def game-repl-port (parse-long (or (System/getenv "LAB_GAME_REPL_PORT") "7889")))
(def game-file (System/getenv "LAB_GAME_FILE"))
(def feed-file (str (fs/path root "live" "feed.jsonl")))

;; ------------------------------------------------------------------ state
(defonce clients (atom #{}))             ; open SSE channels
(defonce feed (atom []))                 ; last 300 events
(defonce claude (atom {:session nil :proc nil :busy false}))
(defonce game (atom {:connected false :snapshot nil :at nil}))

(defn now [] (System/currentTimeMillis))

(defn broadcast! [msg]
  (let [line (str "data: " (json/generate-string msg) "\n\n")]
    (doseq [ch @clients] (http/send! ch line false))))

(defn add-event! [ev]
  (let [ev (merge {:at (now)} ev)]
    (swap! feed #(vec (take-last 300 (conj % ev))))
    (fs/create-dirs (fs/parent feed-file))
    (spit feed-file (str (json/generate-string ev) "\n") :append true)
    (broadcast! {:type "feed" :event ev})
    ev))

;; ------------------------------------------------------------------ nREPL client (game)
(defn- bytes->str [x] (if (bytes? x) (String. ^bytes x "UTF-8") x))

(defn game-eval
  "Evaluate code in the game client's nREPL. Returns {:value .. :out .. :err ..} or {:error ..}."
  [code & {:keys [timeout-ms] :or {timeout-ms 4000}}]
  (try
    (with-open [s (doto (Socket.) (.connect (InetSocketAddress. "127.0.0.1" (int game-repl-port)) 800) (.setSoTimeout timeout-ms))]
      (let [out (.getOutputStream s) in (PushbackInputStream. (.getInputStream s))]
        (b/write-bencode out {"op" "eval" "code" code "id" "lab"})
        (loop [acc {:value nil :out "" :err ""}]
          (let [m (update-keys (b/read-bencode in) keyword)
                acc (cond-> acc
                      (:value m) (assoc :value (bytes->str (:value m)))
                      (:out m) (update :out str (bytes->str (:out m)))
                      (:err m) (update :err str (bytes->str (:err m))))]
            (if (some #(= "done" (bytes->str %)) (:status m)) acc (recur acc))))))
    (catch Exception e {:error (.getMessage e)})))

;; A compact snapshot of the live OSRS client (needs the client_repl plugin).
(def snapshot-form
  "(try (require '[osrs.client :as g])
     (let [c @g/client]
       (g/on-client
         #(let [p (.getLocalPlayer c)]
            (pr-str {:player (some-> p .getName)
                     :world (.getWorld c)
                     :tile (some-> p .getWorldLocation str)
                     :hp [(.getBoostedSkillLevel c net.runelite.api.Skill/HITPOINTS) (.getRealSkillLevel c net.runelite.api.Skill/HITPOINTS)]
                     :prayer (.getBoostedSkillLevel c net.runelite.api.Skill/PRAYER)
                     :run-energy (quot (.getEnergy c) 100)
                     :levels (into (sorted-map) (for [s (net.runelite.api.Skill/values)] [(str s) (.getRealSkillLevel c s)]))
                     :total (.getTotalLevel c)}))))
   (catch Throwable t (pr-str {:error (str t)})))")

(defn poll-game! []
  (let [r (game-eval snapshot-form)]
    (if (:error r)
      (when (:connected @game)
        (swap! game assoc :connected false)
        (add-event! {:source "osrs" :type "disconnected" :text (str "Game REPL not reachable on " game-repl-port)}))
      (let [snap (:value r)]
        (when-not (:connected @game) (add-event! {:source "osrs" :type "connected" :text "Game client REPL connected"}))
        (when (not= snap (:snapshot @game))
          (swap! game assoc :connected true :snapshot snap :at (now))
          (broadcast! {:type "game" :snapshot snap}))
        (swap! game assoc :connected true)))))

;; ------------------------------------------------------------------ live tails (append-only files)
;; Every source here is a file some other process appends to while it runs. The bridge
;; remembers a byte offset per file and turns each new line into one feed event, so the
;; Claude panel and the app see it within a second.
;;   kb      data/kb/raw/ingest-log.jsonl        every new run, comment, video, post the ingesters find
;;   twitch  data/kb/raw/twitch/live-*.jsonl     live chat from scripts/ingest/twitch-live.mjs
;;   osrs    LAB_OSRS_EVENTS (glob, ; separated)  e.g. ...\osrs\tick_monitor\live_*\segments.jsonl
;;   log     LAB_GAME_FILE   (glob, ; separated)  any other log or state file, line by line
;; A file present at start is read from its end (no replay); a file that appears later is
;; read from its start; a file that shrinks is read again from its start.
(def tail-max-lines 20)   ; most lines one file may add per poll

(defn- split-paths [s] (->> (str/split (or s "") #";") (map str/trim) (remove str/blank?)))

(defn- expand
  "A path, or a glob like D:/x/live_*/events.jsonl, as the list of files it names now."
  [pattern]
  (let [pattern (str/replace pattern "\\" "/")
        g (->> ["*" "?" "[" "{"] (keep #(str/index-of pattern %)) seq)]
    (if-not g
      [pattern]
      (let [i (or (str/last-index-of pattern "/" (apply min g)) -1)
            base (if (neg? i) "." (subs pattern 0 (inc i)))]
        (if (fs/directory? base) (map str (fs/glob base (subs pattern (inc i)))) [])))))

(defn- jline [line] (try (json/parse-string line true) (catch Exception _ nil)))

(defn- kb-event [line]
  (when-let [m (jline line)]
    (when (and (map? m) (not= "progress" (:kind m)))
      {:source "kb" :type (str (:source m) "/" (:kind m)) :id (:id m) :text (:title m)})))

(defn- twitch-event [file line]
  (when-let [m (jline line)]
    (let [chan (second (re-find #"live-([^/\\]+)\.jsonl$" (str file)))]
      {:source "twitch" :type "chat" :channel chan :user (:user m) :text (str "#" chan " " (:user m) ": " (:text m))})))

(defn- generic-event [source file line]
  (let [m (jline line)
        name (str (some-> (fs/parent file) fs/file-name (str "/")) (fs/file-name file))]
    (if (map? m)
      {:source source :type (str (or (:kind m) (:type m) "line")) :file name
       :text (or (:text m) (:title m) (:message m) (let [s (json/generate-string m)] (subs s 0 (min 400 (count s)))))}
      {:source source :type "line" :file name :text line})))

(defn tail-sources []
  (concat
   [{:source "kb" :files [(str (fs/path root "data" "kb" "raw" "ingest-log.jsonl"))] :event (fn [_ l] (kb-event l))}
    {:source "twitch" :files (expand (str (fs/path root "data" "kb" "raw" "twitch") "/live-*.jsonl")) :event twitch-event}]
   (for [g (split-paths (System/getenv "LAB_OSRS_EVENTS"))] {:source "osrs" :files (expand g) :event #(generic-event "osrs" %1 %2)})
   (for [g (split-paths game-file)] {:source "log" :files (expand g) :event #(generic-event "log" %1 %2)})))

(defonce offsets (atom nil))   ; {path size}; nil until the first scan

(defn- read-new [file from size]
  (with-open [r (java.io.RandomAccessFile. (str file) "r")]
    (.seek r from)
    (let [buf (byte-array (min 200000 (- size from)))]
      (.readFully r buf)
      (let [text (String. buf "UTF-8")
            cut (inc (or (str/last-index-of text "\n") -1))
            ;; keep a half-written last line for the next poll, unless the chunk holds no newline at all
            complete (if (or (str/ends-with? text "\n") (zero? cut)) text (subs text 0 cut))]
        [(+ from (alength (.getBytes ^String complete "UTF-8"))) (str/split-lines complete)]))))

(defn poll-tails! []
  (let [first? (nil? @offsets)]
    (when first? (reset! offsets {}))
    (doseq [{:keys [files event]} (tail-sources)
            f files :when (fs/regular-file? f)
            :let [size (fs/size f) seen (get @offsets f)]]
      (cond
        first? (swap! offsets assoc f size)
        (and seen (< size seen)) (swap! offsets assoc f 0)
        (> size (or seen 0))
        (let [[upto lines] (read-new f (or seen 0) size)]
          (swap! offsets assoc f upto)
          (doseq [l (->> lines (map str/trim) (remove str/blank?) (take-last tail-max-lines))
                  :let [ev (event f l)] :when ev]
            (add-event! ev)))))))

(defn tail-status [] (into {} (for [{:keys [source files]} (tail-sources)] [source (count (filter fs/regular-file? files))])))

;; ------------------------------------------------------------------ live ingester (Twitch chat)
;; twitch-live.mjs runs beside the bridge unless LAB_TWITCH_LIVE=0. It writes live-<channel>.jsonl,
;; which the twitch tail above reads.
(defonce twitch-proc (atom nil))
(defn start-twitch-live! []
  (when (and (not= "0" (System/getenv "LAB_TWITCH_LIVE")) (nil? @twitch-proc))
    (try
      (reset! twitch-proc (p/process ["node" "scripts/ingest/twitch-live.mjs"] {:dir root :out :inherit :err :inherit}))
      (add-event! {:source "twitch" :type "started" :text "Twitch live chat monitor started"})
      (catch Exception e (add-event! {:source "twitch" :type "failed" :text (str "Twitch live chat monitor did not start: " (.getMessage e))})))))
(defn stop-twitch-live! [] (when-let [pr @twitch-proc] (p/destroy-tree pr) (reset! twitch-proc nil)))

;; ------------------------------------------------------------------ live reload
(defonce mtimes (atom {}))
(defn scan-files []
  (into {} (for [d ["index.html" "hardcore-run.html" "css" "js" "data"]
                 f (if (fs/directory? (fs/path root d)) (fs/glob (fs/path root d) "**") [(fs/path root d)])
                 :let [rel (str/replace (str (fs/relativize root f)) "\\" "/")]
                 ;; data/kb/raw is appended to live (ingest log, Twitch chat); it feeds the panel, not a reload
                 :when (and (fs/regular-file? f) (not (str/starts-with? rel "data/kb/raw/")))]
             [rel (.toMillis (fs/last-modified-time f))])))
(defn poll-reload! []
  (let [cur (scan-files) old @mtimes]
    (reset! mtimes cur)
    (when (seq old)
      (let [changed (for [[k v] cur :when (not= v (get old k))] k)]
        (when (seq changed) (broadcast! {:type "reload" :files changed}))))))

;; ------------------------------------------------------------------ Claude Code
(def claude-system
  "You are the Raid Lab's built-in builder, working like Figma Make: the user describes
what they want in the panel and you make it happen in the running app, start to finish,
without asking for permission or confirmation.

How to work:
1. Act straight away. Only ask a question if the request is truly ambiguous AND guessing
   wrong would waste real work; otherwise pick the sensible option and say what you picked.
2. Edit the files directly. The app is vanilla ES modules with no build step: views in
   js/views, shared code in js/lib, data in js/data, styles in css/app.css. The open app
   reloads by itself the moment you save, so the user watches your change land.
3. Look at your result, the way a designer looks at the canvas: run
   `node scripts/look.mjs <view>` (views: hq run compare route studio practice timer wiki
   patches library hardcore). It prints a screenshot path; open it with Read and check it.
   Fix anything that looks wrong and look again. The user's screen is 1234x690 at 175%;
   also keep the phone layout working (mobile-first).
4. Finish with one or two plain sentences saying what changed. The user is new to this: no jargon.

Never touch tests/, .github/ or scripts/bridge.clj unless asked. Never write to the C: drive.
Use the live context below to answer questions about the game, splits and practice.")

(defn context-block [{:keys [view]}]
  (let [evs (take-last 40 @feed)]
    (str "## Live context\n"
         "Current app view: " (or view "unknown") "\n"
         (when-let [s (:snapshot @game)] (str "OSRS client snapshot: " s "\n"))
         "Recent events (oldest first):\n"
         (str/join "\n" (for [e evs] (str "- " (:source e) "/" (:type e) ": " (or (:text e) (json/generate-string (dissoc e :at :source :type))))))
         "\n")))

(defn claude-cmd [session]
  (cond-> ["cmd" "/c" "claude" "-p" "--output-format" "stream-json" "--verbose" "--include-partial-messages"
           "--permission-mode" (or (System/getenv "LAB_PERMISSION_MODE") "auto")
           "--allowedTools" "Read,Edit,Write,Glob,Grep,Bash(node scripts/look.mjs:*),Bash(npx playwright test:*)"]
    session (into ["--resume" session])))

(defn run-claude! [{:keys [prompt view]}]
  (when-not (:busy @claude)
    (swap! claude assoc :busy true)
    (broadcast! {:type "claude" :event {:type "start" :prompt prompt}})
    (future
      (try
        (let [proc (p/process (claude-cmd (:session @claude)) {:dir root :in :pipe :out :stream :err :string})]
          (swap! claude assoc :proc proc)
          (with-open [w (io/writer (:in proc))]
            (.write w (str claude-system "\n\n" (context-block {:view view}) "\n## Request\n" prompt)))
          (with-open [r (io/reader (:out proc))]
            (doseq [line (line-seq r) :when (str/starts-with? line "{")]
              (let [m (json/parse-string line true)]
                (when-let [sid (:session_id m)] (swap! claude assoc :session sid))
                (broadcast! {:type "claude" :event m}))))
          (let [code (:exit @proc)]
            (when-not (zero? code) (broadcast! {:type "claude" :event {:type "error" :text (str "Claude exited " code ": " (str/trim (str (:err @proc))))}}))))
        (catch Exception e (broadcast! {:type "claude" :event {:type "error" :text (.getMessage e)}}))
        (finally
          (swap! claude assoc :busy false :proc nil)
          (broadcast! {:type "claude" :event {:type "done"}}))))
    true))

(defn stop-claude! []
  (when-let [proc (:proc @claude)] (p/destroy-tree proc))
  (swap! claude assoc :busy false :proc nil))

;; ------------------------------------------------------------------ HTTP
(def types {"html" "text/html; charset=utf-8" "js" "text/javascript; charset=utf-8" "mjs" "text/javascript; charset=utf-8"
            "css" "text/css; charset=utf-8" "json" "application/json; charset=utf-8" "png" "image/png" "svg" "image/svg+xml"
            "webmanifest" "application/manifest+json" "md" "text/markdown; charset=utf-8" "lss" "application/xml"})

(defn json-res [x] {:status 200 :headers {"Content-Type" "application/json" "Cache-Control" "no-store"} :body (json/generate-string x)})
(defn body-json [req] (some-> (:body req) slurp (json/parse-string true)))

(defn static [uri]
  (let [rel (str/replace (if (or (= uri "/") (str/blank? uri)) "/index.html" uri) #"\.\." "")
        f (fs/path root (subs rel 1))]
    (if (and (fs/regular-file? f) (str/starts-with? (str (fs/absolutize f)) root))
      {:status 200 :headers {"Content-Type" (get types (fs/extension f) "application/octet-stream") "Cache-Control" "no-store"} :body (fs/file f)}
      {:status 404 :body "Not found"})))

(defn handler [{:keys [uri request-method] :as req}]
  (case [request-method uri]
    [:get "/api/status"] (json-res {:bridge true :claude (select-keys @claude [:busy :session]) :game (select-keys @game [:connected :at])
                                    :gameFile game-file :feed (count @feed) :repl 1667 :gameReplPort game-repl-port
                                    :tails (tail-status) :twitchLive (boolean (some-> @twitch-proc p/alive?))})
    [:get "/api/feed"] (json-res {:events (take-last 100 @feed) :snapshot (:snapshot @game)})
    [:post "/api/feed"] (json-res (add-event! (merge {:source "app"} (body-json req))))
    [:post "/api/claude"] (json-res {:started (boolean (run-claude! (body-json req))) :busy (:busy @claude)})
    [:post "/api/claude/stop"] (do (stop-claude!) (json-res {:stopped true}))
    [:post "/api/claude/new"] (do (stop-claude!) (swap! claude assoc :session nil) (json-res {:session nil}))
    [:post "/api/eval"] (json-res (game-eval (:code (body-json req)) :timeout-ms 10000))
    [:get "/api/events"]
    (http/as-channel req {:on-open (fn [ch]
                                     (http/send! ch {:status 200 :headers {"Content-Type" "text/event-stream" "Cache-Control" "no-store"}} false)
                                     (http/send! ch (str "data: " (json/generate-string {:type "hello" :events (take-last 50 @feed) :snapshot (:snapshot @game) :busy (:busy @claude)}) "\n\n") false)
                                     (swap! clients conj ch))
                          :on-close (fn [ch _] (swap! clients disj ch))})
    (if (= request-method :get) (static uri) {:status 405 :body "Method not allowed"})))

(defn every [ms f] (future (loop [] (try (f) (catch Exception e (binding [*out* *err*] (println "poll error:" (.getMessage e))))) (Thread/sleep ms) (recur))))

(defn -main []
  (http/run-server #'handler {:port port :ip "127.0.0.1"})
  (nrepl-server/start-server! {:host "127.0.0.1" :port 1667})
  (reset! mtimes (scan-files))
  (every 700 poll-reload!)
  (every 3000 poll-game!)
  (every 1000 poll-tails!)
  (start-twitch-live!)
  (.addShutdownHook (Runtime/getRuntime) (Thread. ^Runnable stop-twitch-live!))
  (every 20000 #(broadcast! {:type "ping"}))
  (println (str "Raid Lab bridge → http://localhost:" port "  (bridge REPL: localhost:1667, game REPL: " game-repl-port
                ", live tails: " (pr-str (tail-status)) ")"))
  @(promise))

(-main)
