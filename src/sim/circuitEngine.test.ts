import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRCLowPass,
  calculateRCHighPass,
  calculateRLCResonance,
  calculate555Timer,
  solvePowerSupply,
  computeVpp,
  computeVrms,
  calculateUT33DPlusACReading,
  generateWaveformSample,
  solveActiveCircuit,
  calculateBoardFilter,
} from './circuitEngine.js';

test('RC Low-Pass Filter calculates correct cutoff frequency and -3dB gain', () => {
  const r = 1000; // 1 kOhm
  const c = 0.1e-6; // 0.1 uF
  // Theoretical fc = 1 / (2 * pi * 1000 * 1e-7) ≈ 1591.55 Hz
  const expectedFc = 1 / (2 * Math.PI * r * c);

  const resAtFc = calculateRCLowPass(r, c, expectedFc);
  assert.ok(Math.abs(resAtFc.fc - 1591.55) < 1.0, `Expected fc ~1591.55, got ${resAtFc.fc}`);
  // Gain at fc must be 1/sqrt(2) ≈ 0.7071 (-3.01 dB)
  assert.ok(Math.abs(resAtFc.gain - 0.7071) < 0.01, `Expected gain ~0.7071, got ${resAtFc.gain}`);
  assert.ok(Math.abs(resAtFc.phaseDeg - -45.0) < 0.5, `Expected phase -45 deg, got ${resAtFc.phaseDeg}`);

  // Well below cutoff (f = 100 Hz), gain ~ 1.0 (0 dB)
  const resLow = calculateRCLowPass(r, c, 100);
  assert.ok(resLow.gain > 0.99, `Low freq gain should be close to 1, got ${resLow.gain}`);

  // Well above cutoff (f = 10000 Hz), gain attenuated
  const resHigh = calculateRCLowPass(r, c, 10000);
  assert.ok(resHigh.gain < 0.2, `High freq gain should be <0.2, got ${resHigh.gain}`);
  assert.ok(resHigh.phaseDeg < -80, `High freq phase should approach -90 deg, got ${resHigh.phaseDeg}`);
});

test('RC High-Pass Filter passes high frequencies and blocks DC', () => {
  const r = 1000;
  const c = 0.1e-6;
  const fc = 1 / (2 * Math.PI * r * c);

  const resAtFc = calculateRCHighPass(r, c, fc);
  assert.ok(Math.abs(resAtFc.gain - 0.7071) < 0.01);
  assert.ok(Math.abs(resAtFc.phaseDeg - 45.0) < 0.5);

  const resHigh = calculateRCHighPass(r, c, 100000);
  assert.ok(resHigh.gain > 0.99);

  // At exactly DC, a series capacitor blocks the signal completely.
  const resAtDc = calculateRCHighPass(r, c, 0);
  assert.equal(resAtDc.gain, 0);
  assert.equal(resAtDc.gainDb, -120);
  assert.equal(resAtDc.phaseDeg, 90);
});

test('RLC Series Resonant Circuit calculates resonance peak f0 and maximum response', () => {
  const r = 100; // 100 Ohm
  const l = 10e-3; // 10 mH
  const c = 0.1e-6; // 0.1 uF
  // Theoretical f0 = 1 / (2 * pi * sqrt(10e-3 * 1e-7)) ≈ 5032.9 Hz
  const expectedF0 = 1 / (2 * Math.PI * Math.sqrt(l * c));

  const atF0 = calculateRLCResonance(r, l, c, expectedF0);
  assert.ok(Math.abs(atF0.f0 - 5032.9) < 2.0);
  // At resonance, total reactance XL - XC = 0, impedance = R, gain across R = 1.0, phase = 0
  assert.ok(Math.abs(atF0.impedance - r) < 0.01);
  assert.ok(Math.abs(atF0.gain - 1.0) < 0.01);
  assert.ok(Math.abs(atF0.phaseDeg) < 0.01);
});

