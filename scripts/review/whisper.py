"""Transcribe one audio file with faster-whisper (CPU, int8) and print word timings.

    python whisper.py <audio.wav (16 kHz mono s16)> [model=small]

Prints {"model":..., "language":..., "words":[{"t":start,"w":" word"}]}.
Model cache: HF_HOME (the review pipeline points it at D:\\claude-temp\\review\\hf).
Falls back to base/tiny when the machine is short on memory.
"""
import json
import sys
import wave

import numpy as np

from faster_whisper import WhisperModel

audio = sys.argv[1]
name = sys.argv[2] if len(sys.argv) > 2 else "small"
model = None
for n in [name] + [m for m in ("base", "tiny") if m != name]:
    try:
        model = WhisperModel(n, device="cpu", compute_type="int8", cpu_threads=4)
        name = n
        break
    except (RuntimeError, MemoryError) as e:
        sys.stderr.write(f"whisper: {n} failed to load ({e}); trying a smaller model\n")
if model is None:
    sys.exit("whisper: no model could be loaded")
# Decode the 16 kHz mono WAV here (faster-whisper's PyAV decoder breaks with some av versions).
with wave.open(audio, "rb") as w:
    pcm = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768.0
segments, info = model.transcribe(pcm, vad_filter=True, beam_size=1, word_timestamps=True, language="en")
words = []
for s in segments:
    for w in s.words or []:
        words.append({"t": round(w.start, 2), "w": w.word})
sys.stdout.write(json.dumps({"model": name, "language": info.language, "words": words}, ensure_ascii=False, separators=(",", ":")))
