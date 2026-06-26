import React, { useRef, useState, useEffect, useCallback } from "react";

/*  Hodgkin–Huxley action-potential simulator
 *  Real-time integrator (forward Euler, dt = 0.01 ms) drawn on a
 *  scrolling oscilloscope. Controls feed the loop through refs so the
 *  animation never triggers React re-renders.
 *
 *  Physics (modern convention, rest ≈ -65 mV):
 *    Cm dV/dt = I_stim - gNa·m³h·(V-ENa) - gK·n⁴·(V-EK) - gL·(V-EL)
 *  Gating kinetics scaled by temperature factor φ = Q10^((T-6.3)/10).
 */

// ---- fixed biophysical constants ----
const Cm = 1.0; // µF/cm²
const ENa = 50.0; // mV
const EK = -77.0; // mV
const EL = -54.387; // mV
const gL = 0.3; // mS/cm²
const Q10 = 3.0;
const T_REF = 6.3; // °C, temperature the HH rates were measured at

// ---- gating rate functions (V in mV, rates in 1/ms) ----
// singularities at V=-55 (αn) and V=-40 (αm) handled by their analytic limits
const alphaN = (V) => {
  const x = V + 55;
  const d = 1 - Math.exp(-x / 10);
  return Math.abs(d) < 1e-7 ? 0.1 : (0.01 * x) / d;
};
const betaN = (V) => 0.125 * Math.exp(-(V + 65) / 80);
const alphaM = (V) => {
  const x = V + 40;
  const d = 1 - Math.exp(-x / 10);
  return Math.abs(d) < 1e-7 ? 1.0 : (0.1 * x) / d;
};
const betaM = (V) => 4 * Math.exp(-(V + 65) / 18);
const alphaH = (V) => 0.07 * Math.exp(-(V + 65) / 20);
const betaH = (V) => 1 / (1 + Math.exp(-(V + 35) / 10));

const xinf = (a, b) => a / (a + b);

// ---- simulation window ----
const WINDOW_MS = 50;
const SAMPLE_DT = 0.1; // ms between stored samples
const MAX_PTS = Math.round(WINDOW_MS / SAMPLE_DT); // 500
const DT = 0.01; // ms integrator step
const STEPS_PER_SAMPLE = Math.round(SAMPLE_DT / DT); // 10
const SAMPLES_PER_FRAME = 6; // ≈0.6 ms sim per animation frame

// ---- palette ----
const C = {
  bg: "#0b0f12",
  panel: "#141b21",
  panel2: "#1a232a",
  edge: "rgba(140,160,170,0.14)",
  grid: "rgba(130,150,160,0.10)",
  ink: "#e9eef1",
  muted: "#7d8e98",
  vm: "#ffd166", // membrane potential — amber hero trace
  na: "#ff6b5c", // sodium — coral (inward, "hot")
  k: "#34c8b6", // potassium — teal (outward, "cool")
  leak: "#9aa890", // leak — sage
  stim: "#a78bfa", // injected current — violet
};

const PRESETS = {
  rest: { istim: 0, gNa: 120, gK: 36, temp: 6.3, label: "Reposo" },
  single: { istim: 0, gNa: 120, gK: 36, temp: 6.3, label: "Un disparo", pulse: true },
  train: { istim: 10, gNa: 120, gK: 36, temp: 6.3, label: "Tren de disparos" },
  cooled: { istim: 12, gNa: 120, gK: 36, temp: 28, label: "Templado (28°C)" },
  block: { istim: 12, gNa: 30, gK: 36, temp: 6.3, label: "TTX parcial (gNa↓)" },
};

function restingState(gNaUnused) {
  // steady state at V0 found by relaxing; analytic init is close enough
  const V0 = -65;
  return {
    V: V0,
    m: xinf(alphaM(V0), betaM(V0)),
    h: xinf(alphaH(V0), betaH(V0)),
    n: xinf(alphaN(V0), betaN(V0)),
    iNa: 0,
    iK: 0,
    iL: 0,
  };
}