test('555 Astable Multivibrator calculates oscillation frequency and duty cycle', () => {
  const r1 = 1000; // 1 kOhm
  const r2 = 10000; // 10 kOhm
  const c = 0.1e-6; // 0.1 uF
  // Theoretical f = 1.44 / ((1000 + 20000) * 1e-7) ≈ 685.7 Hz
  const timer = calculate555Timer(r1, r2, c);
  assert.ok(Math.abs(timer.frequency - 685.7) < 5.0, `Expected f ~685.7, got ${timer.frequency}`);
  assert.ok(timer.dutyCycle > 0.5 && timer.dutyCycle < 0.6, `Expected duty cycle ~0.52, got ${timer.dutyCycle}`);
});

test('ATTEN Power supply transitions smoothly between CV and CC mode', () => {
  // Set 12V with 1A current limit. With 24 Ohm load -> I = 0.5A <= 1A -> CV mode
  const cvRes = solvePowerSupply(12.0, 1.0, 24.0, true);
  assert.equal(cvRes.mode, 'CV');
  assert.equal(cvRes.actualV, 12.0);
  assert.ok(Math.abs(cvRes.actualI - 0.5) < 0.01);

  // With 6 Ohm load -> potential I = 2A > 1A -> CC mode: limits to 1A, V collapses to 6V
  const ccRes = solvePowerSupply(12.0, 1.0, 6.0, true);
  assert.equal(ccRes.mode, 'CC');
  assert.equal(ccRes.actualI, 1.0);
  assert.equal(ccRes.actualV, 6.0);

  // When output switch is off, 0V and 0A
  const offRes = solvePowerSupply(12.0, 1.0, 24.0, false);
  assert.equal(offRes.actualV, 0);
  assert.equal(offRes.actualI, 0);
});

test('Waveform generation and RMS / Vpp math are mathematically consistent', () => {
  const samples: number[] = [];
  const freq = 1000;
  const vpp = 10.0;
  const numSamples = 1000;
  for (let i = 0; i < numSamples; i++) {
    const t = i / (freq * numSamples);
    samples.push(generateWaveformSample(t, 'sine', freq, vpp, 0));
  }

  const calculatedVpp = computeVpp(samples);
  assert.ok(Math.abs(calculatedVpp - 10.0) < 0.1, `Vpp should be ~10, got ${calculatedVpp}`);

  const calculatedVrms = computeVrms(samples);
  // For sine wave: Vrms = (Vpp / 2) / sqrt(2) = 5 / 1.4142 ≈ 3.5355 V
  assert.ok(Math.abs(calculatedVrms - 3.535) < 0.05, `Vrms should be ~3.535, got ${calculatedVrms}`);
});

