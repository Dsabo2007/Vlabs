/**
 * Circuit Simulation Engine for Virtual Electronics Lab
 * Solves circuit networks, AC/DC behaviors, frequency responses, and waveform generation.
 */

import { FunctionGenState, PowerSupplyState, ScopeState, WaveformType, Wire } from '../types/lab';

export interface SignalSample {
  time: number;
  voltage: number;
}

export interface CircuitSimulationResult {
  scopeCh1Waveform: SignalSample[];
  scopeCh2Waveform: SignalSample[];
  psuActualVoltage: number;
  psuActualCurrent: number;
  psuMode: 'CV' | 'CC';
  dmmReading: number;
  dmmUnit: string;
  galvanometerCurrent: number;
  microammeterCurrent?: number;
  circuitInfo: {
    activeCircuitName: string;
    cutoffFrequency?: number;
    resonanceFrequency?: number;
    timer555Frequency?: number;
    gainDb?: number;
    phaseShiftDeg?: number;
  };
}

/**
 * Calculates theoretical RC low-pass filter response
 * Vout/Vin = 1 / sqrt(1 + (f / fc)^2)
 * Phase = -arctan(f / fc)
 */
export function calculateRCLowPass(r: number, c: number, f: number) {
  const fc = 1 / (2 * Math.PI * Math.max(r, 1) * Math.max(c, 1e-12));
  const ratio = f / Math.max(fc, 1e-6);
  const gain = 1 / Math.sqrt(1 + ratio * ratio);
  const phaseRad = -Math.atan(ratio);
  const phaseDeg = (phaseRad * 180) / Math.PI;
  const gainDb = 20 * Math.log10(Math.max(gain, 1e-6));
  return { fc, gain, phaseRad, phaseDeg, gainDb };
}

/**
 * Calculates theoretical RC high-pass filter response
 * Vout/Vin = (f / fc) / sqrt(1 + (f / fc)^2)
 * Phase = +arctan(fc / f) = 90 - arctan(f / fc)
 */
export function calculateRCHighPass(r: number, c: number, f: number) {
  const fc = 1 / (2 * Math.PI * Math.max(r, 1) * Math.max(c, 1e-12));
  // At DC an ideal series-capacitor high-pass has exactly zero gain.
  // Avoid replacing f=0 with an arbitrary epsilon, which creates a small
  // but non-physical output and a phase value dependent on that epsilon.
  const safeFrequency = Math.max(0, Number.isFinite(f) ? f : 0);
  const ratio = safeFrequency / Math.max(fc, 1e-6);
  const gain = ratio === 0 ? 0 : ratio / Math.sqrt(1 + ratio * ratio);
  const phaseRad = safeFrequency === 0 ? Math.PI / 2 : Math.atan(fc / safeFrequency);
  const phaseDeg = (phaseRad * 180) / Math.PI;
  const gainDb = 20 * Math.log10(Math.max(gain, 1e-6));
  return { fc, gain, phaseRad, phaseDeg, gainDb };
}

/**
 * Calculates theoretical series RLC circuit response
 * f0 = 1 / (2 * pi * sqrt(L * C))
 * Q = (1 / R) * sqrt(L / C)
 */
export function calculateRLCResonance(r: number, l: number, c: number, f: number) {
  const f0 = 1 / (2 * Math.PI * Math.sqrt(Math.max(l, 1e-6) * Math.max(c, 1e-12)));
  const omega = 2 * Math.PI * Math.max(f, 1e-6);
  const xl = omega * l;
  const xc = 1 / Math.max(omega * c, 1e-12);
  const xTotal = xl - xc;
  const impedance = Math.sqrt(r * r + xTotal * xTotal);
  const qFactor = (1 / Math.max(r, 1e-3)) * Math.sqrt(l / Math.max(c, 1e-12));
  const phaseRad = -Math.atan2(xTotal, r);
  const phaseDeg = (phaseRad * 180) / Math.PI;
  const gain = r / Math.max(impedance, 1e-6);
  return { f0, impedance, qFactor, gain, phaseRad, phaseDeg, xl, xc };
}

/**
 * Calculates 555 Astable multivibrator oscillation
 * f = 1.44 / ((R1 + 2*R2) * C)
 */
export function calculate555Timer(r1: number, r2: number, c: number) {
  const tHigh = 0.693 * (r1 + r2) * c;
  const tLow = 0.693 * r2 * c;
  const period = tHigh + tLow;
  const frequency = period > 0 ? 1 / period : 0;
  const dutyCycle = period > 0 ? tHigh / period : 0.5;
  return { frequency, period, tHigh, tLow, dutyCycle };
}

/**
 * Generates an instantaneous periodic signal at time t
 */
export function generateWaveformSample(
  t: number,
  type: WaveformType,
  freq: number,
  vpp: number,
  offset: number = 0,
  phaseRad: number = 0,
  symmetry: number = 0.5
): number {
  const period = 1 / Math.max(freq, 1e-6);
  const phaseSec = (phaseRad / (2 * Math.PI)) * period;
  const adjustedT = ((t + phaseSec) % period + period) % period;
  const halfVpp = vpp / 2;

  switch (type) {
    case 'sine': {
      return offset + halfVpp * Math.sin(2 * Math.PI * freq * (t + phaseSec));
    }
    case 'triangle': {
      const sym = Math.max(0.1, Math.min(0.9, symmetry));
      const tNorm = adjustedT / period;
      let val = 0;
      if (tNorm < sym) {
        val = -1 + 2 * (tNorm / sym);
      } else {
        val = 1 - 2 * ((tNorm - sym) / (1 - sym));
      }
      return offset + halfVpp * val;
    }
    case 'square':
    case 'pulse': {
      // SQUARE uses the front-panel symmetry/duty control, so a 25% setting is a
      // genuine narrow pulse and 50% is a symmetrical square wave.
      const sym = Math.max(0.02, Math.min(0.98, symmetry));
      const tNorm = adjustedT / period;
      const isHigh = tNorm < sym;
      return offset + (isHigh ? halfVpp : -halfVpp);
    }
    case 'ramp': {
      // Sawtooth with an adjustable rise time (SG ramp / UTG ramp duty).
      const rise = Math.max(0.05, Math.min(0.95, symmetry));
      const tNorm = adjustedT / period;
      const val = tNorm < rise
        ? -1 + 2 * (tNorm / rise)
        : 1 - 2 * ((tNorm - rise) / (1 - rise));
      return offset + halfVpp * val;
    }
    case 'noise': {
      // Deterministic pseudo-Gaussian noise: the same instant always produces
      // the same sample, so the trace does not flicker between solves.
      const phase = t * (freq > 0 ? freq : 1000);
      const h1 = Math.sin(phase * 12.9898) * 43758.5453;
      const h2 = Math.sin(phase * 78.233 + 1.7) * 24634.6345;
      const n1 = (h1 - Math.floor(h1)) * 2 - 1;
      const n2 = (h2 - Math.floor(h2)) * 2 - 1;
      const noise = Math.max(-1, Math.min(1, (n1 + n2) / 1.6));
      return offset + halfVpp * noise;
    }
    case 'dc':
    default:
      return offset;
  }
}

