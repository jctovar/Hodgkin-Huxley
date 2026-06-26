// Visual palette ported from legacy HodgkinHuxley.jsx. Kept as JS values
// because canvas drawing needs concrete color strings (not CSS variables).

export const C = {
  bg: '#0b0f12',
  panel: '#141b21',
  panel2: '#1a232a',
  edge: 'rgba(140,160,170,0.14)',
  grid: 'rgba(130,150,160,0.10)',
  ink: '#e9eef1',
  muted: '#7d8e98',
  vm: '#ffd166', // membrane potential — amber hero trace
  na: '#ff6b5c', // sodium — coral (inward, "hot")
  k: '#34c8b6', // potassium — teal (outward, "cool")
  leak: '#9aa890', // leak — sage
  stim: '#a78bfa', // injected current — violet
  hGate: '#ff9d72', // h (Na inactivation)
} as const

export type Color = (typeof C)[keyof typeof C]

/** Scope drawing theme: the few palette entries the canvas needs. */
export const SCOPE_THEME = {
  grid: C.grid,
  muted: C.muted,
  ink: C.ink,
  edge: C.edge,
} as const