test('Training Board circuit solving calculates authentic measurements for components', () => {
  const defaultScope = {
    power: true,
    ch1: { enabled: true, voltsPerDiv: 1, position: 0, coupling: 'DC' as const, probe: 1, invert: false, bwLimit: false, voltsFine: false },
    ch2: { enabled: true, voltsPerDiv: 1, position: 0, coupling: 'DC' as const, probe: 1, invert: false, bwLimit: false, voltsFine: false },
    math: { enabled: false, mode: 'CH1+CH2' as const, fftWindow: 'Hanning' as const, fftUnit: 'Vrms' as const },
    timePerDiv: 1e-3,
    horizPosition: 0,
    trigger: { source: 'CH1' as const, slope: 'rising' as const, level: 0, mode: 'Auto' as const, coupling: 'DC' as const },
    measurements: { ch1Vpp: true, ch1Vrms: true, ch1Freq: true, ch2Vpp: true, ch2Vrms: true, ch2Freq: true },
    menuOpen: null,
  } as unknown as import('../types/lab.js').ScopeState;

  const defaultGen = {
    power: true,
    frequency: 1000,
    range: 1000,
    freqDial: 1.0,
    fineDial: 0,
    waveform: 'sine' as const,
    amplitude: 5.0,
    dcOffset: 0,
    symmetry: 0.5,
    attenuation: 0 as const,
    inverted: false,
    ttlOut: true,
  } as unknown as import('../types/lab.js').FunctionGenState;
  const defaultPsu = {
    power: true,
    outputEnabled: true,
    voltageSet: 12.0,
    currentLimit: 1.0,
    voltageActual: 12.0,
    currentActual: 0,
    mode: 'CV' as const,
  };

  // 1. DMM probes across 1k resistor on board
  const res1k = solveActiveCircuit({
    wires: [
      { id: 'w1', fromPortId: 'dmm-1:v_ohm', toPortId: 'board-1:R_1k:a', color: 'red', type: 'banana' },
      { id: 'w2', fromPortId: 'dmm-1:com', toPortId: 'board-1:R_1k:b', color: 'black', type: 'banana' },
    ],
    gen: defaultGen,
    psu: defaultPsu,
    scope: defaultScope,
    boardValues: {},
    multimeterMode: 'OHM',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 10 },
  });
  assert.equal(res1k.dmmReading, 1000);

  // 2. DMM probes across 1N4007 Diode (Anode to Red, Cathode to COM)
  const diodeRes = solveActiveCircuit({
    wires: [
      { id: 'w1', fromPortId: 'dmm-1:v_ohm', toPortId: 'board-1:D_1N4007:a', color: 'red', type: 'banana' },
      { id: 'w2', fromPortId: 'dmm-1:com', toPortId: 'board-1:D_1N4007:k', color: 'black', type: 'banana' },
    ],
    gen: defaultGen,
    psu: defaultPsu,
    scope: defaultScope,
    boardValues: {},
    multimeterMode: 'DIODE',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 10 },
  });
  assert.equal(diodeRes.dmmReading, 0.635);

  // 3. DMM probes across Board +12V Rail and GND
  const railRes = solveActiveCircuit({
    wires: [
      { id: 'w1', fromPortId: 'dmm-1:v_ohm', toPortId: 'board-1:PWR:p12v', color: 'red', type: 'banana' },
      { id: 'w2', fromPortId: 'dmm-1:com', toPortId: 'board-1:PWR:gnd', color: 'black', type: 'banana' },
    ],
    gen: defaultGen,
    psu: defaultPsu,
    scope: defaultScope,
    boardValues: {},
    multimeterMode: 'DCV',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 10 },
  });
  assert.equal(railRes.dmmReading, 12.0);

  // 4. Galvanometer deflection connected to Potentiometer Wiper
  const galvRes = solveActiveCircuit({
    wires: [
      { id: 'w1', fromPortId: 'board-1:GALV:g1', toPortId: 'board-1:POT_10k:w', color: 'blue', type: 'banana' },
      { id: 'w2', fromPortId: 'board-1:GALV:g0', toPortId: 'board-1:PWR:gnd', color: 'black', type: 'banana' },
    ],
    gen: defaultGen,
    psu: defaultPsu,
    scope: defaultScope,
    boardValues: { POT_10k: 75 }, // wiper at 75%
    multimeterMode: 'DCV',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 10 },
  });
  // ratio = 0.75 -> (0.75 - 0.5) * 60 = 15.0 uA
  assert.equal(galvRes.galvanometerCurrent, 15.0);
});



test('Active circuit solver rejects invalid sampling windows', () => {
  const baseParams = {
    wires: [],
    gen: { power: false, frequency: 1000, range: 1000, freqDial: 1, fineDial: 0, waveform: 'sine' as const, amplitude: 5, dcOffset: 0, symmetry: 0.5, attenuation: 0 as const, inverted: false, ttlOut: false },
    psu: { power: false, outputEnabled: false, voltageSet: 0, currentLimit: 0, voltageActual: 0, currentActual: 0, mode: 'CV' as const },
    scope: {} as import('../types/lab.js').ScopeState,
    boardValues: {},
    multimeterMode: 'DCV',
  };

  assert.throws(() => solveActiveCircuit({ ...baseParams, timeWindow: { start: 0, duration: 1, numPoints: 0 } }), RangeError);
  assert.throws(() => solveActiveCircuit({ ...baseParams, timeWindow: { start: 0, duration: -1, numPoints: 10 } }), RangeError);
  assert.throws(() => solveActiveCircuit({ ...baseParams, timeWindow: { start: 0, duration: 1, numPoints: 100001 } }), RangeError);
});