export function computeVrms(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sumSq = samples.reduce((acc, v) => acc + v * v, 0);
  return Math.sqrt(sumSq / samples.length);
}

export function computeVpp(samples: number[]): number {
  if (samples.length === 0) return 0;
  let min = samples[0];
  let max = samples[0];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i] < min) min = samples[i];
    if (samples[i] > max) max = samples[i];
  }
  return max - min;
}

/**
 * UT33D+ AC voltage is average-responding and sine-RMS calibrated, not true-RMS.
 * The meter rectifies the AC component and applies the sine-wave form factor.
 * This idealized estimate is intended for the supported sine/triangle/square
 * generator waveforms; the physical meter's specified AC bandwidth is 40–400Hz.
 */
export function calculateUT33DPlusACReading(
  waveform: WaveformType,
  vpp: number
): number {
  const peak = Math.max(0, Number.isFinite(vpp) ? vpp : 0) / 2;
  const sineCalibrationFactor = Math.PI / (2 * Math.SQRT2);
  let averageRectified = 0;

  switch (waveform) {
    case 'sine':
      averageRectified = (2 * peak) / Math.PI;
      break;
    case 'triangle':
      averageRectified = peak / 2;
      break;
    case 'square':
      averageRectified = peak;
      break;
  }

  return averageRectified * sineCalibrationFactor;
}

export function solvePowerSupply(
  vSet: number,
  iLimit: number,
  loadResistance: number,
  outputEnabled: boolean
): { actualV: number; actualI: number; mode: 'CV' | 'CC' } {
  if (!outputEnabled) {
    return { actualV: 0, actualI: 0, mode: 'CV' };
  }
  const safeLoad = Math.max(loadResistance, 1e-4);
  const potentialCurrent = vSet / safeLoad;

  if (potentialCurrent <= iLimit) {
    return {
      actualV: vSet,
      actualI: potentialCurrent,
      mode: 'CV',
    };
  } else {
    const actualV = iLimit * safeLoad;
    return {
      actualV: Math.min(actualV, vSet),
      actualI: iLimit,
      mode: 'CC',
    };
  }
}

/**
 * Frequency response of the filter-trainer board sections.
 * Active 2nd-order sections are modelled as Butterworth (Q = 0.707); the
 * jumpers on J1..J4 decide which capacitors are in circuit. Passive
 * sections use the nominal L/C values printed on the trainer.
 */
export const FILTER_BOARD_VALUES = {
  activeR: 10e3,
  c1: 10e-9, c3: 47e-9, c2: 10e-9, c4: 47e-9,
  passiveL: 10e-3, passiveC: 100e-9,
};

export interface FilterResponse { gain: number; phaseRad: number; dcGain: number; fc: number }

function secondOrder(kind: 'lp' | 'hp', fc: number, f: number, q: number = Math.SQRT1_2): FilterResponse {
  const x = Math.max(f, 1e-6) / fc;
  const den = Math.sqrt((1 - x * x) ** 2 + (x / q) ** 2);
  const argDen = Math.atan2(x / q, 1 - x * x);
  if (kind === 'lp') return { gain: 1 / den, phaseRad: -argDen, dcGain: 1, fc };
  return { gain: (x * x) / den, phaseRad: Math.PI - argDen, dcGain: 0, fc };
}

export function calculateBoardFilter(section: string, f: number, jumpers = { g1: 0, g2: 0 }): FilterResponse {
  const V = FILTER_BOARD_VALUES;
  if (section === 'active_lpf' || section === 'active_hpf') {
    const kind = section === 'active_lpf' ? 'lp' : 'hp';
    if (jumpers.g1 <= 0 && jumpers.g2 <= 0) {
      // no capacitor patched in: LPF passes everything, HPF blocks everything
      return kind === 'lp' ? { gain: 1, phaseRad: 0, dcGain: 1, fc: Infinity } : { gain: 0, phaseRad: 0, dcGain: 0, fc: 0 };
    }
    const ca = jumpers.g1 > 0 ? jumpers.g1 : jumpers.g2;
    const cb = jumpers.g2 > 0 ? jumpers.g2 : jumpers.g1;
    const fc = 1 / (2 * Math.PI * V.activeR * Math.sqrt(ca * cb));
    return secondOrder(kind, fc, f);
  }
  const f0 = 1 / (2 * Math.PI * Math.sqrt(V.passiveL * V.passiveC));
  // Real LC sections are damped by generator output impedance (50Ω) plus the
  // choke's DC resistance (~3Ω), which gives Q≈6 instead of the ideal ∞.
  const passiveQ = (1 / (50 + 3)) * Math.sqrt(V.passiveL / V.passiveC);
  if (section === 'passive_lpf') return secondOrder('lp', f0, f, passiveQ);
  if (section === 'passive_hpf') return secondOrder('hp', f0, f, passiveQ);
  // passive BPF: parallel L3-C3 tank, Q ~ 3
  const Q = 3;
  const d = f / f0 - f0 / Math.max(f, 1e-6);
  return { gain: 1 / Math.sqrt(1 + Q * Q * d * d), phaseRad: -Math.atan(Q * d), dcGain: 0, fc: f0 };
}

/**
 * Solves circuit waveforms based on dynamic graph connectivity of wires on the bench
 */
