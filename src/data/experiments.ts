import { LabExperiment } from '../types/lab';

export const LAB_EXPERIMENTS: LabExperiment[] = [
  {
    id: 'direct_bnc',
    title: '1. Direct Generator-to-Scope BNC Connection',
    subtitle: 'Waveform inspection & Oscilloscope Auto Setup',
    description:
      'Connect the LW-1641 Function Generator output directly to Oscilloscope CH1 using a 50Ω BNC cable. Verify sine, square, and triangle waveforms, and observe automatic trigger synchronization.',
    theory:
      'The BNC cable provides an impedance-matched (50Ω) coaxial connection that minimizes reflections and external electromagnetic interference. The oscilloscope internal input impedance is 1MΩ // 16pF.',
    expectedOutcome:
      'At 1.000 kHz and 5.0 Vpp, the scope screen displays clean cycles. Pressing AUTO adjusts V/div and Time/div for an optimal view, and MEASURE shows ~1.000 kHz and 5.00 Vpp.',
    boardConfig: {
      activeCircuit: 'direct_bnc',
      defaultValues: {},
    },
    presetWires: [
      { from: 'gen:output', to: 'scope:ch1', color: 'black', type: 'bnc' },
    ],
    instruments: {
      gen: {
        power: true,
        frequency: 1000,
        range: 1000,
        freqDial: 1.0,
        fineDial: 0,
        waveform: 'sine',
        amplitude: 5.0,
        dcOffset: 0,
      },
      scope: {
        power: true,
        ch1: {
          enabled: true,
          voltsPerDiv: 1.0,
          position: 0,
          coupling: 'DC',
          probe: 1,
          invert: false,
        },
        timePerDiv: 500e-6, // 500us/div
        trigger: {
          source: 'CH1',
          mode: 'AUTO',
          slope: 'rising',
          level: 0,
          state: 'TRIGED',
        },
      },
    },
  },
  {
    id: 'rc_lowpass',
    title: '2. RC Low-Pass Filter Frequency Response',
    subtitle: 'College Lab Experiment: Cutoff frequency fc & Phase Shift',
    description:
      'Feed the AC test signal into the RC Low-Pass filter on the Trainer Board (R = 1.0 kΩ, C = 0.1 µF). Monitor filter input on Scope CH1 (Cyan) and filter output on Scope CH2 (Yellow). Sweep frequency from 100 Hz to 20 kHz.',
    theory:
      'The cutoff frequency is fc = 1 / (2π · R · C) ≈ 1591 Hz. Below fc, the output equals the input (gain ≈ 1, 0 dB). At fc, gain drops to 1/√2 ≈ 0.707 (-3 dB) and phase lags by -45°. Above fc, attenuation rolls off at -20 dB/decade and phase approaches -90°.',
    expectedOutcome:
      'At 1 kHz, CH2 amplitude matches CH1 closely. At fc ≈ 1.59 kHz, CH2 amplitude reduces to 70.7% of CH1 with visible phase lag. At 10 kHz, CH2 is heavily attenuated.',
    boardConfig: {
      activeCircuit: 'rc_lowpass',
      defaultValues: { R1: 1000, C1: 0.1e-6 },
    },
    presetWires: [
      { from: 'gen:output', to: 'board:rc_in', color: 'blue', type: 'banana' },
      { from: 'board:rc_in', to: 'scope:ch1', color: 'blue', type: 'banana' },
      { from: 'board:rc_out', to: 'scope:ch2', color: 'yellow', type: 'banana' },
      { from: 'board:gnd', to: 'scope:ext_trig', color: 'black', type: 'banana' },
    ],
    instruments: {
      gen: {
        power: true,
        frequency: 1591,
        range: 1000,
        freqDial: 1.59,
        fineDial: 0,
        waveform: 'sine',
        amplitude: 5.0,
        dcOffset: 0,
      },
      scope: {
        power: true,
        ch1: {
          enabled: true,
          voltsPerDiv: 1.0,
          position: 1.0,
          coupling: 'DC',
          probe: 1,
          invert: false,
        },
        ch2: {
          enabled: true,
          voltsPerDiv: 1.0,
          position: -1.0,
          coupling: 'DC',
          probe: 1,
          invert: false,
        },
        timePerDiv: 200e-6,
      },
    },
  },
  {
    id: 'rlc_resonance',
    title: '3. Series RLC Resonant Circuit',
    subtitle: 'Resonance peak f0, Quality factor Q & Maximum Current',
    description:
      'Study series resonance in an RLC network (R = 100 Ω, L = 10 mH, C = 0.1 µF). Tune the generator frequency around the resonant frequency f0 ≈ 5.03 kHz.',
    theory:
      'At resonance f0 = 1 / (2π · √(L · C)), inductive reactance XL cancels capacitive reactance XC (XL = XC = 316 Ω). Total circuit impedance reaches its minimum Z = R = 100 Ω, producing maximum current and zero phase shift.',
    expectedOutcome:
      'As you sweep through 5.03 kHz, the voltage across the resistor (Scope CH2) peaks sharply to match the full input voltage (CH1), and the two waveforms align in phase.',
    boardConfig: {
      activeCircuit: 'rlc_resonance',
      defaultValues: { R1: 100, L1: 10e-3, C1: 0.1e-6 },
    },
    presetWires: [
      { from: 'gen:output', to: 'board:rlc_in', color: 'blue', type: 'banana' },
      { from: 'board:rlc_in', to: 'scope:ch1', color: 'blue', type: 'banana' },
      { from: 'board:rlc_out', to: 'scope:ch2', color: 'yellow', type: 'banana' },
    ],
    instruments: {
      gen: {
        power: true,
        frequency: 5033,
        range: 1000,
        freqDial: 5.03,
        fineDial: 0,
        waveform: 'sine',
        amplitude: 5.0,
      },
      scope: {
        power: true,
        ch1: {
          enabled: true,
          voltsPerDiv: 1.0,
          position: 0,
          coupling: 'DC',
          probe: 1,
          invert: false,
        },
        ch2: {
          enabled: true,
          voltsPerDiv: 1.0,
          position: 0,
          coupling: 'DC',
          probe: 1,
          invert: false,
        },
        timePerDiv: 50e-6,
      },
    },
  },
  {
    id: 'timer_555',
    title: '4. NE555 Astable Multivibrator Pulse Generator',
    subtitle: 'Capacitor Charge/Discharge Ramping & Output Pulses',
    description:
      'Observe the internal timing mechanism of the legendary 555 IC. Channel 1 monitors the timing capacitor exponential voltage between 1/3 Vcc and 2/3 Vcc; Channel 2 monitors the output square wave.',
    theory:
      'The 555 comparator thresholds switch at 1/3 Vcc and 2/3 Vcc. Oscillation frequency f = 1.44 / ((R1 + 2·R2) · C). Output stays high during capacitor charging through R1+R2, and drops low during discharge through R2.',
    expectedOutcome:
      'Scope CH1 displays a periodic shark-tooth ramp between 4V and 8V (with 12V Vcc). CH2 displays crisp digital pulses synchronized with the ramp turning points.',
    boardConfig: {
      activeCircuit: 'timer_555',
      defaultValues: { R1: 1000, R2: 10000, C1: 0.1e-6 },
    },
    presetWires: [
      { from: 'psu:pos', to: 'board:p12v', color: 'red', type: 'banana' },
      { from: 'psu:neg', to: 'board:gnd', color: 'black', type: 'banana' },
      { from: 'board:555_out', to: 'scope:ch2', color: 'yellow', type: 'banana' },
    ],
    instruments: {
      psu: {
        power: true,
        outputEnabled: true,
        voltageSet: 12.0,
        currentLimit: 1.0,
      },
      scope: {
        power: true,
        ch1: {
          enabled: true,
          voltsPerDiv: 2.0,
          position: -1.0,
          coupling: 'DC',
          probe: 1,
          invert: false,
        },
        ch2: {
          enabled: true,
          voltsPerDiv: 5.0,
          position: 1.0,
          coupling: 'DC',
          probe: 1,
          invert: false,
        },
        timePerDiv: 500e-6,
      },
    },
  },
  {
    id: 'wheatstone_bridge',
    title: '5. Wheatstone Bridge & Galvanometer Null Detection',
    subtitle: 'Null deflection precision resistance measurement',
    description:
      'Connect the ATTEN DC Power Supply to the bridge on the Trainer Board. Turn the Potentiometer knob until the Galvanometer needle returns to exactly zero.',
    theory:
      'The Wheatstone bridge condition for null current is R1 / R2 = R3 / Rx. When balanced, the potential difference across the galvanometer is 0 V, causing the pointer to rest at dead center 0.',
    expectedOutcome:
      'The galvanometer needle deflects left or right depending on the potentiometer position. When balanced at Rx = 1.0 kΩ, needle points straight up to 0.',
    boardConfig: {
      activeCircuit: 'wheatstone_bridge',
      defaultValues: { R1: 1000, R2: 4700, POT1: 4700 },
    },
    presetWires: [
      { from: 'psu:pos', to: 'galvo:pos', color: 'red', type: 'banana' },
      { from: 'psu:neg', to: 'galvo:neg', color: 'black', type: 'banana' },
    ],
    instruments: {
      psu: {
        power: true,
        outputEnabled: true,
        voltageSet: 10.0,
        currentLimit: 0.5,
      },
      dmm: {
        power: true,
        mode: 'DCV',
        unit: 'V',
      },
    },
  },
  {
    id: 'free_lab',
    title: '6. Freeform Workbench',
    subtitle: 'Open experimentation bench with all college instruments',
    description:
      'Full freedom to wire any configuration. Connect banana cables and BNC coaxial lines between the Oscilloscope, Function Generator, Power Supply, Multimeters, Galvanometer, and Trainer Board.',
    theory:
      'Experience the authentic college laboratory environment: verify Ohm’s law, filter circuits, diode rectifiers, transistor switches, or test equipment calibration with the PROBE COMP signal.',
    expectedOutcome:
      'All instruments and sockets are fully interactive with realistic physical responses.',
    boardConfig: {
      activeCircuit: 'free_lab',
      defaultValues: {},
    },
    presetWires: [],
    instruments: {},
  },
];