test('UT33D+ AC voltage uses average-responding sine calibration', () => {
  const vpp = 10;
  const peak = vpp / 2;
  const sineRms = peak / Math.SQRT2;
  const squareReading = peak * Math.PI / (2 * Math.SQRT2);
  const triangleReading = (peak / 2) * Math.PI / (2 * Math.SQRT2);

  assert.ok(Math.abs(calculateUT33DPlusACReading('sine', vpp) - sineRms) < 1e-10);
  assert.ok(Math.abs(calculateUT33DPlusACReading('square', vpp) - squareReading) < 1e-10);
  assert.ok(Math.abs(calculateUT33DPlusACReading('triangle', vpp) - triangleReading) < 1e-10);
});

test('Filter board: active LPF attenuates above fc, HPF attenuates below fc, BPF peaks at f0', () => {
  const j = { g1: 10e-9, g2: 10e-9 };
  const lpf = calculateBoardFilter('active_lpf', 100, j);
  const lpfHi = calculateBoardFilter('active_lpf', 100_000, j);
  assert.ok(lpf.gain > 0.99 && lpfHi.gain < 0.01);
  const hpf = calculateBoardFilter('active_hpf', 100, j);
  const hpfHi = calculateBoardFilter('active_hpf', 100_000, j);
  assert.ok(hpf.gain < 0.01 && hpfHi.gain > 0.99);
  const atFc = calculateBoardFilter('active_lpf', lpf.fc, j);
  assert.ok(Math.abs(atFc.gain - Math.SQRT1_2) < 1e-6);
  const f0 = calculateBoardFilter('passive_bpf', 1000).fc;
  assert.ok(Math.abs(calculateBoardFilter('passive_bpf', f0).gain - 1) < 1e-6);
  assert.ok(calculateBoardFilter('passive_bpf', f0 / 10).gain < 0.2);
});

test('Passive LC low-pass and high-pass sections behave like damped 2nd-order filters', () => {
  const lpfLow = calculateBoardFilter('passive_lpf', 100);
  const lpfHigh = calculateBoardFilter('passive_lpf', 200_000);
  assert.ok(lpfLow.gain > 0.99, `Passband gain should be ~1, got ${lpfLow.gain}`);
  assert.ok(lpfHigh.gain < 0.01, `Stopband gain should be tiny, got ${lpfHigh.gain}`);

  const hpfLow = calculateBoardFilter('passive_hpf', 100);
  const hpfHigh = calculateBoardFilter('passive_hpf', 200_000);
  assert.ok(hpfLow.gain < 0.01, `HPF should block 100 Hz, got ${hpfLow.gain}`);
  assert.ok(hpfHigh.gain > 0.95, `HPF should pass 200 kHz, got ${hpfHigh.gain}`);

  // f0 = 1 / (2π√(LC)) with L=10mH, C=100nF ≈ 5033 Hz
  assert.ok(Math.abs(lpfLow.fc - 5033) < 5, `Expected f0 ~5033 Hz, got ${lpfLow.fc}`);
  // A real LC tank is damped by source resistance, so it peaks instead of exploding.
  assert.ok(calculateBoardFilter('passive_lpf', lpfLow.fc).gain > 3);
});

test('Filter trainer jumpers change the active cutoff frequency coherently', () => {
  const fcSingle = calculateBoardFilter('active_lpf', 1000, { g1: 10e-9, g2: 10e-9 }).fc;
  const fcStacked = calculateBoardFilter('active_lpf', 1000, { g1: 57e-9, g2: 10e-9 }).fc;
  assert.ok(fcStacked < fcSingle * 0.7, `Adding C3 in parallel must lower fc (${fcSingle} → ${fcStacked})`);

  const atCutoff = calculateBoardFilter('active_hpf', fcStacked, { g1: 57e-9, g2: 10e-9 });
  assert.ok(Math.abs(atCutoff.gain - Math.SQRT1_2) < 1e-6, 'Active HPF must be -3 dB at its fc');
});

