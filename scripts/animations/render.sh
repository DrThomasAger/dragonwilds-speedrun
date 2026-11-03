#!/usr/bin/env bash
# Render the raid explainer animations (ManimCE) to media/animations/*.mp4 (720p30)
# plus a GIF preview of each. Nothing is written to C:.
#
#   bash scripts/animations/render.sh            # all scenes
#   bash scripts/animations/render.sh race_to_650  # one scene
#
# Needs: a ManimCE venv (default D:/claude-temp/prior/venvs/manim, override MANIM_VENV),
# ffmpeg at D:/ffmpeg (override FFMPEG_DIR), node (for export-data.mjs). No LaTeX: scenes use Text only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VENV="${MANIM_VENV:-/d/claude-temp/prior/venvs/manim}"
FF="${FFMPEG_DIR:-/d/ffmpeg}"
WORK="${MANIM_WORK:-D:/claude-temp/prior/manim-media}"
export TEMP='D:\claude-temp\prior\cache' TMP='D:\claude-temp\prior\cache' PATH="$FF:$PATH"
OUT="$ROOT/media/animations"; mkdir -p "$OUT"

declare -A SCENE=([race_to_650]=RaceTo650 [sum_of_best]=SumOfBest [monte_carlo]=MonteCarlo)
NAMES=("${@:-race_to_650 sum_of_best monte_carlo}"); NAMES=(${NAMES[*]})

cd "$ROOT"
node scripts/animations/export-data.mjs
# One scene at a time: parallel Cairo renders ran out of memory on a 16 GB machine.
for n in "${NAMES[@]}"; do
  [ -f "$WORK/videos/$n/720p30/$n.mp4" ] && mv -f "$WORK/videos/$n/720p30/$n.mp4" "$WORK/videos/$n/720p30/$n.prev.mp4"  # never copy a stale render
  "$VENV/Scripts/manim.exe" -qm --disable_caching -o "$n" --media_dir "$WORK" "scripts/animations/$n.py" "${SCENE[$n]}"
  cp "$WORK/videos/$n/720p30/$n.mp4" "$OUT/$n.mp4"
  "$FF/ffmpeg.exe" -v error -y -i "$OUT/$n.mp4" \
    -vf "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
    "$OUT/$n.gif"
  "$FF/ffprobe.exe" -v error -show_entries format=duration:stream=codec_name,width,height -of csv=p=0 "$OUT/$n.mp4"
done
ls -la "$OUT"