export default function HodgkinHuxley() {
  // ---- control state (drives UI; mirrored into refs for the loop) ----
  const [istim, setIstim] = useState(0);
  const [gNa, setGNa] = useState(120);
  const [gK, setGK] = useState(36);
  const [temp, setTemp] = useState(6.3);
  const [running, setRunning] = useState(true);
  const [readout, setReadout] = useState({ V: -65, m: 0, h: 0, n: 0, iNa: 0, iK: 0, iL: 0, spikes: 0 });

  // ---- refs the animation loop reads/writes ----
  const ctrl = useRef({ istim, gNa, gK, temp, running });
  ctrl.current = { istim, gNa, gK, temp, running };

  const sim = useRef(restingState());
  const pulse = useRef(0); // ms of stimulus pulse remaining
  const spikes = useRef(0);
  const aboveZero = useRef(false);
  const tNow = useRef(0);

  const buf = useRef(null);
  if (!buf.current) {
    const fill = (v) => Array(MAX_PTS).fill(v);
    const s = restingState();
    buf.current = {
      t: Array.from({ length: MAX_PTS }, (_, i) => i * SAMPLE_DT),
      V: fill(s.V), m: fill(s.m), h: fill(s.h), n: fill(s.n),
      iNa: fill(0), iK: fill(0), iL: fill(0),
    };
  }

  const cV = useRef(null);
  const cI = useRef(null);
  const cG = useRef(null);

  // ---- pulse / reset handlers ----
  const firefPulse = useCallback(() => { pulse.current = 0.8; }, []);
  const reset = useCallback(() => {
    sim.current = restingState();
    pulse.current = 0;
    spikes.current = 0;
    aboveZero.current = false;
    tNow.current = 0;
    const s = restingState();
    const fill = (v) => Array(MAX_PTS).fill(v);
    buf.current.V = fill(s.V); buf.current.m = fill(s.m);
    buf.current.h = fill(s.h); buf.current.n = fill(s.n);
    buf.current.iNa = fill(0); buf.current.iK = fill(0); buf.current.iL = fill(0);
    setReadout({ V: s.V, m: s.m, h: s.h, n: s.n, iNa: 0, iK: 0, iL: 0, spikes: 0 });
  }, []);

  const applyPreset = useCallback((key) => {
    const p = PRESETS[key];
    setIstim(p.istim); setGNa(p.gNa); setGK(p.gK); setTemp(p.temp);
    setRunning(true);
    if (p.pulse) { reset(); setTimeout(() => { pulse.current = 0.8; }, 60); }
  }, [reset]);

  // ---- the loop ----
  useEffect(() => {
    let raf;
    let frame = 0;

    const advance = () => {
      const { istim, gNa, gK, temp } = ctrl.current;
      const phi = Math.pow(Q10, (temp - T_REF) / 10);
      const b = buf.current;
      let s = sim.current;

      for (let k = 0; k < SAMPLES_PER_FRAME; k++) {
        for (let j = 0; j < STEPS_PER_SAMPLE; j++) {
          const Iext = istim + (pulse.current > 0 ? 14 : 0);
          if (pulse.current > 0) pulse.current -= DT;

          const { V, m, h, n } = s;
          const iNa = gNa * m * m * m * h * (V - ENa);
          const iK = gK * n * n * n * n * (V - EK);
          const iL = gL * (V - EL);
          const dV = (Iext - iNa - iK - iL) / Cm;
          const dm = phi * (alphaM(V) * (1 - m) - betaM(V) * m);
          const dh = phi * (alphaH(V) * (1 - h) - betaH(V) * h);
          const dn = phi * (alphaN(V) * (1 - n) - betaN(V) * n);

          s = { V: V + dV * DT, m: m + dm * DT, h: h + dh * DT, n: n + dn * DT, iNa, iK, iL };

          // spike detection on upward 0 mV crossing
          if (!aboveZero.current && s.V >= 0) { spikes.current++; aboveZero.current = true; }
          else if (aboveZero.current && s.V < -10) aboveZero.current = false;
        }
        tNow.current += SAMPLE_DT;
        b.t.push(tNow.current); b.t.shift();
        b.V.push(s.V); b.V.shift();
        b.m.push(s.m); b.m.shift();
        b.h.push(s.h); b.h.shift();
        b.n.push(s.n); b.n.shift();
        b.iNa.push(s.iNa); b.iNa.shift();
        b.iK.push(s.iK); b.iK.shift();
        b.iL.push(s.iL); b.iL.shift();
      }
      sim.current = s;
    };

    const loop = () => {
      if (ctrl.current.running) advance();
      drawScope(cV.current, [{ data: buf.current.V, color: C.vm, glow: true, w: 2 }], [-90, 55], {
        zero: 0, marks: [{ y: 0, label: "0", c: C.muted }, { y: -55, label: "umbral", c: "rgba(255,209,102,0.35)", dash: true }],
        unit: "mV", title: "Potencial de membrana  Vₘ",
      });
      // dynamic symmetric range for currents
      let mx = 60;
      const bI = buf.current;
      for (let i = 0; i < MAX_PTS; i++) {
        mx = Math.max(mx, Math.abs(bI.iNa[i]), Math.abs(bI.iK[i]), Math.abs(bI.iL[i]));
      }
      mx = Math.ceil(mx / 100) * 100;
      drawScope(cI.current, [
        { data: bI.iNa, color: C.na, w: 1.8 },
        { data: bI.iK, color: C.k, w: 1.8 },
        { data: bI.iL, color: C.leak, w: 1.4 },
      ], [-mx, mx], { zero: 0, unit: "µA/cm²", title: "Corrientes iónicas" });
      drawScope(cG.current, [
        { data: buf.current.m, color: C.na, w: 1.8 },
        { data: buf.current.h, color: "#ff9d72", w: 1.8 },
        { data: buf.current.n, color: C.k, w: 1.8 },
      ], [0, 1], { unit: "", title: "Compuertas  m · h · n" });

      frame++;
      if (frame % 5 === 0) {
        const s = sim.current;
        setReadout({ V: s.V, m: s.m, h: s.h, n: s.n, iNa: s.iNa, iK: s.iK, iL: s.iL, spikes: spikes.current });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={st.root}>
      <style>{CSS}</style>

      <header style={st.header}>
        <div>
          <div style={st.kicker}>Modelo de Hodgkin–Huxley · 1952</div>
          <h1 style={st.title}>Potencial de acción de una neurona</h1>
        </div>
        <div style={st.chips}>
          <Chip label="Vₘ" value={`${readout.V.toFixed(1)} mV`} color={C.vm} />
          <Chip label="disparos" value={readout.spikes} color={C.ink} />
        </div>
      </header>

      <div style={st.grid} className="__hh-grid">
        {/* scopes */}
        <section style={st.scopes}>
          <ScopeCard ref={cV} legend={[{ c: C.vm, t: "Vₘ" }]} />
          <ScopeCard ref={cI} legend={[
            { c: C.na, t: "I_Na" }, { c: C.k, t: "I_K" }, { c: C.leak, t: "I_fuga" },
          ]} />
          <ScopeCard ref={cG} legend={[
            { c: C.na, t: "m (act. Na)" }, { c: "#ff9d72", t: "h (inact. Na)" }, { c: C.k, t: "n (act. K)" },
          ]} />
        </section>

        {/* controls */}
        <aside style={st.panel}>
          <div style={st.row}>
            <button
              className="btn primary"
              onClick={() => setRunning((r) => !r)}
              style={{ flex: 1 }}
            >
              {running ? "❚❚ Pausar" : "▶ Reanudar"}
            </button>
            <button className="btn" onClick={reset}>↺ Reiniciar</button>
          </div>

          <button className="btn pulse" onClick={firefPulse} style={{ width: "100%" }}>
            ⚡ Inyectar pulso (estímulo breve)
          </button>

          <Slider label="Corriente inyectada  I" sub="estímulo continuo" unit="µA/cm²"
            min={-5} max={25} step={0.5} value={istim} onChange={setIstim} color={C.stim} />
          <Slider label="Conductancia máx. Na⁺  ḡNa" unit="mS/cm²"
            min={0} max={200} step={1} value={gNa} onChange={setGNa} color={C.na} />
          <Slider label="Conductancia máx. K⁺  ḡK" unit="mS/cm²"
            min={0} max={80} step={1} value={gK} onChange={setGK} color={C.k} />
          <Slider label="Temperatura  T" sub={`φ = ${Math.pow(Q10, (temp - T_REF) / 10).toFixed(2)}×`} unit="°C"
            min={2} max={32} step={0.5} value={temp} onChange={setTemp} color={C.leak} />

          <div style={st.presetLabel}>Escenarios</div>
          <div style={st.presets}>
            {Object.entries(PRESETS).map(([k, p]) => (
              <button key={k} className="btn chip-btn" onClick={() => applyPreset(k)}>{p.label}</button>
            ))}
          </div>

          <div style={st.readBox}>
            <ReadRow label="Vₘ" v={`${readout.V.toFixed(1)} mV`} c={C.vm} />
            <ReadRow label="I_Na" v={`${readout.iNa.toFixed(0)} µA/cm²`} c={C.na} />
            <ReadRow label="I_K" v={`${readout.iK.toFixed(0)} µA/cm²`} c={C.k} />
            <div style={st.gateBars}>
              <GateBar label="m" v={readout.m} c={C.na} />
              <GateBar label="h" v={readout.h} c={"#ff9d72"} />
              <GateBar label="n" v={readout.n} c={C.k} />
            </div>
          </div>
        </aside>
      </div>

      <footer style={st.footer}>
        Cₘ·dVₘ/dt = I − ḡNa·m³h·(Vₘ−E_Na) − ḡK·n⁴·(Vₘ−E_K) − ḡfuga·(Vₘ−E_fuga)
        &nbsp;·&nbsp; E_Na {ENa} · E_K {EK} · E_fuga {EL} mV · ventana {WINDOW_MS} ms
      </footer>
    </div>
  );
}

// ---------- canvas drawing ----------
function drawScope(canvas, series, [ymin, ymax], opts = {}) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 600;
  const cssH = canvas.clientHeight || 160;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cssW, H = cssH;
  const padL = 46, padR = 10, padT = 18, padB = 16;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);

  const xOf = (i) => padL + (i / (MAX_PTS - 1)) * plotW;
  const yOf = (v) => padT + (1 - (v - ymin) / (ymax - ymin)) * plotH;

  // grid
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 0; gx <= WINDOW_MS; gx += 10) {
    const x = padL + (gx / WINDOW_MS) * plotW;
    ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH);
  }
  const yTicks = 4;
  ctx.fillStyle = C.muted;
  ctx.font = "10px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let i = 0; i <= yTicks; i++) {
    const v = ymin + (i / yTicks) * (ymax - ymin);
    const y = yOf(v);
    ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y);
    ctx.fillText(formatTick(v), padL - 6, y);
  }
  ctx.stroke();

  // reference marks
  (opts.marks || []).forEach((mk) => {
    const y = yOf(mk.y);
    ctx.strokeStyle = mk.c; ctx.lineWidth = 1;
    ctx.setLineDash(mk.dash ? [4, 4] : []);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
    ctx.setLineDash([]);
  });
  if (opts.zero !== undefined && (opts.marks || []).every((m) => m.y !== opts.zero)) {
    const y = yOf(opts.zero);
    ctx.strokeStyle = "rgba(140,160,170,0.25)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
  }

  // title + unit
  ctx.fillStyle = C.ink;
  ctx.font = "12px 'Space Grotesk', system-ui, sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.title || "", padL, 12);
  ctx.fillStyle = C.muted;
  ctx.textAlign = "right";
  ctx.fillText(opts.unit || "", padL + plotW, 12);

  // traces (oldest at left, newest at right — scrolling)
  series.forEach((sr) => {
    const draw = (width, alpha) => {
      ctx.strokeStyle = sr.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.linejoin = "round";
      ctx.beginPath();
      for (let i = 0; i < MAX_PTS; i++) {
        const x = xOf(i);
        const y = clamp(yOf(sr.data[i]), padT - 30, padT + plotH + 30);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    if (sr.glow) draw((sr.w || 1.6) + 4, 0.16); // cheap phosphor halo
    draw(sr.w || 1.6, 1);
    ctx.globalAlpha = 1;
  });

  // newest-sample dot
  series.forEach((sr) => {
    const y = yOf(sr.data[MAX_PTS - 1]);
    ctx.fillStyle = sr.color;
    ctx.beginPath(); ctx.arc(padL + plotW, y, 2.6, 0, Math.PI * 2); ctx.fill();
  });
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
function formatTick(v) {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "k";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

// ---------- small components ----------
const ScopeCard = React.forwardRef(function ScopeCard({ legend }, ref) {
  return (
    <div style={st.card}>
      <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
      <div style={st.legend}>
        {legend.map((l, i) => (
          <span key={i} style={st.legItem}>
            <i style={{ background: l.c }} /> {l.t}
          </span>
        ))}
      </div>
    </div>
  );
});

function Chip({ label, value, color }) {
  return (
    <div style={st.chip}>
      <span style={{ color: C.muted, fontSize: 11 }}>{label}</span>
      <span style={{ color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </div>
  );
}

function Slider({ label, sub, unit, min, max, step, value, onChange, color }) {
  return (
    <div style={st.slider}>
      <div style={st.sliderHead}>
        <span style={st.sliderLabel}>{label}{sub ? <em style={st.sub}> · {sub}</em> : null}</span>
        <span style={{ ...st.sliderVal, color }}>{value}<small style={st.unit}> {unit}</small></span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: color }} className="rng" />
    </div>
  );
}

function ReadRow({ label, v, c }) {
  return (
    <div style={st.readRow}>
      <span style={{ color: c, fontSize: 12 }}>{label}</span>
      <span style={st.readVal}>{v}</span>
    </div>
  );
}

function GateBar({ label, v, c }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={st.gateTop}><span style={{ color: c }}>{label}</span><span style={st.gateNum}>{v.toFixed(2)}</span></div>
      <div style={st.gateTrack}><div style={{ ...st.gateFill, width: `${clamp(v, 0, 1) * 100}%`, background: c }} /></div>
    </div>
  );
}

// ---------- styles ----------
const st = {
  root: {
    background: C.bg, color: C.ink, minHeight: "100%", padding: "20px 22px 14px",
    fontFamily: "'Space Grotesk', system-ui, sans-serif", boxSizing: "border-box",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 16 },
  kicker: { color: C.muted, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" },
  title: { margin: "4px 0 0", fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em" },
  chips: { display: "flex", gap: 10 },
  chip: { display: "flex", flexDirection: "column", gap: 2, background: C.panel, border: `1px solid ${C.edge}`, borderRadius: 10, padding: "8px 12px", minWidth: 84 },
  grid: { display: "grid", gap: 16, alignItems: "start" },
  scopes: { display: "flex", flexDirection: "column", gap: 12, minWidth: 0 },
  card: { position: "relative", background: C.panel, border: `1px solid ${C.edge}`, borderRadius: 12, height: 176, padding: 4, overflow: "hidden" },
  legend: { position: "absolute", right: 12, bottom: 8, display: "flex", gap: 12, fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono', monospace" },
  legItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  panel: { background: C.panel, border: `1px solid ${C.edge}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 12 },
  row: { display: "flex", gap: 8 },
  slider: { display: "flex", flexDirection: "column", gap: 6 },
  sliderHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  sliderLabel: { fontSize: 12.5, color: C.ink },
  sub: { color: C.muted, fontStyle: "normal", fontSize: 11 },
  sliderVal: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600 },
  unit: { color: C.muted, fontWeight: 400 },
  presetLabel: { color: C.muted, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" },
  presets: { display: "flex", flexWrap: "wrap", gap: 6 },
  readBox: { background: C.panel2, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 7, marginTop: 2 },
  readRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  readVal: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: C.ink },
  gateBars: { display: "flex", gap: 8, marginTop: 2 },
  gateTop: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
  gateNum: { color: C.muted },
  gateTrack: { height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", marginTop: 3 },
  gateFill: { height: "100%", borderRadius: 3, transition: "width 80ms linear" },
  footer: { marginTop: 14, color: C.muted, fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
* { -webkit-font-smoothing: antialiased; }
.btn {
  background: ${C.panel2}; color: ${C.ink}; border: 1px solid ${C.edge};
  border-radius: 9px; padding: 9px 12px; font-size: 13px; cursor: pointer;
  font-family: 'Space Grotesk', system-ui, sans-serif; transition: all 120ms ease;
}
.btn:hover { border-color: rgba(160,180,190,0.4); background: #202a32; }
.btn:focus-visible { outline: 2px solid ${C.vm}; outline-offset: 2px; }
.btn.primary { background: #223; border-color: rgba(167,139,250,0.45); color: ${C.ink}; }
.btn.primary:hover { background: #2a2a44; }
.btn.pulse { background: rgba(167,139,250,0.14); border-color: rgba(167,139,250,0.5); color: #d9ccff; font-weight: 500; }
.btn.pulse:hover { background: rgba(167,139,250,0.24); }
.btn.pulse:active { transform: translateY(1px); }
.btn.chip-btn { padding: 6px 10px; font-size: 12px; }
.rng { width: 100%; height: 4px; border-radius: 3px; background: rgba(255,255,255,0.10); appearance: none; cursor: pointer; }
.rng::-webkit-slider-thumb { appearance: none; width: 15px; height: 15px; border-radius: 50%; background: #fff; border: 2px solid ${C.bg}; box-shadow: 0 0 0 1px rgba(255,255,255,0.3); }
.rng::-moz-range-thumb { width: 13px; height: 13px; border-radius: 50%; background: #fff; border: 2px solid ${C.bg}; }
@media (prefers-reduced-motion: reduce) { .gateFill { transition: none !important; } }
.__hh-grid { grid-template-columns: minmax(0,1fr) 300px; }
@media (max-width: 760px) {
  .__hh-grid { grid-template-columns: 1fr; }
}
`;
