# Simulador Hodgkin–Huxley — Guía de desarrollo

Documento de trabajo para continuar el proyecto desde **Claude Code**. Describe
el estado actual, la arquitectura objetivo (Vite + React + TypeScript) y un plan
de mejoras priorizado con criterios de aceptación.

---

## 1. Resumen del proyecto

Web app interactiva que simula el **potencial de acción de una neurona** con el
modelo de Hodgkin–Huxley (HH, 1952) a fidelidad biofísica completa. La interfaz
imita un osciloscopio de electrofisiología: la traza de Vₘ es la protagonista y
cada canal iónico tiene su color (Na⁺ coral, K⁺ turquesa, fuga sage).

- **Stack actual:** React (componente `.jsx` ejecutable, JavaScript).
- **Stack objetivo:** Vite + React + **TypeScript**, con la física separada en
  un módulo tipado.
- **Dominio:** electrofisiología / modelado biofísico de neuronas.

---

## 2. Estado actual

Existe un componente funcional completo: `HodgkinHuxley.jsx`. Resumen de su
implementación:

- **Integrador:** Euler hacia adelante (forward Euler), `dt = 0.01 ms`.
- **Render:** canvas (no DOM/SVG) con ventana tipo osciloscopio deslizante de
  `50 ms`. Se evita re-render de React durante la animación: los controles se
  leen desde refs dentro del bucle `requestAnimationFrame`.
- **Visualizaciones simultáneas (3 paneles):**
  - Potencial de membrana Vₘ (ámbar) con líneas de 0 mV y umbral.
  - Corrientes iónicas I_Na (coral), I_K (turquesa), I_fuga (sage), con
    autoescala simétrica.
  - Compuertas m, h, n (0–1).
- **Controles:** corriente de estímulo continuo, botón de pulso, ḡNa, ḡK,
  temperatura (factor Q10 → φ), play/pausa, reinicio.
- **Lecturas en vivo:** Vₘ, contador de espigas, I_Na, I_K, barras de m/h/n.
- **Presets:** reposo, un disparo, tren de disparos, templado (28 °C), bloqueo
  parcial tipo TTX (ḡNa↓).
- **Detalles numéricos:** singularidades de αₘ (en V=−40) y αₙ (en V=−55)
  resueltas con su límite analítico; detección de espiga por cruce ascendente de
  0 mV; escalado por temperatura vía φ = Q10^((T−6.3)/10).

### 2.1 Ecuaciones del modelo

```text
Cm·dVₘ/dt = I_stim − I_Na − I_K − I_fuga
I_Na  = ḡNa · m³ · h · (Vₘ − E_Na)
I_K   = ḡK  · n⁴ · (Vₘ − E_K)
I_fuga= ḡfuga · (Vₘ − E_fuga)

dm/dt = φ · (αₘ(V)·(1−m) − βₘ(V)·m)
dh/dt = φ · (αₕ(V)·(1−h) − βₕ(V)·h)
dn/dt = φ · (αₙ(V)·(1−n) − βₙ(V)·n)
```

Constantes (convención moderna, reposo ≈ −65 mV):

| Parámetro | Valor | Unidad |
| --------- | ----- | ------ |
| Cm        | 1.0   | µF/cm² |
| E_Na      | 50    | mV     |
| E_K       | −77   | mV     |
| E_fuga    | −54.387 | mV   |
| ḡfuga     | 0.3   | mS/cm² |
| Q10       | 3.0   | —      |
| T_ref     | 6.3   | °C     |

Funciones de tasa (V en mV, tasas en 1/ms):

```text
αₙ = 0.01·(V+55) / (1 − exp(−(V+55)/10))      límite en V=−55 → 0.1
βₙ = 0.125·exp(−(V+65)/80)
αₘ = 0.1·(V+40) / (1 − exp(−(V+40)/10))        límite en V=−40 → 1.0
βₘ = 4·exp(−(V+65)/18)
αₕ = 0.07·exp(−(V+65)/20)
βₕ = 1 / (1 + exp(−(V+35)/10))
```

---

## 3. Arquitectura objetivo (Vite + React + TS)

Separar el **motor de simulación** (puro, testeable, sin React) de la **UI**.

### 3.1 Estructura de carpetas propuesta

```text
hh-sim/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── sim/
    │   ├── hh.ts            # constantes, tasas, derivadas (puro)
    │   ├── integrators.ts   # euler, rk4
    │   ├── types.ts         # State, Params, Sample
    │   └── hh.test.ts       # tests unitarios (Vitest)
    ├── components/
    │   ├── Scope.tsx        # canvas reutilizable (1 panel)
    │   ├── PhasePlane.tsx   # gráfico de fase Vₘ–n
    │   ├── Controls.tsx     # sliders + botones + presets
    │   └── Readouts.tsx     # lecturas y barras de compuertas
    ├── hooks/
    │   └── useSimulation.ts # bucle rAF, buffers, estado de controles
    ├── lib/
    │   └── exportCsv.ts     # exportación de datos
    └── styles/
        └── tokens.css       # variables de color / tipografía
```

