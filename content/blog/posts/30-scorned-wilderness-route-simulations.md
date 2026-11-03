---
title: How fast can the Scorned Wilderness raid be run?
slug: scorned-wilderness-route-simulations
excerpt: How fast can the Scorned Wilderness raid be run? 20,000 simulated runs per profile say the safe 1.0.1.2 route lands near 7:21; the record needs the unverified pieces.
tags:
- '#beat-650'
- data-and-the-record
- fastest scorned wilderness time
- kuldra raid simulation
- dragonwilds speedrun math
author: Dr. Thomas Ager
meta_title: How fast can the Scorned Wilderness raid be run?
meta_description: How fast can the Scorned Wilderness raid be run? A 20,000-run simulation per profile, what it measured and what it modelled, and where a sub-6:50 comes from.
feature_image_alt: Histogram of 20,000 simulated Scorned Wilderness runs with the 6:50 record line and the 7:21 median marked
canonical: https://drthomasager.com/scorned-wilderness-route-simulations/
pillar: data-and-the-record
series_order: 30
prev: /skip-level-optimal-path/
next: /scorned-wilderness-patch-history/
status: 'draft: ready to publish'
---
A **route simulation** is a model that **plays the raid thousands of times** from measured segment times, skip success rates and failure costs, then reports how often a route beats a goal. For the Scorned Wilderness, the Raid Lab simulation ran **20,000 runs per profile** against the **6:50.00** goal and a **6:48.00** margin.

**Its headline is clear.** On the **safe 1.0.1.2 route**, even the ceiling profile has a median of **7:21.43**, and **zero of 20,000** runs beat 6:50. The record falls to the **fast, unverified pieces**: the TexasPete Fragments line, the FastTipsGaming Thane launch and a direct Sanctum flight.

## What did the analysis measure, and what did it model?

| Input | Measured or modelled | Value | File |
|---|---|---|---|
| **Split times, six runs** | measured, frame by frame, ±0.1 s | 410.00 to 653.40 s totals | `segments.csv`, `segment-stats.csv` |
| **Checkpoint pieces** | measured, contact sheets refined with 0.2 s strips | 13 pieces, 6:52.80 composite | `runpath-pieces.csv` |
| **Route variant gaps** | measured from the run path | Thane launch −11.2 s, TexasPete Fragments line −6.1 s, flight +16.9 s vs the patched blocks | `model.json` (`measured`) |
| **Run-to-run spread** | modelled: σ 0.0908, calibrated to ***Nanobit's*** PB 7:01.97 and sum of best 6:51 over 177 attempts | TexasPete's σ pooled from Nanobit, same attempt count assumed | `model.json` (`calibration`) |
| **Skip success rates** | modelled priors: elite runner 95% on working skips, 80% on new or unverified ones | | `model.json` (`statusPrior`) |
| **Failure costs** | partly measured (Keep puzzle +44.26 s, heart miss +6 s), partly assumed (failed fight skip +48 s) | | `model.json` (`miss`) |
| **Monte Carlo** | modelled: 20,000 runs per profile, 45 s reset overhead | | `simulate.json` |
| **Synthetic new runner** | generated test data, labelled SYNTHETIC | | `optimize.json`, `practice-priorities.csv` |

## What did the simulation find?

| Profile | Route | Median | p10 | p90 | Beats 6:50 |
|---|---|---|---|---|---|
| ***TexasPete*** (calibrated) | as run, patched strats | 7:01.38 | 6:54.05 | 7:15.16 | **1.23%** |
| ***TexasPete*** 6:50 as a typical run | as run, patched strats | 6:54.02 | 6:47.07 | 7:07.82 | **24.93%** |
| ***TexasPete*** (calibrated) | 1.0.1.2 default | 7:31.95 | 7:20.35 | 8:12.71 | 0 |
| ***Nanobit*** (calibrated) | 1.0.1.2 default | 7:34.98 | 7:23.36 | 8:15.67 | 0 |
| Best of both, as a typical run | 1.0.1.2 default | **7:21.43** | **7:10.17** | 8:02.01 | 0 |

**The 1.0.1.2 default route** is the safe line: Nanobit's vines zoop, the poison and demon skips, the Thane kill and air door, the Keep hole and Dotxy's flight. Its p10 for the ceiling profile, **7:10.17**, sits on the strict composite of **7:10.10**.

