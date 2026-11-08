import React from 'react';

interface SevenSegmentDisplayProps {
  value: string; // e.g. " 1.000", "12.00", "-0.35", "  OFF "
  digits?: number;
  color?: 'red' | 'cyan' | 'green' | 'lcd';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// 7-segment mapping (a, b, c, d, e, f, g)
const SEGMENTS: Record<string, number[]> = {
  '0': [1, 1, 1, 1, 1, 1, 0],
  '1': [0, 1, 1, 0, 0, 0, 0],
  '2': [1, 1, 0, 1, 1, 0, 1],
  '3': [1, 1, 1, 1, 0, 0, 1],
  '4': [0, 1, 1, 0, 0, 1, 1],
  '5': [1, 0, 1, 1, 0, 1, 1],
  '6': [1, 0, 1, 1, 1, 1, 1],
  '7': [1, 1, 1, 0, 0, 0, 0],
  '8': [1, 1, 1, 1, 1, 1, 1],
  '9': [1, 1, 1, 1, 0, 1, 1],
  '-': [0, 0, 0, 0, 0, 0, 1],
  'O': [1, 1, 1, 1, 1, 1, 0],
  'F': [1, 0, 0, 0, 1, 1, 1],
  'C': [1, 0, 0, 1, 1, 1, 0],
  'E': [1, 0, 0, 1, 1, 1, 1],
  'L': [0, 0, 0, 1, 1, 1, 0],
  ' ': [0, 0, 0, 0, 0, 0, 0],
};

export const SevenSegmentDigit: React.FC<{
  char: string;
  hasDot: boolean;
  color: 'red' | 'cyan' | 'green' | 'lcd';
  width: number;
  height: number;
}> = ({ char, hasDot, color, width, height }) => {
  const segs = SEGMENTS[char.toUpperCase()] || [0, 0, 0, 0, 0, 0, 0];

  const colorStyles = {
    red: {
      on: '#ef4444',
      off: '#3b0d0d',
      glow: 'drop-shadow(0 0 4px rgba(239,68,68,0.8))',
      dotOn: '#ef4444',
      dotOff: '#3b0d0d',
    },
    cyan: {
      on: '#06b6d4',
      off: '#082f49',
      glow: 'drop-shadow(0 0 5px rgba(6,182,212,0.9))',
      dotOn: '#06b6d4',
      dotOff: '#082f49',
    },
    green: {
      on: '#22c55e',
      off: '#052e16',
      glow: 'drop-shadow(0 0 5px rgba(34,197,94,0.9))',
      dotOn: '#22c55e',
      dotOff: '#052e16',
    },
    lcd: {
      on: '#1e293b',
      off: '#94a3b833',
      glow: 'none',
      dotOn: '#1e293b',
      dotOff: '#94a3b833',
    },
  }[color];

  // SVG coordinate box 24 x 40
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 28 44"
      className="inline-block overflow-visible select-none"
    >
      <g style={{ filter: colorStyles.glow }}>
        {/* Segment a (top) */}
        <polygon
          points="6,4 20,4 17,7 9,7"
          fill={segs[0] ? colorStyles.on : colorStyles.off}
        />
        {/* Segment b (top right) */}
        <polygon
          points="21,5 21,19 18,17 18,8"
          fill={segs[1] ? colorStyles.on : colorStyles.off}
        />
        {/* Segment c (bottom right) */}
        <polygon
          points="21,22 21,36 18,33 18,24"
          fill={segs[2] ? colorStyles.on : colorStyles.off}
        />
        {/* Segment d (bottom) */}
        <polygon
          points="6,37 20,37 17,34 9,34"
          fill={segs[3] ? colorStyles.on : colorStyles.off}
        />
        {/* Segment e (bottom left) */}
        <polygon
          points="5,22 8,24 8,33 5,36"
          fill={segs[4] ? colorStyles.on : colorStyles.off}
        />
        {/* Segment f (top left) */}
        <polygon
          points="5,5 8,8 8,17 5,19"
          fill={segs[5] ? colorStyles.on : colorStyles.off}
        />
        {/* Segment g (middle) */}
        <polygon
          points="7,20 19,20 17,22 9,22"
          fill={segs[6] ? colorStyles.on : colorStyles.off}
        />
        {/* Decimal Point */}
        <circle
          cx="24"
          cy="36"
          r="2"
          fill={hasDot ? colorStyles.dotOn : colorStyles.dotOff}
        />
      </g>
    </svg>
  );
};

export const SevenSegmentDisplay: React.FC<SevenSegmentDisplayProps> = ({
  value,
  digits = 6,
  color = 'cyan',
  size = 'md',
  className = '',
}) => {
  const dimensions = {
    sm: { width: 14, height: 22 },
    md: { width: 20, height: 32 },
    lg: { width: 28, height: 44 },
    xl: { width: 36, height: 56 },
  }[size];

  // Parse string with possible decimal points
  const parsedDigits: { char: string; hasDot: boolean }[] = [];
  let i = 0;
  while (i < value.length) {
    const char = value[i];
    if (char === '.') {
      if (parsedDigits.length > 0) {
        parsedDigits[parsedDigits.length - 1].hasDot = true;
      }
      i++;
      continue;
    }
    const nextIsDot = i + 1 < value.length && value[i + 1] === '.';
    parsedDigits.push({ char, hasDot: nextIsDot });
    if (nextIsDot) {
      i += 2;
    } else {
      i++;
    }
  }

  // Pad or slice to digits count
  while (parsedDigits.length < digits) {
    parsedDigits.unshift({ char: ' ', hasDot: false });
  }
  const displayDigits = parsedDigits.slice(-digits);

  const bgStyle =
    color === 'lcd'
      ? 'bg-[#b6c7a3] border border-[#8a9e75] shadow-inner text-slate-800'
      : 'bg-[#0a0a0f] border border-neutral-800 shadow-[inset_0_2px_8px_rgba(0,0,0,0.9)]';

  return (
    <div
      className={`inline-flex items-center px-2 py-1 rounded font-mono ${bgStyle} ${className}`}
    >
      {displayDigits.map((d, idx) => (
        <SevenSegmentDigit
          key={idx}
          char={d.char}
          hasDot={d.hasDot}
          color={color}
          width={dimensions.width}
          height={dimensions.height}
        />
      ))}
    </div>
  );
};
