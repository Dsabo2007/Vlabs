import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Port } from '../types/lab';
import { labAudio } from '../utils/audio';

export interface MeasurementsBoardProps {
  instanceId: string;
  ports: Port[];
  connectedPortIds: Set<string>;
  portConnectionCounts?: Map<string, number>;
  wiringSourcePort: Port | null;
  onPortClick: (port: Port) => void;
  onClose: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  meterDeflection?: number; // In µA (-40 to +40, centre zero)
  pot5k?: number;   // 0 to 100%
  pot100k?: number; // 0 to 100%
  pot1M?: number;   // 0 to 100%
  onPotChange?: (potKey: 'pot5k' | 'pot100k' | 'pot1M', value: number) => void;
}

/* ============================================================================
   INSTRUMENTS AND MEASUREMENTS EXPERIMENTS TRAINING BOARD
   Re-built to match the physical lab board (Electrical & Electronic Technical
   College — Computer Engineering Techniques) item for item:

     left   : 14 capacitors (4 polarised, black "+" socket) + 8 inductors
     centre : 4 diodes, µA meter, 2 four-way junction blocks, 2 bridge
              rectifiers, 2 variable (trimmer) capacitors, 3 potentiometers
     right  : 18 resistors

   Everything lives on one flat white laminate plate and is positioned in a
   fixed 1200 x 735 coordinate space, so every socket is exactly where it is on
   the real board.
   ============================================================================ */

const PLATE_W = 1200;
const PLATE_H = 735;
const INK = '#1e4bb8'; // screen-printed blue
const SERIF = "'Century Schoolbook','New Century Schoolbook','Times New Roman',Georgia,serif";
const SOCKET = 30;

type PotKey = 'pot5k' | 'pot100k' | 'pot1M';

// ---------------------------------------------------------------------------
// Layout tables (plate coordinates, px)
// ---------------------------------------------------------------------------
const COL_A = [46, 142];
const COL_B = [190, 286];
const RCOL_1 = [930, 1022];
const RCOL_2 = [1062, 1154];

type TwoTerm = {
  id: string; // port prefix: `${id}:a` / `${id}:b` (or :pos / :neg)
  label: string;
  kind: 'cap' | 'ecap' | 'ind' | 'res';
  polar?: boolean; // uses :pos/:neg and a black "+" socket
  blackLeft?: boolean; // black (+) socket on the left, ports still :a/:b
};

const CAP_ROWS: Array<{ y: number; a: TwoTerm; b: TwoTerm }> = [
  { y: 128, a: { id: 'C_001u_1', label: '0.001uF', kind: 'cap' }, b: { id: 'C_005u_1', label: '0.005uF', kind: 'cap' } },
  { y: 168, a: { id: 'C_001u_2', label: '0.001uF', kind: 'cap' }, b: { id: 'C_005u_2', label: '0.005uF', kind: 'cap' } },
  { y: 208, a: { id: 'C_01u_1', label: '0.01uF', kind: 'cap' }, b: { id: 'C_02u', label: '0.2uF', kind: 'cap' } },
  { y: 248, a: { id: 'C_01u_2', label: '0.01uF', kind: 'cap' }, b: { id: 'C_1u', label: '1uF', kind: 'ecap', blackLeft: true } },
  { y: 288, a: { id: 'C_01u_3', label: '0.01uF', kind: 'cap' }, b: { id: 'C_47u', label: '47uF', kind: 'ecap', polar: true } },
  { y: 345, a: { id: 'C_1u_1', label: '0.1uF', kind: 'cap' }, b: { id: 'C_470u', label: '470uF', kind: 'ecap', polar: true } },
  { y: 385, a: { id: 'C_1u_2', label: '0.1uF', kind: 'cap' }, b: { id: 'C_1000u', label: '1000uF', kind: 'ecap', polar: true } },
];

const IND_ROWS: Array<{ y: number; a: TwoTerm; b: TwoTerm }> = [
  { y: 440, a: { id: 'L_5mH_1', label: '5mH', kind: 'ind' }, b: { id: 'L_5mH_2', label: '5mH', kind: 'ind' } },
  { y: 487, a: { id: 'L_10mH_1', label: '10mH', kind: 'ind' }, b: { id: 'L_10mH_2', label: '10mH', kind: 'ind' } },
  { y: 534, a: { id: 'L_20mH_1', label: '20mH', kind: 'ind' }, b: { id: 'L_20mH_2', label: '20mH', kind: 'ind' } },
  { y: 581, a: { id: 'L_100mH_1', label: '100mH', kind: 'ind' }, b: { id: 'L_100mH_2', label: '100mH', kind: 'ind' } },
];

