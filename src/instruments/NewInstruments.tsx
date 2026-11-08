import React from 'react';
import { X } from 'lucide-react';
import { Port } from '../types/lab';
import { PortJack } from '../components/PortJack';

interface CommonProps {
  ports: Port[];
  connectedPortIds: Set<string>;
  wiringSourcePort: Port | null;
  onPortClick: (port: Port) => void;
  onClose?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

/** Absolutely positioned item, centred on (x, y) of the device face. */
const At: React.FC<{ x: number; y: number; children: React.ReactNode; z?: number }> = ({ x, y, children, z }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', zIndex: z }}>{children}</div>
);

const CloseBtn: React.FC<{ onClose?: () => void; dark?: boolean }> = ({ onClose, dark }) =>
  onClose ? (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ touchAction: 'manipulation' }}
      className={`absolute right-1.5 top-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full shadow ${dark ? 'bg-white/15 text-neutral-200' : 'bg-neutral-800/70 text-neutral-100'} opacity-80 hover:bg-rose-700 hover:text-white hover:opacity-100 before:absolute before:-inset-2 before:content-['']`}
      title="إزالة الجهاز"
    >
      <X className="h-4 w-4" />
    </button>
  ) : null;

const Jack: React.FC<{ port?: Port } & CommonProps> = ({ port, connectedPortIds, wiringSourcePort, onPortClick }) =>
  port ? (
    <PortJack
      port={port}
      connectedCount={connectedPortIds.has(port.id) ? 1 : 0}
      isSelectedForWiring={wiringSourcePort?.id === port.id}
      onPortClick={onPortClick}
      hideLabel
    />
  ) : null;

const byName = (ports: Port[], suffix: string) => ports.find((p) => p.id.endsWith(`:${suffix}`));

/**
 * BNC (male) → dual 4 mm banana adapter, HT311 type.
 *
 * The BNC nose plugs into any BNC jack on a device (snaps on, then travels with
 * that device); the red 4 mm socket carries the centre conductor / signal and
 * the black socket is the shell / ground return.
 */
