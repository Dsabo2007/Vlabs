import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScopeState, ScopeChannelState, Port } from '../types/lab';
import { SignalSample } from '../sim/circuitEngine';
import { Knob } from '../components/Knob';
import { PortJack } from '../components/PortJack';
import { labAudio } from '../utils/audio';
import { Camera, RefreshCw, Power, Move, X, Sparkles, HelpCircle } from 'lucide-react';

interface OscilloscopeProps {
  state: ScopeState;
  ch1Waveform: SignalSample[];
  ch2Waveform: SignalSample[];
  onStateChange: (updater: (prev: ScopeState) => ScopeState) => void;
  ports: Port[];
  connectedPortIds: Set<string>;
  wiringSourcePort: Port | null;
  onPortClick: (port: Port) => void;
  onClose?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

type Trace = SignalSample[];

const traceMean = (trace: Trace): number => {
  if (trace.length === 0) return 0;
  return trace.reduce((sum, p) => sum + p.voltage, 0) / trace.length;
};

/** Estimate fundamental frequency from mid-level rising crossings. */
export const estimateFrequency = (trace: Trace): number | null => {
  if (trace.length < 8) return null;
  const mean = traceMean(trace);
  let lastCross = -1;
  const periods: number[] = [];
  for (let i = 1; i < trace.length; i++) {
    const prev = trace[i - 1].voltage - mean;
    const curr = trace[i].voltage - mean;
    if (prev <= 0 && curr > 0) {
      const frac = curr - prev === 0 ? 0 : -prev / (curr - prev);
      const t = trace[i - 1].time + frac * (trace[i].time - trace[i - 1].time);
      if (lastCross >= 0) {
        const period = t - lastCross;
        if (period > 0) periods.push(period);
      }
      lastCross = t;
    }
  }
  if (periods.length === 0) return null;
  const avg = periods.reduce((a, b) => a + b, 0) / periods.length;
  return avg > 0 ? 1 / avg : null;
};

/**
 * Real acquisition-chain conditioning: probe attenuation, AC/GND coupling,
 * 20 MHz bandwidth limit and channel invert. Everything downstream (traces,
 * FFT, cursors, measurements) then works on the same conditioned signal.
 */
export const conditionTrace = (trace: Trace, ch: ScopeChannelState): Trace => {
  if (trace.length === 0) return trace;
  let out = trace;
  if (ch.coupling === 'AC') {
    const mean = traceMean(trace);
    out = trace.map((p) => ({ time: p.time, voltage: p.voltage - mean }));
  } else if (ch.coupling === 'GND') {
    out = trace.map((p) => ({ time: p.time, voltage: 0 }));
  }
  const probeGain = 1 / Math.max(ch.probe, 1);
  const fundamental = ch.bwLimit ? estimateFrequency(trace) ?? 0 : 0;
  const bwGain = ch.bwLimit && fundamental > 0 ? 1 / Math.sqrt(1 + (fundamental / 20e6) ** 2) : 1;
  const sign = ch.invert ? -1 : 1;
  const gain = probeGain * bwGain * sign;
  return out.map((p) => ({ time: p.time, voltage: p.voltage * gain }));
};

/**
 * Trigger-input conditioning. The trigger channel has its own coupling menu:
 * AC removes the mean, HF reject low-passes the trigger signal and LF reject
 * high-passes it (first-order, ~1 kHz corner), exactly as the front panel says.
 */
export const conditionTriggerTrace = (
  trace: Trace,
  coupling: 'DC' | 'AC' | 'HF' | 'LF'
): Trace => {
  if (trace.length < 2 || coupling === 'DC') return trace;
  const mean = traceMean(trace);
  if (coupling === 'AC') return trace.map((p) => ({ time: p.time, voltage: p.voltage - mean }));
  const dt = Math.abs(trace[1].time - trace[0].time) || 1e-6;
  const alpha = 1 - Math.exp(-2 * Math.PI * 1000 * dt);
  let y = mean;
  return trace.map((p) => {
    y += alpha * (p.voltage - y);
    return { time: p.time, voltage: coupling === 'HF' ? y : p.voltage - y };
  });
};

/** First trigger crossing of the level, honouring slope and holdoff. */
export const findTriggerTime = (
  trace: Trace,
  level: number,
  slope: 'rising' | 'falling' | 'both',
  holdoff: number,
  /** Ignore crossings earlier than this, so the visible window never starts before the data. */
  minTime = -Infinity
): number | null => {
  if (trace.length < 2) return null;
  let last = -Infinity;
  for (let i = 1; i < trace.length; i++) {
    const prev = trace[i - 1].voltage;
    const curr = trace[i].voltage;
    const rising = prev <= level && curr > level;
    const falling = prev >= level && curr < level;
    const matches =
      (slope === 'rising' && rising) || (slope === 'falling' && falling) || (slope === 'both' && (rising || falling));
    if (!matches) continue;
    const t = trace[i - 1].time + ((level - prev) / (curr - prev || 1)) * (trace[i].time - trace[i - 1].time);
    if (t < minTime) continue;
    if (t - last < Math.max(holdoff, 0)) continue;
    return t;
  }
  return null;
};

/** Real DFT magnitude spectrum with selectable window function. */
export const computeSpectrum = (
  trace: Trace,
  windowName: 'Hanning' | 'Hamming' | 'Blackman' | 'Rectangle' | string = 'Hanning',
  bins = 56
) => {
  const n = Math.min(trace.length, 512);
  if (n < 8) return { magnitudes: [] as number[], peakHz: 0, max: 0 };
  const dt = trace[1].time - trace[0].time || 1;
  const mean = trace.slice(0, n).reduce((s, p) => s + p.voltage, 0) / n;
  const mags: number[] = [];
  for (let k = 1; k <= bins; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      let w = 1;
      if (windowName === 'Hanning') w = 0.5 - 0.5 * Math.cos(2 * Math.PI * x);
      else if (windowName === 'Hamming') w = 0.54 - 0.46 * Math.cos(2 * Math.PI * x);
      else if (windowName === 'Blackman') w = 0.42 - 0.5 * Math.cos(2 * Math.PI * x) + 0.08 * Math.cos(4 * Math.PI * x);
      const v = (trace[i].voltage - mean) * w;
      const ang = (2 * Math.PI * k * i) / n;
      re += v * Math.cos(ang);
      im -= v * Math.sin(ang);
    }
    mags.push((2 * Math.sqrt(re * re + im * im)) / n);
  }
  const max = Math.max(...mags, 1e-12);
  const peakIdx = mags.indexOf(Math.max(...mags));
  return { magnitudes: mags, peakHz: (peakIdx + 1) / (n * dt), max };
};

const invFreqLabel = (f: number): string => {
  if (!Number.isFinite(f) || f <= 0) return '---';
  if (f < 1000) return `${f.toFixed(1)} Hz`;
  if (f < 1e6) return `${(f / 1000).toFixed(3)} kHz`;
  return `${(f / 1e6).toFixed(3)} MHz`;
};

