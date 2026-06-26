# AGENTS.md

Interactive Hodgkin–Huxley neuron action-potential simulator. See `DEVELOPMENT.md`
for the full spec (Spanish): equations, constants, architecture, and prioritized
plan with acceptance criteria.

## Layout — read first

- **The app lives in `hh-sim/`** (Vite + React 19 + TypeScript + Vitest). Run all
  commands from there. It was scaffolded with `create-vite` (react-ts template).
- The root `HodgkinHuxley.jsx` is the **legacy** single-file component (~520 lines),
  kept as the physics source of truth; a copy is at `hh-sim/legacy/`. Do not edit the
  legacy `.jsx` expecting changes in the app — port to `hh-sim/src/`.
- No git repo. No branch/commit/PR conventions apply.

## Commands (run inside `hh-sim/`)

```bash
npm run dev          # vite dev server
npm run build        # tsc -b && vite build  (typecheck is part of build)
npm run typecheck    # tsc -b --noEmit
npm run lint         # eslint .
npm run test         # vitest (watch)   |  npm run test:run  (once)
npm run coverage     # vitest run --coverage
```

A single test file: `npx vitest run src/sim/hh.test.ts`.

## Toolchain gotchas (hard-won)

- **Vite is v8 (rolldown).** Vitest must be **v4** — vitest 3 bundles its own vite 7
  (rollup) and breaks the `@vitejs/plugin-react` types. They are pinned in
  `package.json`; keep `vitest` and `@vitest/coverage-v8` on the same major.
- **`react-hooks/refs` (eslint-plugin-react-hooks v7) forbids reading/writing
  `ref.current` during render.** Two consequences in this codebase:
  - The control→loop mirror is synced in a `useEffect`, not assigned during render.
  - Destructure the hook's return (`const { vmRef, … } = useSimulation()`) instead of
    accessing `sim.vmRef` in JSX; member access on the returned object trips the rule.
- **jsdom has no `<canvas>` 2D context.** `src/test/setup.ts` stubs
  `HTMLCanvasElement.prototype.getContext` and gives canvases default
  `clientWidth/clientHeight`; it also polyfills `requestAnimationFrame` + a global
  `flushRaf()` helper to drive the animation loop in tests. `canvas` is installed.

## Architecture (non-obvious)

- **Engine vs. UI split:** `src/sim/` is pure, React-free, 100%-covered physics
  (`hh.ts` constants/rates/deriv, `integrators.ts` euler+rk4, `presets.ts`,
  `types.ts`). `src/components/`, `src/hooks/useSimulation.ts`, `src/lib/` are UI.
- **Animation loop never triggers React re-renders.** The `useSimulation` rAF loop
  reads live controls from a ref (synced via effect) and draws via imperative
  `Scope`/`PhasePlane` handles; only the readout `setState`s, throttled to every 5th
  frame. Preserve this if you touch the loop.
- **Timing:** forward Euler by default, `DT = 0.01 ms`; 50 ms scrolling window;
  `SAMPLE_DT = 0.1 ms`, 6 samples/frame (≈0.6 ms simulated per frame). RK4 + Δt are
  UI-selectable; `stepsPerSample = round(SAMPLE_DT/dt)` keeps sim speed constant.
- **Singularity guards:** `alphaN` (V=−55 → 0.1) and `alphaM` (V=−40 → 1.0) use
  analytic limits where `1 − exp(...)` vanishes. Keep them.
- **Spike detection:** upward crossing of 0 mV with −10 mV re-arm hysteresis.
- **Temperature scaling:** `φ = Q10^((T−6.3)/10)`, applied to all gating rates.
- **Stimulus protocols** (`step`/`train`/`ramp`) are computed in `useSimulation`'s
  `stimulus()`; a manual pulse (`firePulse`) stacks on top.
- Control params persist to `localStorage` (`hh-sim.control.v1`).

## Constants (modern convention, rest ≈ −65 mV)

`Cm=1.0`, `ENa=50`, `EK=−77`, `EL=−54.387` mV; `gL=0.3` mS/cm²; `Q10=3.0`,
`T_REF=6.3 °C`. All defined in `hh-sim/src/sim/hh.ts`.
