import React from 'react';
import { MultimeterState, Port, UT33DRange } from '../types/lab';
import { SevenSegmentDisplay } from '../components/SevenSegment';
import { PortJack } from '../components/PortJack';
import { labAudio } from '../utils/audio';
import { X, Sun } from 'lucide-react';

interface MultimeterProps {
  state: MultimeterState;
  onStateChange: (updater: (prev: MultimeterState) => MultimeterState) => void;
  ports: Port[];
  connectedPortIds: Set<string>;
  wiringSourcePort: Port | null;
  onPortClick: (port: Port) => void;
  title?: string;
  onClose?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

export interface DialPosition {
  id: UT33DRange;
  label: string;
  sublabel?: string;
  angle: number; // degrees where 0 is 12 o'clock
  mode: 'OFF' | 'DCV' | 'ACV' | 'DCA' | 'OHM' | 'CONT' | 'DIODE' | 'NCV';
  fullScale: number; // in base units (Volts, Amps, Ohms)
  unit: string;
  decimals: number;
}

export const UT33D_POSITIONS: DialPosition[] = [
  // 12 o'clock: OFF (0°)
  { id: 'OFF', label: 'OFF', angle: 0, mode: 'OFF', fullScale: 0, unit: '', decimals: 0 },

  // DC Voltage (top-right to 3 o'clock)
  { id: 'DCV_200m', label: '200m', angle: 18, mode: 'DCV', fullScale: 0.2, unit: 'mV', decimals: 1 },
  { id: 'DCV_2000m', label: '2000m', angle: 36, mode: 'DCV', fullScale: 2.0, unit: 'mV', decimals: 0 },
  { id: 'DCV_20', label: '20', angle: 54, mode: 'DCV', fullScale: 20.0, unit: 'V', decimals: 2 },
  { id: 'DCV_200', label: '200', angle: 72, mode: 'DCV', fullScale: 200.0, unit: 'V', decimals: 1 },
  { id: 'DCV_600', label: '600', angle: 90, mode: 'DCV', fullScale: 600.0, unit: 'V', decimals: 0 },

  // AC Voltage (lower right)
  { id: 'ACV_600', label: '600', angle: 108, mode: 'ACV', fullScale: 600.0, unit: 'V', decimals: 0 },
  { id: 'ACV_200', label: '200', angle: 126, mode: 'ACV', fullScale: 200.0, unit: 'V', decimals: 1 },

  // NCV (Non-Contact Voltage)
  { id: 'NCV', label: 'NCV', angle: 144, mode: 'NCV', fullScale: 0, unit: '', decimals: 0 },

  // DC Current (bottom to lower left)
  { id: 'DCA_10A', label: '10', angle: 162, mode: 'DCA', fullScale: 10.0, unit: 'A', decimals: 2 },
  { id: 'DCA_200m', label: '200m', angle: 180, mode: 'DCA', fullScale: 0.2, unit: 'mA', decimals: 1 },
  { id: 'DCA_20m', label: '20m', angle: 198, mode: 'DCA', fullScale: 0.02, unit: 'mA', decimals: 2 },
  { id: 'DCA_2000u', label: '2000µ', angle: 216, mode: 'DCA', fullScale: 0.002, unit: 'µA', decimals: 0 },

  // Continuity / Diode
  { id: 'CONT_DIODE', label: '•))) ▷|', angle: 234, mode: 'CONT', fullScale: 2.0, unit: 'V', decimals: 3 },

  // Resistance (left side to top-left)
  { id: 'OHM_200', label: '200', angle: 252, mode: 'OHM', fullScale: 200, unit: 'Ω', decimals: 1 },
  { id: 'OHM_2000', label: '2000', angle: 270, mode: 'OHM', fullScale: 2000, unit: 'Ω', decimals: 0 },
  { id: 'OHM_20k', label: '20k', angle: 288, mode: 'OHM', fullScale: 20000, unit: 'kΩ', decimals: 2 },
  { id: 'OHM_200k', label: '200k', angle: 306, mode: 'OHM', fullScale: 200000, unit: 'kΩ', decimals: 1 },
  { id: 'OHM_20M', label: '20M', angle: 324, mode: 'OHM', fullScale: 20000000, unit: 'MΩ', decimals: 2 },
  { id: 'OHM_200M', label: '200M', angle: 342, mode: 'OHM', fullScale: 200000000, unit: 'MΩ', decimals: 1 },
];

export const Multimeter: React.FC<MultimeterProps> = ({
  state,
  onStateChange,
  ports,
  connectedPortIds,
  wiringSourcePort,
  onPortClick,
  onClose,
  onDragStart,
}) => {
  const currentPos =
    UT33D_POSITIONS.find((p) => p.id === state.rangeId) ||
    UT33D_POSITIONS.find((p) => p.id === 'DCV_20') ||
    UT33D_POSITIONS[0];

  // Continuous dial rotation in degrees (takes shortest angular path, preventing 360-degree spins)
  const [dialRotation, setDialRotation] = React.useState<number>(() => currentPos.angle);
  const prevRangeIdRef = React.useRef(state.rangeId);

  // Synchronize continuous rotation whenever state.rangeId changes from external props
  React.useEffect(() => {
    if (state.rangeId === prevRangeIdRef.current) return;
    prevRangeIdRef.current = state.rangeId;
    const targetPos = UT33D_POSITIONS.find((p) => p.id === state.rangeId);
    if (!targetPos) return;

    setDialRotation((prevRot) => {
      const targetAngle = targetPos.angle;
      let delta = ((targetAngle - (prevRot % 360) + 540) % 360) - 180;
      return prevRot + delta;
    });
  }, [state.rangeId]);

  const handleSelectPosition = (pos: DialPosition) => {
    labAudio.playKnobClick();
    prevRangeIdRef.current = pos.id;

    // Calculate shortest angular path from current continuous rotation
    setDialRotation((prevRot) => {
      const targetAngle = pos.angle;
      let delta = ((targetAngle - (prevRot % 360) + 540) % 360) - 180;
      return prevRot + delta;
    });

    onStateChange((prev) => ({
      ...prev,
      power: pos.id !== 'OFF',
      mode: pos.mode,
      range: pos.label,
      rangeId: pos.id,
      unit: pos.unit,
    }));
  };

  // Interactive circular dial click handler for 100% reliable detent selection
  const handleDialAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If clicked anywhere around the rotary scale perimeter (radius 35px to 108px)
    if (dist >= 35 && dist <= 108) {
      let clickAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (clickAngle < 0) clickAngle += 360;
      clickAngle = clickAngle % 360;

      let closest = UT33D_POSITIONS[0];
      let minDiff = 999;
      for (const pos of UT33D_POSITIONS) {
        let diff = Math.abs(pos.angle - clickAngle);
        if (diff > 180) diff = 360 - diff;
        if (diff < minDiff) {
          minDiff = diff;
          closest = pos;
        }
      }
      handleSelectPosition(closest);
    }
  };

