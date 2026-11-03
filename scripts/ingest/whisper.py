"""Transcribe one audio file with faster-whisper and print compact JSON.

    python scripts/ingest/whisper.py <audio> [model=small]

Prints {"model":..., "language":..., "segments":[{"t":start,"e":end,"text":...}]}.
Used by scripts/ingest/twitch.mjs. Install (local only, on D:):
    D:\\claude-temp\\ingest\\venv\\Scripts\\python -m pip install faster-whisper
HF_HOME decides where the model is cached (twitch.mjs points it at D:).
"""
import json
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

audio = sys.argv[1]
model_name = sys.argv[2] if len(sys.argv) > 2 else "small"
# Fall back to smaller models when the machine is short on memory (mkl_malloc fails).
order = [model_name] + [m for m in ("base", "tiny") if m != model_name]
model = None
for name in order:
    try:
        model = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=4)
        model_name = name
        break
    except RuntimeError as e:
        sys.stderr.write(f"whisper: {name} failed to load ({e}); trying a smaller model\n")
if model is None:
    sys.exit("whisper: no model could be loaded")
# Decode with ffmpeg (16 kHz mono) instead of PyAV: some PyAV releases don't match
# faster-whisper's decode_audio() signature.
pcm = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", audio, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], check=True, capture_output=True).stdout
samples = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
segments, info = model.transcribe(samples, vad_filter=True, beam_size=1)
out = [{"t": round(s.start, 1), "e": round(s.end, 1), "text": s.text.strip()} for s in segments if s.text.strip()]
sys.stdout.write(json.dumps({"model": model_name, "language": info.language, "segments": out}, ensure_ascii=False, separators=(",", ":")))