export function solveActiveCircuit(params: {
  wires: Wire[];
  gen: FunctionGenState;
  psu: PowerSupplyState;
  scope: ScopeState;
  boardValues: Record<string, number>;
  activePreset?: string;
  multimeterMode: string;
  timeWindow: { start: number; duration: number; numPoints: number };
}): CircuitSimulationResult {
  const { wires, gen, psu, scope, boardValues, multimeterMode, timeWindow } = params;

  // Reject malformed sampling windows early instead of silently producing
  // empty, reversed, or unbounded waveform buffers.
  if (!Number.isFinite(timeWindow.start) || !Number.isFinite(timeWindow.duration) || timeWindow.duration < 0) {
    throw new RangeError('timeWindow.start and duration must be finite, and duration must be non-negative.');
  }
  if (!Number.isInteger(timeWindow.numPoints) || timeWindow.numPoints < 1 || timeWindow.numPoints > 100_000) {
    throw new RangeError('timeWindow.numPoints must be an integer between 1 and 100000.');
  }

  // Build bidirectional adjacency graph of connected ports
  const adj = new Map<string, Set<string>>();
  const addEdge = (u: string, v: string) => {
    if (!adj.has(u)) adj.set(u, new Set());
    if (!adj.has(v)) adj.set(v, new Set());
    adj.get(u)!.add(v);
    adj.get(v)!.add(u);
  };

  for (const w of wires) {
    addEdge(w.fromPortId, w.toPortId);
  }

  // BNC→banana adapter accessory: the BNC centre conductor is the red (+) pole.
  for (const k of Array.from(adj.keys())) {
    if (k.endsWith(':lead_bnc')) addEdge(k, k.replace(/:lead_bnc$/, ':lead_pos'));
  }

  // Union-find over wired ports: lets the power supply see the real load that
  // a student patched across its terminals (resistor, potentiometer branch...)
  const netParent = new Map<string, string>();
  const netFind = (x: string): string => {
    let root = x;
    while (netParent.has(root) && netParent.get(root) !== root) root = netParent.get(root)!;
    let cur = x;
    while (cur !== root) {
      const next = netParent.get(cur) ?? root;
      netParent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const netUnion = (a: string, b: string) => {
    const ra = netFind(a);
    const rb = netFind(b);
    if (ra !== rb) netParent.set(ra, rb);
  };
  for (const w of wires) netUnion(w.fromPortId, w.toPortId);
  for (const k of Array.from(adj.keys())) {
    if (k.endsWith(':lead_bnc')) netUnion(k, k.replace(/:lead_bnc$/, ':lead_pos'));
  }

  // The four-socket "cross" junction blocks on the measurements board
  // (X1 / X2) are a single electrical node: all four arms are shorted together.
  for (const k of Array.from(adj.keys())) {
    const m = /^(.*:X[12]):(n|e|s|w)$/.exec(k);
    if (!m) continue;
    for (const arm of ['n', 'e', 's', 'w']) {
      const sibling = `${m[1]}:${arm}`;
      if (sibling === k) continue;
      addEdge(k, sibling);
      netUnion(k, sibling);
    }
  }

  const boardInstances = new Set<string>();
  for (const k of adj.keys()) {
    const m = /^([a-zA-Z0-9_]*board[a-zA-Z0-9_-]*):/.exec(k);
    if (m) boardInstances.add(m[1]);
  }

  const matchPort = (actual: string, pattern: string): boolean => {
    if (actual === pattern) return true;
    const actIdx = actual.indexOf(':');
    const patIdx = pattern.indexOf(':');
    if (actIdx === -1 || patIdx === -1) return actual === pattern;
    return actual.slice(actIdx) === pattern.slice(patIdx);
  };

  // Reachability check in wiring graph supporting namespaced instances
  const computeConnected = (startPort: string, targetPort: string): boolean => {
    if (matchPort(startPort, targetPort)) return true;
    const startNodes: string[] = [];
    for (const k of adj.keys()) {
      if (matchPort(k, startPort)) startNodes.push(k);
    }
    if (startNodes.length === 0) return false;

    const visited = new Set<string>();
    const queue = [...startNodes];
    for (const s of startNodes) visited.add(s);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (matchPort(cur, targetPort)) return true;
      for (const nxt of adj.get(cur) || []) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push(nxt);
        }
      }
    }
    return false;
  };

  // The graph is fixed for the whole solve, so memoise reachability. Without
  // this cache the per-sample waveform loop repeats hundreds of BFS walks per
  // frame, which is the main cost on phones and tablets.
  const connectionCache = new Map<string, boolean>();
  const isConnected = (startPort: string, targetPort: string): boolean => {
    const key = `${startPort}>${targetPort}`;
    const cached = connectionCache.get(key);
    if (cached !== undefined) return cached;
    const result = computeConnected(startPort, targetPort);
    connectionCache.set(key, result);
    return result;
  };

  const R1 = boardValues['R1'] ?? 1000;
  const C1 = boardValues['C1'] ?? 0.1e-6;
  const L1 = boardValues['L1'] ?? 10e-3;
  const R2 = boardValues['R2'] ?? 4700;
  const Pot1 = boardValues['POT1'] ?? 5000;

  // Generator actual Vpp considering attenuation. The front-panel OUTPUT key
  // must gate the DC offset too, not just the AC amplitude.
  let effectiveGenVpp = gen.power && gen.outputOn !== false ? gen.amplitude : 0;
  if (gen.attenuation === 20) effectiveGenVpp /= 10;
  if (gen.attenuation === 40) effectiveGenVpp /= 100;
  if (gen.attenuation === 60) effectiveGenVpp /= 1000;
  const genFreq = Math.max(0.1, gen.frequency);
  const genType = gen.waveform;
  const genOutputOn = gen.power && gen.outputOn !== false;
  const genOffset = genOutputOn ? gen.dcOffset : 0;
  const genSym = gen.symmetry;
  // INVERT on the LW-1641 flips the signal about its DC level (180° phase).
  const genPhase = gen.inverted ? Math.PI : 0;

  type SourceKind = 'gen';
  interface SourceDef {
    kind: SourceKind;
    label: string;
    type: WaveformType;
    freq: number;
    vpp: number;
    offset: number;
    phase: number;
    symmetry: number;
  }
  const sources: SourceDef[] = [
    { kind: 'gen', label: 'LW-1641 Generator Output', type: genType, freq: genFreq, vpp: effectiveGenVpp, offset: genOffset, phase: genPhase, symmetry: genSym },
  ];

  /** Resolve a port that belongs to the LW-1641 instance family. */
  const kindOwnsPort = (key: string, kind: SourceKind): boolean => {
    if (kind === 'gen') return key.startsWith('gen-') || key.startsWith('gen:');
    return false;
  };
  const kindPortConnected = (kind: SourceKind, suffix: string, targetPort: string): boolean => {
    const starts: string[] = [];
    for (const k of adj.keys()) {
      if (kindOwnsPort(k, kind) && k.endsWith(`:${suffix}`)) starts.push(k);
    }
    if (starts.length === 0) return false;
    const visited = new Set(starts);
    const queue = [...starts];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (matchPort(cur, targetPort)) return true;
      for (const nxt of adj.get(cur) || []) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push(nxt);
        }
      }
    }
    return false;
  };
  const renderSource = (s: SourceDef, t: number, gain = 1, offsetScale = 1, extraPhase = 0) =>
    generateWaveformSample(
      t,
      s.type,
      s.freq,
      s.vpp * gain,
      s.offset * offsetScale,
      s.phase + extraPhase,
      s.symmetry
    );
  const sourceHasSignal = (s: SourceDef) => s.vpp > 0 || Math.abs(s.offset) > 0;
  const sourceTo = (targetPort: string): SourceDef | null => {
    for (const s of sources) {
      if (sourceHasSignal(s) && kindPortConnected(s.kind, 'output', targetPort)) return s;
    }
    return null;
  };

  const dt = timeWindow.duration / Math.max(timeWindow.numPoints - 1, 1);
  const ch1Waveform: SignalSample[] = [];
  const ch2Waveform: SignalSample[] = [];

  let activeCircuitName = 'Direct Connection';

  // Filter-trainer boards present in the wiring graph (instance ids like "filterboard-123-4")
  const filterInstances = new Set<string>();
  for (const k of adj.keys()) {
    const m = /^(filterboard[^:]*):/.exec(k);
    if (m) filterInstances.add(m[1]);
  }
  const SECTIONS: Array<{ id: string; outs: string[]; ins: string[]; name: string }> = [
    { id: 'active_lpf', outs: ['lpf_out_p'], ins: ['lpf_in_p'], name: 'Active 2nd-Order Low-Pass Filter' },
    { id: 'active_hpf', outs: ['hpf_out_p'], ins: ['hpf_in_p'], name: 'Active 2nd-Order High-Pass Filter' },
    { id: 'passive_lpf', outs: ['lpf_out'], ins: ['lpf_in'], name: 'Passive LPF (L-C-L)' },
    { id: 'passive_hpf', outs: ['hpf_out'], ins: ['hpf_in'], name: 'Passive HPF (C-L-C)' },
    { id: 'passive_bpf', outs: ['bpf_out'], ins: ['bpf_in'], name: 'Passive BPF (L-C-C-L)' },
  ];
  // Filter section detection is cached per channel: it used to be re-walked
  // for every single sample, even though the wiring cannot change mid-solve.
  let filterInfo: { fc: number; gainDb: number; phaseShiftDeg: number } | undefined;
  const filterChannelCache = new Map<string, { r: FilterResponse; name: string; src: SourceDef } | null>();
  const solveFilterBoardChannel = (chPort: string): { r: FilterResponse; name: string; src: SourceDef } | null => {
    const cached = filterChannelCache.get(chPort);
    if (cached !== undefined) {
      if (cached) {
        filterInfo = {
          fc: cached.r.fc,
          gainDb: 20 * Math.log10(Math.max(cached.r.gain, 1e-6)),
          phaseShiftDeg: (cached.r.phaseRad * 180) / Math.PI,
        };
      }
      return cached;
    }

    let found: { r: FilterResponse; name: string; src: SourceDef } | null = null;
    for (const inst of filterInstances) {
      for (const sec of SECTIONS) {
        if (!sec.outs.some((o) => isConnected(chPort, `${inst}:${o}`))) continue;
        // Match the source actually patched to the filter input terminal.
        const driver = sec.ins.map((i) => sourceTo(`${inst}:${i}`)).find(Boolean) ?? null;
        if (!driver) continue;
        const side = sec.id === 'active_lpf' ? 'lpf' : 'hpf';
        const jumper = (j: string) => isConnected(`${inst}:${side}_${j}_a`, `${inst}:${side}_${j}_b`);
        const V = FILTER_BOARD_VALUES;
        const g1 = (jumper('j1') ? V.c1 : 0) + (jumper('j3') ? V.c3 : 0);
        const g2 = (jumper('j2') ? V.c2 : 0) + (jumper('j4') ? V.c4 : 0);
        found = { r: calculateBoardFilter(sec.id, driver.freq, { g1, g2 }), name: sec.name, src: driver };
        filterInfo = {
          fc: found.r.fc,
          gainDb: 20 * Math.log10(Math.max(found.r.gain, 1e-6)),
          phaseShiftDeg: (found.r.phaseRad * 180) / Math.PI,
        };
        break;
      }
      if (found) break;
    }
    filterChannelCache.set(chPort, found);
    return found;
  };

  // Helper to compute sample for a specific scope channel
  const getChannelVoltage = (chPort: string, t: number): number => {
    // 0. Filter trainer board: scope probing a filter output driven by the generator
    const filt = solveFilterBoardChannel(chPort);
    if (filt) {
      activeCircuitName = filt.name;
      if (sourceHasSignal(filt.src)) {
        return renderSource(filt.src, t, filt.r.gain, filt.r.dcGain, filt.r.phaseRad);
      }
      return 0;
    }

    // 1. Connected directly or indirectly to PROBE COMP (3V 1kHz square wave)
    if (isConnected(chPort, 'scope:probe_comp')) {
      activeCircuitName = 'Probe Calibration 3V 1kHz';
      return generateWaveformSample(t, 'square', 1000, 3.0, 1.5, 0, 0.5);
    }

    // 2. Connected to 555 output
    if (isConnected(chPort, 'board:555_out')) {
      activeCircuitName = 'NE555 Timer Output';
      const timer = calculate555Timer(R1, R2, C1);
      const period = Math.max(timer.period, 1e-6);
      const modT = ((t % period) + period) % period;
      const vcc = psu.power && psu.outputEnabled ? psu.voltageSet : 12.0;
      return modT < timer.tHigh ? vcc - 1.2 : 0.1;
    }

    // 3. Connected to RC Filter Output
    if (isConnected(chPort, 'board:rc_out')) {
      activeCircuitName = 'RC Low-Pass Filter';
      const driver = sourceTo('board:rc_in');
      const rc = calculateRCLowPass(R1, C1, driver?.freq ?? genFreq);
      if (driver && (driver.vpp > 0 || driver.type === 'dc')) {
        return renderSource(driver, t, rc.gain, rc.gain, rc.phaseRad);
      }
      return 0;
    }

    // 4. Connected to RLC Filter Output
    if (isConnected(chPort, 'board:rlc_out')) {
      activeCircuitName = 'RLC Resonant Circuit';
      const driver = sourceTo('board:rlc_in');
      const rlc = calculateRLCResonance(R1, L1, C1, driver?.freq ?? genFreq);
      if (driver && (driver.vpp > 0 || driver.type === 'dc')) {
        return renderSource(driver, t, rlc.gain, 0, rlc.phaseRad);
      }
      return 0;
    }

    // 5. Connected directly to the generator output
    if (isConnected(chPort, 'board:rc_in') || isConnected(chPort, 'board:rlc_in')) {
      const driver = sourceTo('board:rc_in') ?? sourceTo('board:rlc_in');
      if (driver) {
        activeCircuitName = driver.label;
        return renderSource(driver, t);
      }
    }
    for (const s of sources) {
      if (!kindPortConnected(s.kind, 'output', chPort)) continue;
      activeCircuitName = s.label;
      if (sourceHasSignal(s)) return renderSource(s, t);
      return 0;
    }

    // 6. Connected to a TTL / SYNC digital output
    if (kindPortConnected('gen', 'ttl', chPort)) {
      activeCircuitName = 'TTL/CMOS Digital Pulse';
      return gen.power ? generateWaveformSample(t, 'square', genFreq, 5.0, 2.5, 0, 0.5) : 0;
    }

    // 7. Connected to Bridge Rectifier DC Output
    if (isConnected(chPort, 'board:BR:pos')) {
      activeCircuitName = 'Bridge Rectifier Full-Wave DC';
      const driver = sourceTo('board:BR:ac1');
      if (driver && (driver.vpp > 0 || driver.type === 'dc')) {
        const rawVin = renderSource(driver, t);
        // Full wave rectification: two diode drops ~ 1.2V
        return Math.max(0, Math.abs(rawVin) - 1.2);
      }
      return 0;
    }

    // 8. Connected to Board DC Power Rails
    if (isConnected(chPort, 'board:PWR:p12v')) {
      activeCircuitName = 'Board Rail +12V DC';
      return 12.0;
    }
    if (isConnected(chPort, 'board:PWR:p5v')) {
      activeCircuitName = 'Board Rail +5V DC';
      return 5.0;
    }
    if (isConnected(chPort, 'board:PWR:n12v')) {
      activeCircuitName = 'Board Rail -12V DC';
      return -12.0;
    }
    if (isConnected(chPort, 'board:PWR:gnd')) {
      return 0.0;
    }

    // 9. Connected to Power Supply (+)
    if (isConnected(chPort, 'psu:pos')) {
      activeCircuitName = 'DC Power Supply Rail';
      return psu.power && psu.outputEnabled ? psu.voltageSet : 0;
    }

    // 10. Connected to Power Supply (-) or GND / Ground references
    if (
      isConnected(chPort, 'psu:neg') ||
      isConnected(chPort, 'psu:gnd') ||
      isConnected(chPort, 'gen:output_gnd') ||
      isConnected(chPort, 'leads:lead_neg') ||
      isConnected(chPort, 'scope:ch1_gnd') ||
      isConnected(chPort, 'scope:ch2_gnd')
    ) {
      return 0;
    }

    // Open terminal / floating ground
    return 0;
  };

  for (let i = 0; i < timeWindow.numPoints; i++) {
    const t = timeWindow.start + i * dt;
    ch1Waveform.push({ time: t, voltage: getChannelVoltage('scope:ch1', t) });
    ch2Waveform.push({ time: t, voltage: getChannelVoltage('scope:ch2', t) });
  }

  // Solve Power Supply loading from the real patched network
  let psuLoad = 1e6;
  const isDmmShuntConnected =
    (isConnected('dmm:10a', 'psu:pos') || isConnected('dmm:v_ohm', 'psu:pos')) &&
    isConnected('dmm:com', 'psu:neg');

  // Resolve the real bench nets that belong to the PSU terminals (instance
  // names are dynamic, e.g. psu-1:pos, so pattern-match the wired ports).
  const posNets = new Set<string>();
  const negNets = new Set<string>();
  for (const k of adj.keys()) {
    if (matchPort(k, 'psu:pos')) posNets.add(netFind(k));
    if (matchPort(k, 'psu:neg')) negNets.add(netFind(k));
  }
  const isShorted = Array.from(posNets).some((net) => negNets.has(net));

  const potRatio5k = Math.max(0, Math.min(1, (boardValues['pot5k'] ?? boardValues['POT_5k'] ?? 50) / 100));
  const potRatio100k = Math.max(0, Math.min(1, (boardValues['pot100k'] ?? boardValues['POT_100k'] ?? 50) / 100));
  const potRatio1M = Math.max(0, Math.min(1, (boardValues['measPot1M'] ?? boardValues['pot1M'] ?? boardValues['POT_1M'] ?? 50) / 100));
  const potRatio10k = Math.max(0, Math.min(1, (boardValues['POT_10k'] ?? 50) / 100));

  const branches: Array<[string, string, number]> = [
    ['R_50:a', 'R_50:b', 50],
    ['R_100:a', 'R_100:b', 100],
    ['R_220:a', 'R_220:b', 220],
    ['R_470:a', 'R_470:b', 470],
    ['R_560:a', 'R_560:b', 560],
    ['R_1k:a', 'R_1k:b', 1000],
    ['R_1k_1:a', 'R_1k_1:b', 1000],
    ['R_1k_2:a', 'R_1k_2:b', 1000],
    ['R_2k2:a', 'R_2k2:b', 2200],
    ['R_4k7:a', 'R_4k7:b', 4700],
    ['R_5k_1:a', 'R_5k_1:b', 5000],
    ['R_5k_2:a', 'R_5k_2:b', 5000],
    ['R_10k:a', 'R_10k:b', 10000],
    ['R_10k_1:a', 'R_10k_1:b', 10000],
    ['R_10k_2:a', 'R_10k_2:b', 10000],
    ['R_20k:a', 'R_20k:b', 20000],
    ['R_47k:a', 'R_47k:b', 47000],
    ['R_50k:a', 'R_50k:b', 50000],
    ['R_100k:a', 'R_100k:b', 100000],
    ['R_200k_1:a', 'R_200k_1:b', 200000],
    ['R_200k_2:a', 'R_200k_2:b', 200000],
    ['R_500k:a', 'R_500k:b', 500000],
    ['R_1M:a', 'R_1M:b', 1000000],
    ['POT_5k:1', 'POT_5k:3', 5000],
    ['POT_5k:1', 'POT_5k:w', Math.max(1, 5000 * potRatio5k)],
    ['POT_5k:w', 'POT_5k:3', Math.max(1, 5000 * (1 - potRatio5k))],
    ['POT_100k:1', 'POT_100k:3', 100000],
    ['POT_100k:1', 'POT_100k:w', Math.max(1, 100000 * potRatio100k)],
    ['POT_100k:w', 'POT_100k:3', Math.max(1, 100000 * (1 - potRatio100k))],
    ['POT_1M:1', 'POT_1M:3', 1000000],
    ['POT_1M:1', 'POT_1M:w', Math.max(1, 1000000 * potRatio1M)],
    ['POT_1M:w', 'POT_1M:3', Math.max(1, 1000000 * (1 - potRatio1M))],
    ['POT_10k:1', 'POT_10k:3', 10000],
    ['POT_10k:1', 'POT_10k:w', Math.max(1, 10000 * potRatio10k)],
    ['POT_10k:w', 'POT_10k:3', Math.max(1, 10000 * (1 - potRatio10k))],
  ];

  if (isShorted) {
    psuLoad = 0.01; // dead short across the output terminals
  } else if (isDmmShuntConnected) {
    psuLoad = multimeterMode === 'DCA' ? 0.05 : 10e6;
  } else {
    let conductance = 0;
    for (const inst of boardInstances) {
      for (const [a, b, r] of branches) {
        const na = netFind(`${inst}:${a}`);
        const nb = netFind(`${inst}:${b}`);
        if ((posNets.has(na) && negNets.has(nb)) || (negNets.has(na) && posNets.has(nb))) {
          conductance += 1 / r;
        }
      }
    }
    if (conductance > 0) psuLoad = Math.max(1 / conductance, 0.01);
  }

  const psuResult = solvePowerSupply(psu.voltageSet, psu.currentLimit, psuLoad, psu.power && psu.outputEnabled);

  // Solve Multimeter with authentic electronic behaviors
  let dmmReading = 0;
  let dmmUnit = 'V';

  if (multimeterMode === 'DCV') {
    dmmUnit = 'V';
    if (isConnected('dmm:v_ohm', 'psu:pos') && isConnected('dmm:com', 'psu:neg')) {
      dmmReading = psuResult.actualV;
    } else if (isConnected('dmm:v_ohm', 'psu:neg') && isConnected('dmm:com', 'psu:pos')) {
      dmmReading = -psuResult.actualV;
    } else if (isConnected('dmm:v_ohm', 'board:PWR:p12v') && isConnected('dmm:com', 'board:PWR:gnd')) {
      dmmReading = 12.0;
    } else if (isConnected('dmm:v_ohm', 'board:PWR:p5v') && isConnected('dmm:com', 'board:PWR:gnd')) {
      dmmReading = 5.0;
    } else if (isConnected('dmm:v_ohm', 'board:PWR:n12v') && isConnected('dmm:com', 'board:PWR:gnd')) {
      dmmReading = -12.0;
    } else if (isConnected('dmm:v_ohm', 'board:PWR:p12v') && isConnected('dmm:com', 'board:PWR:n12v')) {
      dmmReading = 24.0;
    } else if (sourceTo('dmm:v_ohm')) {
      dmmReading = sourceTo('dmm:v_ohm')!.offset;
    } else if (isConnected('dmm:v_ohm', 'scope:probe_comp')) {
      dmmReading = 1.5; // DC average of 0-3V 50% square
    } else {
      dmmReading = 0.0;
    }
  } else if (multimeterMode === 'ACV') {
    dmmUnit = 'V';
    if (sourceTo('dmm:v_ohm')) {
      const driver = sourceTo('dmm:v_ohm')!;
      dmmReading = driver.vpp > 0 ? calculateUT33DPlusACReading(driver.type, driver.vpp) : 0.0;
    } else if (isConnected('dmm:v_ohm', 'scope:probe_comp')) {
      dmmReading = calculateUT33DPlusACReading('square', 3.0);
    } else {
      dmmReading = 0.0;
    }
  } else if (multimeterMode === 'DCA') {
    dmmUnit = 'A';
    // Current only flows if connected in circuit with the PSU
    if (isDmmShuntConnected) {
      dmmReading = psuResult.actualI;
    } else {
      dmmReading = 0.0;
    }
  } else if (multimeterMode === 'OHM') {
    dmmUnit = 'Ω';
    // Resistance between test leads
    if (isConnected('dmm:v_ohm', 'dmm:com')) {
      dmmReading = 0.05; // 0.05 ohm probe lead resistance
    } else {
      // Check each board resistor
      const resPairs: [string, string, number][] = [
        ['board:R_50:a', 'board:R_50:b', 50],
        ['board:R_100:a', 'board:R_100:b', 100],
        ['board:R_220:a', 'board:R_220:b', 220],
        ['board:R_470:a', 'board:R_470:b', 470],
        ['board:R_560:a', 'board:R_560:b', 560],
        ['board:R_1k:a', 'board:R_1k:b', 1000],
        ['board:R_1k_1:a', 'board:R_1k_1:b', 1000],
        ['board:R_1k_2:a', 'board:R_1k_2:b', 1000],
        ['board:R_2k2:a', 'board:R_2k2:b', 2200],
        ['board:R_4k7:a', 'board:R_4k7:b', 4700],
        ['board:R_5k_1:a', 'board:R_5k_1:b', 5000],
        ['board:R_5k_2:a', 'board:R_5k_2:b', 5000],
        ['board:R_10k:a', 'board:R_10k:b', 10000],
        ['board:R_10k_1:a', 'board:R_10k_1:b', 10000],
        ['board:R_10k_2:a', 'board:R_10k_2:b', 10000],
        ['board:R_20k:a', 'board:R_20k:b', 20000],
        ['board:R_47k:a', 'board:R_47k:b', 47000],
        ['board:R_50k:a', 'board:R_50k:b', 50000],
        ['board:R_100k:a', 'board:R_100k:b', 100000],
        ['board:R_200k_1:a', 'board:R_200k_1:b', 200000],
        ['board:R_200k_2:a', 'board:R_200k_2:b', 200000],
        ['board:R_500k:a', 'board:R_500k:b', 500000],
        ['board:R_1M:a', 'board:R_1M:b', 1000000],
      ];

      let foundR = -1;
      for (const [pA, pB, val] of resPairs) {
        if (
          (isConnected('dmm:v_ohm', pA) && isConnected('dmm:com', pB)) ||
          (isConnected('dmm:v_ohm', pB) && isConnected('dmm:com', pA))
        ) {
          foundR = val;
          break;
        }
      }

      if (foundR > 0) {
        dmmReading = foundR;
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_5k:1') && isConnected('dmm:com', 'board:POT_5k:3')) ||
        (isConnected('dmm:v_ohm', 'board:POT_5k:3') && isConnected('dmm:com', 'board:POT_5k:1'))
      ) {
        dmmReading = 5000;
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_5k:1') && isConnected('dmm:com', 'board:POT_5k:w')) ||
        (isConnected('dmm:v_ohm', 'board:POT_5k:w') && isConnected('dmm:com', 'board:POT_5k:1'))
      ) {
        const ratio = (boardValues['measPot5k'] ?? boardValues['pot5k'] ?? boardValues['POT_5k'] ?? 50) / 100;
        dmmReading = Math.max(1, Math.round(5000 * ratio));
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_5k:3') && isConnected('dmm:com', 'board:POT_5k:w')) ||
        (isConnected('dmm:v_ohm', 'board:POT_5k:w') && isConnected('dmm:com', 'board:POT_5k:3'))
      ) {
        const ratio = (boardValues['measPot5k'] ?? boardValues['pot5k'] ?? boardValues['POT_5k'] ?? 50) / 100;
        dmmReading = Math.max(1, Math.round(5000 * (1 - ratio)));
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_100k:1') && isConnected('dmm:com', 'board:POT_100k:3')) ||
        (isConnected('dmm:v_ohm', 'board:POT_100k:3') && isConnected('dmm:com', 'board:POT_100k:1'))
      ) {
        dmmReading = 100000;
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_100k:1') && isConnected('dmm:com', 'board:POT_100k:w')) ||
        (isConnected('dmm:v_ohm', 'board:POT_100k:w') && isConnected('dmm:com', 'board:POT_100k:1'))
      ) {
        const ratio = (boardValues['measPot100k'] ?? boardValues['pot100k'] ?? boardValues['POT_100k'] ?? 50) / 100;
        dmmReading = Math.max(1, Math.round(100000 * ratio));
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_100k:3') && isConnected('dmm:com', 'board:POT_100k:w')) ||
        (isConnected('dmm:v_ohm', 'board:POT_100k:w') && isConnected('dmm:com', 'board:POT_100k:3'))
      ) {
        const ratio = (boardValues['measPot100k'] ?? boardValues['pot100k'] ?? boardValues['POT_100k'] ?? 50) / 100;
        dmmReading = Math.max(1, Math.round(100000 * (1 - ratio)));
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_1M:1') && isConnected('dmm:com', 'board:POT_1M:3')) ||
        (isConnected('dmm:v_ohm', 'board:POT_1M:3') && isConnected('dmm:com', 'board:POT_1M:1'))
      ) {
        dmmReading = 1000000;
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_1M:1') && isConnected('dmm:com', 'board:POT_1M:w')) ||
        (isConnected('dmm:v_ohm', 'board:POT_1M:w') && isConnected('dmm:com', 'board:POT_1M:1'))
      ) {
        const ratio = (boardValues['measPot1M'] ?? boardValues['pot1M'] ?? boardValues['POT_1M'] ?? 50) / 100;
        dmmReading = Math.max(1, Math.round(1000000 * ratio));
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_1M:3') && isConnected('dmm:com', 'board:POT_1M:w')) ||
        (isConnected('dmm:v_ohm', 'board:POT_1M:w') && isConnected('dmm:com', 'board:POT_1M:3'))
      ) {
        const ratio = (boardValues['measPot1M'] ?? boardValues['pot1M'] ?? boardValues['POT_1M'] ?? 50) / 100;
        dmmReading = Math.max(1, Math.round(1000000 * (1 - ratio)));
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_10k:1') && isConnected('dmm:com', 'board:POT_10k:3')) ||
        (isConnected('dmm:v_ohm', 'board:POT_10k:3') && isConnected('dmm:com', 'board:POT_10k:1'))
      ) {
        dmmReading = 10000;
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_10k:1') && isConnected('dmm:com', 'board:POT_10k:w')) ||
        (isConnected('dmm:v_ohm', 'board:POT_10k:w') && isConnected('dmm:com', 'board:POT_10k:1'))
      ) {
        const potRatio = (boardValues['POT_10k'] ?? 50) / 100;
        dmmReading = Math.max(1, Math.round(10000 * potRatio));
      } else if (
        (isConnected('dmm:v_ohm', 'board:POT_10k:3') && isConnected('dmm:com', 'board:POT_10k:w')) ||
        (isConnected('dmm:v_ohm', 'board:POT_10k:w') && isConnected('dmm:com', 'board:POT_10k:3'))
      ) {
        const potRatio = (boardValues['POT_10k'] ?? 50) / 100;
        dmmReading = Math.max(1, Math.round(10000 * (1 - potRatio)));
      } else {
        dmmReading = -1; // Overload / Open circuit (OL)
      }
    }
  } else if (multimeterMode === 'CONT') {
    dmmUnit = 'Ω';
    if (isConnected('dmm:v_ohm', 'dmm:com')) {
      dmmReading = 0.05;
    } else if (
      (isConnected('dmm:v_ohm', 'board:R_100:a') && isConnected('dmm:com', 'board:R_100:b')) ||
      (isConnected('dmm:v_ohm', 'board:R_100:b') && isConnected('dmm:com', 'board:R_100:a')) ||
      (isConnected('dmm:v_ohm', 'board:R_50:a') && isConnected('dmm:com', 'board:R_50:b')) ||
      (isConnected('dmm:v_ohm', 'board:R_50:b') && isConnected('dmm:com', 'board:R_50:a'))
    ) {
      dmmReading = 50;
    } else {
      dmmReading = -1; // Open circuit
    }
  } else if (multimeterMode === 'DIODE') {
    dmmUnit = 'V';
    const isDiodeFwd =
      (isConnected('dmm:v_ohm', 'board:D_1N4007:a') && isConnected('dmm:com', 'board:D_1N4007:k')) ||
      (isConnected('dmm:v_ohm', 'board:D1:a') && isConnected('dmm:com', 'board:D1:k')) ||
      (isConnected('dmm:v_ohm', 'board:D2:a') && isConnected('dmm:com', 'board:D2:k')) ||
      (isConnected('dmm:v_ohm', 'board:D3:a') && isConnected('dmm:com', 'board:D3:k')) ||
      (isConnected('dmm:v_ohm', 'board:D_M1:a') && isConnected('dmm:com', 'board:D_M1:k')) ||
      (isConnected('dmm:v_ohm', 'board:D_M2:a') && isConnected('dmm:com', 'board:D_M2:k'));
    const isDiodeRev =
      (isConnected('dmm:v_ohm', 'board:D_1N4007:k') && isConnected('dmm:com', 'board:D_1N4007:a')) ||
      (isConnected('dmm:v_ohm', 'board:D1:k') && isConnected('dmm:com', 'board:D1:a')) ||
      (isConnected('dmm:v_ohm', 'board:D2:k') && isConnected('dmm:com', 'board:D2:a')) ||
      (isConnected('dmm:v_ohm', 'board:D3:k') && isConnected('dmm:com', 'board:D3:a')) ||
      (isConnected('dmm:v_ohm', 'board:D_M1:k') && isConnected('dmm:com', 'board:D_M1:a')) ||
      (isConnected('dmm:v_ohm', 'board:D_M2:k') && isConnected('dmm:com', 'board:D_M2:a'));

    if (isConnected('dmm:v_ohm', 'dmm:com')) {
      dmmReading = 0.000;
    } else if (isDiodeFwd) {
      dmmReading = 0.635; // 1N4007 forward drop
    } else if (isDiodeRev) {
      dmmReading = -1; // Reverse biased OL
    } else {
      dmmReading = -1; // Overload
    }
  }

  // Calculate Galvanometer deflection in scale divisions (-30 to +30)
  let galvanometerCurrent = 0;
  const isG1Pos =
    isConnected('board:GALV:g1', 'psu:pos') ||
    isConnected('board:GALV:g1', 'board:PWR:p5v') ||
    isConnected('board:GALV:g1', 'board:PWR:p12v');
  const isG0Gnd =
    isConnected('board:GALV:g0', 'psu:neg') || isConnected('board:GALV:g0', 'board:PWR:gnd') ||
    isConnected('board:GALV:neg', 'psu:neg') || isConnected('board:GALV:neg', 'board:PWR:gnd');
  const isG0Pos =
    isConnected('board:GALV:g0', 'psu:pos') ||
    isConnected('board:GALV:g0', 'board:PWR:p5v') ||
    isConnected('board:GALV:g0', 'board:PWR:p12v');
  const isG1Gnd =
    isConnected('board:GALV:g1', 'psu:neg') || isConnected('board:GALV:g1', 'board:PWR:gnd');

  if (isG1Pos && isG0Gnd) {
    galvanometerCurrent = 30;
  } else if (isG0Pos && isG1Gnd) {
    galvanometerCurrent = -30;
  } else if ((isConnected('board:GALV:g1', 'board:POT_5k:w') || isConnected('board:GALV:g1', 'board:POT_10k:w')) && isG0Gnd) {
    const potRatio = (boardValues['pot5k'] ?? boardValues['POT_5k'] ?? boardValues['POT_10k'] ?? 50) / 100;
    galvanometerCurrent = Number(((potRatio - 0.5) * 60).toFixed(1));
  } else {
    // Check if connected in series with any resistor or pot across the PSU
    const v = psu.power && psu.outputEnabled ? psuResult.actualV : 0;
    if (v > 0) {
      for (const inst of boardInstances) {
        const netG1 = netFind(`${inst}:GALV:g1`);
        const netG0 = netFind(`${inst}:GALV:g0`);
        const netGNeg = netFind(`${inst}:GALV:neg`);
        const isNegOnG0 = negNets.has(netG0) || negNets.has(netGNeg);
        const isNegOnG1 = negNets.has(netG1);

        for (const [a, b, r] of branches) {
          const na = netFind(`${inst}:${a}`);
          const nb = netFind(`${inst}:${b}`);

          // Forward: PSU(+) -> branch -> G1, G0 -> PSU(-)
          if (isNegOnG0 && ((posNets.has(na) && nb === netG1) || (posNets.has(nb) && na === netG1))) {
            const currentA = v / (r + 75);
            // 300 µA = 30 divisions -> 1 division = 10 µA (1e-5 A)
            galvanometerCurrent = Math.min(30, Math.max(-30, Number((currentA * 100000).toFixed(1))));
            break;
          }
          // Reverse: PSU(+) -> branch -> G0, G1 -> PSU(-)
          if (isNegOnG1 && ((posNets.has(na) && (nb === netG0 || nb === netGNeg)) || (posNets.has(nb) && (na === netG0 || na === netGNeg)))) {
            const currentA = v / (r + 75);
            galvanometerCurrent = Math.min(30, Math.max(-30, Number((-currentA * 100000).toFixed(1))));
            break;
          }
        }
        if (galvanometerCurrent !== 0) break;
      }
    }
  }

  // Calculate Microammeter deflection in µA (0 to 50 µA) on MeasurementsBoard
  let microammeterCurrent = 0;
  const isUAPos =
    isConnected('measurements_board:UA:pos', 'psu:pos') ||
    isConnected('measurements_board:UA:pos', 'board:PWR:p5v') ||
    isConnected('measurements_board:UA:pos', 'board:PWR:p12v');
  const isUANeg =
    isConnected('measurements_board:UA:neg', 'psu:neg') ||
    isConnected('measurements_board:UA:neg', 'board:PWR:gnd');

  if (isUAPos && isUANeg) {
    // Direct connection across supply (clamped to max 50 µA)
    const v = psu.power ? psuResult.actualV : 5.0;
    microammeterCurrent = Math.min(50, Math.max(0, +(v * 5).toFixed(1)));
  } else if (isConnected('measurements_board:UA:pos', 'measurements_board:POT_5k:w') && isUANeg) {
    const ratio = (boardValues['measPot5k'] ?? boardValues['pot5k'] ?? 50) / 100;
    microammeterCurrent = Number((ratio * 50).toFixed(1));
  } else {
    // Check if connected in series with any resistor or pot across the PSU
    const v = psu.power && psu.outputEnabled ? psuResult.actualV : 0;
    if (v > 0) {
      for (const inst of boardInstances) {
        const netUAPos = netFind(`${inst}:UA:pos`);
        const netUANeg = netFind(`${inst}:UA:neg`);
        if (negNets.has(netUANeg)) {
          for (const [a, b, r] of branches) {
            const na = netFind(`${inst}:${a}`);
            const nb = netFind(`${inst}:${b}`);
            if ((posNets.has(na) && nb === netUAPos) || (posNets.has(nb) && na === netUAPos)) {
              // Current in amperes = v / (r + 1000), in µA = (v / (r + 1000)) * 1e6
              const currentUa = (v / (r + 1000)) * 1e6;
              microammeterCurrent = Math.min(50, Math.max(0, Number(currentUa.toFixed(1))));
              break;
            }
          }
        }
        if (microammeterCurrent !== 0) break;
      }
    }
  }

  return {
    scopeCh1Waveform: ch1Waveform,
    scopeCh2Waveform: ch2Waveform,
    psuActualVoltage: psuResult.actualV,
    psuActualCurrent: psuResult.actualI,
    psuMode: psuResult.mode,
    dmmReading,
    dmmUnit,
    galvanometerCurrent,
    microammeterCurrent,
    circuitInfo: {
      activeCircuitName,
      cutoffFrequency: filterInfo?.fc,
      gainDb: filterInfo?.gainDb,
      phaseShiftDeg: filterInfo?.phaseShiftDeg,
    },
  };
}