### 3.2 Tipos base (borrador)

```typescript
// src/sim/types.ts
export interface HHParams {
  gNa: number;   // mS/cm²
  gK: number;    // mS/cm²
  gL: number;    // mS/cm²
  temp: number;  // °C
  iStim: number; // µA/cm²
}

export interface HHState {
  V: number; // mV
  m: number;
  h: number;
  n: number;
}

export interface Sample extends HHState {
  t: number;    // ms
  iNa: number;  // µA/cm²
  iK: number;
  iL: number;
}
```

### 3.3 Pasos de migración

1. Crear el proyecto: `npm create vite@latest hh-sim -- --template react-ts`.
2. Portar la física de `HodgkinHuxley.jsx` a `src/sim/hh.ts` con tipos.
3. Extraer `Scope` como componente tipado que recibe `series`, `yRange` y
   etiquetas por props.
4. Mover el bucle `requestAnimationFrame` y los buffers a `useSimulation.ts`.
5. Conectar `Controls`, `Readouts` y los `Scope` en `App.tsx`.
6. Añadir Vitest y los primeros tests de `hh.ts`.

> Nota: las ecuaciones son idénticas entre la versión `.jsx` actual y la `.ts`;
> la migración es de tipado y organización, no de matemática.

---

## 4. Plan de mejoras

Priorizado. Cada tarea incluye objetivo, enfoque y criterios de aceptación.

### 4.1 Integrador RK4 (mayor precisión) — prioridad alta

- **Objetivo:** sustituir/alternar Euler por Runge–Kutta de 4.º orden para
  reducir el error de truncamiento y permitir pasos `dt` mayores con la misma
  estabilidad.
- **Enfoque:**
  - Definir la derivada como función pura
    `deriv(state, params, phi) => {dV, dm, dh, dn}` en `hh.ts`.
  - Implementar `rk4(state, params, phi, dt)` en `integrators.ts` evaluando la
    derivada en k1..k4 y combinando `(k1 + 2k2 + 2k3 + k4)/6`.
  - Exponer un selector de método en la UI (Euler / RK4) y, opcionalmente, un
    control de `dt`.
- **Criterios de aceptación:**
  - Con RK4 y `dt = 0.025 ms` la forma del potencial de acción coincide con
    Euler `dt = 0.01 ms` dentro de ±0.5 mV en el pico.
  - Test que compara amplitud y tiempo de pico de una espiga entre métodos.

```typescript
// boceto src/sim/integrators.ts
export function rk4(s: HHState, p: HHParams, phi: number, dt: number): HHState {
  const k1 = deriv(s, p, phi);
  const k2 = deriv(add(s, k1, dt / 2), p, phi);
  const k3 = deriv(add(s, k2, dt / 2), p, phi);
  const k4 = deriv(add(s, k3, dt), p, phi);
  return {
    V: s.V + (dt / 6) * (k1.dV + 2 * k2.dV + 2 * k3.dV + k4.dV),
    m: s.m + (dt / 6) * (k1.dm + 2 * k2.dm + 2 * k3.dm + k4.dm),
    h: s.h + (dt / 6) * (k1.dh + 2 * k2.dh + 2 * k3.dh + k4.dh),
    n: s.n + (dt / 6) * (k1.dn + 2 * k2.dn + 2 * k3.dn + k4.dn),
  };
}
```

### 4.2 Exportar datos a CSV — prioridad alta

- **Objetivo:** descargar la ventana simulada (o una grabación continua) como
  CSV para analizar en Python/R/Excel.
- **Enfoque:**
  - Mantener un buffer de muestras `Sample[]` (ya existe en forma de arrays
    paralelos; consolidar en objetos o documentar el orden de columnas).
  - `exportCsv(samples)` genera cabecera `t,V,m,h,n,iNa,iK,iL` y dispara la
    descarga vía `Blob` + `URL.createObjectURL`.
  - Botón "Exportar CSV" en `Controls`; opción de "grabar" para acumular más
    allá de la ventana de 50 ms.
- **Criterios de aceptación:**
  - El archivo abre correctamente con cabecera y N filas = nº de muestras.
  - Valores numéricos con precisión razonable (p. ej. 4–6 decimales) y punto
    decimal (locale-independiente).

