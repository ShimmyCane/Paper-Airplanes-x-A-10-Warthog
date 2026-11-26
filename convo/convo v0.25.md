# Convo v0.25 — rings, the course, the road, and speed

Date: 2026-11-26. Follows `convo v0.24.md`.

Jimmy:
- Mission 2 should be different: the rings need to be much higher, so I can really learn how to fly.
- Instead of a dot at the end of the dots, make it a big circle to fly through.
- Start with really big circles at a little distance, and make them smaller as you progress, past about 10 or 20.
- The path should not be a perfectly straight line.
- The map should be more playful: more hills, some bridges, streets some wider and some narrower, not all straight.
- Boost doesn't seem to work. I should be flying really fast with the throttle up. Is the knots a real limit, or can it be exaggerated?

## Answers and what was done

1. **Rings (mission 2):** twenty rings, 60–110 m above the ground. The first is 70 m across and 520 m out; each one is 3 m smaller than the last until it reaches 12 m. The course wanders left and right, and each ring faces the next.
2. **End of the dots:** the fiftieth dot is now a big ring, 60 m across.
3. **Boost and knots:** the answer is that the engine was too weak. Boost peaked at about 125 knots and then fell away as the plane climbed, because the thrust could not beat the drag at speed. The engine is now stronger (`maxThrust` 16 in `src/flight.ts`). Boost reaches about 250 knots level, and the default lever about 190. I chose this speed on purpose: it is faster than the real A-10's cruise, to make the game feel fast. It is a number to change, not a physical law.
4. **Roads:** the main road meanders (its centre swings about 70 m east and west over a few kilometres), and it is wider in some stretches and narrower in others. Vehicles on it follow the bends. Where the road crosses a lake it is drawn as a bridge deck with rails.

## Not done

- **Hills.** The ground is still flat, and the plane's floor, the ground painting and object placement all assume that. Real hills need a height field used by all three. That is a bigger change than this round; it is the next increment.
- **Bridges as objects.** The bridges are the road drawn over the water, not a separate model. A proper bridge with piers is for later.

## Questions

1. Is 250 knots at boost the right feel, or do you want faster or slower?
2. Should the hills come next, with the height field? Or do you want the rings and course checked on the iPad first?
3. Should the rings' size and height be a setting in ⚙️, or fixed as they are?
