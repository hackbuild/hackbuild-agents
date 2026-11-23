# Browser checks

Checks that need a real browser, a real frame rate or a person looking,
drawn from each package README's "Not verified by anything" list. Each row
says pass, fail or not run, and why.

The automated pass ran on 2026-11-23, and again after the audit fix pass
the same day for the rows marked so: Chrome 150.0.7871.125, headful, on
an Apple M1 (macOS 12) with the real GPU (WebGL renderer ANGLE Metal, Apple
M1; WebGPU adapter vendor apple, architecture common-3, shader-f16), driven
by `tools/check-examples.mjs` over the example pages built by
`tools/build-examples.mjs`. The automated pass measured these numbers; the
owner has not looked yet. Screenshots go to `.local/shots/` (gitignored).
Rows that need a person stay not run until someone looks and writes the
date and their name here.

Rerun: `npm run build && npm run examples && npm run examples:check`.

| # | package | check | status | result |
|---|---|---|---|---|
| 1 | senses | eye, saliency and plume at real frame rate on the real GPU | pass | 2026-11-23 rerun after the fix pass: 59.88 fps p50, frame p95 18.3 ms, page work p95 4.5 ms; saliency update 1.5 ms p50, 4.5 ms p95 with the 160 by 80 readback; eye pass 1.6 ms p50, 4.3 ms p95 (measured). First pass: 59.88 fps, frame p95 17.4 ms |
| 2 | senses | saliency fixation on a scene with objects | pass, varies | 2026-11-23, three runs after the fix pass: 16 of 21, 12 of 24, and 0 of 7 in a run where the machine was loaded (420 frames, 27 eye passes); first pass 15 of 18 (measured, bar 0.5 inferred). With the page's floor grid lines left in the eye's view it was 1 of 12 and 4 of 14 (measured): thin high contrast lines win over objects |
| 3 | senses | eye id and depth pass into the occupancy grid | pass | 2026-11-23 after the depth pass applied instancing and skinning: ball seen in 35 of 73 passes, 328 occupied cells (measured); first pass 40 of 60, 338 |
| 4 | senses | sniffer and tracker find the source on a live plume | pass | 18.8 s and 6.9 s from 5 m downwind after the fix pass; 16.9, 11.5 and 13.2 s on earlier runs (measured) |
| 5 | senses | a person looks at the eye, the plume and the saliency map at real frame rate | not run | needs the owner to look |
| 6 | senses | tracker and sniffer behaviour against the running legacy simulator | not run | needs a recorded legacy run |
| 7 | senses | `senses.iife.js` from a file:// page | pass | 2026-11-23, `packages/senses/test/fixtures/iife.html` in headless Chrome 150 with no `THREE` on the page: loads and runs Saliency. Before the eye moved to `senses-three.iife.js` it threw `ReferenceError: THREE is not defined` (measured) |
| 8 | senses | WebGPU saliency path | not run | not written |
| 9 | drives | an animal driven by drives and the chooser in a running page | pass | 5 of 5 acts chosen, 57 switches over 328 sim s, every switch logged a why; choice update 0.1 ms p95 (measured) |
| 10 | drives | a person reads the why log against the drive plot | not run | needs the owner to look |
| 11 | drives | blocking between cues | not run | not modelled; each cue learns alone |
| 12 | mover | corridor pass, parked in path, bench and a four way cross at real frame rate | pass | 2026-11-23 after the passing side fix: worst stall 0.12, 0.1, 0.19 and 0.1 s; closest gap 0.423, 0.519, 0.151 and 0.186 m; 59.88 fps p50, step work p95 0.3 ms (measured). First pass: stall 0.1, 0, 0.12 and 0.23 s; gap 0.551, 0.7, 0.152 and 0.467 m. Before the side was chosen at closest approach the four way cross overlapped by 0.126 m (measured) |
| 13 | mover | a person looks at steering, the held passing side and yields | not run | needs the owner to look |
| 14 | mover | dog-simulator corridor-pass and parked-in-path seed 21 with a moving dog | not run | needs those scenarios moved onto this package |
| 15 | mover | turn rate limits with heading dynamics | not run | the page moves agents with a 0.15 s velocity lag and no heading dynamics, like the tests |
| 16 | cameras | follow, group, orbit, first person and split views at real frame rate | pass | 59.88 fps p50 in each, frame p95 17.3 to 17.4 ms, controller work p95 0.1 to 0.2 ms (measured) |
| 17 | cameras | follow pulls in front of walls so the dog stays in sight | pass | 767 of 781 frames pulled in, 9 frames (1.2 percent) with the dog hidden, closest 1.146 m (measured; bound 2 percent inferred) |
| 18 | cameras | group framing keeps four moving points in view | pass | 0 point frames outside over 270 frames, with the distance now solved from projected corners (measured) |
| 19 | cameras | shake feel and follow smoothing | not run | needs the owner to look; peak shake offset 0.292 m (0.224 m before shake drew knots only while shaking), decayed to 0 within 12 s (measured) |
| 20 | tunables | the panel builds and syncs the URL hash in a real browser | pass | 4 inputs built on the mover page; a set wrote `St.speed` into the hash (measured) |
| 21 | tunables | a person looks at the panel | not run | needs the owner to look; the package ships no stylesheet |
| 22 | tunables | `tunables.iife.js` from a file:// page | pass | 2026-11-23, the same fixture: a registry defines, sets and reads a value (measured) |
| 23 | tunables | import through the file input | not run | no scripted file pick in this pass |
| 24 | scenario | WebGPU in headless Chrome | not run | this pass ran headful; headful Chrome found the adapter above |
| 25 | scenario | Chrome on the ubuntu-24.04 CI image | pass | the CI unit job runs the scenario Chrome tests with the runner's `/usr/bin/google-chrome` (the 2026-11-23 log: "scenario report 2026-11-23, Chrome/157.0.8103.78"); the senses eye test now finds the same Chrome instead of skipping |

## Layout and mobile, 2026-11-23

The example pages moved onto the hackbuild-ui 0.4.3 class layer, mobile
first; the tunables panel on the mover page is styled by the page in the
same idiom (the package still ships no stylesheet). Chrome 150 on the
Apple M1, puppeteer-core, the index and the four pages at 320 px (touch),
360 px (Galaxy S9+ profile, touch), 390 px (iPhone 13 profile, touch),
768 px (touch), 1024, 1280 and 1440 px, full page screenshots in
`.local/layout/` (gitignored). At every width: no sideways scroll against
the device width; on the touch profiles every control is at least 44 px
tall and fields are 16 px (measured by the layout script). On phones the
3D view sits above the controls; from 641 px the controls go back under
the header. The cameras page orbit now also takes a one finger drag, a
two finger pinch and the wheel, the same steps the keys take. Looked at
in the screenshots by the builder; the owner has not, and no real phone
has opened the pages.

The `?auto` checks after the restyle: senses, drives, mover and cameras
pass. Senses figures move a lot between runs of the same code (the
unchanged pages gave 18 and 10 fixations, 16.35 and 9.4 s to the bowl
on two runs; the restyled page 7 and 14 fixations), so they are not
compared to the rows above.
