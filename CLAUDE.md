# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

The app lives entirely in `hh-sim/`. Run all commands from that directory. The root `HodgkinHuxley.jsx` and `hh-sim/legacy/HodgkinHuxley.jsx` are the original single-file component (~520 lines) kept as the physics source of truth — do not edit them expecting changes in the app; port to `hh-sim/src/` instead.

## Commands (run from `hh-sim/`)

```bash
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build
npm run typecheck    # tsc -b --noEmit
npm run lint         # eslint .
npm run test         # vitest (watch mode)
npm run test:run     # vitest (single run)
npm run coverage     # vitest run --coverage
```

Run a single test file: `npx vitest run src/sim/hh.test.ts`

## Architecture

**Engine vs. UI split** — `src/sim/` is pure, React-free physics with 100% test coverage:
- `hh.ts` — HH constants, gating rate functions, derivative computation
- `integrators.ts` — forward Euler and RK4 integrators
- `presets.ts` — named parameter sets (rest, single spike, spike train, etc.)
- `types.ts` — `HHState`, `HHParams`, `Sample` interfaces

**UI layer:**
- `hooks/useSimulation.ts` — rAF animation loop, ring buffers, stimulus protocols, localStorage persistence (`hh-sim.control.v1`)
- `components/Scope.tsx`, `PhasePlane.tsx` — imperative canvas panels driven by ref handles, not React state
- `components/Controls.tsx`, `Readouts.tsx`, `Splash.tsx`, `IFCurve.tsx`, `SteadyState.tsx`
- `lib/exportCsv.ts`, `lib/scopeDraw.ts`, `lib/iFCurve.ts`

**Animation loop invariant:** the rAF loop reads live controls from a ref (synced via `useEffect`) and draws via imperative canvas handles. Only the readouts call `setState`, throttled to every 5th frame. Do not introduce React re-renders inside the loop.

## Key implementation details

**Singularity guards** in `hh.ts`: `alphaN` at V=−55 uses analytic limit 0.1; `alphaM` at V=−40 uses analytic limit 1.0. Keep these.

**Spike detection:** upward crossing of 0 mV with −10 mV re-arm hysteresis.

**Temperature scaling:** `φ = Q10^((T−6.3)/10)`, applied to all gating rates. `Q10=3.0`, `T_REF=6.3 °C`.

**Timing defaults:** forward Euler, `DT = 0.01 ms`; 50 ms scrolling window; `SAMPLE_DT = 0.1 ms`, 6 samples/frame. `stepsPerSample = round(SAMPLE_DT/dt)` keeps sim speed constant when dt changes.

**Stimulus protocols** (`step`/`train`/`ramp`) are computed inside `useSimulation`'s `stimulus()` function; `firePulse` stacks on top.

## Toolchain gotchas

- **Vite v8 (rolldown) + Vitest v4** — these are pinned intentionally. Vitest 3 bundles its own Vite 7 (rollup) and breaks `@vitejs/plugin-react` types. Keep `vitest` and `@vitest/coverage-v8` on the same major.
- **`react-hooks/refs` rule (eslint-plugin-react-hooks v7)** forbids reading/writing `ref.current` during render. Consequences: the control→loop mirror is synced in a `useEffect`, and hook returns must be destructured (`const { vmRef } = useSimulation()`) rather than accessed as `sim.vmRef` in JSX.
- **jsdom has no canvas 2D context** — `src/test/setup.ts` stubs `HTMLCanvasElement.prototype.getContext`, sets default `clientWidth/clientHeight`, and polyfills `requestAnimationFrame` with a global `flushRaf()` helper. The `canvas` npm package is installed for this.
