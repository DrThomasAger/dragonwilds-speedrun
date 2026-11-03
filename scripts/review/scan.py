"""Per-frame visual features of a raid video for the review pipeline (OCR-free).

    python scan.py <video> <templates_dir> [--fps 10] [--start S] [--end E] [--ffmpeg PATH] [--scale B[,G]]

Decodes the video with ffmpeg (scaled to 640x360, grey) and prints compact JSON:
  {"fps":10, "start":S, "n":N, "w":640, "h":360, "scale":[B,G], "scaleScore":[..],
   "banner":[...],   # normalised cross-correlation (TM_CCOEFF_NORMED) of the
                     # "EXTRACTION POINT UNLOCKED" text template inside the top band
                     # (rows 0-30, x 190-450 of 640x360: the 640x24 banner band, centred)
   "getout":[...],   # same for the "GET OUT NOW!" plate (rows 60-200, x 190-450)
   "med":[...],      # median luminance of the whole frame (stream overlays do not lift it)
   "ctr":[...]}      # mean luminance of the centre 50% (game area)
Sample i is at video time start + i/fps.

UI scale differs between players (resolution / UI-scale setting), so the template scale
is found first: pass 1 samples the video at 1 fps with coarse scales 0.7-1.3, keeps the
frames where each template scores best and refines its scale there in 0.01 steps (the
banner and the GET OUT plate scale differently between setups). Pass 2 scores every
frame at those scales +-0.02. --scale B[,G] skips pass 1.
Templates are built by make_templates.py from 6WEIHo7AUf0 (TexasPete 6:50).
"""
import json
import os
import subprocess
import sys

import cv2
import numpy as np

W, H = 640, 360
COARSE = [0.7, 0.76, 0.82, 0.88, 0.94, 1.0, 1.06, 1.12, 1.18, 1.24, 1.3]
BAND = (slice(0, 30), slice(190, 450))
PLATE = (slice(60, 200), slice(190, 450))


def opt(name, default, cast=str):
    if name in sys.argv:
        return cast(sys.argv[sys.argv.index(name) + 1])
    return default


def resize(t, s):
    return cv2.resize(t, (max(8, round(t.shape[1] * s)), max(5, round(t.shape[0] * s))), interpolation=cv2.INTER_AREA)


def ncc(region, t):
    if t.shape[0] > region.shape[0] or t.shape[1] > region.shape[1]:
        return -1.0
    r = cv2.matchTemplate(region, t, cv2.TM_CCOEFF_NORMED)
    return float(np.nanmax(r)) if r.size else -1.0


def frames(ffmpeg, video, fps, start=0.0, end=None):
    cmd = [ffmpeg, "-v", "error", "-nostdin"]
    if start > 0:
        cmd += ["-ss", f"{start:.3f}"]
    cmd += ["-i", video]
    if end is not None:
        cmd += ["-t", f"{max(0.1, end - start):.3f}"]
    cmd += ["-an", "-vf", f"fps={fps},scale={W}:{H},format=gray", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=W * H * 8)
    size = W * H
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(H, W)
    err = p.stderr.read().decode("utf-8", "replace")
    p.wait()
    if p.returncode != 0:
        frames.error = err.strip()[-400:]


frames.error = None


def find_scales(ffmpeg, video, temps, regions, start, end):
    """Pass 1: per template, (scale, score) of the best match, sampled at 1 fps."""
    coarse = [[resize(t, s) for s in COARSE] for t in temps]
    hits = [[] for _ in temps]  # per template: (score, region)
    for f in frames(ffmpeg, video, 1, start, end):
        ff = f.astype(np.float32)
        for k, (cs, reg) in enumerate(zip(coarse, regions)):
            r = ff[reg].copy()
            hits[k].append((max(ncc(r, t) for t in cs), r))
            if len(hits[k]) > 60:  # bound memory on long videos: keep the best 20
                hits[k] = sorted(hits[k], key=lambda h: -h[0])[:20]
    out = []
    for k, t0 in enumerate(temps):
        hk = sorted(hits[k], key=lambda h: -h[0])
        top = [r for sc, r in hk[:10] if sc > 0.45]
        best = (0.0, 1.0)
        for s in np.arange(0.68, 1.32, 0.01):
            if not top:
                break
            t = resize(t0, float(s))
            v = float(np.mean(sorted((ncc(r, t) for r in top), reverse=True)[:5]))
            if v > best[0]:
                best = (v, round(float(s), 2))
        out.append((best[1], round(best[0], 3)))
    return out


def main():
    video, tdir = sys.argv[1], sys.argv[2]
    fps = opt("--fps", 10.0, float)
    start = opt("--start", 0.0, float)
    end = opt("--end", None, float)
    ffmpeg = opt("--ffmpeg", os.environ.get("FFMPEG", "ffmpeg"))
    banner = cv2.imread(os.path.join(tdir, "banner.png"), cv2.IMREAD_GRAYSCALE)
    getout = cv2.imread(os.path.join(tdir, "getout.png"), cv2.IMREAD_GRAYSCALE)
    if banner is None or getout is None:
        raise SystemExit(f"templates missing in {tdir}")
    banner, getout = banner.astype(np.float32), getout.astype(np.float32)

    scale = opt("--scale", None, str)
    if scale:
        bs, gs = (float(x) for x in (scale.split(",") * 2)[:2])
        found = [(bs, None), (gs, None)]
    else:
        found = find_scales(ffmpeg, video, [banner, getout], [BAND, PLATE], start, end)
        bs, gs = found[0][0], found[1][0]
    bts = [resize(banner, s) for s in (bs - 0.02, bs, bs + 0.02)]
    gts = [resize(getout, s) for s in (gs - 0.02, gs, gs + 0.02)]

    out = {"fps": fps, "start": start, "w": W, "h": H, "scale": [bs, gs], "scaleScore": [found[0][1], found[1][1]],
           "banner": [], "getout": [], "med": [], "ctr": []}
    # The GET OUT plate shows for ~15 s, so it is scored every 5th frame and densely only
    # while the last score is high (the end is then found from black frames at full rate).
    stride = max(1, int(round(fps / 2)))
    last_g = -1.0
    for i, f in enumerate(frames(ffmpeg, video, fps, start, end)):
        ff = f.astype(np.float32)
        band, plate = ff[BAND], ff[PLATE]
        out["banner"].append(round(max(ncc(band, t) for t in bts), 3))
        if i % stride == 0 or last_g > 0.45:
            last_g = round(max(ncc(plate, t) for t in gts), 3)
        out["getout"].append(last_g)
        out["med"].append(int(np.median(f[::4, ::4])))
        out["ctr"].append(round(float(f[90:270, 160:480].mean()), 1))
    out["n"] = len(out["med"])
    if out["n"] == 0:
        sys.stderr.write(frames.error or "no frames decoded")
        raise SystemExit(2)
    sys.stdout.write(json.dumps(out, separators=(",", ":")))


if __name__ == "__main__":
    main()
