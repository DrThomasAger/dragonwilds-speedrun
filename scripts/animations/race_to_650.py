"""(a) Race to 6:50 — TexasPete 6:50, Nanobit 7:01 and the 6:48 target pace,
five split bars each, growing on one shared run clock.

Render (from repo root):
  manim -qm -o race_to_650 --media_dir D:/claude-temp/prior/manim-media scripts/animations/race_to_650.py RaceTo650
or use scripts/animations/render.ps1, which also copies to media/animations/ and makes a GIF.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from manim import (DOWN, LEFT, RIGHT, UP, UL, DashedLine, FadeIn, Rectangle, Scene, Text,
                   ValueTracker, VGroup, Write, always_redraw, linear, config)

from common import BG, FONT, GOLD, GRID, INK, MONO, MUTED, RECORD, SPLIT_COLORS, TARGET, fmt, load

config.background_color = BG

D = load()
X0, X1, TMAX = -3.4, 5.6, 430.0


def xof(t):
    return X0 + (X1 - X0) * min(t, TMAX) / TMAX


_TEXT = {}


def label(s, **kw):
    """Text is the costly part of a redraw; reuse one per distinct string (copied, so moves don't leak)."""
    key = (s, tuple(sorted((k, str(v)) for k, v in kw.items())))
    if key not in _TEXT:
        _TEXT[key] = Text(s, **kw)
    return _TEXT[key].copy()


class RaceTo650(Scene):
    def construct(self):
        runs = {r["key"]: r for r in D["runs"]}
        rows = [
            ("TexasPete 6:50 (WR)", runs["tp650"]["splits"], INK),
            ("Nanobit 7:01", runs["nano701"]["splits"], INK),
            ("Target 6:48", D["targetPace"], TARGET),
        ]
        target = D["targetPace"]
        ys = [1.3, 0.0, -1.3]
        H = 0.62

        title = Text("Race to 6:50", font=FONT, weight="BOLD", font_size=40, color=INK).to_corner(UL, buff=0.4)
        sub = Text("Scorned Wilderness raid · same run clock · five splits", font=FONT, font_size=20, color=MUTED)
        sub.next_to(title, DOWN, aligned_edge=LEFT, buff=0.12)
        self.play(Write(title), FadeIn(sub), run_time=1.0)

        # axis: minute ticks + split legend
        axis = VGroup()
        for s in range(0, 421, 60):
            x = xof(s)
            axis.add(DashedLine([x, 2.0, 0], [x, -2.0, 0], color=GRID, stroke_width=1, dash_length=0.06))
            axis.add(Text(fmt(s, 0), font=MONO, font_size=16, color=MUTED).move_to([x, -2.25, 0]))
        rec = DashedLine([xof(410), 2.15, 0], [xof(410), -2.0, 0], color=RECORD, stroke_width=3)
        rec_lbl = Text("6:50 record", font=FONT, font_size=16, color=RECORD).next_to(rec, UP, buff=0.05)
        legend = VGroup(*[
            VGroup(Rectangle(width=0.22, height=0.22, fill_color=c, fill_opacity=1, stroke_width=0),
                   Text(n, font=FONT, font_size=16, color=INK)).arrange(RIGHT, buff=0.1)
            for n, c in zip(D["splits"], SPLIT_COLORS)
        ]).arrange(RIGHT, buff=0.35).move_to([1.2, -3.35, 0])
        labels = VGroup(*[
            Text(n, font=FONT, font_size=22, color=c).move_to([-5.15, y, 0]) for (n, _, c), y in zip(rows, ys)
        ])
        self.play(FadeIn(axis), FadeIn(rec), FadeIn(rec_lbl), FadeIn(legend), FadeIn(labels), run_time=0.8)

        t = ValueTracker(0.0)

        def bars():
            g = VGroup()
            now = t.get_value()
            for (name, splits, _), y in zip(rows, ys):
                prev = 0.0
                for k, cum in enumerate(splits):
                    if now <= prev:
                        break
                    end = min(now, cum)
                    w = xof(end) - xof(prev)
                    if w > 1e-3:
                        r = Rectangle(width=w, height=H, fill_color=SPLIT_COLORS[k], fill_opacity=0.95,
                                      stroke_color=BG, stroke_width=1.5)
                        r.move_to([(xof(prev) + xof(end)) / 2, y, 0])
                        g.add(r)
                    prev = cum
            return g

        def readouts():
            g = VGroup()
            now = t.get_value()
            for (name, splits, c), y in zip(rows, ys):
                done = [k for k, s in enumerate(splits) if s <= now]
                if not done:
                    continue
                k = done[-1]
                if k == len(splits) - 1:
                    txt = label(fmt(splits[-1]), font=MONO, font_size=20, color=GOLD if splits[-1] < 410 else INK)
                elif splits is not target:
                    d = splits[k] - target[k]
                    txt = label(f"{'+' if d >= 0 else '−'}{abs(d):.1f}", font=MONO, font_size=18,
                               color=RECORD if d > 0 else TARGET)
                else:
                    continue
                txt.next_to([xof(min(now, splits[-1])), y, 0], RIGHT, buff=0.08)
                if k < len(splits) - 1:
                    txt.shift(UP * (H / 2 + 0.16) + LEFT * 0.4)
                g.add(txt)
            return g

        clock = always_redraw(lambda: Text(fmt(t.get_value()), font=MONO, font_size=34, color=INK)
                              .to_corner(UP + RIGHT, buff=0.45))
        note = Text("deltas = gap to target pace at the last split", font=FONT, font_size=14, color=MUTED)
        note.to_corner(DOWN + LEFT, buff=0.25).shift(UP * 0.55)
        self.add(always_redraw(bars), always_redraw(readouts), clock, note)
        # Seven 2-second legs instead of one 14-second animation: each leg is encoded to its
        # own partial file, which keeps peak memory low (one long leg ran out of memory).
        for leg in range(1, 8):
            self.play(t.animate.set_value(425.0 * leg / 7), run_time=2, rate_func=linear)
        self.wait(0.5)

        diff = runs["nano701"]["time"] - runs["tp650"]["time"]
        tgt_gap = 410 - target[-1]
        msg = Text(f"Nanobit finishes {diff:.2f} s behind; the target beats 6:50 by {tgt_gap:.1f} s",
                   font=FONT, font_size=20, color=INK).move_to([1.1, -2.8, 0])
        self.play(FadeIn(msg), run_time=0.6)
        self.wait(2.0)
