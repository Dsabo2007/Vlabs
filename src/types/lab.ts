export type PortType = 'banana' | 'bnc' | 'pin';
export type PortPolarity = 'pos' | 'neg' | 'gnd' | 'signal' | 'common' | 'terminal';

export interface Port {
  id: string; // e.g. "scope:ch1", "gen:output", "psu:pos", "board:R1_A"
  parentId: string; // device or board id
  name: string;
  type: PortType;
  polarity?: PortPolarity;
  color?: string; // e.g. '#ef4444' for red, '#1e293b' for black, '#06b6d4' for cyan
  label: string;
  // Local coordinate relative to parent component (in px)
  x: number;
  y: number;
}

export interface Wire {
  id: string;
  fromPortId: string;
  toPortId: string;
  color: string; // 'red' | 'black' | 'blue' | 'green' | 'yellow'
  type: 'banana' | 'bnc' | 'bnc-banana';
}

export type WaveformType = 'sine' | 'triangle' | 'square' | 'ramp' | 'pulse' | 'noise' | 'dc';

export interface ScopeChannelState {
  enabled: boolean;
  voltsPerDiv: number; // e.g. 1 (1V/div), 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 2, 5, 10
  position: number; // divisions offset (-4 to +4)
  coupling: 'DC' | 'AC' | 'GND';
  probe: 1 | 10 | 100 | 1000;
  invert: boolean;
  bwLimit: boolean;
  voltsFine: boolean;
}

export interface ScopeState {
  power: boolean;
  ch1: ScopeChannelState;
  ch2: ScopeChannelState;
  math: {
    enabled: boolean;
    mode: 'CH1+CH2' | 'CH1-CH2' | 'FFT';
    fftWindow?: 'Hanning' | 'Hamming' | 'Blackman' | 'Rectangle';
    fftUnit?: 'Vrms' | 'dBVrms';
  };
  timePerDiv: number; // in seconds, e.g. 500e-6 = 500us/div
  horizPosition: number; // time offset in seconds
  trigger: {
    type: 'Edge' | 'Pulse';
    source: 'CH1' | 'CH2' | 'EXT' | 'AC Line';
    mode: 'AUTO' | 'NORM' | 'SINGLE';
    slope: 'rising' | 'falling' | 'both';
    coupling: 'DC' | 'AC' | 'HF' | 'LF';
    level: number; // in Volts
    state: 'TRIGED' | 'AUTO' | 'READY' | 'STOP';
    holdoff: number; // seconds
  };
  display: {
    format: 'YT' | 'XY';
    type: 'vectors' | 'dots';
    persist: 'off' | '1s' | '2s' | '5s' | 'infinite';
    brightness: number;
  };
  acquire: {
    mode: 'sampling' | 'peak' | 'average';
    averages: number;
    fastAcq: boolean;
  };
  utility: {
    frequencyCounter: boolean;
    language: 'ar' | 'en';
    gridBrightness: number;
  };
  running: boolean;
  activeMenu: 'NONE' | 'MEASURE' | 'CURSOR' | 'ACQUIRE' | 'DISPLAY' | 'UTILITY' | 'MATH' | 'TRIGGER' | 'HORIZONTAL' | 'CH1' | 'CH2' | 'STORAGE' | 'HORI MENU' | 'TRIG MENU';
  cursor: {
    enabled: boolean;
    type: 'time' | 'voltage' | 'track';
    source: 'CH1' | 'CH2';
    activeCursor: 'A' | 'B';
    c1: number;
    c2: number;
  };
  showAllParameters?: boolean;
  helpActive?: boolean;
  helpMessage?: string;
}

export interface FunctionGenState {
  power: boolean;
  frequency: number; // in Hz (0.2 to 2_000_000)
  range: number; // 1, 10, 100, 1000, 10000, 100000, 1000000
  freqDial: number; // 0.2 to 2.0
  fineDial: number; // -0.1 to +0.1
  waveform: WaveformType;
  amplitude: number; // 0 to 20 Vpp open circuit
  dcOffset: number; // -10V to +10V
  symmetry: number; // 20% to 80% (default 50%)
  attenuation: 0 | 20 | 40 | 60; // dB
  inverted: boolean;
  ttlOut: boolean;
  outputOn?: boolean; // front-panel OUTPUT key (undefined = on)
}

export interface PowerSupplyState {
  power: boolean;
  outputEnabled: boolean;
  voltageSet: number; // 0 to 30V
  currentLimit: number; // 0 to 5A
  voltageActual: number;
  currentActual: number;
  mode: 'CV' | 'CC';
  vCoarse?: number; // 0 to 30V (coarse knob position)
  vFine?: number;   // 0 to 1.0V (fine vernier knob position)
  iCoarse?: number; // 0.1 to 5.0A (coarse knob position)
  iFine?: number;   // 0 to 0.2A (fine vernier knob position)
}

export type UT33DRange =
  | 'OFF'
  | 'DCV_200m' | 'DCV_2000m' | 'DCV_20' | 'DCV_200' | 'DCV_600'
  | 'ACV_600' | 'ACV_200'
  | 'NCV'
  | 'DCA_10A' | 'DCA_200m' | 'DCA_20m' | 'DCA_2000u'
  | 'CONT_DIODE'
  | 'OHM_200' | 'OHM_2000' | 'OHM_20k' | 'OHM_200k' | 'OHM_20M' | 'OHM_200M';

export interface MultimeterState {
  power: boolean;
  mode: 'OFF' | 'DCV' | 'ACV' | 'DCA' | 'OHM' | 'CONT' | 'DIODE' | 'NCV';
  range: string;
  rangeId: UT33DRange;
  hold: boolean;
  backlight: boolean;
  reading: number;
  displayStr: string;
  unit: string;
  overload: boolean;
}

export interface BoardComponent {
  id: string;
  name: string;
  type: 'resistor' | 'capacitor' | 'inductor' | 'diode' | 'transistor' | 'ic555' | 'potentiometer' | 'source' | 'switch';
  value: number; // Ohm, Farad, Henry, etc.
  unit: string;
  ports: {
    terminalA: string;
    terminalB: string;
    terminalC?: string;
  };
  state?: any;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface LabExperiment {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  schematicUrl?: string;
  theory: string;
  expectedOutcome: string;
  boardConfig: {
    activeCircuit: string;
    defaultValues: Record<string, number>;
  };
  presetWires: Array<{ from: string; to: string; color: string; type: 'banana' | 'bnc' | 'bnc-banana' }>;
  instruments: {
    scope?: DeepPartial<ScopeState>;
    gen?: DeepPartial<FunctionGenState>;
    psu?: DeepPartial<PowerSupplyState>;
    dmm?: DeepPartial<MultimeterState>;
  };
}