const RES_ROWS: Array<{ y: number; a: TwoTerm; b: TwoTerm }> = [
  { y: 96, a: { id: 'R_5k_1', label: '5K Ω', kind: 'res' }, b: { id: 'R_50', label: '50 Ω', kind: 'res' } },
  { y: 154, a: { id: 'R_10k_1', label: '10K Ω', kind: 'res' }, b: { id: 'R_100', label: '100 Ω', kind: 'res' } },
  { y: 212, a: { id: 'R_10k_2', label: '10K Ω', kind: 'res' }, b: { id: 'R_220', label: '220 Ω', kind: 'res' } },
  { y: 270, a: { id: 'R_50k', label: '50K Ω', kind: 'res' }, b: { id: 'R_470', label: '470 Ω', kind: 'res' } },
  { y: 328, a: { id: 'R_100k', label: '100K Ω', kind: 'res' }, b: { id: 'R_560', label: '560 Ω', kind: 'res' } },
  { y: 386, a: { id: 'R_200k_1', label: '200K Ω', kind: 'res' }, b: { id: 'R_1k_1', label: '1K Ω', kind: 'res' } },
  { y: 444, a: { id: 'R_200k_2', label: '200K Ω', kind: 'res' }, b: { id: 'R_1k_2', label: '1K Ω', kind: 'res' } },
  { y: 502, a: { id: 'R_500k', label: '500K Ω', kind: 'res' }, b: { id: 'R_2k2', label: '2.2K Ω', kind: 'res' } },
  { y: 560, a: { id: 'R_1M', label: '1M Ω', kind: 'res' }, b: { id: 'R_5k_2', label: '5K Ω', kind: 'res' } },
];

// Four vertical diodes along the top of the centre section
const DIODES = [
  { id: 'D_M1', x: 351, style: 'zener' as const },
  { id: 'D_M2', x: 430, style: 'zener' as const },
  { id: 'D_M3', x: 676, style: 'plain' as const },
  { id: 'D_M4', x: 761, style: 'plain' as const },
];
const DIODE_TOP = 57;
const DIODE_BOT = 131;

// Four-way junction blocks
const JUNCTIONS = [
  { id: 'X1', cx: 380, cy: 200 },
  { id: 'X2', cx: 752, cy: 200 },
];
const JUNCTION_ARM_V = 33;
const JUNCTION_ARM_H = 36;

// Bridge rectifiers
const BRIDGES = [
  { id: 'BR1', cx: 380, cy: 306 },
  { id: 'BR2', cx: 758, cy: 306 },
];
const BRIDGE_ARM = 36;

// µA meter geometry
const METER = { x: 448, y: 124, w: 215, h: 158 };
const UA_SOCKETS = { y: 328, neg: 512, pos: 598 };

// Variable (trimmer) capacitors
const TRIMMERS = [
  { id: 'VC1', cx: 397, cy: 406 },
  { id: 'VC2', cx: 676, cy: 406 },
];
const TRIMMER_SPAN = 52;

// Potentiometers
const POTS: Array<{
  key: PotKey;
  portPrefix: string;
  cx: number;
  topY: number;
  knobY: number;
  botY: number;
  style: 'red' | 'silver';
  caption: string;
}> = [
  { key: 'pot5k', portPrefix: 'POT_5k', cx: 388, topY: 466, knobY: 531, botY: 574, style: 'red', caption: '5K Ω' },
  { key: 'pot100k', portPrefix: 'POT_100k', cx: 680, topY: 469, knobY: 540, botY: 574, style: 'silver', caption: '100K Ω' },
  { key: 'pot1M', portPrefix: 'POT_1M', cx: 830, topY: 470, knobY: 536, botY: 576, style: 'red', caption: '1M Ω' },
];
const POT_HALF_SPAN = 56;

// ---------------------------------------------------------------------------
// SVG symbol helpers (screen-printed artwork)
// ---------------------------------------------------------------------------
const stroke = { stroke: INK, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Label: React.FC<{ x: number; y: number; children: React.ReactNode; size?: number; anchor?: 'start' | 'middle' | 'end' }> = ({
  x,
  y,
  children,
  size = 12.5,
  anchor = 'middle',
}) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={700} fill={INK} fontFamily={SERIF}>
    {children}
  </text>
);

const Arrowhead: React.FC<{ x: number; y: number; angleDeg: number; size?: number }> = ({ x, y, angleDeg, size = 6 }) => (
  <polygon
    points={`0,0 ${-size},${-size * 0.45} ${-size},${size * 0.45}`}
    fill={INK}
    transform={`translate(${x} ${y}) rotate(${angleDeg})`}
  />
);

