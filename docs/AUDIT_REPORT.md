# Virtual Electronics Lab — Initial Engineering Audit

Date: 2026-11-04

## Changes applied in this pass

1. **RC high-pass at DC** — `calculateRCHighPass(..., f=0)` previously substituted an arbitrary epsilon for zero frequency. That produced a non-zero transfer gain for a capacitor-blocked DC signal. The solver now returns exactly zero gain and the limiting +90° phase at DC.
2. **Sampling-window validation** — `solveActiveCircuit` now rejects non-finite start/duration values, negative durations, non-integer point counts, zero points, and buffers above 100,000 points. This prevents malformed or unexpectedly large waveform allocations.
3. **UT33D+ diode/continuity selection** — the shared continuity/diode dial position previously always selected continuity, so the DIODE branch in the circuit engine could not be reached from the interface. The HOLD/SEL control now switches CONT ↔ DIODE while that dial position is selected; elsewhere it retains data-hold behavior. The diode display uses a 3-decimal voltage format.
4. **UT33D+ AC measurement model** — the previous implementation used true-RMS values for square and triangle waves. The UT33D+ manual describes an average-responding, sine-RMS-calibrated AC measurement. The solver now applies the sine form factor to average-rectified sine, triangle, and square waveforms.
5. **Regression coverage** — added tests for exact DC blocking in the RC high-pass, invalid sampling windows, and average-responding AC readings.

## Verification performed

- All 19 TypeScript/TSX source files passed a TypeScript transpile/syntax pass.
- `src/sim/circuitEngine.ts` and its type dependencies passed a standalone TypeScript compile.
- Targeted runtime checks passed for RC low-pass, RC high-pass DC blocking, PSU CV/CC behavior, sine RMS calculation, and the new AC meter model.
- Full application build and the repository's TypeScript project-wide check were **not** completed: dependencies were not present, and package installation did not complete in this environment. This is an environment limitation, not a successful build claim.

## Important architectural limitations found

The current `solveActiveCircuit` is a rule-based demonstration model, not a general circuit solver. It uses named-port connectivity checks and hard-coded circuit cases. In particular:

- It does not solve arbitrary resistor/capacitor/inductor/transistor networks using nodal analysis or modified nodal analysis.
- Component loading, source output impedance, meter input impedance, oscilloscope input capacitance, diode curves, transient capacitor/inductor state, and wire-ground reference behavior are not consistently solved as one circuit.
- Some trainer-board rails and experiment outputs are represented by fixed values or simplified formulae.
- Oscilloscope sampling, bandwidth, aliasing, trigger behavior, acquisition modes, and channel loading are not yet a complete instrument-grade physical model.
- The UT33D+ AC bandwidth is specified as 40–400Hz; the present waveform correction models the meter's average-responding behavior but does not yet model its frequency-response error outside that band.
- Multiple instances of identical instruments/boards need an explicit simulation-instance selection model; suffix-based port matching can make same-named ports ambiguous when several identical devices are on the bench.

These are not cosmetic issues. They are the main remaining work required before describing the lab as a physically faithful circuit simulator. They have been documented rather than concealed by broad rewrites in this initial pass.

## Next recommended engineering phase

1. Replace heuristic connectivity checks with a netlist builder that preserves instrument and board instance IDs.
2. Add a deterministic DC operating-point solver (modified nodal analysis) for resistors, independent sources, and supported diode models.
3. Add transient state integration for capacitors and inductors, then AC small-signal analysis.
4. Connect all instruments to the same solved network, including input impedance, source impedance, probe attenuation, and meter loading.
5. Add model-specific instrument tests and end-to-end wiring scenarios before changing the UI further.