test('Power supply sees the resistor patched across its terminals (CV → CC)', () => {
  const scope = { power: true } as unknown as import('../types/lab.js').ScopeState;
  const gen = { power: false } as unknown as import('../types/lab.js').FunctionGenState;
  const wires = [
    { id: 'w1', fromPortId: 'psu-1:pos', toPortId: 'board-1:R_1k:a', color: 'red', type: 'banana' as const },
    { id: 'w2', fromPortId: 'psu-1:neg', toPortId: 'board-1:R_1k:b', color: 'black', type: 'banana' as const },
  ];
  const cv = solveActiveCircuit({
    wires,
    gen,
    psu: { power: true, outputEnabled: true, voltageSet: 12, currentLimit: 1, voltageActual: 12, currentActual: 0, mode: 'CV' },
    scope,
    boardValues: {},
    multimeterMode: 'DCV',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 8 },
  });
  assert.equal(cv.psuMode, 'CV');
  assert.ok(Math.abs(cv.psuActualCurrent - 0.012) < 0.0005, `Expected 12 mA, got ${cv.psuActualCurrent}`);

  const cc = solveActiveCircuit({
    wires,
    gen,
    psu: { power: true, outputEnabled: true, voltageSet: 12, currentLimit: 0.005, voltageActual: 12, currentActual: 0, mode: 'CV' },
    scope,
    boardValues: {},
    multimeterMode: 'DCV',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 8 },
  });
  assert.equal(cc.psuMode, 'CC');
  assert.ok(Math.abs(cc.psuActualVoltage - 5) < 0.01, `Expected 5 V in CC, got ${cc.psuActualVoltage}`);
});

test('Generator INVERT flips the waveform about its DC offset', () => {
  const scope = { power: true } as unknown as import('../types/lab.js').ScopeState;
  const psu = { power: false, outputEnabled: false } as unknown as import('../types/lab.js').PowerSupplyState;
  const wires = [
    { id: 'w1', fromPortId: 'gen-1:output', toPortId: 'scope-1:ch1', color: 'blue', type: 'banana' as const },
  ];
  const baseGen = {
    power: true, frequency: 1000, range: 1000, freqDial: 1, fineDial: 0, waveform: 'sine' as const,
    amplitude: 6, dcOffset: 2, symmetry: 0.5, attenuation: 0 as const, ttlOut: true,
  };
  const normal = solveActiveCircuit({
    wires, gen: { ...baseGen, inverted: false }, psu, scope, boardValues: {}, multimeterMode: 'DCV',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 32 },
  });
  const inverted = solveActiveCircuit({
    wires, gen: { ...baseGen, inverted: true }, psu, scope, boardValues: {}, multimeterMode: 'DCV',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 32 },
  });
  for (let i = 0; i < normal.scopeCh1Waveform.length; i++) {
    const sum = normal.scopeCh1Waveform[i].voltage + inverted.scopeCh1Waveform[i].voltage;
    assert.ok(Math.abs(sum - 2 * baseGen.dcOffset) < 1e-6, `Inversion must mirror around the DC offset, got ${sum}`);
  }
});