  const handleHoldClick = () => {
    labAudio.playButtonClick();
    onStateChange((prev) => {
      if (prev.rangeId === 'CONT_DIODE') {
        const nextMode = prev.mode === 'DIODE' ? 'CONT' : 'DIODE';
        return { ...prev, mode: nextMode, unit: 'V', hold: false };
      }
      return { ...prev, hold: !prev.hold };
    });
  };

  const handleBacklightClick = () => {
    labAudio.playButtonClick();
    onStateChange((prev) => ({ ...prev, backlight: !prev.backlight }));
  };

  // Compute 3½ digit LCD display string matching UT33D+ physical behavior
  const formatLcdDisplay = (): { displayStr: string; isOverload: boolean; showNeg: boolean } => {
    if (!state.power || currentPos.id === 'OFF') {
      return { displayStr: '    ', isOverload: false, showNeg: false };
    }

    if (currentPos.id === 'NCV') {
      return { displayStr: ' EF ', isOverload: false, showNeg: false };
    }

    const val = state.reading;
    const absVal = Math.abs(val);
    const showNeg = val < -0.0001;

    // Check overload against current range full scale
    if (currentPos.mode === 'OHM') {
      if (val < 0 || absVal > currentPos.fullScale) {
        return { displayStr: '1.   ', isOverload: true, showNeg: false };
      }
      let scaled = absVal;
      if (currentPos.unit === 'kΩ') scaled = absVal / 1000;
      else if (currentPos.unit === 'MΩ') scaled = absVal / 1e6;
      return { displayStr: scaled.toFixed(currentPos.decimals), isOverload: false, showNeg: false };
    }

    if (state.mode === 'DIODE') {
      if (val < 0 || absVal > 2.1) {
        return { displayStr: '1.   ', isOverload: true, showNeg: false };
      }
      return { displayStr: absVal.toFixed(3), isOverload: false, showNeg: false };
    }

    if (state.mode === 'CONT') {
      if (val < 0 || absVal > 50) {
        return { displayStr: '1.   ', isOverload: true, showNeg: false };
      }
      return { displayStr: absVal.toFixed(1), isOverload: false, showNeg: false };
    }

    if (currentPos.mode === 'DCV' || currentPos.mode === 'ACV') {
      if (absVal > currentPos.fullScale) {
        return { displayStr: '1.   ', isOverload: true, showNeg };
      }
      let scaled = absVal;
      if (currentPos.unit === 'mV') scaled = absVal * 1000;
      return { displayStr: scaled.toFixed(currentPos.decimals), isOverload: false, showNeg };
    }

    if (currentPos.mode === 'DCA') {
      if (absVal > currentPos.fullScale) {
        return { displayStr: '1.   ', isOverload: true, showNeg };
      }
      let scaled = absVal;
      if (currentPos.unit === 'µA') scaled = absVal * 1e6;
      else if (currentPos.unit === 'mA') scaled = absVal * 1000;
      return { displayStr: scaled.toFixed(currentPos.decimals), isOverload: false, showNeg };
    }

    return { displayStr: absVal.toFixed(2), isOverload: false, showNeg };
  };

