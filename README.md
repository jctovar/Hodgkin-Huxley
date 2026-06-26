# Simulador de Hodgkin–Huxley

[![Deploy to GitHub Pages](https://github.com/jctovar/Hodgkin-Huxley/actions/workflows/pages.yml/badge.svg)](https://github.com/jctovar/Hodgkin-Huxley/actions/workflows/pages.yml)
[![Release](https://github.com/jctovar/Hodgkin-Huxley/actions/workflows/release.yml/badge.svg)](https://github.com/jctovar/Hodgkin-Huxley/releases)
[![latest release](https://img.shields.io/github/v/release/jctovar/Hodgkin-Huxley)](https://github.com/jctovar/Hodgkin-Huxley/releases)

> **Demo en vivo:** https://jctovar.github.io/Hodgkin-Huxley/

Simulador interactivo del **potencial de acción de una neurona** según el modelo de
Hodgkin & Huxley (1952), a fidelidad biofísica completa. La interfaz imita un
osciloscopio de electrofisiología: la traza de potencial de membrana (Vₘ) es la
protagonista, y cada canal iónico tiene su color (Na⁺ coral, K⁺ turquesa, fuga
verde oliva). Está pensado tanto para la exploración cualitativa como para el
análisis cuantitativo (exportación de datos, curvas I–F, plano de fase).

> La especificación completa (ecuaciones, constantes, arquitectura y plan) está en
> [`DEVELOPMENT.md`](./DEVELOPMENT.md). El componente original de referencia es
> [`HodgkinHuxley.jsx`](./HodgkinHuxley.jsx) (también en `hh-sim/legacy/`).

---

## Características

**Pantalla de inicio institucional** (splash) con el logo y crédito, que se cierra
sola (clic / `Enter` / `Escape` o auto-cierre) y respeta `prefers-reduced-motion`.

**Visualización en tiempo real** (6 paneles sobre `<canvas>`, dibujo imperativo sin
re-renders de React):

- **Potencial de membrana Vₘ** — traza ámbar con halo tipo fósforo, líneas de 0 mV y umbral.
- **Corrientes iónicas** — I_Na, I_K e I_fuga con autoescala simétrica.
- **Compuertas** — m, h, n (0–1).
- **Plano de fase Vₘ–n** — muestra el ciclo límite durante el disparo repetitivo, con la nulclina n∞(V).
- **Activación en estado estacionario** — x∞(V) y constantes de tiempo τ(V).
- **Curva I–F** — frecuencia de disparo frente a corriente inyectada (calculada bajo demanda).

**Controles:**

- Corriente inyectada continua I, conductancias máximas ḡNa y ḡK, y temperatura T
  (con el factor φ = Q10^((T−6.3)/10) mostrado en vivo).
- Selector de **integrador** (Euler / RK4 de 4.º orden) y de **Δt**.
- **Protocolos de estímulo**: escalón, tren de pulsos (50 Hz) y rampa.
- Botón de **pulso manual**, play/pausa, reinicio y los 5 escenarios (presets).
- **Grabación** y **exportación a CSV** de la ventana (o de toda la grabación).
- Persistencia de los parámetros en `localStorage`.

**Presets:** Reposo · Un disparo · Tren de disparos · Templado (28 °C) · TTX parcial (ḡNa↓).

---

## El modelo

```text
Cm·dVₘ/dt = I_stim − I_Na − I_K − I_fuga
I_Na   = ḡNa · m³ · h · (Vₘ − E_Na)
I_K    = ḡK  · n⁴ · (Vₘ − E_K)
I_fuga = ḡfuga · (Vₘ − E_fuga)

dm/dt = φ · (αₘ(V)·(1−m) − βₘ(V)·m)      (análogo para h, n)
```

| Parámetro | Valor | Unidad |
| --------- | ----- | ------ |
| Cm | 1.0 | µF/cm² |
| E_Na | 50 | mV |
| E_K | −77 | mV |
| E_fuga | −54.387 | mV |
| ḡfuga | 0.3 | mS/cm² |
| Q10 | 3.0 | — |
| T_ref | 6.3 | °C |

Detalles numéricos relevantes:

- **Integrador:** Euler hacia adelante por defecto (`Δt = 0.01 ms`); RK4 disponible.
- **Ventana:** osciloscopio deslizante de 50 ms; 6 muestras por frame (≈0.6 ms simulados/frame).
- **Singulares:** αₙ (V = −55 → 0.1) y αₘ (V = −40 → 1.0) usan su límite analítico donde `1 − exp(·)` se anula.
- **Detección de espigas:** cruce ascendente de 0 mV con histéresis de re-arme en −10 mV.
- **Escalado por temperatura:** φ = Q10^((T − 6.3)/10), aplicado a todas las tasas de compuerta.

Convención moderna, reposo ≈ −65 mV.

---

## Stack tecnológico

- **Vite 8** + **React 19** + **TypeScript**
- **Vitest 4** (jsdom) + **@testing-library/react** + `canvas`
- **ESLint** (con `eslint-plugin-react-hooks` v7)

---

## Puesta en marcha

Toda la app está en [`hh-sim/`](./hh-sim). Desde esa carpeta:

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # typecheck (tsc -b) + build de producción
npm run preview    # previsualizar el build
```

> Requiere Node 20+ (probado con Node 22).

---

## Tests

```bash
npm run test       # vitest en modo watch
npm run test:run   # una pasada
npm run coverage   # cobertura
```

Un único archivo: `npx vitest run src/sim/hh.test.ts`.

El **núcleo numérico** (`src/sim/` y `src/lib/`) está al **100 % de cobertura** e
incluye el test de regresión de DEVELOPMENT.md §4.1 (RK4 con Δt = 0.025 ms frente a
Euler con Δt = 0.01 ms → coincidencia en el pico dentro de ±0.5 mV), además de
tests de umbral de disparo, efecto de la temperatura y forma de la espiga.

---

## Estructura del proyecto

```text
.
├── HodgkinHuxley.jsx          # componente original (referencia, ~520 líneas)
├── DEVELOPMENT.md             # especificación del proyecto (español)
├── AGENTS.md                  # notas para asistentes de IA que editen el repo
├── .github/workflows/         # CI: pages.yml (deploy) + release.yml (versiones)
└── hh-sim/                    # la app (Vite + React + TS)
    ├── legacy/HodgkinHuxley.jsx
    └── src/
        ├── sim/               # motor de simulación puro (sin React, 100% testeado)
        │   ├── hh.ts              # constantes, tasas, derivadas, corriente, φ
        │   ├── integrators.ts     # euler + rk4
        │   ├── presets.ts         # control por defecto + escenarios
        │   └── types.ts
        ├── components/        # Splash, Scope, PhasePlane, SteadyState, IFCurve, Controls, Readouts
        ├── hooks/useSimulation.ts   # bucle rAF, buffers, refs, estímulos
        ├── lib/               # scopeDraw, exportCsv, iFCurve
        └── styles/theme.ts    # paleta de colores
```

---

## Arquitectura

- **Separación motor / UI:** `src/sim/` es física pura, sin React y totalmente
  testeable. La UI vive en `src/components/`, `src/hooks/` y `src/lib/`.
- **El bucle de animación nunca provoca re-renders de React.** El `useSimulation`
  lee los controles desde un `ref` (sincronizado en un `useEffect`) y dibuja de
  forma imperativa a través de los handles de `Scope`/`PhasePlane`; solo el readout
  hace `setState`, y estrangulado a 1 de cada 5 frames.
- **Dibujo en `<canvas>`**, no DOM/SVG, para mantener 60 fps con varios paneles.

---

## Despliegue y releases

La app se publica automáticamente mediante GitHub Actions (no hay servidor: es un
sitio estático generado por Vite).

- **GitHub Pages** — en cada *push* a `main`, el workflow
  [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) ejecuta
  `lint → typecheck → tests → build` y, si todo pasa, despliega a
  **https://jctovar.github.io/Hodgkin-Huxley/** (con `base: '/Hodgkin-Huxley/'`).
- **Releases** — al crear un tag `vX.Y.Z`, el workflow
  [`.github/workflows/release.yml`](./.github/workflows/release.yml) compila y
  publica un [release](https://github.com/jctovar/Hodgkin-Huxley/releases) con el
  `dist/` empaquetado (`hh-sim-dist.zip` / `.tar.gz`) y *changelog* autogenerado.

Para generar una nueva versión:

```bash
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
```

---

## Estado y roadmap

Migración desde el `.jsx` monolítico completada y **desplegada en producción**
(GitHub Pages + releases por tag). Implementado: integrador RK4, exportación CSV,
plano de fase, curva I–F, panel de activación estacionaria, protocolos de estímulo,
persistencia, accesibilidad básica y pantalla de inicio institucional.

Pendiente (DEVELOPMENT.md §4.4): `OffscreenCanvas`/Web Worker para grabaciones muy
largas, nulclinas adicionales en el plano de fase y más tests de regresión.

---

## Referencias

- Hodgkin, A. L. & Huxley, A. F. (1952). *A quantitative description of membrane
  current and its application to conduction and excitation in nerve.* Journal of
  Physiology, 117(4), 500–544.