export const BananaLeads: React.FC<CommonProps> = (props) => {
  const { ports, onClose, onDragStart } = props;
  return (
    <div className="relative select-none" style={{ width: 150, height: 232 }} data-instrument-model="BNC-BANANA-ADAPTER">
      <svg width="150" height="232" viewBox="0 0 150 232" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <defs>
          {/* brushed chrome, used for the bayonet barrel and the socket ferrules */}
          <linearGradient id="adChrome" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6f757d" />
            <stop offset="0.18" stopColor="#d8dde2" />
            <stop offset="0.38" stopColor="#fbfcfd" />
            <stop offset="0.62" stopColor="#c2c8ce" />
            <stop offset="0.82" stopColor="#8f959d" />
            <stop offset="1" stopColor="#5a6068" />
          </linearGradient>
          <linearGradient id="adChromeV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7c828a" />
            <stop offset="0.28" stopColor="#eef1f4" />
            <stop offset="0.55" stopColor="#c7ccd2" />
            <stop offset="1" stopColor="#6a7078" />
          </linearGradient>
          {/* moulded black body with a soft specular band */}
          <linearGradient id="adBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#050607" />
            <stop offset="0.14" stopColor="#2c3035" />
            <stop offset="0.36" stopColor="#43484e" />
            <stop offset="0.52" stopColor="#26292d" />
            <stop offset="0.78" stopColor="#111315" />
            <stop offset="1" stopColor="#040506" />
          </linearGradient>
          <linearGradient id="adRed" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5c0808" />
            <stop offset="0.16" stopColor="#c8281f" />
            <stop offset="0.34" stopColor="#f2685c" />
            <stop offset="0.52" stopColor="#d8362a" />
            <stop offset="0.8" stopColor="#8c100c" />
            <stop offset="1" stopColor="#4a0505" />
          </linearGradient>
          <linearGradient id="adBlack" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000000" />
            <stop offset="0.18" stopColor="#17191c" />
            <stop offset="0.38" stopColor="#464b51" />
            <stop offset="0.54" stopColor="#22262a" />
            <stop offset="0.82" stopColor="#0a0b0c" />
            <stop offset="1" stopColor="#000000" />
          </linearGradient>
          <radialGradient id="adHole" cx="0.45" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#000000" />
            <stop offset="0.7" stopColor="#0a0b0c" />
            <stop offset="1" stopColor="#2b2e31" />
          </radialGradient>
          <filter id="adShadow" x="-30%" y="-10%" width="170%" height="135%">
            <feDropShadow dx="0" dy="5" stdDeviation="3.2" floodOpacity="0.45" />
          </filter>
        </defs>

        <g filter="url(#adShadow)">
          {/* --- BNC male nose (bayonet barrel seen head-on) --- */}
          <circle cx="75" cy="30" r="25" fill="url(#adChromeV)" stroke="#565c64" strokeWidth="1.2" />
          {/* bayonet locking lugs */}
          <rect x="47" y="25.5" width="8" height="9" rx="1.6" fill="url(#adChromeV)" stroke="#5c626a" strokeWidth="0.8" />
          <rect x="95" y="25.5" width="8" height="9" rx="1.6" fill="url(#adChromeV)" stroke="#5c626a" strokeWidth="0.8" />
          <rect x="49" y="29" width="4" height="2" rx="1" fill="#6d737b" opacity="0.7" />
          <rect x="97" y="29" width="4" height="2" rx="1" fill="#6d737b" opacity="0.7" />
          {/* outer chrome rim */}
          <circle cx="75" cy="30" r="23" fill="none" stroke="#f3f5f7" strokeWidth="0.9" opacity="0.65" />
          {/* dark bore */}
          <circle cx="75" cy="30" r="18.5" fill="#191c1f" />
          <circle cx="75" cy="30" r="18.5" fill="none" stroke="#0a0b0c" strokeWidth="1.4" />
          {/* PTFE dielectric */}
          <circle cx="75" cy="30" r="13" fill="#ece8db" stroke="#c2bdaf" strokeWidth="0.8" />
          <circle cx="75" cy="30" r="9" fill="#0f1113" />
          {/* gold centre pin */}
          <circle cx="75" cy="30" r="3.3" fill="#e8b93c" stroke="#8d6614" strokeWidth="0.8" />
          <circle cx="74" cy="29" r="1.1" fill="#fff4c6" opacity="0.9" />
          {/* short chrome neck disappearing into the moulding */}
          <path d="M57 48 H93 V62 Q93 66 89 66 H61 Q57 66 57 62 Z" fill="url(#adChromeV)" stroke="#565c64" strokeWidth="0.9" />
          <path d="M57 52 H93" stroke="#f2f4f6" strokeWidth="0.8" opacity="0.5" />

          {/* --- black moulded body --- */}
          <path
            d="M32 74 Q32 64 42 64 H108 Q118 64 118 74 V122 Q118 130 109 130 H41 Q32 130 32 122 Z"
            fill="url(#adBody)"
            stroke="#000000"
            strokeWidth="1.4"
          />
          {/* grip ribs */}
          {[78, 85, 92, 99, 106, 113, 120].map((y) => (
            <path key={y} d={`M38 ${y} H112`} stroke="#000000" strokeWidth="1.1" opacity="0.55" />
          ))}
          {[78, 85, 92, 99, 106, 113, 120].map((y) => (
            <path key={`h${y}`} d={`M38 ${y - 0.8} H112`} stroke="#6a7078" strokeWidth="0.5" opacity="0.35" />
          ))}
          {/* mould parting line + specular highlight */}
          <path d="M75 64 V130" stroke="#000" strokeWidth="0.8" opacity="0.4" />
          <path d="M46 68 H104" stroke="#ffffff" strokeWidth="0.7" opacity="0.10" />
          {/* embossed model number */}
          <text x="75" y="102" textAnchor="middle" fontSize="7.2" fontWeight="700" fill="#9aa0a8" opacity="0.85" fontFamily="Arial, sans-serif" letterSpacing="1">
            HT311
          </text>

          {/* --- 4 mm banana sockets --- */}
          {[
            { x: 52, body: 'url(#adRed)', stroke: '#4a0505', hi: '#ffb3aa' },
            { x: 98, body: 'url(#adBlack)', stroke: '#000000', hi: '#8d939b' },
          ].map((s) => (
            <g key={s.x}>
              {/* ferrule / collar */}
              <rect x={s.x - 16} y="124" width="32" height="12" rx="4" fill="url(#adChromeV)" stroke="#565c64" strokeWidth="1" />
              <rect x={s.x - 14} y="126.5" width="28" height="2" rx="1" fill="#ffffff" opacity="0.35" />
              {/* socket body */}
              <rect x={s.x - 14} y="134" width="28" height="16" rx="3.5" fill={s.body} stroke={s.stroke} strokeWidth="1.1" />
              <rect x={s.x - 11} y="138" width="22" height="42" rx="7" fill={s.body} stroke={s.stroke} strokeWidth="1.1" />
              <rect x={s.x - 9} y="176" width="18" height="12" rx="5" fill={s.body} stroke={s.stroke} strokeWidth="1.1" />
              {/* gloss highlight */}
              <rect x={s.x - 9.5} y="140" width="2.4" height="38" rx="1.2" fill={s.hi} opacity="0.35" />
              <rect x={s.x - 13} y="136" width="20" height="1.6" rx="0.8" fill="#ffffff" opacity="0.22" />
              {/* 4 mm bore */}
              <ellipse cx={s.x} cy="184" rx="6.2" ry="4.2" fill="url(#adHole)" stroke="#000" strokeWidth="0.7" />
              <ellipse cx={s.x} cy="183" rx="3.4" ry="2.2" fill="#000" />
            </g>
          ))}

          {/* polarity legend printed beside the sockets */}
          <text x="52" y="208" textAnchor="middle" fontSize="13" fontWeight="900" fill="#ef4444" fontFamily="Arial">+</text>
          <text x="98" y="208" textAnchor="middle" fontSize="13" fontWeight="900" fill="#cbd5e1" fontFamily="Arial">−</text>
          <text x="52" y="221" textAnchor="middle" fontSize="5.4" fill="#94a3b8" fontFamily="Arial">SIGNAL</text>
          <text x="98" y="221" textAnchor="middle" fontSize="5.4" fill="#94a3b8" fontFamily="Arial">GROUND</text>
        </g>
      </svg>

      {/* grab bar on the moulded body */}
      <div
        onPointerDown={onDragStart}
        style={{ position: 'absolute', left: 36, top: 66, width: 78, height: 62, touchAction: 'none', cursor: 'grab', zIndex: 2 }}
        title="اسحب القطعة وقرّب طرف BNC من أي منفذ BNC لتثبيتها"
      />

      {/* BNC snap-on target, exactly over the barrel centre */}
      <At x={75} y={30} z={3}><div style={{ opacity: 0.001 }}><Jack port={byName(ports, 'lead_bnc')} {...props} /></div></At>
      {/* banana socket holes */}
      <At x={52} y={184} z={3}><Jack port={byName(ports, 'lead_pos')} {...props} /></At>
      <At x={98} y={184} z={3}><Jack port={byName(ports, 'lead_neg')} {...props} /></At>

      <CloseBtn onClose={onClose} dark />
    </div>
  );
};
