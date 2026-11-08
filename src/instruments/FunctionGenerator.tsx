import React, { useState } from 'react';
import { FunctionGenState, Port, WaveformType } from '../types/lab';
import { SevenSegmentDisplay } from '../components/SevenSegment';
import { PortJack } from '../components/PortJack';
import { labAudio } from '../utils/audio';
import { X, Power } from 'lucide-react';

interface FunctionGeneratorProps {
  state: FunctionGenState;
  onStateChange: (updater: (prev: FunctionGenState) => FunctionGenState) => void;
  ports: Port[];
  connectedPortIds: Set<string>;
  wiringSourcePort: Port | null;
  onPortClick: (port: Port) => void;
  onClose?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

const FREQ_RANGES = [
  { label: '1', multiplier: 1, unit: 'Hz' },
  { label: '10', multiplier: 10, unit: 'Hz' },
  { label: '100', multiplier: 100, unit: 'Hz' },
  { label: '1k', multiplier: 1000, unit: 'kHz' },
  { label: '10k', multiplier: 10000, unit: 'kHz' },
  { label: '100k', multiplier: 100000, unit: 'kHz' },
  { label: '1M', multiplier: 1000000, unit: 'MHz' },
];

/**
 * Authentic Light-Grey Fluted Collet Knob for LW-1641
 */
interface FlutedKnobProps {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  isCyanLabel?: boolean;
  hasDetentSymbols?: boolean; // for DC OFFSET with - and +
  onChange: (val: number) => void;
  onPress?: () => void;
}

const FlutedKnob: React.FC<FlutedKnobProps> = ({
  label,
  sublabel,
  value,
  min,
  max,
  step = 0.01,
  unit = '',
  size = 'md',
  isCyanLabel = false,
  hasDetentSymbols = false,
  onChange,
  onPress,
}) => {
  const isDraggingRef = React.useRef(false);
  const startYRef = React.useRef(0);
  const startValRef = React.useRef(value);
  const knobElRef = React.useRef<HTMLDivElement>(null);

  const clamped = Math.max(min, Math.min(max, value));
  const pct = (clamped - min) / (max - min || 1);
  const angle = -135 + 270 * pct;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY;
    const range = max - min;
    const sensitivity = 0.005;
    const rawVal = startValRef.current + deltaY * (range * sensitivity);
    const stepped = Math.round(rawVal / step) * step;
    const nextVal = Math.max(min, Math.min(max, stepped));
    if (nextVal !== value) {
      labAudio.playKnobClick();
      onChange(Number(nextVal.toFixed(3)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Native non-passive listener (React's onWheel is passive and logs errors
  // when preventDefault is called).
  React.useEffect(() => {
    const el = knobElRef.current;
    if (!el) return;
    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const nextVal = Math.max(min, Math.min(max, value + dir * step));
      if (nextVal !== value) {
        labAudio.playKnobClick();
        onChange(Number(nextVal.toFixed(3)));
      }
    };
    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelNative);
  }, [value, min, max, step, onChange]);

  const dimensions = {
    sm: { diameter: 34, capSize: 22, pointerLen: 8 },
    md: { diameter: 38, capSize: 26, pointerLen: 10 },
    lg: { diameter: 48, capSize: 34, pointerLen: 14 },
  }[size];

  return (
    <div className="flex flex-col items-center select-none relative group">
      {/* Label above Knob */}
      <div className="flex items-center space-x-1 mb-1">
        {hasDetentSymbols && (
          <span className="text-[7.5px] font-mono font-bold text-sky-700 leading-none mr-0.5">
            -
          </span>
        )}
        <span
          className={`text-[8px] font-mono font-bold tracking-tight uppercase leading-none ${
            isCyanLabel ? 'text-sky-700 font-extrabold' : 'text-neutral-700'
          }`}
        >
          {label}
        </span>
        {hasDetentSymbols && (
          <span className="text-[7.5px] font-mono font-bold text-sky-700 leading-none ml-0.5">
            +
          </span>
        )}
      </div>

      {/* Fluted Knob Body */}
      <div
        ref={knobElRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={onPress}
        style={{
          width: dimensions.diameter,
          height: dimensions.diameter,
          touchAction: 'none',
        }}
        className="relative rounded-full cursor-ns-resize shadow-[0_2px_4px_rgba(0,0,0,0.35),0_1px_1px_rgba(255,255,255,0.8)_inset] flex items-center justify-center border border-neutral-400 bg-gradient-to-b from-[#e3e6e3] via-[#c8ccc8] to-[#9ea29f] hover:brightness-105 active:scale-95 transition-transform"
        title={`${label}: ${value.toFixed(2)}${unit}`}
      >
        {/* Realistic Ribbed / Fluted perimeter skirt */}
        <div className="absolute inset-0 rounded-full overflow-hidden opacity-30 pointer-events-none">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              style={{
                transform: `rotate(${i * 20}deg)`,
                transformOrigin: 'center center',
              }}
              className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-neutral-900"
            />
          ))}
        </div>

        {/* Outer bevel ring */}
        <div className="w-[90%] h-[90%] rounded-full bg-gradient-to-b from-[#d2d6d1] to-[#b4b8b3] flex items-center justify-center shadow-inner border border-neutral-400/60">
          {/* Rotating Cap Face */}
          <div
            style={{
              width: dimensions.capSize,
              height: dimensions.capSize,
              transform: `rotate(${angle}deg)`,
            }}
            className="rounded-full bg-gradient-to-b from-[#f2f4f1] via-[#e2e5e1] to-[#caced0] border border-neutral-400/80 shadow-[0_1px_3px_rgba(0,0,0,0.25)] flex items-center justify-center relative transition-transform duration-75"
          >
            {/* Dark Pointer Line */}
            <div
              style={{ height: dimensions.pointerLen }}
              className="w-[2px] bg-neutral-800 rounded-full absolute top-[2px] shadow-sm"
            />
            {/* Center machined cap detail */}
            <div className="w-2 h-2 rounded-full bg-gradient-to-tr from-[#d5d9d4] to-[#f4f7f3] border border-neutral-400 shadow-inner" />
          </div>
        </div>
      </div>

      {/* Sublabel below knob (if any) */}
      {sublabel && (
        <span className="text-[6.5px] text-neutral-500 font-mono tracking-tighter mt-1 leading-none">
          {sublabel}
        </span>
      )}
    </div>
  );
};

export const FunctionGenerator: React.FC<FunctionGeneratorProps> = ({
  state,
  onStateChange,
  ports,
  connectedPortIds,
  wiringSourcePort,
  onPortClick,
  onClose,
  onDragStart,
}) => {
  // Local state for counter mode (INT = internal generator freq, EXT = input BNC)
  const [counterMode, setCounterMode] = useState<'INT' | 'EXT'>('INT');
  const [counterGate, setCounterGate] = useState<'1kHz' | '50MHz'>('1kHz');
  const [cmosLevel, setCmosLevel] = useState<number>(5.0);

  // Toggle Power
  const handleTogglePower = () => {
    labAudio.playPowerToggle(!state.power);
    onStateChange((prev) => ({ ...prev, power: !prev.power }));
  };

  // Change Range
  const handleSelectRange = (multiplier: number) => {
    labAudio.playButtonClick();
    onStateChange((prev) => {
      const newFreq = prev.freqDial * (1 + prev.fineDial) * multiplier;
      return { ...prev, range: multiplier, frequency: Math.max(0.2, newFreq) };
    });
  };

  // Change Waveform Function
  const handleSelectWaveform = (wf: WaveformType) => {
    labAudio.playButtonClick();
    onStateChange((prev) => ({ ...prev, waveform: wf }));
  };

  // Toggle 20dB Attenuation
  const handleToggleAtt20 = () => {
    labAudio.playButtonClick();
    onStateChange((prev) => {
      const is20 = prev.attenuation === 20 || prev.attenuation === 60;
      let nextAtt: 0 | 20 | 40 | 60 = 0;
      if (is20) {
        nextAtt = prev.attenuation === 60 ? 40 : 0;
      } else {
        nextAtt = prev.attenuation === 40 ? 60 : 20;
      }
      return { ...prev, attenuation: nextAtt };
    });
  };

  // Toggle 40dB Attenuation
  const handleToggleAtt40 = () => {
    labAudio.playButtonClick();
    onStateChange((prev) => {
      const is40 = prev.attenuation === 40 || prev.attenuation === 60;
      let nextAtt: 0 | 20 | 40 | 60 = 0;
      if (is40) {
        nextAtt = prev.attenuation === 60 ? 20 : 0;
      } else {
        nextAtt = prev.attenuation === 20 ? 60 : 40;
      }
      return { ...prev, attenuation: nextAtt };
    });
  };

  // Format 6-digit LED Display
  let displayStr = '      ';
  let isKHz = false;
  let isOverload = false;

  if (state.power) {
    if (counterMode === 'INT') {
      const freq = state.frequency;
      if (freq > 2200000) {
        isOverload = true;
      }
      if (freq >= 1000) {
        isKHz = true;
        const inKhz = freq / 1000;
        if (inKhz < 10) {
          displayStr = inKhz.toFixed(4);
        } else if (inKhz < 100) {
          displayStr = inKhz.toFixed(3);
        } else {
          displayStr = inKhz.toFixed(2);
        }
      } else {
        isKHz = false;
        if (freq < 10) {
          displayStr = freq.toFixed(3);
        } else if (freq < 100) {
          displayStr = freq.toFixed(2);
        } else {
          displayStr = freq.toFixed(1);
        }
      }
    } else {
      // EXT counter mode
      const isCounterConnected = connectedPortIds.has('gen:counter');
      if (isCounterConnected) {
        displayStr = ' 1.000';
        isKHz = true;
      } else {
        displayStr = ' 0.000';
        isKHz = false;
      }
    }
  } else {
    displayStr = '  OFF ';
  }

  const outputPort = ports.find((p) => p.id === 'gen:output' || p.id.endsWith(':output'));
  const outputGndPort = ports.find((p) => p.id === 'gen:output_gnd' || p.id.endsWith(':output_gnd'));
  const ttlPort = ports.find((p) => p.id === 'gen:ttl' || p.id.endsWith(':ttl'));
  const vcfPort = ports.find((p) => p.id === 'gen:vcf' || p.id.endsWith(':vcf'));
  const counterPort = ports.find((p) => p.id === 'gen:counter' || p.id.endsWith(':counter'));

  const isAtt20Active = state.attenuation === 20 || state.attenuation === 60;
  const isAtt40Active = state.attenuation === 40 || state.attenuation === 60;

  return (
    <div className="relative select-none text-slate-800 font-sans">
      {/* Real Lab Instrument Outer Benchtop Enclosure */}
      <div className="w-[660px] bg-gradient-to-b from-[#e7eae6] via-[#dce0dc] to-[#c8ccc8] rounded-xl border-4 border-[#c5c9c4] shadow-[0_15px_35px_rgba(0,0,0,0.45),inset_0_2px_3px_rgba(255,255,255,0.9)] p-2 relative overflow-hidden">
        {/* Top Cabinet Air Vents (subtle embossed cooling slots) */}
        <div className="absolute top-1 left-8 right-8 flex justify-between pointer-events-none opacity-30">
          <div className="flex space-x-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-2.5 h-1 bg-neutral-700 rounded-sm" />
            ))}
          </div>
          <div className="flex space-x-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-2.5 h-1 bg-neutral-700 rounded-sm" />
            ))}
          </div>
        </div>

        {/* ONE CONTINUOUS SOLID FRONT METAL FACEPLATE */}
        <div className="bg-gradient-to-b from-[#f2f4f1] via-[#ecefe9] to-[#e1e5e0] rounded-lg border-2 border-[#b5bab4] shadow-[inset_0_1px_3px_rgba(0,0,0,0.2),0_1px_0_rgba(255,255,255,0.9)] px-4 py-3">
          
          {/* Top Silk-Screen Brand Header (Printed directly on metal faceplate) */}
          <div
            onPointerDown={onDragStart}
            style={{ touchAction: 'none' }}
            className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-300 cursor-grab active:cursor-grabbing hover:bg-neutral-200/40 px-1 rounded transition-colors"
            title="انقر واسحب لتحريك مولد الإشارة (Drag to move LW-1641)"
          >
            {/* Left: LW Badge + Model & Name in Teal/Black */}
            <div className="flex items-center space-x-2">
              {/* Cyan Square LW Logo */}
              <div className="w-5 h-5 bg-[#00a89d] rounded-[3px] flex items-center justify-center shadow-sm">
                <span className="text-[10px] font-black text-white font-mono tracking-tighter">
                  LW
                </span>
              </div>
              <span className="text-[#00a89d] font-mono font-black text-xs tracking-wider">
                LW-1641
              </span>
              <span className="text-neutral-800 font-sans font-black text-xs tracking-wide">
                FUNCTION GENERATOR
              </span>
              <span className="text-[#00a89d] font-mono font-black text-xs tracking-normal">
                2MHz
              </span>
            </div>

            {/* Right: Close Button */}
            {onClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-4 h-4 rounded-full bg-neutral-300 relative before:absolute before:-inset-2.5 before:content-[''] hover:bg-rose-500 hover:text-white text-neutral-600 flex items-center justify-center transition-colors shadow-sm"
                title="إخفاء المولد"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Upper Section: Display on Left, Single Row of 10 Pushbuttons on Right */}
          <div className="flex items-stretch justify-between gap-3 mb-4">
            
            {/* Display Window: Recessed dark acrylic box */}
            <div className="w-[200px] h-[64px] bg-[#0c1214] rounded-md border-2 border-neutral-700 shadow-[inset_0_2px_6px_rgba(0,0,0,0.95)] flex items-center justify-between px-2.5 relative overflow-hidden">
              {/* Left Annunciators (OV.FL, GATE) */}
              <div className="flex flex-col justify-between h-[44px] text-[7.5px] font-mono">
                {/* OV.FL */}
                <div className="flex items-center space-x-1">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      state.power && isOverload
                        ? 'bg-red-500 shadow-[0_0_5px_#ef4444]'
                        : 'bg-red-950'
                    }`}
                  />
                  <span className={state.power && isOverload ? 'text-red-400 font-bold' : 'text-neutral-600'}>
                    OV.FL
                  </span>
                </div>

                {/* GATE */}
                <div className="flex items-center space-x-1">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      state.power
                        ? 'bg-emerald-400 shadow-[0_0_5px_#10b981] animate-pulse'
                        : 'bg-emerald-950'
                    }`}
                  />
                  <span className={state.power ? 'text-emerald-400 font-bold' : 'text-neutral-600'}>
                    GATE
                  </span>
                </div>
              </div>

              {/* 6-Digit Seven Segment Display */}
              <div className="flex items-center justify-center">
                <SevenSegmentDisplay
                  value={displayStr}
                  digits={6}
                  color="cyan"
                  size="sm"
                />
              </div>

              {/* Right Annunciators (Hz, kHz) */}
              <div className="flex flex-col justify-between h-[44px] text-[7.5px] font-mono text-right">
                <div className="flex items-center justify-end space-x-1">
                  <span className={state.power && !isKHz ? 'text-cyan-300 font-bold' : 'text-neutral-600'}>
                    Hz
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      state.power && !isKHz
                        ? 'bg-cyan-400 shadow-[0_0_4px_#06b6d4]'
                        : 'bg-cyan-950'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-end space-x-1">
                  <span className={state.power && isKHz ? 'text-cyan-300 font-bold' : 'text-neutral-600'}>
                    kHz
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      state.power && isKHz
                        ? 'bg-cyan-400 shadow-[0_0_4px_#06b6d4]'
                        : 'bg-cyan-950'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Combined Pushbuttons Region: Framed box with RANGE(Hz) and FUNCTION in ONE straight row */}
            <div className="flex-1 border border-neutral-400/90 rounded-md p-1.5 bg-[#e7eae5]/70 shadow-inner flex flex-col justify-between">
              
              {/* Header Labels printed above the buttons */}
              <div className="flex items-center justify-between px-1 mb-0.5">
                {/* RANGE(Hz) label */}
                <div className="w-[68%] text-center border-b border-neutral-300 pb-0.5">
                  <span className="text-[7.5px] font-mono font-bold text-neutral-700 tracking-wider">
                    RANGE (Hz)
                  </span>
                </div>
                {/* Vertical Divider */}
                <div className="w-[1px] h-3 bg-neutral-400" />
                {/* FUNCTION label */}
                <div className="w-[28%] text-center border-b border-neutral-300 pb-0.5">
                  <span className="text-[7.5px] font-mono font-bold text-neutral-700 tracking-wider">
                    FUNCTION
                  </span>
                </div>
              </div>

              {/* The 10 Pushbuttons in ONE Straight Horizontal Row */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {/* 7 Range Buttons */}
                <div className="flex items-center justify-between w-[68%] gap-1">
                  {FREQ_RANGES.map((r) => {
                    const isSelected = state.range === r.multiplier;
                    return (
                      <button
                        key={r.label}
                        onClick={() => handleSelectRange(r.multiplier)}
                        className={`flex-1 h-7 rounded-[2px] flex flex-col items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#d0d5d0] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] border border-neutral-500 translate-y-[1px]'
                            : 'bg-gradient-to-b from-[#ffffff] via-[#f1f3f0] to-[#dfe2de] shadow-[0_2px_3px_rgba(0,0,0,0.25),0_1px_0_rgba(255,255,255,0.9)_inset] border border-neutral-400 hover:brightness-105 active:translate-y-[1px]'
                        }`}
                        title={`Range ×${r.label}`}
                      >
                        <span className={`text-[8px] font-mono font-bold leading-none ${isSelected ? 'text-sky-800' : 'text-neutral-800'}`}>
                          {r.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Vertical Separator line */}
                <div className="w-[1px] h-6 bg-neutral-400" />

                {/* 3 Function Buttons */}
                <div className="flex items-center justify-between w-[28%] gap-1">
                  {[
                    { type: 'sine', label: '∼' },
                    { type: 'triangle', label: '∧' },
                    { type: 'square', label: '⎍' },
                  ].map((wf) => {
                    const isSelected = state.waveform === wf.type;
                    return (
                      <button
                        key={wf.type}
                        onClick={() => handleSelectWaveform(wf.type as WaveformType)}
                        className={`flex-1 h-7 rounded-[2px] flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#d0d5d0] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] border border-neutral-500 translate-y-[1px]'
                            : 'bg-gradient-to-b from-[#ffffff] via-[#f1f3f0] to-[#dfe2de] shadow-[0_2px_3px_rgba(0,0,0,0.25),0_1px_0_rgba(255,255,255,0.9)_inset] border border-neutral-400 hover:brightness-105 active:translate-y-[1px]'
                        }`}
                        title={`Waveform ${wf.label}`}
                      >
                        <span className={`text-[12px] font-bold leading-none ${isSelected ? 'text-sky-800' : 'text-neutral-800'}`}>
                          {wf.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Middle Row: The 6 Knurled/Fluted Knobs printed across the panel */}
          <div className="flex items-center justify-between px-1 py-2 my-2 border-t border-b border-neutral-300">
            {/* Knob 1: FREQUENCY (Coarse dial, slightly larger) */}
            <FlutedKnob
              label="FREQUENCY"
              size="lg"
              value={state.freqDial}
              min={0.2}
              max={2.0}
              step={0.01}
              onChange={(v) =>
                onStateChange((prev) => ({
                  ...prev,
                  freqDial: v,
                  frequency: v * (1 + prev.fineDial) * prev.range,
                }))
              }
            />

            {/* Knob 2: FINE (Fine tuning vernier) */}
            <FlutedKnob
              label="FINE"
              size="sm"
              value={state.fineDial}
              min={-0.1}
              max={0.1}
              step={0.005}
              onChange={(v) =>
                onStateChange((prev) => ({
                  ...prev,
                  fineDial: v,
                  frequency: prev.freqDial * (1 + v) * prev.range,
                }))
              }
            />

            {/* Knob 3: CMOS LEVEL (in cyan/blue ink) */}
            <FlutedKnob
              label="CMOS LEVEL"
              size="sm"
              isCyanLabel={true}
              value={cmosLevel}
              min={3.5}
              max={15}
              step={0.5}
              unit="V"
              onChange={(v) => setCmosLevel(v)}
            />

            {/* Knob 4: DC OFFSET (in cyan/blue ink with - and +) */}
            <FlutedKnob
              label="DC OFFSET"
              size="sm"
              isCyanLabel={true}
              hasDetentSymbols={true}
              value={state.dcOffset}
              min={-10}
              max={10}
              step={0.2}
              unit="V"
              onChange={(v) =>
                onStateChange((prev) => ({ ...prev, dcOffset: v }))
              }
              onPress={() => {
                labAudio.playButtonClick();
                onStateChange((prev) => ({ ...prev, dcOffset: 0 }));
              }}
            />

            {/* Knob 5: AMPL / -20dB */}
            <FlutedKnob
              label="AMPL / -20dB"
              size="md"
              value={state.amplitude}
              min={0.2}
              max={20}
              step={0.2}
              unit="Vpp"
              onChange={(v) =>
                onStateChange((prev) => ({ ...prev, amplitude: v }))
              }
            />

            {/* Knob 6: SYM (Symmetry) */}
            <FlutedKnob
              label="SYM"
              size="sm"
              value={state.symmetry * 100}
              min={20}
              max={80}
              step={1}
              unit="%"
              onChange={(v) =>
                onStateChange((prev) => ({ ...prev, symmetry: v / 100 }))
              }
              onPress={() => {
                labAudio.playButtonClick();
                onStateChange((prev) => ({ ...prev, symmetry: 0.5 }));
              }}
            />

            {/* Silk-screened CE Logo */}
            <div className="flex flex-col items-center justify-center pl-1 border-l border-neutral-300">
              <span className="text-sm font-serif font-black text-neutral-400 tracking-tighter">
                CE
              </span>
            </div>
          </div>

          {/* Bottom Row: POWER Rocker, COUNTER, ATT, and BNC Connectors */}
          <div className="flex items-center justify-between pt-2">
            
            {/* POWER Switch: Classic Rectangular Orange Rocker */}
            <div className="flex flex-col items-center">
              <span className="text-[7.5px] font-mono font-bold text-neutral-700 mb-0.5">
                POWER
              </span>
              <button
                onClick={handleTogglePower}
                className={`w-7 h-9 rounded-[2px] border border-neutral-600 flex flex-col items-center justify-between p-0.5 shadow-md transition-all ${
                  state.power
                    ? 'bg-gradient-to-b from-[#ff8800] via-[#ea580c] to-[#c2410c] shadow-[0_0_8px_rgba(249,115,22,0.8)]'
                    : 'bg-gradient-to-b from-[#404040] via-[#262626] to-[#171717] text-neutral-500'
                }`}
                title="Power Switch (OFF / ON)"
              >
                <span className={`text-[6.5px] font-mono font-bold ${state.power ? 'text-orange-950' : 'text-neutral-500'}`}>
                  OFF
                </span>
                <Power className={`w-3.5 h-3.5 ${state.power ? 'text-white' : 'text-neutral-500'}`} />
                <span className={`text-[6.5px] font-mono font-black ${state.power ? 'text-white' : 'text-neutral-500'}`}>
                  ON
                </span>
              </button>
            </div>

            {/* COUNTER: BNC Input + INT/EXT and 1kHz/50MHz buttons */}
            <div className="flex items-center space-x-2 border border-neutral-400/80 rounded px-2 py-1 bg-[#e7eae5]/50">
              {/* BNC INPUT */}
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-mono font-bold text-neutral-700 leading-none mb-0.5">
                  COUNTER
                </span>
                {counterPort && (
                  <div className="p-0.5 bg-neutral-300 rounded border border-neutral-400 shadow-inner">
                    <PortJack
                      port={counterPort}
                      connectedCount={connectedPortIds.has(counterPort.id) ? 1 : 0}
                      isSelectedForWiring={wiringSourcePort?.id === counterPort.id}
                      onPortClick={onPortClick}
                    />
                  </div>
                )}
                <span className="text-[6.5px] font-mono font-bold text-neutral-600 mt-0.5">
                  INPUT
                </span>
              </div>

              {/* Pushbuttons INT/EXT and 1kHz/50MHz */}
              <div className="flex flex-col space-y-1">
                <button
                  onClick={() => {
                    labAudio.playButtonClick();
                    setCounterMode((m) => (m === 'INT' ? 'EXT' : 'INT'));
                  }}
                  className={`w-10 h-4 rounded-[2px] text-[6.5px] font-mono font-bold border flex items-center justify-center transition-all ${
                    counterMode === 'EXT'
                      ? 'bg-[#d0d5d0] shadow-inner text-sky-800 border-neutral-500'
                      : 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] text-neutral-700 border-neutral-400'
                  }`}
                  title="Switch Counter INT / EXT"
                >
                  {counterMode === 'EXT' ? 'EXT' : 'INT'}
                </button>
                <button
                  onClick={() => {
                    labAudio.playButtonClick();
                    setCounterGate((g) => (g === '1kHz' ? '50MHz' : '1kHz'));
                  }}
                  className={`w-10 h-4 rounded-[2px] text-[6.5px] font-mono font-bold border flex items-center justify-center transition-all ${
                    counterGate === '50MHz'
                      ? 'bg-[#d0d5d0] shadow-inner text-sky-800 border-neutral-500'
                      : 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] text-neutral-700 border-neutral-400'
                  }`}
                  title="Counter Gate: 1kHz / 50MHz"
                >
                  {counterGate}
                </button>
              </div>
            </div>

            {/* ATT Section: 20dB and 40dB buttons with 60dB bracket */}
            <div className="flex flex-col items-center border border-neutral-400/80 rounded px-2 py-1 bg-[#e7eae5]/50">
              <span className="text-[7px] font-mono font-bold text-neutral-700 leading-none mb-0.5">
                ATT
              </span>
              <div className="flex items-center space-x-1">
                {/* 20dB */}
                <button
                  onClick={handleToggleAtt20}
                  className={`w-7 h-5 rounded-[2px] text-[7px] font-mono font-bold border flex items-center justify-center transition-all ${
                    isAtt20Active
                      ? 'bg-[#d0d5d0] shadow-inner text-sky-800 border-neutral-500 translate-y-[1px]'
                      : 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] text-neutral-700 border-neutral-400'
                  }`}
                  title="Toggle -20dB Attenuation"
                >
                  20dB
                </button>

                {/* 40dB */}
                <button
                  onClick={handleToggleAtt40}
                  className={`w-7 h-5 rounded-[2px] text-[7px] font-mono font-bold border flex items-center justify-center transition-all ${
                    isAtt40Active
                      ? 'bg-[#d0d5d0] shadow-inner text-sky-800 border-neutral-500 translate-y-[1px]'
                      : 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] text-neutral-700 border-neutral-400'
                  }`}
                  title="Toggle -40dB Attenuation"
                >
                  40dB
                </button>
              </div>

              {/* Bracket 60dB */}
              <div className="flex flex-col items-center w-full mt-0.5">
                <div className="w-12 h-[2px] bg-neutral-400 relative">
                  <div className="absolute left-0 top-0 w-[1px] h-1 bg-neutral-400" />
                  <div className="absolute right-0 top-0 w-[1px] h-1 bg-neutral-400" />
                </div>
                <span className={`text-[6px] font-mono font-bold ${state.attenuation === 60 ? 'text-sky-700 font-extrabold' : 'text-neutral-500'}`}>
                  60dB
                </span>
              </div>
            </div>

            {/* Three BNC Bulkhead Outputs (OUTPUT 50Ω, TTL/CMOS, VCF IN) */}
            <div className="flex items-center space-x-4">
              {/* OUTPUT 50Ω with BNC to Dual-Banana Adapter */}
              {outputPort && (
                <div className="flex flex-col items-center bg-[#dbe0da] px-1.5 py-0.5 rounded-md border border-neutral-400 shadow-sm">
                  <span className="text-[7px] font-mono font-bold text-neutral-800 leading-none mb-0.5">
                    OUTPUT 50Ω
                  </span>
                  <div className="flex items-center space-x-1.5 px-1 py-0.5 bg-neutral-900 rounded border border-neutral-600 shadow-inner">
                    {/* Signal (+) Red */}
                    <div className="flex flex-col items-center">
                      <PortJack
                        port={outputPort}
                        connectedCount={connectedPortIds.has(outputPort.id) ? 1 : 0}
                        isSelectedForWiring={wiringSourcePort?.id === outputPort.id}
                        onPortClick={onPortClick}
                      />
                      <span className="text-[6.5px] font-mono font-bold text-red-400 mt-0.5 leading-none">
                        (+)
                      </span>
                    </div>
                    {/* Ground (⏚) Black */}
                    {outputGndPort && (
                      <div className="flex flex-col items-center">
                        <PortJack
                          port={outputGndPort}
                          connectedCount={connectedPortIds.has(outputGndPort.id) ? 1 : 0}
                          isSelectedForWiring={wiringSourcePort?.id === outputGndPort.id}
                          onPortClick={onPortClick}
                        />
                        <span className="text-[6.5px] font-mono font-bold text-slate-300 mt-0.5 leading-none">
                          (⏚)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TTL/CMOS */}
              {ttlPort && (
                <div className="flex flex-col items-center">
                  <span className="text-[7.5px] font-mono font-bold text-neutral-700 leading-none mb-0.5">
                    TTL/CMOS
                  </span>
                  <div className="p-0.5 bg-neutral-300 rounded border border-neutral-400 shadow-inner">
                    <PortJack
                      port={ttlPort}
                      connectedCount={connectedPortIds.has(ttlPort.id) ? 1 : 0}
                      isSelectedForWiring={wiringSourcePort?.id === ttlPort.id}
                      onPortClick={onPortClick}
                    />
                  </div>
                  <span className="text-[6.5px] font-mono text-neutral-400 mt-0.5 leading-none">
                    PULSE
                  </span>
                </div>
              )}

              {/* VCF IN */}
              {vcfPort && (
                <div className="flex flex-col items-center">
                  <span className="text-[7.5px] font-mono font-bold text-neutral-700 leading-none mb-0.5">
                    VCF IN
                  </span>
                  <div className="p-0.5 bg-neutral-300 rounded border border-neutral-400 shadow-inner">
                    <PortJack
                      port={vcfPort}
                      connectedCount={connectedPortIds.has(vcfPort.id) ? 1 : 0}
                      isSelectedForWiring={wiringSourcePort?.id === vcfPort.id}
                      onPortClick={onPortClick}
                    />
                  </div>
                  <span className="text-[6.5px] font-mono text-neutral-400 mt-0.5 leading-none">
                    INPUT
                  </span>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
