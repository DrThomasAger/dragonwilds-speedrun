"""(c) Monte-Carlo histogram of finished raid times vs the 6:50 line.

The samples are MODELLED, not observed: seeded Monte Carlo from
scripts/analysis/model.mjs (exported by export-data.mjs). Filled bars: the
TexasPete-calibrated profile on the route he actually ran for 6:50; outline: the
same runner on the model's current-patch default route. The model is under active
development, so re-run render.sh to refresh the numbers.

Render: see scripts/animations/render.ps1 (scene MonteCarlo).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from manim import (DOWN, LEFT, RIGHT, UP, UL, DashedLine, FadeIn, Line, Rectangle, Scene, Text, ValueTracker,
                   VGroup, VMobject, Write, always_redraw, config, smooth)

from common import BG, FONT, GOLD, INK, MONO, MUTED, RECORD, SLOW, TARGET, fmt, load

config.background_color = BG

D = load()
MC = D["monteCarlo"]
LO, HI, BW = 400.0, 520.0, 2.0
EDGES = np.arange(LO, HI + BW, BW)
X0, X1, Y0, YH = -5.6, 5.6, -2.3, 4.0
ROUTE_NAME = " → ".join(MC["currentRoute"])


def xof(t):
    return X0 + (X1 - X0) * (t - LO) / (HI - LO)


def summary(pid, route):
    return next(s for s in MC["summary"] if s["profile"] == pid and s["routeName"] == route)


class MonteCarlo(Scene):
    def construct(self):
        tp = np.array(MC["samples"]["tp650:as-run"]["finished"])
        nb = np.array(MC["samples"]["tp650:current"]["finished"])
        n_tp = len(tp)
        full_tp, _ = np.histogram(np.clip(tp, LO, HI - 1e-6), EDGES)
        full_nb, _ = np.histogram(np.clip(nb, LO, HI - 1e-6), EDGES)
        ymax = max(full_tp.max(), full_nb.max()) * 1.05

        def yof(c):
            return Y0 + YH * c / ymax

        title = Text("How often does a run beat 6:50?", font=FONT, weight="BOLD", font_size=34, color=INK)
        title.to_corner(UL, buff=0.35)
        sub = Text("MODELLED · seeded Monte Carlo (scripts/analysis/model.mjs) · not observed runs",
                   font=FONT, font_size=16, color=GOLD)
        sub.next_to(title, DOWN, aligned_edge=LEFT, buff=0.1)
        self.play(Write(title), FadeIn(sub), run_time=1.0)

        axis = VGroup(Line([X0, Y0, 0], [X1, Y0, 0], color=MUTED, stroke_width=2))
        for s in range(405, 521, 15):
            axis.add(Line([xof(s), Y0, 0], [xof(s), Y0 - 0.08, 0], color=MUTED, stroke_width=2))
            axis.add(Text(fmt(s, 0), font=MONO, font_size=15, color=MUTED).move_to([xof(s), Y0 - 0.3, 0]))
        axis.add(Text("finished run time (≥ 8:40 piled into the last bin)", font=FONT, font_size=14, color=MUTED)
                 .move_to([0, Y0 - 0.62, 0]))
        rec = DashedLine([xof(410), Y0, 0], [xof(410), Y0 + YH + 0.25, 0], color=RECORD, stroke_width=3)
        rec_lbl = Text("6:50", font=MONO, font_size=18, color=RECORD).next_to(rec, UP, buff=0.04)
        self.play(FadeIn(axis), FadeIn(rec), FadeIn(rec_lbl), run_time=0.7)

        n = ValueTracker(0)

        def bars():
            k = int(n.get_value())
            c, _ = np.histogram(np.clip(tp[:k], LO, HI - 1e-6), EDGES) if k else (np.zeros(len(EDGES) - 1), None)
            # runs pile up: bars grow from zero to the full 19k-run histogram
            g = VGroup()
            for i, cnt in enumerate(c):
                if cnt <= 0:
                    continue
                h = yof(cnt) - Y0
                left = EDGES[i]
                r = Rectangle(width=xof(left + BW) - xof(left) - 0.015, height=h, stroke_width=0,
                              fill_color=TARGET if left + BW <= 410 else SLOW, fill_opacity=0.9)
                r.move_to([(xof(left) + xof(left + BW)) / 2, Y0 + h / 2, 0])
                g.add(r)
            return g

        def counter():
            k = int(n.get_value())
            if not k:
                return VGroup()
            beat = int((tp[:k] < 410).sum())
            return VGroup(
                Text(f"TexasPete-calibrated, route he ran for 6:50 · {k:,} finishes", font=FONT, font_size=18, color=INK),
                Text(f"{100 * beat / k:.1f}% of finishes under 6:50", font=MONO, font_size=22, color=TARGET),
            ).arrange(DOWN, aligned_edge=RIGHT, buff=0.1).to_corner(UP + RIGHT, buff=0.35).shift(DOWN * 0.9)

        self.add(always_redraw(bars), always_redraw(counter))
        self.play(n.animate.set_value(n_tp), run_time=8, rate_func=smooth)
        self.wait(0.6)

        # Nanobit-calibrated profile as an outline for comparison
        pts = []
        for i, cnt in enumerate(full_nb):
            pts += [[xof(EDGES[i]), yof(cnt), 0], [xof(EDGES[i + 1]), yof(cnt), 0]]
        pts = [[xof(LO), Y0, 0]] + pts + [[xof(HI), Y0, 0]]
        outline = VMobject(stroke_color=GOLD, stroke_width=3).set_points_as_corners(pts)
        nb_lbl = Text(f"Same runner, current-patch route: {int((nb < 410).sum())} of {len(nb):,} under 6:50",
                      font=MONO, font_size=18, color=GOLD)
        nb_lbl.to_corner(UP + RIGHT, buff=0.35).shift(DOWN * 1.75)
        self.play(FadeIn(outline), FadeIn(nb_lbl), run_time=1.5)

        s_tp, s_cur = summary("tp650", "as-run"), summary("tp650", "current")
        foot = Text(f"Per attempt incl. deaths: {100 * s_tp['pBeat']:.1f}% vs {100 * s_cur['pBeat']:.1f}%  ·  "
                    f"median {fmt(s_tp['median'])} vs {fmt(s_cur['median'])}  ·  current route {ROUTE_NAME}",
                    font=FONT, font_size=14, color=MUTED).to_edge(DOWN, buff=0.2)
        self.play(FadeIn(foot), run_time=0.6)
        self.wait(2.5)
