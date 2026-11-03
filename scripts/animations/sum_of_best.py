"""(b) Community sum of best — the fastest segment from any reference run,
lifted out of each runner's bar and assembled into one composite run.

Render: see scripts/animations/render.ps1 (scene SumOfBest).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from manim import (DOWN, LEFT, RIGHT, UP, UL, DashedLine, FadeIn, FadeOut, Indicate, Rectangle, Scene,
                   Text, TransformFromCopy, VGroup, Write, config)

from common import BG, FONT, GOLD, GRID, INK, MONO, MUTED, RECORD, SPLIT_COLORS, TARGET, fmt, load

config.background_color = BG

D = load()
X0, X1, TMAX = -2.6, 6.2, 660.0


def xof(t):
    return X0 + (X1 - X0) * t / TMAX


class SumOfBest(Scene):
    def construct(self):
        runs = sorted(D["runs"], key=lambda r: r["time"])
        best = D["communityBest"]
        sob = D["sumOfBest"]

        title = Text("Community sum of best", font=FONT, weight="BOLD", font_size=38, color=INK).to_corner(UL, buff=0.4)
        sub = Text("fastest segment from any reference run, split by split", font=FONT, font_size=20, color=MUTED)
        sub.next_to(title, DOWN, aligned_edge=LEFT, buff=0.12)
        self.play(Write(title), FadeIn(sub), run_time=1.0)

        H, top, step = 0.36, 1.85, 0.5
        grid = VGroup()
        for s in range(0, 661, 60):
            grid.add(DashedLine([xof(s), top + 0.3, 0], [xof(s), -2.75, 0], color=GRID, stroke_width=1, dash_length=0.06))
            grid.add(Text(fmt(s, 0), font=MONO, font_size=14, color=MUTED).move_to([xof(s), -3.0, 0]))
        self.add(grid)

        rows, segrects = VGroup(), {}
        for i, r in enumerate(runs):
            y = top - i * step
            lbl = Text(r["label"].replace(" (1.0.1 follow-along)", ""), font=FONT, font_size=17, color=INK)
            lbl.move_to([-4.6, y, 0])
            bars = VGroup()
            prev = 0.0
            for k, cum in enumerate(r["splits"]):
                rect = Rectangle(width=xof(cum) - xof(prev), height=H, fill_color=SPLIT_COLORS[k], fill_opacity=0.35,
                                 stroke_color=BG, stroke_width=1.2)
                rect.move_to([(xof(prev) + xof(cum)) / 2, y, 0])
                bars.add(rect)
                segrects[(r["key"], k)] = rect
                prev = cum
            rows.add(VGroup(lbl, bars))
        self.play(FadeIn(rows, lag_ratio=0.1), run_time=1.4)

        ycomp = -2.3
        comp_lbl = Text("Sum of best", font=FONT, font_size=19, weight="BOLD", color=GOLD).move_to([-4.6, ycomp, 0])
        self.play(FadeIn(comp_lbl), run_time=0.4)

        acc = 0.0
        pieces = VGroup()
        for k, b in enumerate(best):
            src = segrects[(b["run"], k)]
            src_label = next(r["label"] for r in runs if r["key"] == b["run"]).split(" (")[0]
            caption = Text(f"{D['splits'][k]}: {b['seg']:.2f} s from {src_label}",
                           font=FONT, font_size=22, color=SPLIT_COLORS[k]).move_to([1.8, -1.35, 0])
            self.play(FadeIn(caption), src.animate.set_fill(opacity=1.0).set_stroke(GOLD, width=3), run_time=0.5)
            self.play(Indicate(src, color=GOLD, scale_factor=1.08), run_time=0.5)
            tgt = Rectangle(width=xof(acc + b["seg"]) - xof(acc), height=H + 0.08, fill_color=SPLIT_COLORS[k],
                            fill_opacity=1, stroke_color=GOLD, stroke_width=2)
            tgt.move_to([(xof(acc) + xof(acc + b["seg"])) / 2, ycomp, 0])
            self.play(TransformFromCopy(src, tgt), run_time=0.9)
            pieces.add(tgt)
            acc += b["seg"]
            self.play(FadeOut(caption), run_time=0.25)

        total = Text(fmt(sob), font=MONO, font_size=26, color=GOLD).next_to(pieces, RIGHT, buff=0.4)
        rec = DashedLine([xof(410), top + 0.35, 0], [xof(410), -2.75, 0], color=RECORD, stroke_width=3)
        rec_lbl = Text("6:50 record", font=FONT, font_size=15, color=RECORD).next_to(rec, UP, buff=0.04)
        self.play(FadeIn(total), FadeIn(rec), FadeIn(rec_lbl), run_time=0.8)
        tgt_line = DashedLine([xof(D["targetTime"]), ycomp + 0.35, 0], [xof(D["targetTime"]), ycomp - 0.35, 0],
                              color=TARGET, stroke_width=3)
        tgt_lbl = Text("6:48 target", font=FONT, font_size=14, color=TARGET).next_to(tgt_line, DOWN, buff=0.04)
        msg = Text(f"{fmt(sob)} on paper: {410 - sob:.2f} s under the record. "
                   f"The 6:48 target spreads the {D['targetTime'] - sob:.1f} s of slack across all five splits.",
                   font=FONT, font_size=17, color=INK).move_to([0.2, -3.5, 0])
        self.play(FadeIn(tgt_line), FadeIn(tgt_lbl), FadeIn(msg), run_time=0.8)
        self.wait(2.5)