  const { displayStr, showNeg } = formatLcdDisplay();

  // Ports: Authentic UT33D+ has 3 terminals: 10AMAX, COM, VΩmA
  const tenAPort = ports.find((p) => p.id === 'dmm:10a' || p.id.endsWith(':10a'));
  const comPort = ports.find((p) => p.id === 'dmm:com' || p.id.endsWith(':com'));
  const vOhmPort =
    ports.find((p) => p.id === 'dmm:v_ohm' || p.id.endsWith(':v_ohm')) ||
    ports.find((p) => p.id === 'dmm:ma' || p.id.endsWith(':ma'));

  return (
    <div className="relative select-none text-slate-900 font-sans w-[276px] h-[526px]">
      {/* Outer Contoured Red Rubber Holster */}
      <div className="bg-gradient-to-b from-[#e61d2b] via-[#d61725] to-[#b5101c] rounded-[36px] p-2.5 shadow-[0_22px_50px_rgba(0,0,0,0.65),inset_0_2px_4px_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.5)] border-2 border-[#940c15] relative h-full">
        
        {/* Ergonomic Holster Side Ribs & Grip Grooves */}
        <div className="absolute left-[-3px] top-28 bottom-28 w-1.5 flex flex-col justify-between py-2 pointer-events-none opacity-40">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-2 w-full bg-black/40 rounded-r-sm" />
          ))}
        </div>
        <div className="absolute right-[-3px] top-28 bottom-28 w-1.5 flex flex-col justify-between py-2 pointer-events-none opacity-40">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-2 w-full bg-black/40 rounded-l-sm" />
          ))}
        </div>

        {/* Inner Dark Matte Faceplate with Fixed Stable Height */}
        <div className="bg-[#1c1e22] rounded-[26px] p-3 border-2 border-[#2b2e35] shadow-[inset_0_2px_8px_rgba(0,0,0,0.85)] flex flex-col justify-between h-full relative overflow-hidden">
          
          {/* Top Header Strip with Brand and Drag Handle */}
          <div
            onPointerDown={onDragStart}
            style={{ touchAction: 'none' }}
            className="flex items-center justify-between pb-1.5 border-b border-[#2d3139] cursor-grab active:cursor-grabbing hover:bg-white/5 -mx-1 px-1 rounded-t-xl transition-colors h-[28px]"
            title="انقر واسحب الأوفوميتر لتحريكه (Drag to reposition Multimeter)"
          >
            {/* Left: UNI-T Bold Red Badge */}
            <div className="flex items-center space-x-2">
              <div className="bg-[#dc2626] text-white font-black text-[10px] px-1.5 py-0.5 rounded shadow-sm tracking-wider">
                UNI-T
              </div>
            </div>

            {/* Middle: NCV Sensor Lens Indicator */}
            <div className="flex items-center space-x-1">
              <div
                className={`w-2.5 h-2.5 rounded-full border border-red-950 transition-colors ${
                  state.mode === 'NCV' && state.power
                    ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                    : 'bg-red-950/60'
                }`}
              />
              <span className="text-[8px] font-mono font-bold text-neutral-400">
                NCV
              </span>
            </div>

            {/* Right: Model UT33D+ & Close X Button */}
            <div className="flex items-center space-x-1.5">
              <span className="text-white font-mono font-black text-[10.5px] tracking-wide">
                UT33D+
              </span>
              {onClose && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="w-4 h-4 rounded bg-[#2a2d34] relative before:absolute before:-inset-2.5 before:content-[''] hover:bg-rose-600 text-neutral-400 hover:text-white flex items-center justify-center transition-colors ml-1"
                  title="إخفاء الأوفوميتر"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Authentic Recessed LCD Display Window (Fixed Height to Prevent Layout Shift) */}
          <div
            className={`border-2 border-[#161719] rounded-lg p-2.5 shadow-[inset_0_3px_8px_rgba(0,0,0,0.85)] relative overflow-hidden transition-colors duration-200 h-[86px] flex flex-col justify-between ${
              state.backlight && state.power
                ? 'bg-gradient-to-b from-[#67e8f9]/70 via-[#38bdf8]/60 to-[#22d3ee]/70 shadow-[inset_0_0_12px_rgba(6,182,212,0.6)]'
                : 'bg-gradient-to-b from-[#cad3c0] to-[#b5bfab]'
            }`}
          >
            {/* LCD Top Indicators Row (Fixed 14px height ensures no collapse on empty unit) */}
            <div className="flex items-center justify-between text-[8px] font-mono font-bold text-[#141d17] leading-none h-[14px]">
              <span className={state.power ? 'opacity-90 font-extrabold' : 'opacity-10'}>
                APO
              </span>
              <span className={state.mode === 'NCV' && state.power ? 'opacity-90 font-extrabold' : 'opacity-10'}>
                NCV
              </span>
              <span className="opacity-90 font-bold text-[8.5px] min-w-[24px] text-right">
                {state.power && currentPos.id !== 'OFF' ? currentPos.unit : ''}
              </span>
            </div>

            {/* Main Digital Readout Line with Centered Vertical Alignment */}
            <div className="flex items-center justify-between h-[42px]">
              {/* Left Annunciators: DC / AC / HOLD */}
              <div className="flex flex-col justify-between h-full text-[8px] font-mono font-bold text-[#141d17] leading-tight py-0.5">
                <span className={state.hold && state.power ? 'opacity-100 font-black' : 'opacity-10'}>
                  HOLD
                </span>
                <span className={(currentPos.mode === 'DCV' || currentPos.mode === 'DCA') && state.power ? 'opacity-100 font-black' : 'opacity-10'}>
                  DC
                </span>
                <span className={currentPos.mode === 'ACV' && state.power ? 'opacity-100 font-black' : 'opacity-10'}>
                  AC
                </span>
              </div>

              {/* 7-Segment Value Readout */}
              <div className="flex items-center space-x-1">
                {showNeg && (
                  <span className="text-xl font-bold font-mono text-[#121815] -mr-1">
                    -
                  </span>
                )}
                <SevenSegmentDisplay
                  value={displayStr}
                  digits={4}
                  color="lcd"
                  size="lg"
                  className="!bg-transparent !border-0 !shadow-none !p-0"
                />
              </div>
            </div>

            {/* LCD Bottom Annunciators */}
            <div className="flex items-center justify-between text-[7px] text-[#2c362f] font-mono leading-none opacity-60">
              <span>CAT II 600V</span>
              <span>1999 MAX</span>
            </div>
          </div>

          {/* Middle Buttons: HOLD/SELECT & Backlight */}
          <div className="flex items-center justify-between px-1 h-[32px]">
            {/* HOLD / SELECT (Orange/Yellow Tactile Pill Button) */}
            <div className="flex items-center space-x-2">
              <span className="text-[7.5px] font-mono font-bold text-neutral-300 tracking-wider">
                HOLD
              </span>
              <button
                type="button"
                onClick={handleHoldClick}
                className={`w-14 h-5 rounded-md shadow-md border flex items-center justify-center transition-all active:scale-95 ${
                  state.hold
                    ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-[0_0_8px_rgba(251,191,36,0.6)] font-black'
                    : 'bg-gradient-to-b from-[#f59e0b] to-[#d97706] border-[#b45309] text-slate-950 font-bold hover:brightness-105'
                }`}
                title="تثبيت القراءة على الشاشة (Data Hold)"
              >
                <div className="w-8 h-2 bg-amber-300/40 rounded-full" />
              </button>
            </div>

            {/* Backlight Button (Sky Blue Tactile Pill Button) */}
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleBacklightClick}
                className={`w-12 h-5 rounded-md shadow-md border flex items-center justify-center transition-all active:scale-95 ${
                  state.backlight
                    ? 'bg-cyan-400 border-cyan-300 text-slate-950 shadow-[0_0_8px_rgba(34,211,238,0.7)]'
                    : 'bg-gradient-to-b from-[#38bdf8] to-[#0284c7] border-[#0369a1] text-white hover:brightness-105'
                }`}
                title="إضاءة الشاشة الخلفية (LCD Backlight)"
              >
                <Sun className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>

          {/* Central Rotary Range Switch Area with Shortest Path Rotation & Reliable Snapping */}
          <div
            onClick={handleDialAreaClick}
            className="relative w-[214px] h-[214px] mx-auto flex items-center justify-center cursor-pointer"
            title="انقر على أي نطاق لتدوير المفتاح إليه (Click any range to rotate)"
          >
            {/* Outer Circular Scale Ring with Position Labels & Detent Ticks */}
            {UT33D_POSITIONS.map((pos) => {
              const rad = ((pos.angle - 90) * Math.PI) / 180;
              const r = 88; // distance from dial center to text
              const x = 107 + r * Math.cos(rad);
              const y = 107 + r * Math.sin(rad);
              const isSelected = state.rangeId === pos.id;

              // Detent tick mark coordinates (between knob rim r=58 and label r=88)
              const rTick = 68;
              const xTick = 107 + rTick * Math.cos(rad);
              const yTick = 107 + rTick * Math.sin(rad);

              return (
                <React.Fragment key={pos.id}>
                  {/* Detent Indicator Dot/Bar */}
                  {pos.id === 'OFF' ? (
                    <>
                      <div
                        style={{
                          left: `${107 - 14}px`,
                          top: `${107 - 78}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className="absolute w-[1.5px] h-2.5 bg-neutral-300 pointer-events-none"
                      />
                      <div
                        style={{
                          left: `${107 + 14}px`,
                          top: `${107 - 78}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className="absolute w-[1.5px] h-2.5 bg-neutral-300 pointer-events-none"
                      />
                    </>
                  ) : (
                    <div
                      style={{
                        left: `${xTick}px`,
                        top: `${yTick}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className={`absolute w-1.5 h-1.5 rounded-full pointer-events-none transition-colors ${
                        isSelected ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-neutral-500/80'
                      }`}
                    />
                  )}

                  {/* Range Label Button with Isolated Position Transform Container */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className="z-20 flex items-center justify-center pointer-events-auto"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPosition(pos);
                      }}
                      className={`min-w-[24px] min-h-[18px] px-1 py-0.5 text-[8px] font-mono font-bold tracking-tight rounded cursor-pointer transition-colors flex items-center justify-center ${
                        isSelected
                          ? 'text-cyan-300 font-black drop-shadow-[0_0_6px_rgba(6,182,212,0.9)] bg-cyan-950/50 border border-cyan-400/50'
                          : 'text-neutral-300 hover:text-white hover:bg-white/10'
                      }`}
                      title={`Range: ${pos.label} (${pos.mode})`}
                    >
                      {pos.label}
                    </button>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Silk-screen Group Labels & Curved Arcs */}
            {/* V⎓ Label */}
            <div className="absolute right-2 top-16 text-[9px] font-bold text-white font-mono pointer-events-none drop-shadow-sm">
              V⎓
            </div>
            {/* V~ Label */}
            <div className="absolute right-5 bottom-14 text-[9px] font-bold text-white font-mono pointer-events-none drop-shadow-sm">
              V~
            </div>
            {/* A⎓ Label */}
            <div className="absolute bottom-2 left-12 text-[9px] font-bold text-white font-mono pointer-events-none drop-shadow-sm">
              A⎓
            </div>
            {/* Ω Label */}
            <div className="absolute left-3 top-20 text-[11px] font-bold text-white font-mono pointer-events-none drop-shadow-sm">
              Ω
            </div>
            {/* CE Symbol */}
            <div className="absolute right-7 bottom-6 text-[8px] font-bold text-neutral-400 font-mono pointer-events-none">
              CE
            </div>

            {/* Central Rotating Heavy Industrial Dial with Continuous Shortest Path Rotation */}
            <div
              style={{
                transform: `rotate(${dialRotation}deg)`,
              }}
              className="w-[116px] h-[116px] rounded-full bg-gradient-to-b from-[#2a2d34] via-[#1a1b1f] to-[#111215] border-4 border-[#3a3e47] shadow-[0_6px_16px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.2)] flex items-center justify-center relative cursor-grab active:cursor-grabbing transition-transform duration-150 ease-out z-10 pointer-events-none"
            >
              {/* Fluted Rim Ribs */}
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  style={{ transform: `rotate(${i * 15}deg)` }}
                  className="absolute w-full h-[1px] pointer-events-none opacity-20"
                >
                  <div className="w-1.5 h-full bg-white ml-auto" />
                </div>
              ))}

              {/* Elongated Center Pointer Bar with Gripping Channel */}
              <div className="w-7 h-[106px] bg-gradient-to-r from-[#2c2f36] via-[#3b404a] to-[#252830] rounded-md shadow-md border border-[#484e5a] flex flex-col items-center justify-between p-1 relative">
                {/* Pointing Arrow Tip at the Top */}
                <div className="w-0 h-0 border-x-4 border-x-transparent border-b-6 border-b-white filter drop-shadow-sm -mt-0.5" />
                
                {/* Center Finger Gripping Groove */}
                <div className="w-3.5 h-12 bg-[#17181c] rounded border border-neutral-700/80 shadow-inner flex flex-col justify-around py-1.5">
                  <div className="w-2 h-0.5 bg-neutral-600 mx-auto rounded" />
                  <div className="w-2 h-0.5 bg-neutral-600 mx-auto rounded" />
                  <div className="w-2 h-0.5 bg-neutral-600 mx-auto rounded" />
                </div>

                {/* Bottom Tail */}
                <div className="w-2 h-1.5 bg-neutral-600/50 rounded-sm mb-0.5" />
              </div>
            </div>
          </div>

          {/* Bottom Safety Terminals Section (Clean Authentic Layout without Duplicate Labels) */}
          <div className="bg-[#121417] rounded-xl p-2.5 pb-2.5 border border-[#2b2e35] shadow-inner mt-1 min-h-[96px] flex flex-col justify-between">
            <div className="grid grid-cols-3 gap-1.5 text-center items-center">
              
              {/* Left Terminal: 10AMAX */}
              <div className="flex flex-col items-center justify-between">
                <div className="h-6 flex flex-col items-center justify-end mb-1">
                  <span className="text-[8.5px] font-bold text-white font-mono leading-none tracking-tight">
                    10AMAX
                  </span>
                </div>

                {tenAPort && (
                  <div className="p-0.5 bg-[#08090b] rounded-full border border-neutral-700 shadow-inner flex items-center justify-center">
                    <PortJack
                      port={tenAPort}
                      connectedCount={connectedPortIds.has(tenAPort.id) ? 1 : 0}
                      isSelectedForWiring={wiringSourcePort?.id === tenAPort.id}
                      onPortClick={onPortClick}
                      hideLabel={true}
                    />
                  </div>
                )}

                <div className="h-6 flex flex-col items-center justify-start mt-1 leading-tight">
                  <span className="text-[6.5px] font-mono text-amber-400 font-bold leading-none">
                    ▲ FUSED
                  </span>
                  <span className="text-[5.5px] font-mono text-neutral-400 leading-tight mt-0.5">
                    10 sec Max
                  </span>
                </div>
              </div>

              {/* Center Terminal: COM (Common Negative) */}
              <div className="flex flex-col items-center justify-between">
                <div className="h-6 flex flex-col items-center justify-end mb-1">
                  <span className="text-[10px] font-black text-amber-500 font-mono leading-none tracking-wider">
                    COM
                  </span>
                </div>

                {comPort && (
                  <div className="p-0.5 bg-[#08090b] rounded-full border border-amber-600/40 shadow-inner flex items-center justify-center">
                    <PortJack
                      port={comPort}
                      connectedCount={connectedPortIds.has(comPort.id) ? 1 : 0}
                      isSelectedForWiring={wiringSourcePort?.id === comPort.id}
                      onPortClick={onPortClick}
                      hideLabel={true}
                    />
                  </div>
                )}

                <div className="h-6 flex flex-col items-center justify-start mt-1 leading-tight">
                  <span className="text-[6.5px] font-mono text-amber-400 font-bold leading-none">
                    ▲ CAT II
                  </span>
                  <span className="text-[5.5px] font-mono text-neutral-400 leading-tight mt-0.5">
                    600V Max
                  </span>
                </div>
              </div>

              {/* Right Terminal: VΩmA (Voltage, Resistance, mA Current) */}
              <div className="flex flex-col items-center justify-between">
                <div className="h-6 flex flex-col items-center justify-end mb-1 leading-tight">
                  <span className="text-[7.5px] font-bold text-white font-mono leading-none">
                    •))) ▷|
                  </span>
                  <span className="text-[8.5px] font-bold text-white font-mono leading-none mt-0.5 tracking-tight">
                    VΩmA
                  </span>
                </div>

                {vOhmPort && (
                  <div className="p-0.5 bg-[#08090b] rounded-full border border-rose-600/40 shadow-inner flex items-center justify-center">
                    <PortJack
                      port={vOhmPort}
                      connectedCount={connectedPortIds.has(vOhmPort.id) ? 1 : 0}
                      isSelectedForWiring={wiringSourcePort?.id === vOhmPort.id}
                      onPortClick={onPortClick}
                      hideLabel={true}
                    />
                  </div>
                )}

                <div className="h-6 flex flex-col items-center justify-start mt-1 leading-tight">
                  <span className="text-[6.5px] font-mono text-amber-400 font-bold leading-none">
                    ▲ FUSED
                  </span>
                  <span className="text-[5.5px] font-mono text-neutral-400 leading-tight mt-0.5">
                    200mA MAX
                  </span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
