import React, { useRef, useState, useCallback, useEffect } from 'react';
import { labAudio } from '../utils/audio';

interface KnobProps {
  label: string;
  sublabel?: string;
  value: number; // current value
  min?: number;
  max?: number;
  step?: number;
  steps?: number[]; // discrete step values (e.g. [1, 2, 5, 10...])
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'silver' | 'dark' | 'cream' | 'blue' | 'yellow' | 'atten';
  formatValue?: (val: number) => string;
  onChange: (newVal: number) => void;
  onPress?: () => void;
  className?: string;
  /** Hide the printed label (used when the panel has its own legend). */
  hideLabel?: boolean;
}

export const Knob: React.FC<KnobProps> = ({
  label,
  sublabel,
  value,
  min = 0,
  max = 100,
  step = 1,
  steps,
  size = 'md',
  color = 'silver',
  formatValue,
  onChange,
  onPress,
  className = '',
  hideLabel = false,
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startValRef = useRef(value);

  // Compute angle (typically from -135deg to +135deg = 270 deg total travel)
  let angle = 0;
  if (steps && steps.length > 1) {
    const idx = steps.indexOf(value);
    const activeIdx = idx >= 0 ? idx : 0;
    angle = -135 + (270 / (steps.length - 1)) * activeIdx;
  } else {
    const clamped = Math.max(min, Math.min(max, value));
    const pct = (clamped - min) / (max - min || 1);
    angle = -135 + 270 * pct;
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY; // upward drag increases
    const sensitivity = 0.005;

    if (steps && steps.length > 1) {
      const stepIdxDelta = Math.round(deltaY / 15);
      const curIdx = steps.indexOf(startValRef.current);
      const targetIdx = Math.max(0, Math.min(steps.length - 1, (curIdx >= 0 ? curIdx : 0) + stepIdxDelta));
      const nextVal = steps[targetIdx];
      if (nextVal !== value) {
        labAudio.playKnobClick();
        onChange(nextVal);
      }
    } else {
      const range = max - min;
      const rawVal = startValRef.current + deltaY * (range * sensitivity);
      const stepped = Math.round(rawVal / step) * step;
      const clamped = Math.max(min, Math.min(max, stepped));
      if (clamped !== value) {
        labAudio.playKnobClick();
        onChange(clamped);
      }
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

  // React registers onWheel as passive; use a native non-passive listener so
  // the page does not scroll while adjusting a knob (and no console errors).
  useEffect(() => {
    const el = knobRef.current;
    if (!el) return;
    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      if (steps && steps.length > 1) {
        const idx = steps.indexOf(value);
        const targetIdx = Math.max(0, Math.min(steps.length - 1, (idx >= 0 ? idx : 0) + dir));
        const nextVal = steps[targetIdx];
        if (nextVal !== value) {
          labAudio.playKnobClick();
          onChange(nextVal);
        }
      } else {
        const nextVal = Math.max(min, Math.min(max, value + dir * step));
        if (nextVal !== value) {
          labAudio.playKnobClick();
          onChange(nextVal);
        }
      }
    };
    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelNative);
  }, [value, steps, min, max, step, onChange]);

  const dimensions = {
    sm: { size: 30, pointerLen: 10, font: 'text-[9px]' },
    md: { size: 40, pointerLen: 14, font: 'text-[10px]' },
    lg: { size: 52, pointerLen: 18, font: 'text-[11px]' },
    xl: { size: 68, pointerLen: 24, font: 'text-xs' },
  }[size];

  const colorStyles = {
    silver: {
      rim: 'border-[#94a3b8] bg-gradient-to-b from-[#f1f5f9] via-[#cbd5e1] to-[#64748b]',
      face: 'bg-gradient-to-b from-[#e2e8f0] to-[#94a3b8] shadow-inner',
      line: 'bg-cyan-600',
    },
    dark: {
      rim: 'border-[#475569] bg-gradient-to-b from-[#334155] via-[#1e293b] to-[#0f172a]',
      face: 'bg-gradient-to-b from-[#1e293b] to-[#0f172a] shadow-inner',
      line: 'bg-white',
    },
    cream: {
      rim: 'border-[#d6d3d1] bg-gradient-to-b from-[#f5f5f4] via-[#e7e5e4] to-[#a8a29e]',
      face: 'bg-gradient-to-b from-[#fafaf9] to-[#d6d3d1] shadow-inner',
      line: 'bg-red-600',
    },
    blue: {
      rim: 'border-[#38bdf8] bg-gradient-to-b from-[#0284c7] via-[#0369a1] to-[#075985]',
      face: 'bg-gradient-to-b from-[#0369a1] to-[#0c4a6e] shadow-inner',
      line: 'bg-white',
    },
    yellow: {
      rim: 'border-[#facc15] bg-gradient-to-b from-[#eab308] via-[#ca8a04] to-[#a16207]',
      face: 'bg-gradient-to-b from-[#ca8a04] to-[#713f12] shadow-inner',
      line: 'bg-white',
    },
    // ATTEN APS3005S: industrial fluted potentiometer knob with crisp pointer.
    atten: {
      rim: 'border-[#1b1f28] bg-gradient-to-b from-[#474f5e] via-[#2d3340] to-[#191c24] shadow-[0_3px_6px_rgba(0,0,0,0.6)]',
      face: 'bg-gradient-to-b from-[#38404e] via-[#282d38] to-[#1c2028] shadow-[inset_0_1px_2px_rgba(255,255,255,0.2),inset_0_-2px_4px_rgba(0,0,0,0.6)]',
      line: 'bg-[#ff5722] shadow-[0_0_4px_rgba(255,87,34,0.8)]',
    },
  }[color];

  return (
    <div
      className={`flex flex-col items-center select-none ${className}`}
      title={`${label}: ${formatValue ? formatValue(value) : value}`}
    >
      {/* Knob Dial Container */}
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={onPress}
        style={{
          width: dimensions.size,
          height: dimensions.size,
          touchAction: 'none',
        }}
        className={`relative rounded-full cursor-ns-resize shadow-md flex items-center justify-center p-[2.5px] border ${colorStyles.rim} hover:brightness-110 active:scale-[0.98] transition-transform`}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        tabIndex={0}
      >
        {/* Rotating Face */}
        <div
          style={{ transform: `rotate(${angle}deg)` }}
          className={`w-full h-full rounded-full flex items-center justify-center relative transition-transform duration-75 ${colorStyles.face}`}
        >
          {/* Fluted grip + smooth centre cap (ATTEN knobs) */}
          {color === 'atten' && (
            <>
              {/* Outer fluting notches */}
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  style={{ transform: `rotate(${i * 22.5}deg)` }}
                  className="absolute w-full h-[1px] pointer-events-none opacity-25"
                >
                  <div className="w-[3px] h-full bg-white ml-auto" />
                </div>
              ))}
              <span className="absolute inset-[6px] rounded-full bg-gradient-to-b from-[#3e4655] to-[#1f232c] border border-white/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.6)]" />
            </>
          )}
          {/* Pointer indicator line */}
          <div
            style={{ height: dimensions.pointerLen }}
            className={`w-[2.5px] rounded-full absolute top-[3px] z-10 ${colorStyles.line}`}
          />
        </div>
      </div>

      {/* Label */}
      {!hideLabel && (
        <span className={`font-semibold tracking-tight text-slate-700 leading-tight mt-1 text-center ${dimensions.font}`}>
          {label}
        </span>
      )}
      {!hideLabel && sublabel && (
        <span className="text-[8px] text-slate-500 uppercase tracking-tighter -mt-0.5">
          {sublabel}
        </span>
      )}
    </div>
  );
};
