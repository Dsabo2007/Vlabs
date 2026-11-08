import React from 'react';
import { Port, PortType } from '../types/lab';
import { labAudio } from '../utils/audio';

interface PortJackProps {
  port: Port;
  connectedCount?: number;
  isSelectedForWiring?: boolean;
  onPortClick: (port: Port) => void;
  className?: string;
  hideLabel?: boolean;
}

export const PortJack: React.FC<PortJackProps> = ({
  port,
  connectedCount = 0,
  isSelectedForWiring = false,
  onPortClick,
  className = '',
  hideLabel = false,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    labAudio.playPlugSnap();
    onPortClick(port);
  };

  const isBnc = port.type === 'bnc';

  return (
    <div
      onClick={handleClick}
      className={`relative inline-flex flex-col items-center justify-center cursor-pointer select-none group touch-manipulation ${className}`}
      title={`${port.label} (${isBnc ? 'BNC Connector' : 'Banana Socket'}) - Click to wire`}
      data-port-id={port.id}
    >
      {/* Expanded touch target for iPad & Android */}
      <span className="absolute -inset-3 rounded-full cursor-pointer pointer-events-auto" />
      {/* Visual Socket */}
      {isBnc ? (
        // 50Ω BNC front-panel jack: chrome bayonet barrel, dark bore, PTFE
        // dielectric and a gold centre contact, with the panel's channel colour
        // kept as a thin ring around the connector.
        <div
          data-port-anchor
          className={`relative w-7 h-7 rounded-full transition-all ${
            isSelectedForWiring
              ? 'ring-4 ring-cyan-400 ring-offset-1 scale-110'
              : 'hover:scale-105'
          }`}
        >
          {/* panel colour ring */}
          <span
            className="absolute -inset-[2px] rounded-full"
            style={{ border: `1.6px solid ${port.color || '#64748b'}`, opacity: 0.9 }}
          />
          {/* chrome bayonet barrel */}
          <span
            className="absolute inset-0 rounded-full border border-[#6f747b]"
            style={{
              background: 'radial-gradient(circle at 32% 26%, #ffffff 0%, #e2e6ea 24%, #a8aeb6 56%, #6c727a 100%)',
              boxShadow: 'inset 0 1px 1px #fff, inset 0 -1px 2px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.35)',
            }}
          />
          {/* bayonet locking lugs */}
          <span className="absolute -left-[2px] top-1/2 h-[5px] w-[4px] -translate-y-1/2 rounded-[1px] bg-gradient-to-b from-[#dfe2e6] to-[#7c828a] shadow" />
          <span className="absolute -right-[2px] top-1/2 h-[5px] w-[4px] -translate-y-1/2 rounded-[1px] bg-gradient-to-b from-[#dfe2e6] to-[#7c828a] shadow" />
          {/* dark bore */}
          <span
            className="absolute inset-[4px] rounded-full border border-[#4b5056]"
            style={{
              background: 'radial-gradient(circle at 50% 38%, #3c4147 0%, #1a1d20 62%, #0d0f11 100%)',
              boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.95)',
            }}
          />
          {/* PTFE dielectric */}
          <span
            className="absolute inset-[8px] rounded-full"
            style={{ background: 'radial-gradient(circle at 38% 32%, #ffffff 0%, #e9e5da 60%, #b7b2a6 100%)' }}
          />
          {/* gold centre contact */}
          <span
            className="absolute left-1/2 top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 28%, #fff4b8 0%, #e5b134 52%, #8a6312 100%)',
              boxShadow: '0 0 2px rgba(0,0,0,0.55)',
            }}
          />
        </div>
      ) : (
        // Banana Jack Style
        <div
          data-port-anchor
          className={`relative w-6 h-6 rounded-full flex items-center justify-center border transition-all shadow-sm ${
            isSelectedForWiring
              ? 'ring-4 ring-amber-400 ring-offset-1 scale-110'
              : 'hover:scale-105'
          } border-black/20`}
          style={{
            backgroundColor: port.color || '#ef4444',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {/* Metallic socket hole */}
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-700 shadow-inner flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-neutral-950" />
          </div>
        </div>
      )}

      {/* Connection Indicator Badge */}
      {connectedCount > 0 && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-cyan-600 text-[8px] font-bold text-white rounded-full flex items-center justify-center shadow">
          {connectedCount}
        </span>
      )}

      {/* Label */}
      {!hideLabel && port.label && (
        <span className="text-[9px] font-bold text-slate-800 tracking-tight mt-0.5 leading-none">
          {port.label}
        </span>
      )}
    </div>
  );
};