**The calibrated TexasPete profile** reads the 6:50 as the best of about 177 attempts, so his simulated median sits at 7:01.38. In the profile's own words: *"Medians slower than the PB splits because a PB is a best-of-N outlier."*

## Where does the variance live?

Across the six measured runs, **Cataclysm Keep carries 29.47%** of the between-run variance and **Kuldra's Sanctum 26.36%**. Together the two back-half splits hold **55.83%** of it, which is where consistency practice pays most.

## When should you reset?

For the calibrated TexasPete profile on the as-run route, the simulation's reset rule is: **reset when a split comes in later than** Vines 1:22.50, Fragments 2:24.75, Stronghold 3:16.00, Keep 4:52.75. That policy yields **0.1788 sub-6:50 runs per hour**, against **0.0812** with no resets: one record-pace run every 5.6 hours instead of every 12.3.

## What does the 4:40 claim add?

**A second route shape.** ***IINo1goodII*** describes it: *"I launched myself skipping the 3rd checkpoint and some of the parkour area. Used the plunge mech to bypass the rocks on the fight itself since they are patched. Surge dashed the bridge."* ([comment](https://youtu.be/4hncfjhUvg8?t=0)) The run path reads his 45-second clip as a phone recording of a replay with the method hidden, so it stays outside the model until a timed run appears.

## What this means when you run

- **Route the unverified fast pieces** once they test clean, because the safe route tops out near 7:10.
- **Spend practice on the Keep and the Sanctum**, which hold 56% of the run-to-run variance.
- **Reset on the split thresholds** to double your record-pace runs per hour.

## Read further

- [What is the fastest skip-by-skip path through the raid?](/skip-level-optimal-path/)
- [What is the community sum of best for the Scorned Wilderness raid?](/community-sum-of-best-and-target-pace/)
- [Where is the Scorned Wilderness world record won?](/scorned-wilderness-world-record-data/)
- [How do you fly through Kuldra's Sanctum?](/infinite-double-jump-sanctum-flight/)

## Sources

- Raid Lab analysis, generated 3 November 2026: `data/kb/analysis/simulate.json` and `simulate.csv` (20,000 runs per profile, goal 410 s, margin 408 s, reset overhead 45 s), `model.json` (calibration, variants, priors, miss costs), `consistency.csv`, `reset-thresholds.csv`
- Run path pieces: `docs/runpath.md`, `data/kb/runpath.json`
- ***Nanobit***: "clearly can be done sub 7 judging by my sum of best, but needs very clean movement and strong zoops" ([7:01 description](https://youtu.be/doVQ9Ph256g?t=0))
- ***IINo1goodII***: "Sub 4 mins is possible. I'm confident someone could do it in around 3 minutes flat." ([video](https://youtu.be/4hncfjhUvg8?t=0))
- ***FastTipsGaming***: "my full unedited Kuldra raid and boss skip in Runescape Dragonwilds" ([Thane launch, 4:41](https://youtu.be/oK0_U_I40DY?t=281))
- ***Dotxy***: "This works mostly everywhere, happy flying friends" ([Sanctum flight](https://youtu.be/GeWbo4GpFEg?t=0))

> **Free: the Beat 6:50 Raid Lab and checklist.** Race your runs against the 6:50 and the 7:01 on one clock, loop every skip in this series and track your consistency. [Open the Raid Lab](https://drthomasager.github.io/dragonwilds-speedrun/). Join the mailing list and the printable Beat 6:50 pre-run checklist arrives with the welcome email, yours to keep.

## Key takeaways

- In 20,000 simulated runs per profile, the safe 1.0.1.2 route has a best median of 7:21.43 and a p10 of 7:10.17.
- The record on today's patch comes from the unverified fast pieces: the TexasPete Fragments line, the Thane launch and a direct flight.
- Cataclysm Keep and Kuldra's Sanctum hold 56% of the measured run-to-run variance, so they repay practice first.

***Dr. Thomas Ager***

May this writing benefit all beings.

<!-- series-nav -->
**← Previous:** [What is the fastest skip-by-skip path through the raid?](/skip-level-optimal-path/)

**Next →** [What did each patch do to the Scorned Wilderness speedrun route?](/scorned-wilderness-patch-history/)

**Series index:** [How do you beat the 6:50 Scorned Wilderness world record? A route you can run with](/how-to-beat-the-6-50-scorned-wilderness-world-record/)
<!-- /series-nav -->
