"""Shared data + style for the raid explainer animations (ManimCE).

Data comes from data/kb/prior/animation-data.json, written by
`node scripts/animations/export-data.mjs` from js/data/raid.js and the
Monte-Carlo model in scripts/analysis/. Nothing here is hand-typed.
"""
import json
from pathlib import Path

from manim import ManimColor

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "kb" / "prior" / "animation-data.json"


def load():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def fmt(t, dp=2):
    """Seconds -> m:ss.xx (speedrun style)."""
    m = int(t // 60)
    s = t - 60 * m
    w = 3 + dp if dp else 2
    return f"{m}:{s:0{w}.{dp}f}" if dp else f"{m}:{int(round(s)):02d}"


# Palette: dark slate background, one hue per split (Vines -> Sanctum),
# gold for "best", red for the record line, teal for the target.
BG = ManimColor("#0f1419")
INK = ManimColor("#e6e1cf")
MUTED = ManimColor("#7f8a96")
GRID = ManimColor("#2a333d")
SPLIT_COLORS = [ManimColor(c) for c in ("#4c9f70", "#3a86c8", "#8e6cc4", "#d0843a", "#c8464b")]
GOLD = ManimColor("#f2c14e")
RECORD = ManimColor("#ff5f56")
TARGET = ManimColor("#2ec4b6")
SLOW = ManimColor("#3a6ea5")

FONT = "Segoe UI"
MONO = "Consolas"