/** Horizontal two-terminal symbol between two sockets on the same row. */
const TwoTerminalArt: React.FC<{ xl: number; xr: number; y: number; t: TwoTerm }> = ({ xl, xr, y, t }) => {
  const cx = (xl + xr) / 2;
  const lead = (a: number, b: number) => <line x1={a} y1={y} x2={b} y2={y} {...stroke} />;
  let symbol: React.ReactNode = null;
  if (t.kind === 'res') {
    symbol = (
      <>
        {lead(xl + 12, cx - 22)}
        <path d={`M ${cx - 22} ${y} L ${cx - 16} ${y} L ${cx - 12} ${y - 6.5} L ${cx - 6} ${y + 6.5} L ${cx} ${y - 6.5} L ${cx + 6} ${y + 6.5} L ${cx + 12} ${y - 6.5} L ${cx + 16} ${y} L ${cx + 22} ${y}`} {...stroke} />
        {lead(cx + 22, xr - 12)}
      </>
    );
  } else if (t.kind === 'ind') {
    const x0 = cx - 24;
    symbol = (
      <>
        {lead(xl + 12, x0)}
        <path d={`M ${x0} ${y} a 6 6.5 0 0 1 12 0 a 6 6.5 0 0 1 12 0 a 6 6.5 0 0 1 12 0 a 6 6.5 0 0 1 12 0`} {...stroke} />
        {lead(x0 + 48, xr - 12)}
      </>
    );
  } else {
    const curved = t.kind === 'ecap';
    symbol = (
      <>
        {lead(xl + 12, cx - 4)}
        <line x1={cx - 4} y1={y - 10} x2={cx - 4} y2={y + 10} {...stroke} strokeWidth={2.6} />
        {curved ? (
          <path d={`M ${cx + 6} ${y - 10} Q ${cx + 1} ${y} ${cx + 6} ${y + 10}`} {...stroke} strokeWidth={2.6} />
        ) : (
          <line x1={cx + 4} y1={y - 10} x2={cx + 4} y2={y + 10} {...stroke} strokeWidth={2.6} />
        )}
        {lead(cx + 4, xr - 12)}
      </>
    );
  }
  return (
    <g>
      {symbol}
      <Label x={cx} y={y - 14}>
        {t.label}
      </Label>
    </g>
  );
};

/** Vertical diode between an anode socket (top) and a cathode socket (bottom). */
const DiodeArt: React.FC<{ x: number; style: 'zener' | 'plain' | 'arrow' }> = ({ x, style }) => {
  const mid = (DIODE_TOP + DIODE_BOT) / 2;
  const tip = mid + 7;
  const base = mid - 8;
  return (
    <g>
      <line x1={x} y1={DIODE_TOP + 13} x2={x} y2={base} {...stroke} />
      {style === 'arrow' ? (
        <>
          <path d={`M ${x - 10} ${base} L ${x} ${tip} L ${x + 10} ${base}`} {...stroke} />
          <Arrowhead x={x} y={DIODE_TOP + 26} angleDeg={90} size={5.5} />
        </>
      ) : (
        <polygon points={`${x - 10},${base} ${x + 10},${base} ${x},${tip}`} {...stroke}  />
      )}
      {style === 'zener' ? (
        <path d={`M ${x - 14} ${tip - 4} L ${x - 10} ${tip} L ${x + 10} ${tip} L ${x + 14} ${tip + 4}`} {...stroke} />
      ) : (
        <line x1={x - 11} y1={tip} x2={x + 11} y2={tip} {...stroke} strokeWidth={2.6} />
      )}
      <line x1={x} y1={tip} x2={x} y2={DIODE_BOT - 13} {...stroke} />
    </g>
  );
};