test('End-to-end: generator → active LPF patch → scope channel', () => {
  const scope = {
    power: true,
    ch1: { enabled: true, voltsPerDiv: 1, position: 0, coupling: 'DC', probe: 1, invert: false, bwLimit: false, voltsFine: false },
  } as unknown as import('../types/lab.js').ScopeState;
  const wires = [
    { id: 'w1', fromPortId: 'gen-1:output', toPortId: 'filterboard-1:lpf_in_p', color: 'blue', type: 'banana' as const },
    { id: 'w2', fromPortId: 'filterboard-1:lpf_out_p', toPortId: 'scope-1:ch1', color: 'blue', type: 'banana' as const },
    { id: 'w3', fromPortId: 'filterboard-1:lpf_j1_a', toPortId: 'filterboard-1:lpf_j1_b', color: 'blue', type: 'banana' as const },
    { id: 'w4', fromPortId: 'filterboard-1:lpf_j2_a', toPortId: 'filterboard-1:lpf_j2_b', color: 'blue', type: 'banana' as const },
  ];
  const res = solveActiveCircuit({
    wires,
    gen: { power: true, frequency: 1000, range: 1000, freqDial: 1, fineDial: 0, waveform: 'sine', amplitude: 5, dcOffset: 0, symmetry: 0.5, attenuation: 0, inverted: false, ttlOut: true },
    psu: { power: false, outputEnabled: false, voltageSet: 0, currentLimit: 0, voltageActual: 0, currentActual: 0, mode: 'CV' },
    scope,
    boardValues: {},
    multimeterMode: 'DCV',
    timeWindow: { start: 0, duration: 2e-3, numPoints: 401 },
  });
  assert.match(res.circuitInfo.activeCircuitName, /Low-Pass/);
  assert.ok(Math.abs((res.circuitInfo.cutoffFrequency ?? 0) - 1591.5) < 2, 'fc should be ~1591 Hz');
  const vpp = computeVpp(res.scopeCh1Waveform.map((p) => p.voltage));
  assert.ok(vpp > 4.3 && vpp < 4.8, `Filtered 1 kHz sine should be ~4.5 Vpp, got ${vpp}`);
});

test('Electronics Training Board (IMG_20261105_122510): Galvanometer J0409 and 18-resistor matrix', () => {
  const defaultScope = { power: true, ch1: { enabled: true, voltsPerDiv: 1, position: 0, coupling: 'DC', probe: 1, invert: false, bwLimit: false, voltsFine: false } } as unknown as import('../types/lab.js').ScopeState;
  const defaultGen = { power: false, frequency: 1000, range: 1000, freqDial: 1, fineDial: 0, waveform: 'sine' as const, amplitude: 5, dcOffset: 0, symmetry: 0.5, attenuation: 0 as const, inverted: false, ttlOut: true };
  const defaultPsu = { power: true, outputEnabled: true, voltageSet: 10.0, currentLimit: 1.0, voltageActual: 10.0, currentActual: 0, mode: 'CV' as const };

  // 1. Galvanometer deflection test: PSU 10V across 100k + Galvanometer (internal ~75Ω)
  // I = 10V / 100kΩ = 0.1mA = 100µA. On a 300µA FSD scale (-30 to +30 divs where 30 = 300µA), 100µA = +10 divs
  const galvTest = solveActiveCircuit({
    wires: [
      { id: 'w1', fromPortId: 'psu-1:pos', toPortId: 'board-1:R_100k:a', color: 'red', type: 'banana' },
      { id: 'w2', fromPortId: 'board-1:R_100k:b', toPortId: 'board-1:GALV:g1', color: 'red', type: 'banana' },
      { id: 'w3', fromPortId: 'board-1:GALV:g0', toPortId: 'psu-1:neg', color: 'black', type: 'banana' },
    ],
    gen: defaultGen,
    psu: defaultPsu,
    scope: defaultScope,
    boardValues: {},
    multimeterMode: 'DCV',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 10 },
  });
  assert.ok(galvTest.galvanometerCurrent > 9 && galvTest.galvanometerCurrent < 11, `Galvanometer should read ~10 divisions, got ${galvTest.galvanometerCurrent}`);

  // 2. Measure R_50 (50 ohm resistor)
  const r50Test = solveActiveCircuit({
    wires: [
      { id: 'w1', fromPortId: 'dmm-1:v_ohm', toPortId: 'board-1:R_50:a', color: 'red', type: 'banana' },
      { id: 'w2', fromPortId: 'dmm-1:com', toPortId: 'board-1:R_50:b', color: 'black', type: 'banana' },
    ],
    gen: defaultGen,
    psu: defaultPsu,
    scope: defaultScope,
    boardValues: {},
    multimeterMode: 'OHM',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 10 },
  });
  assert.equal(r50Test.dmmReading, 50);

  // 3. Potentiometer 5k wiper resistance at 40% (2k)
  const pot5kTest = solveActiveCircuit({
    wires: [
      { id: 'w1', fromPortId: 'dmm-1:v_ohm', toPortId: 'board-1:POT_5k:1', color: 'red', type: 'banana' },
      { id: 'w2', fromPortId: 'dmm-1:com', toPortId: 'board-1:POT_5k:w', color: 'black', type: 'banana' },
    ],
    gen: defaultGen,
    psu: defaultPsu,
    scope: defaultScope,
    boardValues: { pot5k: 40 },
    multimeterMode: 'OHM',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 10 },
  });
  assert.equal(pot5kTest.dmmReading, 2000);
});