```typescript
// boceto src/lib/exportCsv.ts
export function exportCsv(samples: Sample[], filename = "hh_sim.csv") {
  const header = "t,V,m,h,n,iNa,iK,iL";
  const rows = samples.map((s) =>
    [s.t, s.V, s.m, s.h, s.n, s.iNa, s.iK, s.iL]
      .map((x) => x.toFixed(6)).join(",")
  );
  const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

### 4.3 Gráfico de fase Vₘ–n — prioridad media

- **Objetivo:** visualizar la trayectoria en el plano de fase con Vₘ en X y la
  compuerta n en Y, útil para ver el ciclo límite durante disparos repetitivos.
- **Enfoque:**
  - Nuevo componente `PhasePlane.tsx` (canvas) que dibuja la trayectoria
    `(V[i], n[i])` con desvanecimiento del rastro antiguo (alpha decreciente).
  - Punto resaltado para el estado actual.
  - Opcional: nulclinas dV/dt = 0 y dn/dt = 0 como curvas de referencia para
    interpretación cualitativa.
- **Criterios de aceptación:**
  - Con corriente supraumbral continua, la trayectoria forma un lazo cerrado
    (ciclo límite) visible.
  - Ejes etiquetados (Vₘ en mV, n adimensional) y escalas fijas legibles.

### 4.4 Mejoras adicionales (backlog)

- **Selector de `dt` y método** desde la UI con aviso de estabilidad.
- **Protocolos de estímulo** configurables: escalón, rampa, tren de pulsos,
  ruido — además del pulso único actual.
- **Curva I–F** (frecuencia de disparo vs corriente inyectada) calculada en
  segundo plano.
- **Curvas de activación en estado estacionario** m∞(V), h∞(V), n∞(V) y
  constantes de tiempo τ(V) como panel didáctico.
- **Persistencia** de parámetros/escenarios en `localStorage` (fuera de
  artifacts; válido en la app Vite).
- **Accesibilidad:** foco visible, navegación por teclado en sliders, respeto a
  `prefers-reduced-motion`, etiquetas ARIA en controles.
- **Tests** de regresión sobre forma de espiga, umbral de disparo y efecto de
  temperatura.
- **Rendimiento:** considerar `OffscreenCanvas` / Web Worker si se añaden más
  paneles o grabaciones largas.

---

## 5. Cómo arrancar (Claude Code)

```bash
# 1. crear proyecto
npm create vite@latest hh-sim -- --template react-ts
cd hh-sim && npm install

# 2. tests
npm install -D vitest
npx vitest

# 3. desarrollo
npm run dev
```

Sugerencia de orden de trabajo: migrar la física a `hh.ts` con tests (sección
3.3) → RK4 (4.1) → CSV (4.2) → plano de fase (4.3) → backlog (4.4).

---

## 6. Despliegue detrás de un proxy inverso (nginx / Apache)

El build de producción está configurado con `base: '/Hodgkin-Huxley/'` en
`vite.config.ts`. Todos los assets, el manifest y las rutas internas asumen
ese prefijo, por lo que el proxy debe servir los archivos exactamente en esa
subruta.

### Paso 1 — generar el build

```bash
cd hh-sim
npm run build   # genera hh-sim/dist/
```

Copia el contenido de `dist/` al directorio raíz que servirá el proxy:

```bash
# ejemplo: /var/www/hodgkin-huxley/
sudo cp -r dist/* /var/www/hodgkin-huxley/
```

### Paso 2 — nginx

```nginx
server {
    listen 80;
    server_name tu-dominio.example.com;

    # Redirigir HTTP → HTTPS si usas TLS
    # return 301 https://$host$request_uri;

    location /Hodgkin-Huxley/ {
        alias /var/www/hodgkin-huxley/;

        # La app no usa enrutamiento cliente (no hay React Router),
        # pero el fallback a index.html evita 404 en recarga directa.
        try_files $uri $uri/ /Hodgkin-Huxley/index.html;

        # Cabeceras de caché recomendadas para SPA estática
        location ~* \.(js|css|svg|ico|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

Con TLS (bloque `server` adicional que escucha en 443 + `ssl_certificate`).

### Paso 2 — Apache

Habilita `mod_alias` y `mod_rewrite`:

```bash
sudo a2enmod alias rewrite
```

`VirtualHost` o `.htaccess` en `/var/www/hodgkin-huxley/`:

**Opción A — VirtualHost:**

```apache
<VirtualHost *:80>
    ServerName tu-dominio.example.com

    Alias /Hodgkin-Huxley /var/www/hodgkin-huxley

    <Directory /var/www/hodgkin-huxley>
        Options -Indexes
        AllowOverride None
        Require all granted

        # Fallback a index.html para recarga directa
        FallbackResource /Hodgkin-Huxley/index.html
    </Directory>

    # Caché agresiva para assets con hash en el nombre
    <FilesMatch "\.(js|css|svg|ico|woff2?)$">
        Header set Cache-Control "max-age=31536000, public, immutable"
    </FilesMatch>
</VirtualHost>
```

**Opción B — `.htaccess`** (si no tienes acceso al VirtualHost):

```apache
Options -Indexes
FallbackResource /Hodgkin-Huxley/index.html
```

### Nota sobre la subruta

Si necesitas servir la app en la raíz del dominio (`/`) en lugar de
`/Hodgkin-Huxley/`, cambia en `vite.config.ts`:

```ts
base: command === 'build' ? '/' : '/',
```

y ajusta en consecuencia la configuración del proxy.

---

## 7. Referencias

- Hodgkin, A. L. & Huxley, A. F. (1952). *A quantitative description of membrane
  current and its application to conduction and excitation in nerve.* Journal of
  Physiology, 117(4), 500–544.
- Convención de parámetros: forma "moderna" con reposo ≈ −65 mV (la usada en el
  código actual).