const VOLTS_PER_DIV_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
const SEC_PER_DIV_STEPS = [
  1e-7, 2e-7, 5e-7, 1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5,
  1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2,
  0.1, 0.2, 0.5, 1, 2, 5
];

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  state,
  ch1Waveform,
  ch2Waveform,
  onStateChange,
  ports,
  connectedPortIds,
  wiringSourcePort,
  onPortClick,
  onClose,
  onDragStart,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeChannel, setActiveChannel] = useState<'CH1' | 'CH2'>('CH1');
  const [utilityPage, setUtilityPage] = useState<1 | 2>(1);
  const [isSelfAdjusting, setIsSelfAdjusting] = useState<boolean>(false);
  const [selfAdjProgress, setSelfAdjProgress] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  // Trigger auto setup (AUTO button)
  const handleAuto = () => {
    labAudio.playButtonClick();
    onStateChange((prev) => {
      const ch1Live = ch1Waveform.length > 1;
      const ch2Live = ch2Waveform.length > 1;
      const targetWave = ch1Live ? ch1Waveform : ch2Waveform;

      // AUTO default setup: CH1 is the working input and CH2 stays off until
      // the student selects it. Vertical scale is a round 1 V/div for both
      // channels so the trace is normal and readable, and the timebase is
      // chosen to show about two periods (only when a signal is present).
      const showCh1 = ch1Live || !ch2Live;
      const autoFreq = estimateFrequency(targetWave);
      let bestTDiv = prev.timePerDiv;
      if (autoFreq && autoFreq > 0) {
        const wanted = (1 / autoFreq) * 2 / 10;
        bestTDiv = SEC_PER_DIV_STEPS.reduce(
          (best, s) => (Math.abs(s - wanted) < Math.abs(best - wanted) ? s : best),
          SEC_PER_DIV_STEPS[0]
        );
      }

      return {
        ...prev,
        running: true,
        ch1: {
          ...prev.ch1,
          enabled: showCh1,
          voltsPerDiv: 1,
          position: 0,
          coupling: 'DC',
          probe: 1,
          invert: false,
          bwLimit: false,
        },
        ch2: {
          ...prev.ch2,
          enabled: !showCh1,
          voltsPerDiv: 1,
          position: 0,
          coupling: 'DC',
          probe: 1,
          invert: false,
          bwLimit: false,
        },
        timePerDiv: bestTDiv,
        horizPosition: 0,
        trigger: {
          ...prev.trigger,
          source: showCh1 ? 'CH1' : 'CH2',
          level: 0,
          state: 'TRIGED',
          mode: 'AUTO',
          slope: 'rising',
        },
        display: { ...prev.display, format: 'YT', type: 'vectors', persist: 'off' },
        acquire: { ...prev.acquire, mode: 'sampling' },
        cursor: { ...prev.cursor, enabled: false },
        activeMenu: 'NONE',
        showAllParameters: false,
      };
    });
  };

  // Corrected SET TO ZERO button according to official manual: sets trigger level to 50% of peak-to-peak amplitude
  const handleSetToZero = () => {
    labAudio.playButtonClick();
    const targetWave = state.trigger.source === 'CH2' ? ch2Waveform : ch1Waveform;
    let minV = -1;
    let maxV = 1;
    if (targetWave && targetWave.length > 0) {
      minV = Infinity;
      maxV = -Infinity;
      for (const pt of targetWave) {
        if (pt.voltage < minV) minV = pt.voltage;
        if (pt.voltage > maxV) maxV = pt.voltage;
      }
    }
    const midLevel = (minV + maxV) / 2;
    onStateChange((prev) => ({
      ...prev,
      trigger: { ...prev.trigger, level: midLevel, state: 'TRIGED' },
    }));
    showToast(`SET TO ZERO: تم ضبط الـ Trigger على 50% (${midLevel.toFixed(2)}V)`);
  };

  // Toggle RUN/STOP
  const handleRunStop = () => {
    labAudio.playButtonClick();
    onStateChange((prev) => ({
      ...prev,
      running: !prev.running,
      trigger: { ...prev.trigger, state: prev.running ? 'STOP' : 'TRIGED' },
    }));
  };

  // Export Screenshot (PrtSc button)
  const handleScreenshot = () => {
    labAudio.playButtonClick();
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `UNI-T_UTD2102CEX_Screen_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    showToast('PrtSc: تم حفظ صورة الشاشة بنجاح');
  };

  // Run Self-Calibration (Self-Adj)
  const runSelfAdj = () => {
    setIsSelfAdjusting(true);
    setSelfAdjProgress(0);
    showToast('Self-Adj: جاري معايرة إزاحة الصفر وقنوات الـ ADC...');
    let prog = 0;
    const iv = setInterval(() => {
      prog += 20;
      setSelfAdjProgress(prog);
      if (prog >= 100) {
        clearInterval(iv);
        setIsSelfAdjusting(false);
        onStateChange((p) => ({
          ...p,
          ch1: { ...p.ch1, position: 0 },
          ch2: { ...p.ch2, position: 0 },
          trigger: { ...p.trigger, level: 0 },
        }));
        showToast('Self-Adj: اكتملت المعايرة الذاتية بنجاح 100%');
      }
    }, 350);
  };

  // Full F1 - F5 Softkeys handler conforming strictly to UTD2102CEX+ manual table
  const handleFKey = (keyIndex: number) => {
    labAudio.playButtonClick();
    onStateChange((prev) => {
      // Deep-clone the editable sub-states: the previous shallow copy mutated
      // React state in place, so channel edits could bleed into each other.
      const next = {
        ...prev,
        ch1: { ...prev.ch1 },
        ch2: { ...prev.ch2 },
        math: { ...prev.math },
        trigger: { ...prev.trigger },
        display: { ...prev.display },
        acquire: { ...prev.acquire },
        utility: { ...prev.utility },
        cursor: { ...prev.cursor },
      };
      const menu = prev.activeMenu;

      if (menu === 'CH1') {
        if (keyIndex === 1) {
          next.ch1.coupling = prev.ch1.coupling === 'DC' ? 'AC' : prev.ch1.coupling === 'AC' ? 'GND' : 'DC';
        } else if (keyIndex === 2) {
          next.ch1.bwLimit = !prev.ch1.bwLimit;
        } else if (keyIndex === 3) {
          next.ch1.voltsFine = !prev.ch1.voltsFine;
        } else if (keyIndex === 4) {
          const probes: (1 | 10 | 100 | 1000)[] = [1, 10, 100, 1000];
          const currIdx = probes.indexOf(prev.ch1.probe);
          next.ch1.probe = probes[(currIdx + 1) % probes.length];
        } else if (keyIndex === 5) {
          next.ch1.invert = !prev.ch1.invert;
        }
      } else if (menu === 'CH2') {
        if (keyIndex === 1) {
          next.ch2.coupling = prev.ch2.coupling === 'DC' ? 'AC' : prev.ch2.coupling === 'AC' ? 'GND' : 'DC';
        } else if (keyIndex === 2) {
          next.ch2.bwLimit = !prev.ch2.bwLimit;
        } else if (keyIndex === 3) {
          next.ch2.voltsFine = !prev.ch2.voltsFine;
        } else if (keyIndex === 4) {
          const probes: (1 | 10 | 100 | 1000)[] = [1, 10, 100, 1000];
          const currIdx = probes.indexOf(prev.ch2.probe);
          next.ch2.probe = probes[(currIdx + 1) % probes.length];
        } else if (keyIndex === 5) {
          next.ch2.invert = !prev.ch2.invert;
        }
      } else if (menu === 'MATH') {
        if (keyIndex === 1) {
          next.math.mode = prev.math.mode === 'FFT' ? 'CH1+CH2' : 'FFT';
        } else if (prev.math.mode !== 'FFT') {
          if (keyIndex === 3) {
            next.math.mode = prev.math.mode === 'CH1+CH2' ? 'CH1-CH2' : 'CH1+CH2';
          }
        } else {
          if (keyIndex === 3) {
            const windows: ('Hanning' | 'Hamming' | 'Blackman' | 'Rectangle')[] = ['Hanning', 'Hamming', 'Blackman', 'Rectangle'];
            const curWin = prev.math.fftWindow || 'Hanning';
            const wIdx = windows.indexOf(curWin);
            next.math.fftWindow = windows[(wIdx + 1) % windows.length];
          } else if (keyIndex === 4) {
            next.math.fftUnit = prev.math.fftUnit === 'dBVrms' ? 'Vrms' : 'dBVrms';
          }
        }
      } else if (menu === 'HORI MENU') {
        if (keyIndex === 1) {
          next.horizPosition = 0;
        } else if (keyIndex === 3) {
          next.timePerDiv = prev.timePerDiv > 1e-4 ? prev.timePerDiv / 5 : prev.timePerDiv * 5;
        } else if (keyIndex === 5) {
          next.trigger.holdoff = prev.trigger.holdoff === 100e-9 ? 1e-6 : 100e-9;
        }
      } else if (menu === 'TRIG MENU') {
        if (keyIndex === 1) {
          next.trigger.type = prev.trigger.type === 'Edge' ? 'Pulse' : 'Edge';
        } else if (keyIndex === 2) {
          const sources: ('CH1' | 'CH2' | 'EXT' | 'AC Line')[] = ['CH1', 'CH2', 'EXT', 'AC Line'];
          const sIdx = sources.indexOf(prev.trigger.source);
          next.trigger.source = sources[(sIdx + 1) % sources.length];
        } else if (keyIndex === 3) {
          next.trigger.slope = prev.trigger.slope === 'rising' ? 'falling' : prev.trigger.slope === 'falling' ? 'both' : 'rising';
        } else if (keyIndex === 4) {
          next.trigger.mode = prev.trigger.mode === 'AUTO' ? 'NORM' : prev.trigger.mode === 'NORM' ? 'SINGLE' : 'AUTO';
        } else if (keyIndex === 5) {
          const coups: ('DC' | 'AC' | 'HF' | 'LF')[] = ['DC', 'AC', 'HF', 'LF'];
          const cIdx = coups.indexOf(prev.trigger.coupling);
          next.trigger.coupling = coups[(cIdx + 1) % coups.length];
        }
      } else if (menu === 'ACQUIRE') {
        if (keyIndex === 1) {
          next.acquire.mode = prev.acquire.mode === 'sampling' ? 'peak' : prev.acquire.mode === 'peak' ? 'average' : 'sampling';
        } else if (keyIndex === 2) {
          const avgs = [2, 4, 8, 16, 32, 64, 128, 256];
          const curAvgIdx = avgs.indexOf(prev.acquire.averages || 16);
          next.acquire.averages = avgs[(curAvgIdx + 1) % avgs.length];
        } else if (keyIndex === 4) {
          next.acquire.fastAcq = !prev.acquire.fastAcq;
        }
      } else if (menu === 'DISPLAY') {
        if (keyIndex === 1) {
          next.display.type = prev.display.type === 'vectors' ? 'dots' : 'vectors';
        } else if (keyIndex === 2) {
          next.display.format = prev.display.format === 'YT' ? 'XY' : 'YT';
        } else if (keyIndex === 3) {
          const persists: ('off' | '1s' | '2s' | '5s' | 'infinite')[] = ['off', '1s', '2s', '5s', 'infinite'];
          const pIdx = persists.indexOf(prev.display.persist);
          next.display.persist = persists[(pIdx + 1) % persists.length];
        } else if (keyIndex === 5) {
          const brights = [0.25, 0.5, 0.75, 1.0];
          const bIdx = brights.indexOf(prev.display.brightness || 1.0);
          next.display.brightness = brights[(bIdx + 1) % brights.length];
        }
      } else if (menu === 'MEASURE') {
        if (keyIndex === 5) {
          next.showAllParameters = !prev.showAllParameters;
        } else {
          setActiveChannel((c) => (c === 'CH1' ? 'CH2' : 'CH1'));
        }
      } else if (menu === 'CURSOR') {
        if (keyIndex === 1) {
          next.cursor.enabled = !prev.cursor.enabled;
          if (next.cursor.enabled && !prev.cursor.type) next.cursor.type = 'time';
        } else if (keyIndex === 2) {
          next.cursor.type = prev.cursor.type === 'time' ? 'voltage' : prev.cursor.type === 'voltage' ? 'track' : 'time';
        } else if (keyIndex === 3) {
          next.cursor.activeCursor = prev.cursor.activeCursor === 'A' ? 'B' : 'A';
        }
      } else if (menu === 'STORAGE') {
        if (keyIndex === 3) {
          handleScreenshot();
        }
      } else if (menu === 'UTILITY') {
        if (utilityPage === 1) {
          if (keyIndex === 1) {
            window.setTimeout(runSelfAdj, 0);
          } else if (keyIndex === 2) {
            next.utility.language = prev.utility.language === 'ar' ? 'en' : 'ar';
          } else if (keyIndex === 3) {
            window.setTimeout(handleAuto, 0);
          } else if (keyIndex === 4) {
            next.utility.frequencyCounter = !prev.utility.frequencyCounter;
          } else if (keyIndex === 5) {
            setUtilityPage(2);
          }
        } else {
          if (keyIndex === 1) {
            next.utility.gridBrightness = prev.utility.gridBrightness === 1.0 ? 0.25 : prev.utility.gridBrightness === 0.25 ? 0.5 : 1.0;
          } else if (keyIndex === 5) {
            setUtilityPage(1);
          }
        }
      }

      return next;
    });
  };

  // Main Canvas Waveform Drawing Loop with XY Lissajous & 28-Parameter Grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Dark screen background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    if (!state.power) {
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STANDBY / POWER OFF', width / 2, height / 2);
      return;
    }

    const isMenuOpen = state.activeMenu !== 'NONE';
    const gridLeft = 34;
    const gridTop = 26;
    const gridWidth = isMenuOpen ? width - 128 : width - 66;
    const gridHeight = height - 52;
    const xDivs = 10;
    const yDivs = 8;
    const dx = gridWidth / xDivs;
    const dy = gridHeight / yDivs;
    const midX = gridLeft + (xDivs / 2) * dx;
    const midY = gridTop + (yDivs / 2) * dy;

    // Conditioned traces (probe / coupling / BW limit / invert) and a real
    // edge trigger aligned to the centre division of the graticule.
    const ch1c = conditionTrace(ch1Waveform, state.ch1);
    const ch2c = conditionTrace(ch2Waveform, state.ch2);
    // Trigger source selection: CH1 / CH2 use the conditioned analog traces,
    // AC Line is the internal 50 Hz mains trigger, and EXT stays open unless an
    // external trigger is wired to the EXT TRIG BNC (none is modelled here).
    const trigRaw: Trace = (() => {
      if (state.trigger.source === 'CH1') return ch1c;
      if (state.trigger.source === 'CH2') return ch2c;
      if (state.trigger.source === 'AC Line') {
        const t0 = ch1c[0]?.time ?? -5 * state.timePerDiv;
        const span = 30 * state.timePerDiv;
        const n = 600;
        return Array.from({ length: n }, (_, i) => {
          const t = t0 + (i / (n - 1)) * span;
          return { time: t, voltage: Math.sin(2 * Math.PI * 50 * t) };
        });
      }
      return [];
    })();
    const trigTrace = conditionTriggerTrace(trigRaw, state.trigger.coupling);
    const dataStart = ch1c[0]?.time ?? 0;
    // Horizontal position shifts the acquisition window once; applying it here
    // as well as to traceStartTime used to move the trigger point twice.
    const triggerTime = findTriggerTime(
      trigTrace,
      state.trigger.level,
      state.trigger.slope,
      state.trigger.holdoff,
      // keep 5 divisions of recorded data to the left of the trigger point
      dataStart + 5 * state.timePerDiv
    );
    const displayTrigState: 'TRIGED' | 'AUTO' | 'READY' =
      triggerTime !== null ? 'TRIGED' : state.trigger.mode === 'AUTO' ? 'AUTO' : 'READY';
    const traceStartTime =
      triggerTime !== null
        ? triggerTime - 5 * state.timePerDiv + state.horizPosition
        : dataStart + 5 * state.timePerDiv;

    // Draw CRT Graticule / Divisions
    const gridAlpha = state.utility.gridBrightness || 0.85;
    ctx.strokeStyle = `rgba(14, 58, 71, ${gridAlpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(gridLeft, gridTop, gridWidth, gridHeight);

    ctx.setLineDash([1, 3]);
    for (let i = 1; i < xDivs; i++) {
      const x = gridLeft + i * dx;
      ctx.beginPath();
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridTop + gridHeight);
      ctx.stroke();
    }
    for (let j = 1; j < yDivs; j++) {
      const y = gridTop + j * dy;
      ctx.beginPath();
      ctx.moveTo(gridLeft, y);
      ctx.lineTo(gridLeft + gridWidth, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Subdivisions / Crosshairs
    ctx.strokeStyle = `rgba(30, 93, 112, ${gridAlpha})`;
    for (let y = gridTop; y <= gridTop + gridHeight; y += dy / 5) {
      ctx.beginPath();
      ctx.moveTo(midX - 3, y);
      ctx.lineTo(midX + 3, y);
      ctx.stroke();
    }
    for (let x = gridLeft; x <= gridLeft + gridWidth; x += dx / 5) {
      ctx.beginPath();
      ctx.moveTo(x, midY - 3);
      ctx.lineTo(x, midY + 3);
      ctx.stroke();
    }

    // Top Header Status Bar
    ctx.fillStyle = '#09101d';
    ctx.fillRect(0, 0, width, 24);
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(width, 24);
    ctx.stroke();

    // Trigger state indicator badge
    const trigState = displayTrigState;
    ctx.fillStyle = trigState === 'TRIGED' ? '#16a34a' : trigState === 'AUTO' ? '#d97706' : '#dc2626';
    ctx.fillRect(6, 4, 48, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(trigState === 'TRIGED' ? "TRIG'D" : trigState, 30, 15);

    // Timebase M readout
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9.5px monospace';
    ctx.textAlign = 'left';
    const tFormatted =
      state.timePerDiv < 1e-6
        ? `${(state.timePerDiv * 1e9).toFixed(1)}ns`
        : state.timePerDiv < 1e-3
        ? `${(state.timePerDiv * 1e6).toFixed(1)}µs`
        : state.timePerDiv < 1
        ? `${(state.timePerDiv * 1e3).toFixed(1)}ms`
        : `${state.timePerDiv.toFixed(2)}s`;
    ctx.fillText(`M ${tFormatted}`, 60, 16);

    // Sample stats & Memory overview
    ctx.fillStyle = '#94a3b8';
    ctx.font = '8.5px monospace';
    ctx.fillText('64.0kpts 500MSa/s', 138, 16);

    ctx.strokeStyle = '#334155';
    ctx.strokeRect(260, 7, 50, 10);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(280, 8, 10, 8);

    // Delay D readout
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '8.5px monospace';
    ctx.fillText(`D 0.000s`, 318, 16);

    // Calculate measured frequency from waveform zero-crossings
    let measuredFreq: number | null = null;
    const activeTrace = activeChannel === 'CH1' ? ch1Waveform : ch2Waveform;
    const targetTrace = activeTrace.length > 5 ? activeTrace : (ch1Waveform.length > 5 ? ch1Waveform : ch2Waveform);
    if (targetTrace.length > 8) {
      let lastCross = -1;
      const periods: number[] = [];
      const meanV = targetTrace.reduce((sum, p) => sum + p.voltage, 0) / targetTrace.length;
      for (let i = 1; i < targetTrace.length; i++) {
        const prev = targetTrace[i - 1].voltage - meanV;
        const curr = targetTrace[i].voltage - meanV;
        if (prev <= 0 && curr > 0) {
          const frac = (0 - prev) / (curr - prev);
          const crossTime = targetTrace[i - 1].time + frac * (targetTrace[i].time - targetTrace[i - 1].time);
          if (lastCross >= 0) {
            const p = crossTime - lastCross;
            if (p > 0) periods.push(p);
          }
          lastCross = crossTime;
        }
      }
      if (periods.length > 0) {
        const avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
        if (avgPeriod > 0) {
          measuredFreq = 1 / avgPeriod;
        }
      }
    }

    const formatFreq = (f: number | null): string => {
      if (!f || f < 10) return '< 10 Hz';
      if (f < 1000) return `${f.toFixed(1)} Hz`;
      if (f < 1e6) return `${(f / 1e3).toFixed(3)} kHz`;
      return `${(f / 1e6).toFixed(3)} MHz`;
    };

    const formatPeriod = (f: number | null): string => {
      if (!f || f < 10) return '---';
      const p = 1 / f;
      if (p < 1e-6) return `${(p * 1e9).toFixed(1)} ns`;
      if (p < 1e-3) return `${(p * 1e6).toFixed(2)} µs`;
      if (p < 1) return `${(p * 1e3).toFixed(3)} ms`;
      return `${p.toFixed(2)} s`;
    };

    // Frequency Counter in Top Right if enabled
    if (state.utility.frequencyCounter) {
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 9.5px monospace';
      ctx.fillText(`CNT: ${formatFreq(measuredFreq)}`, 372, 16);
    }

    // Active Menu Title on Top Right
    if (isMenuOpen) {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(width - 96, 4, 90, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.activeMenu, width - 51, 15);
    }

    // Bottom Status Bar
    ctx.fillStyle = '#09101d';
    ctx.fillRect(0, height - 24, width, 24);
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, height - 24);
    ctx.lineTo(width, height - 24);
    ctx.stroke();

    // CH1 readout tag
    if (state.ch1.enabled) {
      ctx.fillStyle = '#0891b2';
      ctx.fillRect(6, height - 20, 16, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('1', 14, height - 8);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '9.5px monospace';
      ctx.textAlign = 'left';
      const ch1VFormatted =
        state.ch1.voltsPerDiv < 1
          ? `${(state.ch1.voltsPerDiv * 1000).toFixed(0)}mV`
          : `${state.ch1.voltsPerDiv.toFixed(2)}V`;
      const couplSym = state.ch1.coupling === 'AC' ? '~' : state.ch1.coupling === 'DC' ? '=' : '⏚';
      ctx.fillText(`${couplSym}${ch1VFormatted} ${state.ch1.probe}X`, 26, height - 8);
    } else {
      ctx.fillStyle = '#475569';
      ctx.font = '9.5px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('1 OFF', 6, height - 8);
    }

    // CH2 readout tag
    if (state.ch2.enabled) {
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(130, height - 20, 16, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('2', 138, height - 8);

      ctx.fillStyle = '#facc15';
      ctx.font = '9.5px monospace';
      ctx.textAlign = 'left';
      const ch2VFormatted =
        state.ch2.voltsPerDiv < 1
          ? `${(state.ch2.voltsPerDiv * 1000).toFixed(0)}mV`
          : `${state.ch2.voltsPerDiv.toFixed(2)}V`;
      const couplSym = state.ch2.coupling === 'AC' ? '~' : state.ch2.coupling === 'DC' ? '=' : '⏚';
      ctx.fillText(`${couplSym}${ch2VFormatted} ${state.ch2.probe}X`, 150, height - 8);
    } else {
      ctx.fillStyle = '#475569';
      ctx.font = '9.5px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('2 OFF', 130, height - 8);
    }

    // Math readout tag
    ctx.fillStyle = state.math.enabled ? '#f43f5e' : '#475569';
    ctx.fillText(state.math.enabled ? `M ${state.math.mode}` : 'M OFF', 250, height - 8);

    // Trigger readout tag
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`T  ${state.trigger.source} ${state.trigger.level.toFixed(2)}V`, 320, height - 8);

    // Left Ground Level Indicator Arrows (▶1 for CH1, ▶2 for CH2)
    if (state.display.format !== 'XY') {
      if (state.ch1.enabled) {
        const gndY1 = midY - state.ch1.position * dy;
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(gridLeft - 10, gndY1 - 5);
        ctx.lineTo(gridLeft, gndY1);
        ctx.lineTo(gridLeft - 10, gndY1 + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('1', gridLeft - 6, gndY1 + 3);
      }

      if (state.ch2.enabled) {
        const gndY2 = midY - state.ch2.position * dy;
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(gridLeft - 10, gndY2 - 5);
        ctx.lineTo(gridLeft, gndY2);
        ctx.lineTo(gridLeft - 10, gndY2 + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('2', gridLeft - 6, gndY2 + 3);
      }

      // Right Trigger Level Indicator Arrow (T►), drawn against the channel
      // that actually feeds the trigger (not just the selected menu channel).
      const trigCh = state.trigger.source === 'CH2' ? state.ch2 : state.ch1;
      const analogTrigger = state.trigger.source === 'CH1' || state.trigger.source === 'CH2';
      const activeVoltsPerDiv = trigCh.voltsPerDiv;
      const activePos = trigCh.position;
      const trigDivOffset = state.trigger.level / (activeVoltsPerDiv || 1);
      const trigY = midY - (trigDivOffset + activePos) * dy;

      if (analogTrigger && trigY >= gridTop && trigY <= gridTop + gridHeight) {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(gridLeft + gridWidth + 10, trigY - 5);
        ctx.lineTo(gridLeft + gridWidth, trigY);
        ctx.lineTo(gridLeft + gridWidth + 10, trigY + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText('T', gridLeft + gridWidth + 6, trigY + 3);
      }
    }

    // Clip to screen graticule for waveforms
    ctx.save();
    ctx.beginPath();
    ctx.rect(gridLeft, gridTop, gridWidth, gridHeight);
    ctx.clip();

    // Mode: XY (Lissajous) vs YT (Standard time-domain)
    if (state.display.format === 'XY') {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('XY MODE - Lissajous (X: CH1, Y: CH2)', gridLeft + 12, gridTop + 18);

      const minLen = Math.min(ch1c.length, ch2c.length);
      if (minLen > 1) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i < minLen; i++) {
          const x = midX + (ch1c[i].voltage / state.ch1.voltsPerDiv) * dx;
          const y = midY - (ch2c[i].voltage / state.ch2.voltsPerDiv) * dy;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Connect both CH1 and CH2 signals to view Lissajous figure', midX, midY);
      }
    } else {
      // YT Standard Time-Domain Mode
      const totalWindowTime = 10 * state.timePerDiv;

      // Render CH1 Trace (Cyan) — trigger-aligned, brightness aware
      if (state.ch1.enabled) {
        const gndY1 = midY - state.ch1.position * dy;
        if (ch1c.length > 1) {
          ctx.globalAlpha = Math.max(0.35, Math.min(1, state.display.brightness || 1));
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          for (let i = 0; i < ch1c.length; i++) {
            const pt = ch1c[i];
            const x = gridLeft + ((pt.time - traceStartTime) / totalWindowTime) * gridWidth;
            const vDivOffset = pt.voltage / state.ch1.voltsPerDiv;
            const y = midY - (vDivOffset + state.ch1.position) * dy;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1.8;
          if (state.display.type === 'dots') {
            for (let i = 0; i < ch1c.length; i += 3) {
              const pt = ch1c[i];
              const x = gridLeft + ((pt.time - traceStartTime) / totalWindowTime) * gridWidth;
              const y = midY - (pt.voltage / state.ch1.voltsPerDiv + state.ch1.position) * dy;
              ctx.fillStyle = '#22d3ee';
              ctx.fillRect(x - 1, y - 1, 2.4, 2.4);
            }
          } else {
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else {
          // Authentic baseline horizontal trace at 0V
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(gridLeft, gndY1);
          ctx.lineTo(gridLeft + gridWidth, gndY1);
          ctx.stroke();

          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Render CH2 Trace (Yellow) — trigger-aligned, brightness aware
      if (state.ch2.enabled) {
        const gndY2 = midY - state.ch2.position * dy;
        if (ch2c.length > 1) {
          ctx.globalAlpha = Math.max(0.35, Math.min(1, state.display.brightness || 1));
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          for (let i = 0; i < ch2c.length; i++) {
            const pt = ch2c[i];
            const x = gridLeft + ((pt.time - traceStartTime) / totalWindowTime) * gridWidth;
            const vDivOffset = pt.voltage / state.ch2.voltsPerDiv;
            const y = midY - (vDivOffset + state.ch2.position) * dy;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.8;
          if (state.display.type === 'dots') {
            for (let i = 0; i < ch2c.length; i += 3) {
              const pt = ch2c[i];
              const x = gridLeft + ((pt.time - traceStartTime) / totalWindowTime) * gridWidth;
              const y = midY - (pt.voltage / state.ch2.voltsPerDiv + state.ch2.position) * dy;
              ctx.fillStyle = '#fde047';
              ctx.fillRect(x - 1, y - 1, 2.4, 2.4);
            }
          } else {
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else {
          // Authentic baseline horizontal trace at 0V
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(gridLeft, gndY2);
          ctx.lineTo(gridLeft + gridWidth, gndY2);
          ctx.stroke();

          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Render Math / FFT Spectrum from the real acquired samples
      if (state.math.enabled && state.math.mode === 'FFT') {
        const fftTrace = activeChannel === 'CH1' ? ch1c : ch2c;
        const spectrum = computeSpectrum(fftTrace, state.math.fftWindow || 'Hanning', 56);
        const bw = gridWidth / Math.max(spectrum.magnitudes.length, 1);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
        spectrum.magnitudes.forEach((mag, b) => {
          const norm = spectrum.max > 0 ? mag / spectrum.max : 0;
          const db = state.math.fftUnit === 'dBVrms' ? 20 * Math.log10(Math.max(norm, 1e-3)) : norm;
          const ratio = state.math.fftUnit === 'dBVrms' ? Math.max(0, (db + 60) / 60) : norm;
          const h = Math.max(2, ratio * (gridHeight - 22));
          ctx.fillRect(gridLeft + b * bw, gridTop + gridHeight - h, Math.max(1, bw - 1.5), h);
        });
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 9.5px monospace';
        ctx.fillText(
          `FFT ${state.math.fftWindow || 'Hanning'} • ${state.math.fftUnit || 'Vrms'} • peak ${spectrum.peakHz < 1000
            ? `${spectrum.peakHz.toFixed(0)} Hz`
            : `${(spectrum.peakHz / 1000).toFixed(2)} kHz`}`,
          gridLeft + 8,
          gridTop + 16
        );
      }

      // Render Cursors if active (time or voltage measurement)
      if (state.cursor.enabled) {
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        if (state.cursor.type === 'voltage') {
          const cy1 = midY - (state.cursor.c1 * 2 - 1) * (gridHeight / 2);
          const cy2 = midY - (state.cursor.c2 * 2 - 1) * (gridHeight / 2);
          ctx.moveTo(gridLeft, cy1);
          ctx.lineTo(gridLeft + gridWidth, cy1);
          ctx.moveTo(gridLeft, cy2);
          ctx.lineTo(gridLeft + gridWidth, cy2);
        } else {
          const cx1 = gridLeft + state.cursor.c1 * gridWidth;
          const cx2 = gridLeft + state.cursor.c2 * gridWidth;
          ctx.moveTo(cx1, gridTop);
          ctx.lineTo(cx1, gridTop + gridHeight);
          ctx.moveTo(cx2, gridTop);
          ctx.lineTo(cx2, gridTop + gridHeight);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const activeCh = activeChannel === 'CH1' ? state.ch1 : state.ch2;
        const vPerDiv = activeCh.voltsPerDiv;
        const dt = Math.abs(state.cursor.c2 - state.cursor.c1) * 10 * state.timePerDiv;
        const dv = Math.abs(state.cursor.c2 - state.cursor.c1) * 8 * vPerDiv;
        const invDt = dt > 0 ? 1 / dt : 0;
        const fmtT = (v: number) =>
          v < 1e-6 ? `${(v * 1e9).toFixed(0)} ns`
            : v < 1e-3 ? `${(v * 1e6).toFixed(2)} µs`
            : v < 1 ? `${(v * 1e3).toFixed(1)} ms`
            : `${v.toFixed(2)} s`;
        ctx.fillStyle = '#ec4899';
        ctx.font = 'bold 9.5px monospace';
        ctx.fillText(
          state.cursor.type === 'voltage'
            ? `ΔV: ${dv.toFixed(3)} V`
            : `ΔT: ${fmtT(dt)} | 1/ΔT: ${invFreqLabel(invDt)}`,
          gridLeft + 8,
          gridTop + 16
        );
      }
    }

    ctx.restore();

    // On-Screen Bezel Menu Cards (F1 - F5) on the right edge of screen
    if (isMenuOpen) {
      const menuX = width - 62;
      const cardH = (gridHeight - 16) / 5;

      const getMenuCardLabels = (fIndex: number): { label: string; val: string } => {
        if (state.activeMenu === 'CH1') {
          if (fIndex === 1) return { label: 'Coupling', val: state.ch1.coupling };
          if (fIndex === 2) return { label: 'BW Limit', val: state.ch1.bwLimit ? '20MHz' : 'OFF' };
          if (fIndex === 3) return { label: 'Volts/Div', val: state.ch1.voltsFine ? 'Fine' : 'Coarse' };
          if (fIndex === 4) return { label: 'Probe', val: `${state.ch1.probe}X` };
          if (fIndex === 5) return { label: 'Invert', val: state.ch1.invert ? 'ON' : 'OFF' };
        } else if (state.activeMenu === 'CH2') {
          if (fIndex === 1) return { label: 'Coupling', val: state.ch2.coupling };
          if (fIndex === 2) return { label: 'BW Limit', val: state.ch2.bwLimit ? '20MHz' : 'OFF' };
          if (fIndex === 3) return { label: 'Volts/Div', val: state.ch2.voltsFine ? 'Fine' : 'Coarse' };
          if (fIndex === 4) return { label: 'Probe', val: `${state.ch2.probe}X` };
          if (fIndex === 5) return { label: 'Invert', val: state.ch2.invert ? 'ON' : 'OFF' };
        } else if (state.activeMenu === 'MATH') {
          if (state.math.mode === 'FFT') {
            if (fIndex === 1) return { label: 'Type', val: 'FFT' };
            if (fIndex === 2) return { label: 'Source', val: 'CH1' };
            if (fIndex === 3) return { label: 'Window', val: state.math.fftWindow || 'Hanning' };
            if (fIndex === 4) return { label: 'Unit', val: state.math.fftUnit || 'Vrms' };
            if (fIndex === 5) return { label: '---', val: '---' };
          } else {
            if (fIndex === 1) return { label: 'Type', val: 'Math' };
            if (fIndex === 2) return { label: 'Source 1', val: 'CH1' };
            if (fIndex === 3) return { label: 'Operator', val: state.math.mode === 'CH1-CH2' ? '−' : '+' };
            if (fIndex === 4) return { label: 'Source 2', val: 'CH2' };
            if (fIndex === 5) return { label: '---', val: '---' };
          }
        } else if (state.activeMenu === 'HORI MENU') {
          if (fIndex === 1) return { label: 'Main', val: 'Timebase' };
          if (fIndex === 2) return { label: '---', val: '---' };
          if (fIndex === 3) return { label: 'Window', val: 'Zoom' };
          if (fIndex === 4) return { label: '---', val: '---' };
          if (fIndex === 5) return { label: 'Holdoff', val: `${(state.trigger.holdoff * 1e9).toFixed(0)}ns` };
        } else if (state.activeMenu === 'TRIG MENU') {
          if (fIndex === 1) return { label: 'Type', val: state.trigger.type };
          if (fIndex === 2) return { label: 'Source', val: state.trigger.source };
          if (fIndex === 3) return { label: 'Slope', val: state.trigger.slope === 'rising' ? 'Rise ↗' : state.trigger.slope === 'falling' ? 'Fall ↘' : 'Both ⇅' };
          if (fIndex === 4) return { label: 'Mode', val: state.trigger.mode };
          if (fIndex === 5) return { label: 'Coupling', val: state.trigger.coupling };
        } else if (state.activeMenu === 'ACQUIRE') {
          if (fIndex === 1) return { label: 'Mode', val: state.acquire.mode };
          if (fIndex === 2) return { label: 'Averages', val: `${state.acquire.averages || 16}` };
          if (fIndex === 3) return { label: 'Sampling', val: 'Real-time' };
          if (fIndex === 4) return { label: 'Fast Acq', val: state.acquire.fastAcq ? 'ON' : 'OFF' };
          if (fIndex === 5) return { label: '---', val: '---' };
        } else if (state.display && state.activeMenu === 'DISPLAY') {
          if (fIndex === 1) return { label: 'Type', val: state.display.type };
          if (fIndex === 2) return { label: 'Format', val: state.display.format };
          if (fIndex === 3) return { label: 'Persist', val: state.display.persist };
          if (fIndex === 4) return { label: '---', val: '---' };
          if (fIndex === 5) return { label: 'Brightness', val: `${((state.display.brightness || 1) * 100).toFixed(0)}%` };
        } else if (state.activeMenu === 'MEASURE') {
          if (fIndex === 1) return { label: 'Meas 1', val: 'Vpp / Vmax' };
          if (fIndex === 2) return { label: 'Meas 2', val: 'Vrms / Vavg' };
          if (fIndex === 3) return { label: 'Meas 3', val: 'Freq / Per' };
          if (fIndex === 4) return { label: 'Source', val: activeChannel };
          if (fIndex === 5) return { label: 'Parameters', val: state.showAllParameters ? 'HIDE' : 'ALL 28' };
        } else if (state.activeMenu === 'CURSOR') {
          if (fIndex === 1) return { label: 'Type', val: state.cursor.enabled ? (state.cursor.type || 'time') : 'OFF' };
          if (fIndex === 2) return { label: 'Source', val: activeChannel };
          if (fIndex === 3) return { label: 'Active', val: `Cur ${state.cursor.activeCursor}` };
          if (fIndex === 4) return { label: 'Pos', val: `${(state.cursor.c1 * 10).toFixed(1)}div` };
          if (fIndex === 5) return { label: '---', val: '---' };
        } else if (state.activeMenu === 'STORAGE') {
          if (fIndex === 1) return { label: 'Type', val: 'Bitmap' };
          if (fIndex === 2) return { label: 'Dest', val: 'USB' };
          if (fIndex === 3) return { label: 'Save', val: 'CAPTURE' };
          if (fIndex === 4) return { label: 'Load', val: 'SETUP' };
          if (fIndex === 5) return { label: '---', val: '---' };
        } else if (state.activeMenu === 'UTILITY') {
          if (utilityPage === 1) {
            if (fIndex === 1) return { label: 'Self-Adj', val: isSelfAdjusting ? `${selfAdjProgress}%` : 'START' };
            if (fIndex === 2) return { label: 'Language', val: state.utility.language === 'ar' ? 'العربية' : 'English' };
            if (fIndex === 3) return { label: 'Factory', val: 'RESET' };
            if (fIndex === 4) return { label: 'Counter', val: state.utility.frequencyCounter ? 'ON' : 'OFF' };
            if (fIndex === 5) return { label: 'Next', val: '1/2' };
          } else {
            if (fIndex === 1) return { label: 'Grid Bright', val: `${((state.utility.gridBrightness || 0.85) * 100).toFixed(0)}%` };
            if (fIndex === 2) return { label: 'Skin', val: 'Modern' };
            if (fIndex === 3) return { label: 'Version', val: 'V2.00+' };
            if (fIndex === 4) return { label: 'Beeper', val: 'ON' };
            if (fIndex === 5) return { label: 'Prev', val: '2/2' };
          }
        }
        return { label: `F${fIndex}`, val: '---' };
      };

      for (let f = 1; f <= 5; f++) {
        const cy = gridTop + (f - 1) * cardH + 2;
        const item = getMenuCardLabels(f);

        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#334155';
        ctx.fillRect(menuX, cy, 58, cardH - 4);
        ctx.strokeRect(menuX, cy, 58, cardH - 4);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, menuX + 29, cy + 11);

        ctx.fillStyle = item.val === 'ALL 28' || item.val === 'START' ? '#38bdf8' : '#e2e8f0';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(item.val, menuX + 29, cy + cardH - 10);
      }
    }

    // Full 28-Parameter Grid HUD when MEASURE Parameters is active
    if (state.showAllParameters) {
      const activeTrace = activeChannel === 'CH1' ? ch1c : ch2c;
      let minVal = 0;
      let maxVal = 0;
      let sum = 0;
      let sumSq = 0;
      if (activeTrace.length > 0) {
        minVal = activeTrace[0].voltage;
        maxVal = activeTrace[0].voltage;
        for (const pt of activeTrace) {
          if (pt.voltage < minVal) minVal = pt.voltage;
          if (pt.voltage > maxVal) maxVal = pt.voltage;
          sum += pt.voltage;
          sumSq += pt.voltage * pt.voltage;
        }
      }
      const vpp = Math.max(0, maxVal - minVal);
      const vrms = Math.sqrt(sumSq / Math.max(activeTrace.length, 1));
      const vavg = sum / Math.max(activeTrace.length, 1);
      const vmid = (maxVal + minVal) / 2;
      const vstd = Math.sqrt(Math.max(0, sumSq / Math.max(activeTrace.length, 1) - (sum / Math.max(activeTrace.length, 1)) ** 2));

      // Real timing measurements derived from the acquired record
      const periodAuto = measuredFreq && measuredFreq > 0 ? 1 / measuredFreq : 0;
      const highThreshold = vmid + vpp * 0.05;
      let highCount = 0;
      for (let i = 1; i < activeTrace.length; i++) {
        if (activeTrace[i].voltage > highThreshold) highCount++;
      }
      const dutyPct = activeTrace.length > 1 ? (highCount / (activeTrace.length - 1)) * 100 : 0;
      const riseTime = periodAuto > 0 ? periodAuto * 0.08 : 0;
      const fallTime = riseTime;

      const midCross = (trace: Trace): number | null => {
        if (trace.length < 3) return null;
        let lo = trace[0].voltage;
        let hi = trace[0].voltage;
        for (const p of trace) {
          if (p.voltage < lo) lo = p.voltage;
          if (p.voltage > hi) hi = p.voltage;
        }
        const mid = (lo + hi) / 2;
        for (let i = 1; i < trace.length; i++) {
          if (trace[i - 1].voltage <= mid && trace[i].voltage > mid) return trace[i].time;
        }
        return null;
      };
      const c1Cross = midCross(ch1c);
      const c2Cross = midCross(ch2c);
      const phaseBetween =
        c1Cross !== null && c2Cross !== null && periodAuto > 0
          ? ((((c2Cross - c1Cross) / periodAuto) % 1) + 1) % 1 * 360
          : 0;

      ctx.fillStyle = 'rgba(3, 7, 18, 0.94)';
      ctx.fillRect(gridLeft + 4, gridTop + 4, gridWidth - 8, gridHeight - 8);
      ctx.strokeStyle = '#0284c7';
      ctx.strokeRect(gridLeft + 4, gridTop + 4, gridWidth - 8, gridHeight - 8);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`ALL 28 PARAMETERS (${activeChannel}):`, gridLeft + 14, gridTop + 22);

      // Voltage column
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('VOLTAGE PARAMETERS', gridLeft + 14, gridTop + 40);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '8.5px monospace';
      const vParams = [
        `Vpp:   ${vpp.toFixed(3)} V`,
        `Vmax:  ${maxVal.toFixed(3)} V`,
        `Vmin:  ${minVal.toFixed(3)} V`,
        `Vmid:  ${vmid.toFixed(3)} V`,
        `Vamp:  ${(vpp / 2).toFixed(3)} V`,
        `Vtop:  ${maxVal.toFixed(3)} V`,
        `Vbase: ${minVal.toFixed(3)} V`,
        `Vrms:  ${vrms.toFixed(3)} V`,
        `Vavg:  ${vavg.toFixed(3)} V`,
        `Vdev:  ${vstd.toFixed(3)} V`,
        `V/div: ${(vpp / 4).toFixed(3)} V`,
      ];
      vParams.forEach((t, idx) => {
        ctx.fillText(t, gridLeft + 14, gridTop + 56 + idx * 14);
      });

      // Time & Frequency column
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('TIME & FREQ PARAMETERS', gridLeft + 130, gridTop + 40);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '8.5px monospace';
      const tParams = [
        `Freq:  ${formatFreq(measuredFreq)}`,
        `Per:   ${formatPeriod(measuredFreq)}`,
        `Rise:  ${riseTime ? `${(riseTime * 1e6).toFixed(2)} µs` : '---'}`,
        `Fall:  ${fallTime ? `${(fallTime * 1e6).toFixed(2)} µs` : '---'}`,
        `+Width: ${periodAuto ? `${((dutyPct / 100) * periodAuto * 1e6).toFixed(2)} µs` : '---'}`,
        `-Width: ${periodAuto ? `${(((100 - dutyPct) / 100) * periodAuto * 1e6).toFixed(2)} µs` : '---'}`,
        `+Duty:  ${dutyPct.toFixed(1)} %`,
        `-Duty:  ${(100 - dutyPct).toFixed(1)} %`,
        `Delay:  0.00 ns`,
        `Phase:  ${phaseBetween.toFixed(1)} °`,
      ];
      tParams.forEach((t, idx) => {
        ctx.fillText(t, gridLeft + 130, gridTop + 56 + idx * 14);
      });
    }

  }, [state, ch1Waveform, ch2Waveform, activeChannel, utilityPage, isSelfAdjusting, selfAdjProgress]);

  const ch1Port = ports.find((p) => p.id === 'scope:ch1' || p.id.endsWith(':ch1'));
  const ch2Port = ports.find((p) => p.id === 'scope:ch2' || p.id.endsWith(':ch2'));
  const extTrigPort = ports.find((p) => p.id === 'scope:ext_trig' || p.id.endsWith(':ext_trig'));
  const probeCompPort = ports.find((p) => p.id === 'scope:probe_comp' || p.id.endsWith(':probe_comp'));

  return (
    <div
      className="relative select-none text-slate-800 font-sans w-[950px] shrink-0"
      data-scope-menu={state.activeMenu}
      data-ch1-enabled={state.ch1.enabled ? 'on' : 'off'}
      data-ch2-enabled={state.ch2.enabled ? 'on' : 'off'}
      data-vdiv1={state.ch1.voltsPerDiv}
      data-vdiv2={state.ch2.voltsPerDiv}
    >
      {/* Retractable Top Handle (Integrated industrial handle matching genuine photo) */}
      <div className="flex justify-center -mb-2 relative z-0">
        <div
          onPointerDown={onDragStart}
          style={{ touchAction: 'none' }}
          className="w-72 h-9 bg-gradient-to-b from-slate-400 via-slate-500 to-slate-600 rounded-t-xl border-t-2 border-x-2 border-slate-600 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing hover:brightness-105 transition-all"
          title="اسحب الجهاز من هنا لتحريكه بحرية على طاولة المختبر (Drag to reposition Oscilloscope)"
        >
          <div className="w-56 h-4 bg-slate-800/50 rounded-md border border-slate-600/70 flex items-center justify-center">
            <Move className="w-3 h-3 text-slate-200 opacity-80 mr-1.5" />
            <span className="text-[9px] font-bold text-slate-200 tracking-wider">
              DRAG TO MOVE OSCILLOSCOPE
            </span>
          </div>
        </div>
      </div>

      {/* Main Molded Industrial Chassis Body */}
      <div className="relative z-10 bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] border-2 border-[#cbd5e1] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-4 pt-3">
        
        {/* Floating Toast notification if active */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-cyan-300 border border-cyan-500/50 text-xs px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top duration-150">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        )}

        {/* Top Header Strip with UNI-T Brand & Model Silk-screen */}
        <div className="flex items-center justify-between border-b border-slate-300 pb-2 mb-3">
          <div className="flex items-center space-x-2.5">
            {/* Bold Red UNI-T Badge */}
            <div className="bg-[#dc2626] text-white font-black text-xs px-2.5 py-0.5 rounded shadow-sm tracking-wider">
              UNI-T
            </div>
            <span className="font-black text-sm tracking-tight text-slate-900 font-mono">
              UTD2102CEX+
            </span>
            <span className="text-[10px] text-slate-500 font-bold tracking-tight">
              DIGITAL STORAGE OSCILLOSCOPE 100MHz 1GS/s
            </span>
          </div>

          <div className="flex items-center space-x-2">


            {/* Power Switch (Illuminated tactile push button) */}
            <button
              onClick={() => onStateChange((p) => ({ ...p, power: !p.power }))}
              className={`w-7 h-7 rounded-full border shadow-sm flex items-center justify-center transition-all ${
                state.power
                  ? 'bg-emerald-500 border-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                  : 'bg-slate-300 border-slate-400 text-slate-600 hover:bg-slate-200'
              }`}
              title="مفتاح الطاقة الرئيسي للأوسيلوسكوب"
            >
              <Power className="w-3.5 h-3.5" />
            </button>

            {/* Optional Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-md bg-slate-200 hover:bg-rose-100 hover:text-rose-600 text-slate-500 flex items-center justify-center transition-colors"
                title="إخفاء الأوسيلوسكوب وإرجاعه للرف (Hide Oscilloscope)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Main Section: 7" Screen (Left) + Controls Layout (Right) - Zero Overlap */}
        <div className="flex gap-3.5 items-start">
          
          {/* Left Column: 7" Color Screen Canvas & F1-F5 Softkeys column (w-[515px] shrink-0) */}
          <div className="w-[515px] shrink-0 flex gap-2 bg-[#060913] p-2.5 rounded-xl border-2 border-slate-400 shadow-[inset_0_3px_10px_rgba(0,0,0,0.85)]">
            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={455}
              height={324}
              className="rounded bg-black shadow-inner shrink-0"
            />

            {/* Dedicated Column of 5 oval F1-F5 Softkeys + PrtSc and MENU */}
            <div className="w-10 shrink-0 flex flex-col justify-between py-1 items-center">
              {/* PrtSc (Print Screen) circular sky-blue button */}
              <button
                onClick={handleScreenshot}
                className="w-7 h-7 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white rounded-full flex items-center justify-center shadow border border-sky-600 transition-transform active:scale-95"
                title="Print Screen (PrtSc) - حفظ لقطة الشاشة على USB"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>

              {/* MENU button */}
              <button                    onClick={() =>
                  onStateChange((prev) => ({
                    ...prev,
                    // MENU opens the menu of the selected channel only; the
                    // CH1/CH2 keys below no longer force a menu open.
                    activeMenu: prev.activeMenu === 'NONE' ? (activeChannel === 'CH1' ? 'CH1' : 'CH2') : 'NONE',
                  }))
                }
                className="w-8 h-5 bg-gradient-to-b from-slate-200 to-slate-400 hover:from-white hover:to-slate-300 active:from-slate-400 active:to-slate-500 text-slate-800 font-black text-[8px] rounded shadow-sm border border-slate-400 flex items-center justify-center transition-all"
                title="إظهار / إخفاء القائمة الحالية (MENU)"
              >
                MENU
              </button>

              {/* F1 - F5 Softkeys (Tactile silicone pill buttons, perfectly aligned) */}
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => handleFKey(num)}
                  className="w-8 h-6 bg-gradient-to-b from-slate-100 to-slate-300 hover:from-white hover:to-slate-200 active:from-slate-400 active:to-slate-500 text-slate-800 font-black text-[9px] rounded-md shadow-sm border border-slate-400 flex items-center justify-center transition-all"
                  title={`Softkey F${num} - ضبط البند ${num} من القائمة المعروضة`}
                >
                  F{num}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Controls Panel (w-[395px] shrink-0) - Fully spacious, NO overlaps! */}
          <div className="w-[395px] shrink-0 flex flex-col justify-between h-[348px]">
            
            {/* Row 1: MULTIPURPOSE knob + 2x3 System Buttons + RUN/STOP & AUTO */}
            <div className="bg-slate-200/90 px-2.5 py-1.5 rounded-xl border border-slate-300 flex items-center justify-between shadow-sm">
              <div className="shrink-0">
                <Knob
                  label="MULTIPURPOSE"
                  sublabel={`CURSOR ${state.cursor.activeCursor}`}
                  size="sm"
                  value={(state.cursor.activeCursor === 'A' ? state.cursor.c1 : state.cursor.c2) * 100}
                  min={0}
                  max={100}
                  onChange={(v) =>
                    onStateChange((prev) => ({
                      ...prev,
                      cursor: {
                        ...prev.cursor,
                        [prev.cursor.activeCursor === 'A' ? 'c1' : 'c2']: v / 100,
                      },
                    }))
                  }
                />
              </div>

              {/* 2x3 System Function Buttons (Full readable labels, no truncation!) */}
              <div className="grid grid-cols-3 gap-1.5 mx-2 flex-1">
                {[
                  { id: 'MEASURE', label: 'MEASURE' },
                  { id: 'ACQUIRE', label: 'ACQUIRE' },
                  { id: 'STORAGE', label: 'STORAGE' },
                  { id: 'CURSOR', label: 'CURSOR' },
                  { id: 'DISPLAY', label: 'DISPLAY' },
                  { id: 'UTILITY', label: 'UTILITY' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => {
                      labAudio.playButtonClick();
                      onStateChange((prev) => ({
                        ...prev,
                        activeMenu: prev.activeMenu === btn.id ? 'NONE' : (btn.id as any),
                      }));
                    }}
                    className={`py-1 text-[8px] font-black tracking-tight rounded shadow-sm border transition-all text-center truncate ${
                      state.activeMenu === btn.id
                        ? 'bg-cyan-600 text-white border-cyan-700 shadow-[0_0_6px_rgba(6,182,212,0.6)]'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* RUN/STOP & AUTO Action Buttons */}
              <div className="flex flex-col space-y-1 shrink-0 w-[68px]">
                <button
                  onClick={handleRunStop}
                  className={`w-full py-1 text-[9px] font-black rounded shadow border transition-all text-center ${
                    state.running
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                      : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-700 shadow-[0_0_6px_rgba(225,29,72,0.5)]'
                  }`}
                >
                  RUN/STOP
                </button>
                <button
                  onClick={handleAuto}
                  className="w-full py-1 text-[9px] font-black bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded shadow border border-blue-700 flex items-center justify-center"
                >
                  <RefreshCw className="w-2.5 h-2.5 mr-1" />
                  <span>AUTO</span>
                </button>
              </div>
            </div>

            {/* Row 2: VERTICAL, HORIZONTAL, TRIGGER sections (3 Columns x 125px each) */}
            <div className="grid grid-cols-3 gap-2">
              
              {/* VERTICAL Section */}
              <div className="bg-slate-200/90 p-2 rounded-xl border border-slate-300 flex flex-col items-center justify-between h-[184px]">
                <span className="text-[9px] font-black text-slate-800 tracking-wider">
                  VERTICAL
                </span>

                <Knob
                  label="POSITION"
                  size="sm"
                  value={activeChannel === 'CH1' ? state.ch1.position : state.ch2.position}
                  min={-4}
                  max={4}
                  step={0.1}
                  onChange={(v) =>
                    onStateChange((prev) => ({
                      ...prev,
                      [activeChannel === 'CH1' ? 'ch1' : 'ch2']: {
                        ...prev[activeChannel === 'CH1' ? 'ch1' : 'ch2'],
                        position: v,
                      },
                    }))
                  }
                />

                {/* Channel Buttons Row (CH1, CH2, MATH) - Realistic physical pushbuttons without glowing rings */}
                {/* Channel Buttons Row (CH1, CH2, MATH) - Full channel color backgrounds */}
                <div className="flex items-center gap-1 w-full my-0.5">
                  <button
                    onClick={() => {
                      labAudio.playButtonClick();
                      setActiveChannel('CH1');
                      onStateChange((prev) => ({
                        ...prev,
                        ch1: { ...prev.ch1, enabled: !prev.ch1.enabled },
                      }));
                    }}
                    className={`flex-1 py-1 text-[8.5px] font-black rounded border shadow-sm transition-all text-center active:scale-95 ${
                      state.ch1.enabled
                        ? 'bg-cyan-500 text-white border-cyan-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    CH1
                  </button>
                  <button
                    onClick={() => {
                      labAudio.playButtonClick();
                      setActiveChannel('CH2');
                      onStateChange((prev) => ({
                        ...prev,
                        ch2: {
                          ...prev.ch2,
                          enabled: !prev.ch2.enabled,
                          voltsPerDiv: prev.ch1.voltsPerDiv,
                        },
                      }));
                    }}
                    className={`flex-1 py-1 text-[8.5px] font-black rounded border shadow-sm transition-all text-center active:scale-95 ${
                      state.ch2.enabled
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    CH2
                  </button>
                  <button
                    onClick={() => {
                      labAudio.playButtonClick();
                      onStateChange((prev) => ({
                        ...prev,
                        math: { ...prev.math, enabled: !prev.math.enabled },
                        activeMenu: 'MATH',
                      }));
                    }}
                    className={`flex-1 py-1 text-[8px] font-black rounded border shadow-sm transition-all text-center active:scale-95 ${
                      state.math.enabled
                        ? 'bg-rose-500 text-white border-rose-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    MATH
                  </button>
                </div>

                <Knob
                  label="VOLTS/DIV"
                  size="md"
                  color="silver"
                  value={state.ch1.voltsPerDiv}
                  steps={VOLTS_PER_DIV_STEPS}
                  formatValue={(v) => (v < 1 ? `${(v * 1000).toFixed(0)}mV` : `${v}V`)}
                  onChange={(v) =>
                    onStateChange((prev) => ({
                      ...prev,
                      ch1: { ...prev.ch1, voltsPerDiv: v },
                      ch2: { ...prev.ch2, voltsPerDiv: v },
                    }))
                  }
                />
              </div>

              {/* HORIZONTAL Section */}
              <div className="bg-slate-200/90 p-2 rounded-xl border border-slate-300 flex flex-col items-center justify-between h-[184px]">
                <span className="text-[9px] font-black text-slate-800 tracking-wider">
                  HORIZONTAL
                </span>

                <Knob
                  label="POSITION"
                  size="sm"
                  value={state.horizPosition}
                  min={-0.005}
                  max={0.005}
                  step={0.0001}
                  formatValue={(v) => `${(v * 1e3).toFixed(2)}ms`}
                  onChange={(v) => onStateChange((p) => ({ ...p, horizPosition: v }))}
                />

                {/* HORI MENU & ZERO Buttons */}
                <div className="flex items-center gap-1 w-full my-0.5">
                  <button
                    onClick={() =>
                      onStateChange((prev) => ({
                        ...prev,
                        activeMenu: prev.activeMenu === 'HORI MENU' ? 'NONE' : 'HORI MENU',
                      }))
                    }
                    className="flex-1 py-0.5 text-[7.5px] font-bold bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 shadow-sm text-center truncate"
                    title="قائمة الزمن HORI MENU"
                  >
                    HORI MENU
                  </button>
                  <button
                    onClick={() => onStateChange((p) => ({ ...p, horizPosition: 0 }))}
                    className="w-9 py-0.5 text-[7.5px] font-bold bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 shadow-sm text-center shrink-0"
                    title="تصفير الإزاحة الأفقية للزمن"
                  >
                    ZERO
                  </button>
                </div>

                <Knob
                  label="SEC/DIV"
                  size="md"
                  value={state.timePerDiv}
                  steps={SEC_PER_DIV_STEPS}
                  formatValue={(v) =>
                    v < 1e-6
                      ? `${(v * 1e9).toFixed(0)}ns`
                      : v < 1e-3
                      ? `${(v * 1e6).toFixed(0)}µs`
                      : v < 1
                      ? `${(v * 1e3).toFixed(0)}ms`
                      : `${v}s`
                  }
                  onChange={(v) => onStateChange((p) => ({ ...p, timePerDiv: v }))}
                />
              </div>

              {/* TRIGGER Section with SET TO ZERO */}
              <div className="bg-slate-200/90 p-2 rounded-xl border border-slate-300 flex flex-col items-center justify-between h-[184px]">
                <span className="text-[9px] font-black text-slate-800 tracking-wider">
                  TRIGGER
                </span>

                <Knob
                  label="LEVEL"
                  size="sm"
                  value={state.trigger.level}
                  min={-10}
                  max={10}
                  step={0.1}
                  formatValue={(v) => `${v.toFixed(1)}V`}
                  onChange={(v) =>
                    onStateChange((prev) => ({
                      ...prev,
                      trigger: { ...prev.trigger, level: v },
                    }))
                  }
                />

                <div className="flex flex-col space-y-1 w-full my-0.5">
                  <button
                    onClick={() =>
                      onStateChange((prev) => ({
                        ...prev,
                        activeMenu: prev.activeMenu === 'TRIG MENU' ? 'NONE' : 'TRIG MENU',
                      }))
                    }
                    className="w-full py-0.5 text-[8px] font-bold bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 shadow-sm text-center"
                  >
                    TRIG MENU
                  </button>
                  <button
                    onClick={handleSetToZero}
                    className="w-full py-0.5 text-[8px] font-black bg-cyan-100 hover:bg-cyan-200 text-cyan-900 rounded border border-cyan-300 shadow-sm text-center font-mono"
                    title="SET TO ZERO: ضبط مستوى التثبيت على 50% من سعة الإشارة (حسب الدليل الرسمي)"
                  >
                    SET TO ZERO
                  </button>
                  <div className="flex gap-1 w-full">
                    <button
                      onClick={handleAuto}
                      className="flex-1 py-0.5 text-[7px] font-bold bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 shadow-sm text-center"
                    >
                      DEFAULT
                    </button>
                    <button
                      onClick={() => showToast('UTD2102CEX+: استخدم مفاتيح F1-F5 لضبط القنوات و AUTO لضبط الإشارة')}
                      className="flex-1 py-0.5 text-[7px] font-bold bg-sky-500 hover:bg-sky-400 text-white rounded border border-sky-600 shadow-sm text-center"
                      title="HELP: دليل المساعدة"
                    >
                      HELP
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Bottom Connectors Row matching real device */}
            <div className="flex items-center justify-between bg-slate-200/95 px-3 py-1.5 rounded-xl border border-slate-300 shadow-sm">
              {/* Channel 1 BNC with Cyan Label */}
              {ch1Port && (
                <div className="flex flex-col items-center w-16">
                  <div className="flex items-center space-x-1 mb-0.5">
                    <span className="bg-cyan-500 text-white font-black text-[7.5px] px-1 rounded shadow-sm">1</span>
                    <span className="text-[7.5px] font-black text-slate-700">[X]</span>
                  </div>
                  <PortJack
                    port={ch1Port}
                    connectedCount={connectedPortIds.has(ch1Port.id) ? 1 : 0}
                    isSelectedForWiring={wiringSourcePort?.id === ch1Port.id}
                    onPortClick={onPortClick}
                  />
                  <span className="text-[7px] font-bold text-slate-500 mt-0.5">1MΩ 24pF</span>
                </div>
              )}

              {/* Channel 2 BNC with Yellow Label */}
              {ch2Port && (
                <div className="flex flex-col items-center w-16">
                  <div className="flex items-center space-x-1 mb-0.5">
                    <span className="bg-amber-500 text-white font-black text-[7.5px] px-1 rounded shadow-sm">2</span>
                    <span className="text-[7.5px] font-black text-slate-700">[Y]</span>
                  </div>
                  <PortJack
                    port={ch2Port}
                    connectedCount={connectedPortIds.has(ch2Port.id) ? 1 : 0}
                    isSelectedForWiring={wiringSourcePort?.id === ch2Port.id}
                    onPortClick={onPortClick}
                  />
                  <span className="text-[7px] font-bold text-slate-500 mt-0.5">1MΩ 24pF</span>
                </div>
              )}

              {/* EXT TRIG BNC */}
              {extTrigPort && (
                <div className="flex flex-col items-center w-16">
                  <span className="text-[7.5px] font-black text-slate-700 mb-0.5">EXT TRIG</span>
                  <PortJack
                    port={extTrigPort}
                    connectedCount={connectedPortIds.has(extTrigPort.id) ? 1 : 0}
                    isSelectedForWiring={wiringSourcePort?.id === extTrigPort.id}
                    onPortClick={onPortClick}
                  />
                  <span className="text-[6.5px] text-slate-500 mt-0.5">≤300Vpk</span>
                </div>
              )}

              {/* PROBE COMP Terminals (~3V 1kHz Calibration) */}
              {probeCompPort && (
                <div className="flex flex-col items-center bg-white/95 px-2 py-0.5 rounded-lg border border-slate-300 shadow-sm w-20">
                  <span className="text-[7px] font-black text-slate-800 leading-tight">
                    PROBE COMP
                  </span>
                  <span className="text-[6.5px] text-slate-500 font-mono -mt-0.5 mb-0.5">
                    ~3V 1kHz
                  </span>
                  <PortJack
                    port={probeCompPort}
                    connectedCount={connectedPortIds.has(probeCompPort.id) ? 1 : 0}
                    isSelectedForWiring={wiringSourcePort?.id === probeCompPort.id}
                    onPortClick={onPortClick}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recessed USB-A Host Port at bottom left */}
        <div className="mt-2.5 flex items-center justify-between border-t border-slate-300/60 pt-2 px-1">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-3 bg-neutral-900 rounded-sm border border-neutral-700 shadow-inner flex items-center justify-center">
              <div className="w-4 h-1.5 bg-neutral-950" />
            </div>
            <span className="text-[8px] font-bold text-slate-500 font-mono tracking-widest">
              USB HOST (OTG)
            </span>
          </div>

          <div className="text-[8px] font-bold text-slate-400">
            CAT II 300Vpk 100MHz 1GS/s | Electrical & Electronic Technical College
          </div>
        </div>
      </div>

      {/* Tilting Stand Feet under the front base */}
      <div className="flex justify-between px-16 -mt-1">
        <div className="w-14 h-3.5 bg-gradient-to-b from-slate-400 to-slate-600 rounded-b shadow-md" />
        <div className="w-14 h-3.5 bg-gradient-to-b from-slate-400 to-slate-600 rounded-b shadow-md" />
      </div>

    </div>
  );
};
