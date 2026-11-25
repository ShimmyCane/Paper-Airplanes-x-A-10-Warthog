# Graphics: recursive increments (0.23)

Goal: a flight simulator about the beauty of the world from the air. Five increments, one or two
things each, checked in a screenshot before the next. Each one is a commit; the screenshot is
the review.

| # | Increment | What changed | Status |
|---|-----------|--------------|--------|
| 1 | Resolution | Canvas 960×540 (four times the pixels). Layout still in 480×270 units; the ground and sky are painted per device pixel. | done (0.23) |
| 2 | Farmland | Smaller, varied field plots with hedges between them; more crops (maize, stubble, rapeseed) and a shade per plot. | done (0.23) |
| 3 | Minor roads | Country lanes on a loose grid (430 m and 510 m) across farm and open land, with edge lines and verges; they stop at the main road, the rail, towns, forest and water. | done (0.23) |
| 4 | Houses and ponds | Villages of three or four houses and barns in farm cells; ponds with sandy rims in the fields (placed by hash, the same every flight). | done (0.23) |
| 5 | Railway | Gravel ballast either side of the track; a level crossing where each lane meets the line. | done (0.23) |

## Notes

- Frame rate: the 960×540 build is about half as fast in headless software rendering (53 → 25 fps
  in one scene). `halfGround` in `render.ts` already drops to every other column on a slow device.
  Check on an iPad before going further.
- Neutral things are never targets: `isHostile` in `src/world.ts`.
- Next round, not done: a second track or siding, a station on the line, the lanes' hedges, and
  a river. Sprite detail still uses the old voxel size (drawn 2× larger), so the models are not yet
  finer than before; that is the next resolution step.