/** Tiny diode symbol laid along a diamond edge (current runs p0 -> p1). */
const EdgeDiode: React.FC<{ p0: [number, number]; p1: [number, number] }> = ({ p0, p1 }) => {
  const mx = (p0[0] + p1[0]) / 2;
  const my = (p0[1] + p1[1]) / 2;
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const tip: [number, number] = [mx + ux * 3.2, my + uy * 3.2];
  const b1: [number, number] = [mx - ux * 3.2 + nx * 3.6, my - uy * 3.2 + ny * 3.6];
  const b2: [number, number] = [mx - ux * 3.2 - nx * 3.6, my - uy * 3.2 - ny * 3.6];
  const bar1: [number, number] = [tip[0] + nx * 3.8, tip[1] + ny * 3.8];
  const bar2: [number, number] = [tip[0] - nx * 3.8, tip[1] - ny * 3.8];
  return (
    <g>
      <polygon points={`${tip.join(',')} ${b1.join(',')} ${b2.join(',')}`} fill={INK} stroke={INK} strokeWidth={0.8} />
      <line x1={bar1[0]} y1={bar1[1]} x2={bar2[0]} y2={bar2[1]} stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
};

const BridgeArt: React.FC<{ cx: number; cy: number }> = ({ cx, cy }) => {
  const r = 17;
  const T: [number, number] = [cx, cy - r];
  const R: [number, number] = [cx + r, cy];
  const B: [number, number] = [cx, cy + r];
  const L: [number, number] = [cx - r, cy];
  return (
    <g>
      <polygon points={`${T} ${R} ${B} ${L}`} fill="none" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <EdgeDiode p0={T} p1={L} />
      <EdgeDiode p0={B} p1={L} />
      <EdgeDiode p0={R} p1={T} />
      <EdgeDiode p0={R} p1={B} />
      {/* leads to the four sockets */}
      <line x1={cx} y1={cy - BRIDGE_ARM + 12} x2={cx} y2={T[1]} {...stroke} strokeWidth={2} />
      <line x1={cx} y1={B[1]} x2={cx} y2={cy + BRIDGE_ARM - 12} {...stroke} strokeWidth={2} />
      <line x1={cx - BRIDGE_ARM + 12} y1={cy} x2={L[0]} y2={cy} {...stroke} strokeWidth={2} />
      <line x1={R[0]} y1={cy} x2={cx + BRIDGE_ARM - 12} y2={cy} {...stroke} strokeWidth={2} />
      <Label x={cx + 28} y={cy - BRIDGE_ARM + 4} size={12}>
        AC
      </Label>
      <Label x={cx + 28} y={cy + BRIDGE_ARM + 4} size={12}>
        AC
      </Label>
      <Label x={cx - BRIDGE_ARM - 3} y={cy - 20} size={11}>
        +
      </Label>
      <Label x={cx + BRIDGE_ARM + 4} y={cy - 20} size={13}>
        −
      </Label>
    </g>
  );
};

const JunctionArt: React.FC<{ cx: number; cy: number }> = ({ cx, cy }) => (
  <g>
    <line x1={cx} y1={cy - JUNCTION_ARM_V + 12} x2={cx} y2={cy + JUNCTION_ARM_V - 12} {...stroke} strokeWidth={2} />
    <line x1={cx - JUNCTION_ARM_H + 12} y1={cy} x2={cx + JUNCTION_ARM_H - 12} y2={cy} {...stroke} strokeWidth={2} />
  </g>
);

/** Variable capacitor: two plates with the slanted "adjustable" arrow. */
const TrimmerArt: React.FC<{ cx: number; cy: number }> = ({ cx, cy }) => (
  <g>
    <line x1={cx - TRIMMER_SPAN + 12} y1={cy} x2={cx - 4} y2={cy} {...stroke} />
    <line x1={cx - 4} y1={cy - 10} x2={cx - 4} y2={cy + 10} {...stroke} strokeWidth={2.6} />
    <line x1={cx + 4} y1={cy - 10} x2={cx + 4} y2={cy + 10} {...stroke} strokeWidth={2.6} />
    <line x1={cx + 4} y1={cy} x2={cx + TRIMMER_SPAN - 12} y2={cy} {...stroke} />
    <line x1={cx - 17} y1={cy + 12} x2={cx + 17} y2={cy - 12} {...stroke} strokeWidth={2} />
    <Arrowhead x={cx + 19} y={cy - 13.4} angleDeg={-36} size={7} />
  </g>
);

const PotSymbolArt: React.FC<{ cx: number; cy: number }> = ({ cx, cy }) => (
  <g>
    <line x1={cx - POT_HALF_SPAN + 12} y1={cy} x2={cx - 24} y2={cy} {...stroke} />
    <path d={`M ${cx - 24} ${cy} L ${cx - 19} ${cy} L ${cx - 15} ${cy - 6.5} L ${cx - 9} ${cy + 6.5} L ${cx - 3} ${cy - 6.5} L ${cx + 3} ${cy + 6.5} L ${cx + 9} ${cy - 6.5} L ${cx + 13} ${cy} L ${cx + 19} ${cy}`} {...stroke} />
    <line x1={cx + 19} y1={cy} x2={cx + POT_HALF_SPAN - 12} y2={cy} {...stroke} />
    <line x1={cx - 16} y1={cy + 10} x2={cx + 21} y2={cy - 11} {...stroke} strokeWidth={1.9} />
    <Arrowhead x={cx + 23} y={cy - 12.2} angleDeg={-29} size={7} />
  </g>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const MeasurementsBoard: React.FC<MeasurementsBoardProps> = ({
  instanceId,
  ports,
  connectedPortIds,
  portConnectionCounts,
  wiringSourcePort,
  onPortClick,
  onClose,
  onDragStart,
  meterDeflection = 0,
  pot5k = 50,
  pot100k = 50,
  pot1M = 50,
  onPotChange,
}) => {
  const [internalPot5k, setInternalPot5k] = useState(pot5k);
  const [internalPot100k, setInternalPot100k] = useState(pot100k);
  const [internalPot1M, setInternalPot1M] = useState(pot1M);

  useEffect(() => setInternalPot5k(pot5k), [pot5k]);
  useEffect(() => setInternalPot100k(pot100k), [pot100k]);
  useEffect(() => setInternalPot1M(pot1M), [pot1M]);

  const potValues: Record<PotKey, number> = { pot5k: internalPot5k, pot100k: internalPot100k, pot1M: internalPot1M };

  const handlePotUpdate = (potKey: PotKey, val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    if (potKey === 'pot5k') setInternalPot5k(clamped);
    if (potKey === 'pot100k') setInternalPot100k(clamped);
    if (potKey === 'pot1M') setInternalPot1M(clamped);
    onPotChange?.(potKey, clamped);
  };

  const getPort = (suffix: string) => ports.find((p) => p.id === `${instanceId}:${suffix}`);

  // ---- Banana socket (orange moulded collar / black metal-nut collar) ------
  const renderSocket = (suffix: string, x: number, y: number, tone: 'orange' | 'black' = 'orange') => {
    const port = getPort(suffix);
    if (!port) return null;
    const isConnected = connectedPortIds.has(port.id);
    const isSource = wiringSourcePort?.id === port.id;
    const stacked = portConnectionCounts?.get(port.id) ?? 0;

    return (
      <button
        key={suffix}
        type="button"
        data-port-id={port.id}
        onClick={(e) => {
          e.stopPropagation();
          labAudio.playPlugSnap();
          onPortClick(port);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        title={`${port.name} • ${stacked > 0 ? `${stacked} سلك موصول` : 'انقر للتوصيل'}`}
        className={`absolute rounded-full p-0 border-0 cursor-pointer touch-manipulation transition-transform ${
          isSource ? 'z-30 scale-125' : 'hover:scale-110 active:scale-95'
        }`}
        style={{
          left: x - SOCKET / 2,
          top: y - SOCKET / 2,
          width: SOCKET,
          height: SOCKET,
          background:
            tone === 'orange'
              ? 'radial-gradient(circle at 38% 32%, #ff8f45 0%, #f2601f 52%, #c8400f 100%)'
              : 'radial-gradient(circle at 38% 32%, #4b4b4b 0%, #2a2a2a 55%, #111 100%)',
          boxShadow: isSource
            ? '0 0 0 2.5px #22d3ee, 0 0 14px 3px rgba(34,211,238,0.85)'
            : isConnected
              ? '0 0 0 2px #fbbf24, 0 0 9px 2px rgba(245,158,11,0.55), 0 2px 3px rgba(0,0,0,0.45)'
              : '0 2px 3px rgba(0,0,0,0.38), inset 0 1px 1px rgba(255,255,255,0.35)',
        }}
      >
        {/* enlarged invisible touch target */}
        <span className="absolute -inset-2 rounded-full" />
        {/* metal eyelet */}
        <span
          className="absolute rounded-full"
          style={{
            left: 5,
            top: 5,
            right: 5,
            bottom: 5,
            background:
              tone === 'orange'
                ? 'radial-gradient(circle at 35% 30%, #8a8a8a 0%, #3b3b3b 55%, #1c1c1c 100%)'
                : 'radial-gradient(circle at 35% 30%, #aab0b9 0%, #5b6470 50%, #23272e 100%)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)',
          }}
        />
        {/* socket bore */}
        <span
          className="absolute rounded-full"
          style={{
            left: 10,
            top: 10,
            right: 10,
            bottom: 10,
            background: '#050505',
            boxShadow: 'inset 0 1.5px 2.5px rgba(0,0,0,0.95)',
          }}
        >
          {isConnected && (
            <span className="absolute inset-[2px] rounded-full bg-amber-400" style={{ boxShadow: '0 0 5px #fbbf24' }} />
          )}
        </span>
        {stacked > 1 && (
          <span className="absolute -bottom-1.5 -right-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full border border-white bg-sky-600 px-[2px] text-[8px] font-black text-white shadow">
            {stacked}
          </span>
        )}
      </button>
    );
  };

  // ---- Rotary potentiometer knob ------------------------------------------
  const renderKnob = (pot: (typeof POTS)[number]) => {
    const value = potValues[pot.key];
    const angle = -135 + (value / 100) * 270;
    const size = pot.style === 'red' ? 50 : 40;

    const onDown = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startVal = value;
      const move = (m: PointerEvent) => handlePotUpdate(pot.key, startVal + ((startY - m.clientY) / 120) * 100);
      const up = (u: PointerEvent) => {
        try {
          target.releasePointerCapture(u.pointerId);
        } catch {
          /* pointer already released */
        }
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };

    return (
      <div
        key={pot.key}
        onPointerDown={onDown}
        title={`Potentiometer ${pot.caption}: ${value.toFixed(0)}% (اسحب للأعلى أو الأسفل للتدوير)`}
        className="absolute cursor-ns-resize touch-none select-none transition-transform hover:scale-105"
        style={{ left: pot.cx - size / 2, top: pot.knobY - size / 2, width: size, height: size }}
      >
        {pot.style === 'red' ? (
          <div
            className="relative h-full w-full rounded-full"
            style={{
              background: 'radial-gradient(circle at 36% 30%, #4b5563 0%, #1f2937 45%, #0b0f16 100%)',
              boxShadow: '0 4px 7px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.25)',
            }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <div
                className="relative rounded-full"
                style={{
                  width: size * 0.58,
                  height: size * 0.58,
                  background: 'radial-gradient(circle at 36% 30%, #ff6b6b 0%, #e11d2a 55%, #8f0f18 100%)',
                  boxShadow: 'inset 0 -2px 3px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                <div className="absolute left-1/2 top-[2px] h-[9px] w-[3px] -translate-x-1/2 rounded-full bg-[#1a0507]" />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="relative h-full w-full rounded-full"
            style={{
              background:
                'repeating-conic-gradient(from 0deg, #e5e7eb 0deg 14deg, #8b95a3 14deg 28deg)',
              boxShadow: '0 3px 6px rgba(0,0,0,0.5), inset 0 0 0 3px #b8c0cc',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${angle}deg)` }}>
              <div className="relative h-[46%] w-[46%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#f3f4f6,#9ca3af_70%)] shadow-inner">
                <div className="absolute left-1/2 top-[1px] h-[8px] w-[3px] -translate-x-1/2 rounded-sm bg-[#111827]" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // µA meter needle: ±40 µA  ->  ±34°
  const clamped = Math.max(-40, Math.min(40, meterDeflection));
  const needleAngle = (clamped / 40) * 34;

  // ---- helpers to emit rows of sockets ------------------------------------
  const termSockets = (t: TwoTerm, xl: number, xr: number, y: number) => {
    const left = t.polar ? `${t.id}:pos` : `${t.id}:a`;
    const right = t.polar ? `${t.id}:neg` : `${t.id}:b`;
    const leftBlack = t.polar || t.blackLeft;
    return (
      <React.Fragment key={t.id}>
        {renderSocket(left, xl, y, leftBlack ? 'black' : 'orange')}
        {renderSocket(right, xr, y, 'orange')}
      </React.Fragment>
    );
  };

  return (
    <div
      className="relative select-none"
      style={{
        width: PLATE_W + 30,
        height: PLATE_H + 30,
        padding: 15,
        borderRadius: 14,
        // brushed-aluminium extrusion
        background:
          'linear-gradient(180deg, #f3f5f7 0%, #c9ced4 18%, #e8ebee 40%, #a9b0b8 70%, #d3d8dd 100%)',
        boxShadow:
          '0 24px 60px rgba(0,0,0,0.65), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(0,0,0,0.35)',
        border: '1px solid #7b838c',
        fontFamily: SERIF,
      }}
    >
      {/* black rubber end-caps at the top corners (as on the real unit) */}
      <div className="pointer-events-none absolute left-0 top-0 h-7 w-9 rounded-tl-[14px] bg-gradient-to-br from-[#2b2f34] to-[#0f1113]" />
      <div className="pointer-events-none absolute right-0 top-0 h-7 w-9 rounded-tr-[14px] bg-gradient-to-bl from-[#2b2f34] to-[#0f1113]" />

      {/* ============================== PLATE ============================== */}
      <div
        className="relative overflow-hidden rounded-[6px]"
        style={{
          width: PLATE_W,
          height: PLATE_H,
          background: 'linear-gradient(180deg, #fbfbf9 0%, #f6f5f1 55%, #efede7 100%)',
          boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.28), inset 0 -1px 2px rgba(255,255,255,0.8)',
        }}
      >
        {/* ---------- full-width drag strip (sits behind the title text) ---------- */}
        <div
          data-board-drag
          onPointerDown={onDragStart}
          style={{ touchAction: 'none', height: 50 }}
          className="group/drag absolute inset-x-0 top-0 z-20 flex cursor-grab items-center justify-center border-b border-transparent bg-transparent transition-colors duration-150 hover:border-sky-600/30 hover:bg-sky-600/10 active:cursor-grabbing active:bg-sky-600/20"
          title="اسحب من هنا لتحريك البورد (Drag to move)"
        >
          <h1
            className="pointer-events-none m-0 whitespace-nowrap font-bold uppercase"
            style={{ color: INK, fontFamily: SERIF, fontSize: 23, letterSpacing: '0.09em' }}
          >
            INSTRUMENTS AND MEASUREMENTS EXPERIMENTS TRAINING BOARD
          </h1>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-sky-700 opacity-0 transition-opacity group-hover/drag:opacity-70">
            ⠿ DRAG
          </span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white/70 text-slate-500 opacity-50 transition hover:bg-rose-600 hover:text-white hover:opacity-100"
            title="إغلاق البورد"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ---------------------- printed artwork layer ---------------------- */}
        <svg
          className="pointer-events-none absolute left-0 top-0"
          width={PLATE_W}
          height={PLATE_H}
          viewBox={`0 0 ${PLATE_W} ${PLATE_H}`}
        >
          {/* capacitors */}
          {CAP_ROWS.map((r) => (
            <g key={r.y}>
              <TwoTerminalArt xl={COL_A[0]} xr={COL_A[1]} y={r.y} t={r.a} />
              <TwoTerminalArt xl={COL_B[0]} xr={COL_B[1]} y={r.y} t={r.b} />
            </g>
          ))}
          {/* inductors */}
          {IND_ROWS.map((r) => (
            <g key={r.y}>
              <TwoTerminalArt xl={COL_A[0]} xr={COL_A[1]} y={r.y} t={r.a} />
              <TwoTerminalArt xl={COL_B[0]} xr={COL_B[1]} y={r.y} t={r.b} />
            </g>
          ))}
          {/* resistors */}
          {RES_ROWS.map((r) => (
            <g key={r.y}>
              <TwoTerminalArt xl={RCOL_1[0]} xr={RCOL_1[1]} y={r.y} t={r.a} />
              <TwoTerminalArt xl={RCOL_2[0]} xr={RCOL_2[1]} y={r.y} t={r.b} />
            </g>
          ))}

          {/* four diodes */}
          {DIODES.map((d) => (
            <DiodeArt key={d.id} x={d.x} style={d.style} />
          ))}

          {/* junction blocks & bridges */}
          {JUNCTIONS.map((j) => (
            <JunctionArt key={j.id} cx={j.cx} cy={j.cy} />
          ))}
          {BRIDGES.map((b) => (
            <BridgeArt key={b.id} cx={b.cx} cy={b.cy} />
          ))}

          {/* variable capacitors */}
          {TRIMMERS.map((t) => (
            <TrimmerArt key={t.id} cx={t.cx} cy={t.cy} />
          ))}

          {/* potentiometers: wiper lead from the top socket + symbol + caption */}
          {POTS.map((p) => (
            <g key={p.key}>
              <line x1={p.cx} y1={p.topY + 14} x2={p.cx} y2={p.knobY - (p.style === 'red' ? 26 : 12)} {...stroke} strokeWidth={2} />
              <PotSymbolArt cx={p.cx} cy={p.botY} />
              <line x1={p.cx - 36} y1={p.botY + 31} x2={p.cx - 10} y2={p.botY + 31} {...stroke} strokeWidth={1.8} />
              <Arrowhead x={p.cx - 5} y={p.botY + 31} angleDeg={0} size={6} />
              <Label x={p.cx - 46} y={p.botY + 36} size={12} anchor="end">
                0
              </Label>
              <Label x={p.cx + 4} y={p.botY + 36} size={12} anchor="start">
                {p.caption}
              </Label>
            </g>
          ))}

          {/* footer legends */}
          <text x={22} y={PLATE_H - 24} fontSize={21} fontWeight={700} fill={INK} fontFamily={SERIF} letterSpacing="1.6">
            COMPUTER ENGINEERING TECHNIQUES
          </text>
          <text x={PLATE_W - 26} y={PLATE_H - 50} textAnchor="end" fontSize={21} fontWeight={700} fill={INK} fontFamily={SERIF} letterSpacing="1.6">
            ELECTRICAL AND ELECTRONIC
          </text>
          <text x={PLATE_W - 60} y={PLATE_H - 22} textAnchor="end" fontSize={21} fontWeight={700} fill={INK} fontFamily={SERIF} letterSpacing="1.6">
            TECHNICAL COLLEGE
          </text>
        </svg>

        {/* ------------------------------ µA meter ------------------------------ */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: METER.x,
            top: METER.y,
            width: METER.w,
            height: METER.h,
            borderRadius: '8px 8px 12px 12px',
            background: 'linear-gradient(180deg, #8fa9a6 0%, #7c9895 45%, #6a8582 100%)',
            border: '1px solid #55706d',
            boxShadow: '0 6px 12px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.45), inset 0 -2px 4px rgba(0,0,0,0.25)',
          }}
        >
          {/* glass window */}
          <div
            className="absolute overflow-hidden"
            style={{
              left: 7,
              right: 7,
              top: 6,
              height: 88,
              background: 'linear-gradient(180deg, #ffffff 0%, #f4f6f7 100%)',
              border: '1px solid #43504f',
              boxShadow: 'inset 0 4px 5px rgba(0,0,0,0.35)',
            }}
          >
            <svg viewBox="0 0 201 88" width="100%" height="100%">
              {/* dark shadow strip under the top bezel */}
              <rect x="0" y="0" width="201" height="5" fill="#2f3636" opacity="0.85" />
              {/* anti-parallax mirror arc */}
              <path d="M 31 78 A 90 90 0 0 1 170 78" fill="none" stroke="#6b7280" strokeWidth="4.5" />
              {/* scale: -40 ... 0 ... +40 */}
              {Array.from({ length: 41 }).map((_, i) => {
                const val = i - 20; // -20 .. +20 minor steps of 2 µA
                const a = ((val * 2) / 40) * 34;
                const rad = ((a - 90) * Math.PI) / 180;
                const major = val % 10 === 0;
                const rO = 88;
                const rI = major ? 79 : 83;
                const cx = 100.5;
                const cy = 118;
                return (
                  <line
                    key={i}
                    x1={cx + rO * Math.cos(rad)}
                    y1={cy + rO * Math.sin(rad)}
                    x2={cx + rI * Math.cos(rad)}
                    y2={cy + rI * Math.sin(rad)}
                    stroke="#1f2937"
                    strokeWidth={major ? 1.2 : 0.7}
                  />
                );
              })}
              <path d="M 28.9 63.4 A 88 88 0 0 1 172.1 63.4" fill="none" stroke="none" />
              {[-40, -20, 0, 20, 40].map((v) => {
                const a = (v / 40) * 34;
                const rad = ((a - 90) * Math.PI) / 180;
                const r = 70;
                return (
                  <text
                    key={v}
                    x={100.5 + r * Math.cos(rad)}
                    y={118 + r * Math.sin(rad) + 3}
                    textAnchor="middle"
                    fontSize="7.5"
                    fontWeight="700"
                    fill="#1f2937"
                    fontFamily="Arial, sans-serif"
                  >
                    {Math.abs(v)}
                  </text>
                );
              })}
              <text x="100.5" y="68" textAnchor="middle" fontSize="12" fill="#1f2937" fontFamily="Arial, sans-serif">
                µA
              </text>
              <text x="6" y="84" fontSize="5.5" fill="#374151" fontFamily="Arial, sans-serif">
                1.5
              </text>
              {/* needle */}
              <g
                style={{
                  transform: `rotate(${needleAngle}deg)`,
                  transformOrigin: '100.5px 118px',
                  transition: 'transform 140ms cubic-bezier(0.2, 0.8, 0.4, 1)',
                }}
              >
                <line x1="100.5" y1="118" x2="100.5" y2="19" stroke="#111827" strokeWidth="1.1" strokeLinecap="round" />
              </g>
            </svg>
          </div>
          {/* zero-adjust screw */}
          <div
            className="absolute rounded-full"
            style={{
              left: '50%',
              top: 118,
              width: 22,
              height: 22,
              marginLeft: -11,
              background: 'radial-gradient(circle at 35% 30%, #3a3a3a 0%, #0c0c0c 70%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.25)',
            }}
          >
            <div className="absolute left-1/2 top-1/2 h-[12px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[#d1d5db]" />
          </div>
        </div>

        {/* trimmer adjustment screws above each variable capacitor */}
        {TRIMMERS.map((t) => (
          <div
            key={`${t.id}-screw`}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: t.cx - 9,
              top: t.cy - 52,
              width: 18,
              height: 18,
              background: 'radial-gradient(circle at 35% 30%, #d1d5db 0%, #6b7280 65%, #374151 100%)',
              boxShadow: '0 0 0 2px #b7c7e6, 0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            <div className="absolute left-1/2 top-1/2 h-[3px] w-[10px] -translate-x-1/2 -translate-y-1/2 rotate-[-25deg] bg-[#1f2937]" />
          </div>
        ))}

        {/* ------------------------------ knobs ------------------------------ */}
        {POTS.map((p) => renderKnob(p))}

        {/* ------------------------------ sockets ------------------------------ */}
        {/* capacitors + inductors (left block) */}
        {CAP_ROWS.map((r) => (
          <React.Fragment key={`cs${r.y}`}>
            {termSockets(r.a, COL_A[0], COL_A[1], r.y)}
            {termSockets(r.b, COL_B[0], COL_B[1], r.y)}
          </React.Fragment>
        ))}
        {IND_ROWS.map((r) => (
          <React.Fragment key={`is${r.y}`}>
            {termSockets(r.a, COL_A[0], COL_A[1], r.y)}
            {termSockets(r.b, COL_B[0], COL_B[1], r.y)}
          </React.Fragment>
        ))}

        {/* resistors (right block) */}
        {RES_ROWS.map((r) => (
          <React.Fragment key={`rs${r.y}`}>
            {termSockets(r.a, RCOL_1[0], RCOL_1[1], r.y)}
            {termSockets(r.b, RCOL_2[0], RCOL_2[1], r.y)}
          </React.Fragment>
        ))}

        {/* four diodes */}
        {DIODES.map((d) => (
          <React.Fragment key={d.id}>
            {renderSocket(`${d.id}:a`, d.x, DIODE_TOP)}
            {renderSocket(`${d.id}:k`, d.x, DIODE_BOT)}
          </React.Fragment>
        ))}

        {/* junction blocks */}
        {JUNCTIONS.map((j) => (
          <React.Fragment key={j.id}>
            {renderSocket(`${j.id}:n`, j.cx, j.cy - JUNCTION_ARM_V)}
            {renderSocket(`${j.id}:w`, j.cx - JUNCTION_ARM_H, j.cy)}
            {renderSocket(`${j.id}:e`, j.cx + JUNCTION_ARM_H, j.cy)}
            {renderSocket(`${j.id}:s`, j.cx, j.cy + JUNCTION_ARM_V)}
          </React.Fragment>
        ))}

        {/* bridge rectifiers: AC top / AC bottom / "+" left / "−" right (black) */}
        {BRIDGES.map((b) => (
          <React.Fragment key={b.id}>
            {renderSocket(`${b.id}:ac1`, b.cx, b.cy - BRIDGE_ARM)}
            {renderSocket(`${b.id}:ac2`, b.cx, b.cy + BRIDGE_ARM)}
            {renderSocket(`${b.id}:pos`, b.cx - BRIDGE_ARM, b.cy)}
            {renderSocket(`${b.id}:neg`, b.cx + BRIDGE_ARM, b.cy, 'black')}
          </React.Fragment>
        ))}

        {/* µA meter terminals (black, under the meter) */}
        {renderSocket('UA:neg', UA_SOCKETS.neg, UA_SOCKETS.y, 'black')}
        {renderSocket('UA:pos', UA_SOCKETS.pos, UA_SOCKETS.y, 'black')}

        {/* variable capacitors */}
        {TRIMMERS.map((t) => (
          <React.Fragment key={t.id}>
            {renderSocket(`${t.id}:a`, t.cx - TRIMMER_SPAN, t.cy)}
            {renderSocket(`${t.id}:b`, t.cx + TRIMMER_SPAN, t.cy)}
          </React.Fragment>
        ))}

        {/* potentiometers: wiper (top) + two ends (bottom) */}
        {POTS.map((p) => (
          <React.Fragment key={`ps-${p.key}`}>
            {renderSocket(`${p.portPrefix}:w`, p.cx, p.topY)}
            {renderSocket(`${p.portPrefix}:1`, p.cx - POT_HALF_SPAN, p.botY)}
            {renderSocket(`${p.portPrefix}:3`, p.cx + POT_HALF_SPAN, p.botY)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
