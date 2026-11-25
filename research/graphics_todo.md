# Graphics: recursive increments (0.23)

Goal: a flight simulator about the beauty of the world from the air. Five increments, one or two
things each, checked in a screenshot before the next. Each one is a commit; the screenshot is
the review.

| # | Increment | What changed | Status |
|---|-----------|--------------|--------|
| 1 | Resolution | Canvas 960×540 (four times the pixels). Layout still in 480×270 units; the ground and sky are painted per device pixel. | done (0.23) |
| 2 | Farmland | Smaller, varied field plots with ditch boundaries and furrow rows up close; more crop colours. | planned |
| 3 | Minor roads | Country lanes on a grid across farm and open land, with edge lines and verges; they stop at the main road, the rail and towns. | planned |
| 4 | Houses and ponds | Houses (a small voxel model, neutral) in farm clusters; small ponds with reed rims in the fields. | planned |
| 5 | Railway | A level crossing where lanes meet the line, ballast along the track. | planned |

## Notes

- Frame rate: the 960×540 build is about half as fast in headless software rendering (53 → 25 fps
  in one scene). `halfGround` in `render.ts` already drops to every other column on a slow device.
  Check on an iPad before going further.
- Neutral things are never targets: `isHostile` in `src/world.ts`.