test('Measurements Training Board (IMG_20261105_122517): Microammeter µA and 1M Potentiometer', () => {
  const defaultScope = { power: true, ch1: { enabled: true, voltsPerDiv: 1, position: 0, coupling: 'DC', probe: 1, invert: false, bwLimit: false, voltsFine: false } } as unknown as import('../types/lab.js').ScopeState;
  const defaultGen = { power: false, frequency: 1000, range: 1000, freqDial: 1, fineDial: 0, waveform: 'sine' as const, amplitude: 5, dcOffset: 0, symmetry: 0.5, attenuation: 0 as const, inverted: false, ttlOut: true };
  const defaultPsu = { power: true, outputEnabled: true, voltageSet: 5.0, currentLimit: 1.0, voltageActual: 5.0, currentActual: 0, mode: 'CV' as const };

  // Microammeter deflection: 5V across 200kΩ = 25µA
  const uaTest = solveActiveCircuit({
    wires: [
      { id: 'w1', fromPortId: 'psu-1:pos', toPortId: 'measurements_board-1:R_200k_1:a', color: 'red', type: 'banana' },
      { id: 'w2', fromPortId: 'measurements_board-1:R_200k_1:b', toPortId: 'measurements_board-1:UA:pos', color: 'red', type: 'banana' },
      { id: 'w3', fromPortId: 'measurements_board-1:UA:neg', toPortId: 'psu-1:neg', color: 'black', type: 'banana' },
    ],
    gen: defaultGen,
    psu: defaultPsu,
    scope: defaultScope,
    boardValues: {},
    multimeterMode: 'DCV',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 10 },
  });
  assert.ok(
    (uaTest.microammeterCurrent ?? 0) >= 24 && (uaTest.microammeterCurrent ?? 0) <= 26,
    `Microammeter should read ~25 µA, got ${uaTest.microammeterCurrent}`
  );

  // 1M Potentiometer at 70% (700kΩ)
  const pot1mTest = solveActiveCircuit({
    wires: [
      { id: 'w1', fromPortId: 'dmm-1:v_ohm', toPortId: 'measurements_board-1:POT_1M:1', color: 'red', type: 'banana' },
      { id: 'w2', fromPortId: 'dmm-1:com', toPortId: 'measurements_board-1:POT_1M:w', color: 'black', type: 'banana' },
    ],
    gen: defaultGen,
    psu: defaultPsu,
    scope: defaultScope,
    boardValues: { measPot1M: 70 },
    multimeterMode: 'OHM',
    timeWindow: { start: 0, duration: 1e-3, numPoints: 10 },
  });
  assert.equal(pot1mTest.dmmReading, 700000);
});

test('Pulse duty, ramp symmetry and noise determinism', () => {
  const period = 1 / 1000;
  assert.equal(generateWaveformSample(0, 'pulse', 1000, 2, 0, 0, 0.25), 1);
  assert.equal(generateWaveformSample(0.4 * period, 'pulse', 1000, 2, 0, 0, 0.25), -1);
  assert.ok(Math.abs(generateWaveformSample(0.25 * period, 'ramp', 1000, 2, 0, 0, 0.5)) < 1e-9);
  const n1 = generateWaveformSample(0.123, 'noise', 1000, 2, 0);
  const n2 = generateWaveformSample(0.123, 'noise', 1000, 2, 0);
  assert.equal(n1, n2, 'Noise must be deterministic for a stable trace');
  assert.notEqual(n1, generateWaveformSample(0.124, 'noise', 1000, 2, 0));
});

