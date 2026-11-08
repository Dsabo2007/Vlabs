import React, { useState, useEffect } from 'react';
import { X, GripHorizontal } from 'lucide-react';
import { Port } from '../types/lab';
import { labAudio } from '../utils/audio';

export interface TrainingBoardProps {
  instanceId: string;
  ports: Port[];
  connectedPortIds: Set<string>;
  portConnectionCounts?: Map<string, number>;
  wiringSourcePort: Port | null;
  onPortClick: (port: Port) => void;
  onClose: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  galvanometerDeflection?: number; // In scale divisions (-30 to +30)
  pot5k?: number;   // 0 to 100%
  pot100k?: number; // 0 to 100%
  pot1M?: number;   // 0 to 100%
  onPotChange?: (potKey: 'pot5k' | 'pot100k' | 'pot1M', value: number) => void;
}

/**
 * ELECTRONICS EXPERIMENTS TRAINING BOARD
 * 100% Authentic replica of the university laboratory training console from:
 * ELECTRICAL AND ELECTRONIC TECHNICAL COLLEGE • COMPUTER ENGINEERING TECHNIQUES
 * (IMG_20261105_122517.jpg)
 */
export const TrainingBoard: React.FC<TrainingBoardProps> = ({
  instanceId,
  ports,
  connectedPortIds,
  portConnectionCounts,
  wiringSourcePort,
  onPortClick,
  onClose,
  onDragStart,
  galvanometerDeflection = 0,
  pot5k = 50,
  pot100k = 50,
  pot1M = 50,
  onPotChange,
}) => {
  // AC Switch state
  const [acPowerOn, setAcPowerOn] = useState(true);

  // Potentiometers state
  const [internalPot5k, setInternalPot5k] = useState(pot5k);
  const [internalPot100k, setInternalPot100k] = useState(pot100k);
  const [internalPot1M, setInternalPot1M] = useState(pot1M);

  useEffect(() => setInternalPot5k(pot5k), [pot5k]);
  useEffect(() => setInternalPot100k(pot100k), [pot100k]);
  useEffect(() => setInternalPot1M(pot1M), [pot1M]);

  const handlePotUpdate = (potKey: 'pot5k' | 'pot100k' | 'pot1M', val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    if (potKey === 'pot5k') setInternalPot5k(clamped);
    if (potKey === 'pot100k') setInternalPot100k(clamped);
    if (potKey === 'pot1M') setInternalPot1M(clamped);
    onPotChange?.(potKey, clamped);
  };

  // Helper to find a port by suffix
  const getPort = (suffix: string) => {
    return ports.find((p) => p.id === `${instanceId}:${suffix}`);
  };

  // Realistic Physical Banana Socket Component
  const renderSocket = (
    portSuffix: string,
    color: 'red' | 'black' = 'red',
    customTooltip?: string
  ) => {
    const port = getPort(portSuffix);
    if (!port) return <div className="w-[20px] h-[20px]" />;

    const isConnected = connectedPortIds.has(port.id);
    const isWiringSource = wiringSourcePort?.id === port.id;
    const stacked = portConnectionCounts?.get(port.id) ?? 0;

    const collarGrad = color === 'red'
      ? 'radial-gradient(circle at 35% 30%, #ef4444 0%, #dc2626 50%, #991b1b 100%)'
      : 'radial-gradient(circle at 35% 30%, #334155 0%, #1e293b 50%, #0f172a 100%)';

    return (
      <div className="relative inline-flex flex-col items-center select-none group/sock">
        <button
          type="button"
          data-port-id={port.id}
          onClick={(e) => {
            e.stopPropagation();
            labAudio.playPlugSnap();
            onPortClick(port);
          }}
          className={`relative w-[21px] h-[21px] rounded-full flex items-center justify-center transition-transform cursor-pointer touch-manipulation ${
            isWiringSource
              ? 'ring-2 ring-cyan-400 scale-125 z-30 shadow-[0_0_12px_#22d3ee]'
              : 'hover:scale-115 active:scale-95'
          }`}
          style={{
            background: collarGrad,
            boxShadow: isConnected
              ? `0 0 0 1.5px #fbbf24, 0 0 8px 2px rgba(245,158,11,0.5), 0 2px 4px rgba(0,0,0,0.4)`
              : '0 1.5px 3px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.4)',
          }}
          title={customTooltip || `${port.name} • ${stacked > 0 ? `${stacked} سلك موصول` : 'انقر للتوصيل'}`}
        >
          {/* Expanded transparent touch hit target (min 45px for iPad & Android touchscreens) */}
          <span className="absolute -inset-3 rounded-full cursor-pointer pointer-events-auto" />
          {/* Outer Nickel/Brass Ring */}
          <div className="w-[13px] h-[13px] rounded-full bg-gradient-to-br from-[#fef08a] via-[#eab308] to-[#854d0e] p-[1.5px] shadow-inner flex items-center justify-center">
            {/* Center Bore (Jack hole) */}
            <div className="w-[8px] h-[8px] rounded-full bg-[#0a0a0a] shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,0.9)] flex items-center justify-center">
              {isConnected && (
                <div className="w-[3px] h-[3px] rounded-full bg-amber-400 shadow-[0_0_4px_#fbbf24]" />
              )}
            </div>
          </div>

          {/* Lead count badge if stacked */}
          {stacked > 1 && (
            <span className="absolute -bottom-1 -right-1 min-w-[12px] h-[12px] px-[2px] rounded-full bg-sky-600 text-white text-[7px] font-black flex items-center justify-center border border-white shadow">
              {stacked}
            </span>
          )}
        </button>
      </div>
    );
  };

  // Realistic Physical Rotary Potentiometer Knob Component
  const renderPhysicalKnob = (
    potKey: 'pot5k' | 'pot100k' | 'pot1M',
    valuePercent: number,
    label: string,
    styleType: 'black-red-cap' | 'knurled-silver' = 'black-red-cap'
  ) => {
    // Rotation range: -135deg to +135deg
    const angle = -135 + (valuePercent / 100) * 270;

    const handlePointerDown = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startVal = valuePercent;

      const onPointerMove = (moveEvt: PointerEvent) => {
        const deltaY = startY - moveEvt.clientY;
        const deltaPercent = (deltaY / 120) * 100;
        handlePotUpdate(potKey, startVal + deltaPercent);
      };

      const onPointerUp = (upEvt: PointerEvent) => {
        target.releasePointerCapture(upEvt.pointerId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    return (
      <div className="flex flex-col items-center select-none group/pot">
        <div
          onPointerDown={handlePointerDown}
          className="relative w-[34px] h-[34px] rounded-full cursor-ns-resize shadow-[0_3px_6px_rgba(0,0,0,0.4)] flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{
            background: styleType === 'black-red-cap'
              ? 'radial-gradient(circle at 35% 30%, #374151 0%, #1f2937 60%, #111827 100%)'
              : 'radial-gradient(circle at 35% 30%, #f1f5f9 0%, #cbd5e1 50%, #64748b 100%)',
            border: styleType === 'black-red-cap' ? '2px solid #111827' : '2px solid #475569',
          }}
          title={`${label}: ${(valuePercent).toFixed(0)}% (اسحب للأعلى أو الأسفل للتدوير)`}
        >
          <div className="absolute inset-0.5 rounded-full border border-white/20 pointer-events-none" />

          <div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            {styleType === 'black-red-cap' ? (
              <div className="relative w-[18px] h-[18px] rounded-full bg-gradient-to-b from-[#ef4444] to-[#b91c1c] shadow-inner flex items-start justify-center">
                <div className="w-[2.5px] h-[6px] bg-white rounded-full mt-[1px] shadow-sm" />
              </div>
            ) : (
              <div className="relative w-[18px] h-[18px] rounded-full bg-gradient-to-b from-[#e2e8f0] to-[#94a3b8] shadow-inner flex items-start justify-center">
                <div className="w-[3px] h-[5px] bg-[#0f172a] rounded-sm mt-[1px]" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Needle angle for Galvanometer J0409 (-30 to +30 scale spans -40deg to +40deg)
  const clampedDeflection = Math.max(-30, Math.min(30, galvanometerDeflection));
  const needleAngle = (clampedDeflection / 30) * 40;

  return (
    <div
      className="relative select-none font-sans rounded-2xl"
      style={{
        width: 1180,
        height: 740,
        background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 35%, #94a3b8 70%, #cbd5e1 100%)',
        padding: '16px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.7), inset 0 2px 3px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.4)',
        border: '1px solid #64748b',
      }}
    >
      {/* 4 Black Corner Brackets with Countersunk Screws */}
      <div className="absolute top-0 left-0 w-8 h-8 rounded-tl-2xl bg-[#1e293b] border-r border-b border-neutral-700 shadow flex items-center justify-center z-20">
        <div className="w-3 h-3 rounded-full bg-neutral-400 border border-neutral-600 flex items-center justify-center shadow-inner">
          <div className="w-1.5 h-0.5 bg-neutral-700" />
        </div>
      </div>
      <div className="absolute top-0 right-0 w-8 h-8 rounded-tr-2xl bg-[#1e293b] border-l border-b border-neutral-700 shadow flex items-center justify-center z-20">
        <div className="w-3 h-3 rounded-full bg-neutral-400 border border-neutral-600 flex items-center justify-center shadow-inner">
          <div className="w-1.5 h-0.5 bg-neutral-700" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-8 h-8 rounded-bl-2xl bg-[#1e293b] border-r border-t border-neutral-700 shadow flex items-center justify-center z-20">
        <div className="w-3 h-3 rounded-full bg-neutral-400 border border-neutral-600 flex items-center justify-center shadow-inner">
          <div className="w-1.5 h-0.5 bg-neutral-700" />
        </div>
      </div>
      <div className="absolute bottom-0 right-0 w-8 h-8 rounded-br-2xl bg-[#1e293b] border-l border-t border-neutral-700 shadow flex items-center justify-center z-20">
        <div className="w-3 h-3 rounded-full bg-neutral-400 border border-neutral-600 flex items-center justify-center shadow-inner">
          <div className="w-1.5 h-0.5 bg-neutral-700" />
        </div>
      </div>

      {/* Floating Grip Handle & Close Button */}
      <div className="absolute top-1 right-10 flex items-center gap-1 z-30">
        <div
          onPointerDown={onDragStart}
          className="p-1 rounded-md bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-grab active:cursor-grabbing transition-colors"
          title="اسحب البورد لتحريكه بحرية"
        >
          <GripHorizontal className="w-4 h-4" />
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md bg-neutral-800/60 hover:bg-red-600 text-neutral-300 hover:text-white transition-colors"
          title="إغلاق البورد"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ====================================================================
          MAIN MONOLITHIC WHITE LAB MELAMINE FACEPLATE (NO CARD BOXES!)
         ==================================================================== */}
      <div
        className="w-full h-full relative rounded-lg overflow-hidden flex flex-col justify-between"
        style={{
          background: 'radial-gradient(circle at 50% 30%, #fbfbfa 0%, #f5f4ef 80%, #ebe8df 100%)',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.25), inset 0 -1px 2px rgba(255,255,255,0.8)',
          padding: '16px 24px 14px 24px',
        }}
      >
        {/* Top Header Row */}
        <div className="w-full flex items-center justify-between pb-1.5 border-b border-blue-900/15">
          <h1
            className="text-[20px] tracking-[0.12em] font-black uppercase text-[#0d3b82]"
            style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
          >
            ELECTRONICS EXPERIMENTS TRAINING BOARD
          </h1>
          <span
            className="text-[15px] tracking-[0.08em] font-black uppercase text-[#0d3b82]"
            style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
          >
            COMPUTER ENGINEERING TECHNIQUES
          </span>
        </div>

        {/* Central Workspace (3 Visual Columns) */}
        <div className="flex-1 grid grid-cols-12 gap-2 mt-2 items-start">

          {/* -------------------------------------------------------------
              LEFT SECTION:
              - Top Left: Fuse & AC Rocker Switch
              - Capacitors (7 rows x 2 cols)
              - Inductors (3 rows x 2 cols)
              - Power Supply Rails (12V AC, 5VDC, 12V DC, 0V COM)
             ------------------------------------------------------------- */}
          <div className="col-span-4 flex flex-col justify-between h-[585px] pr-2 border-r border-blue-900/10">
            {/* Top Left: Fuse & AC Power Switch */}
            <div className="flex items-center gap-3 mb-1">
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-[#111827] border-2 border-neutral-700 shadow-md flex items-center justify-center">
                  <span className="text-[6.5px] font-mono text-neutral-400 font-bold">FUSE</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    labAudio.playPowerToggle(!acPowerOn);
                    setAcPowerOn(!acPowerOn);
                  }}
                  className={`w-12 h-6 rounded px-1 flex items-center transition-colors shadow-inner border border-neutral-800 ${
                    acPowerOn ? 'bg-red-600 justify-end' : 'bg-neutral-800 justify-start'
                  }`}
                  title="مفتاح الطاقة المتناوبة AC"
                >
                  <div className="w-5 h-4 bg-white rounded-sm shadow" />
                </button>
                <div className="text-[9px] font-serif font-black text-[#0d3b82]">
                  <div>{acPowerOn ? 'ON' : 'OFF'}</div>
                  <div>AC</div>
                </div>
              </div>
            </div>

            {/* Capacitors (6 rows x 2 cols) */}
            <div className="flex flex-col gap-[7px]">
              {/* Row 1: 0.001uF | 0.005uF */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('C_001u_1:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">0.001uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="1" x2="24" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_001u_1:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('C_005u:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">0.005uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="1" x2="24" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_005u:b', 'red')}
                </div>
              </div>

              {/* Row 2: 0.001uF | 0.2uF */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('C_001u_2:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">0.001uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="1" x2="24" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_001u_2:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('C_02u:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">0.2uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="1" x2="24" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_02u:b', 'red')}
                </div>
              </div>

              {/* Row 3: 0.01uF | 1uF */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('C_01u_1:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">0.01uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="1" x2="24" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_01u_1:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('C_1u:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">1uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="1" x2="24" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_1u:b', 'red')}
                </div>
              </div>

              {/* Row 4: 0.01uF | 47uF (Electrolytic) */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('C_01u_2:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">0.01uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="1" x2="24" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_01u_2:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('C_47u:pos', 'black')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">47uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <path d="M 24,1 Q 20,6 24,11" fill="none" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_47u:neg', 'red')}
                </div>
              </div>

              {/* Row 5: 0.1uF | 470uF (Electrolytic) */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('C_1u_1:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">0.1uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="1" x2="24" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_1u_1:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('C_470u:pos', 'black')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">470uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <path d="M 24,1 Q 20,6 24,11" fill="none" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_470u:neg', 'red')}
                </div>
              </div>

              {/* Row 6: 0.1uF | 1000uF (Electrolytic) */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('C_1u_2:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">0.1uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="1" x2="24" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_1u_2:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('C_1000u:pos', 'black')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">1000uF</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="18" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="18" y1="1" x2="18" y2="11" stroke="#0d3b82" strokeWidth="2.2" />
                      <path d="M 24,1 Q 20,6 24,11" fill="none" stroke="#0d3b82" strokeWidth="2.2" />
                      <line x1="24" y1="6" x2="42" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('C_1000u:neg', 'red')}
                </div>
              </div>
            </div>

            {/* Inductors (3 rows x 2 cols) */}
            <div className="flex flex-col gap-[7px] pt-1 border-t border-blue-900/15">
              {/* Row 7: 5mH | 5mH */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('L_5mH_1:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">5mH</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="6" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <path d="M 6,6 Q 10.5,-1 15,6 Q 19.5,-1 24,6 Q 28.5,-1 33,6 Q 37.5,-1 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('L_5mH_1:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('L_5mH_2:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">5mH</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="6" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <path d="M 6,6 Q 10.5,-1 15,6 Q 19.5,-1 24,6 Q 28.5,-1 33,6 Q 37.5,-1 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('L_5mH_2:b', 'red')}
                </div>
              </div>

              {/* Row 8: 10mH | 10mH */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('L_10mH_1:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">10mH</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="6" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <path d="M 6,6 Q 10.5,-1 15,6 Q 19.5,-1 24,6 Q 28.5,-1 33,6 Q 37.5,-1 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('L_10mH_1:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('L_10mH_2:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">10mH</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="6" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <path d="M 6,6 Q 10.5,-1 15,6 Q 19.5,-1 24,6 Q 28.5,-1 33,6 Q 37.5,-1 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('L_10mH_2:b', 'red')}
                </div>
              </div>

              {/* Row 9: 20mH | 20mH */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('L_20mH_1:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">20mH</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="6" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <path d="M 6,6 Q 10.5,-1 15,6 Q 19.5,-1 24,6 Q 28.5,-1 33,6 Q 37.5,-1 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('L_20mH_1:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('L_20mH_2:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">20mH</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <line x1="0" y1="6" x2="6" y2="6" stroke="#0d3b82" strokeWidth="1.8" />
                      <path d="M 6,6 Q 10.5,-1 15,6 Q 19.5,-1 24,6 Q 28.5,-1 33,6 Q 37.5,-1 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('L_20mH_2:b', 'red')}
                </div>
              </div>
            </div>

            {/* Row 10: Transformer & Power Supply Terminals */}
            <div className="flex items-center justify-between pt-1 border-t border-blue-900/15">
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <span className="text-[7.5px] font-mono font-bold text-[#0d3b82]">12V AC</span>
                  {renderSocket('PWR:ac12_1', 'red')}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[7.5px] font-mono font-bold text-[#0d3b82]">5VDC</span>
                  {renderSocket('PWR:p5v', 'red')}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[7.5px] font-mono font-bold text-[#0d3b82]">12V DC</span>
                  {renderSocket('PWR:p12v', 'red')}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[7.5px] font-mono font-bold text-[#0d3b82]">0V</span>
                  {renderSocket('PWR:gnd', 'black')}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[7.5px] font-mono font-bold text-[#0d3b82]">0V</span>
                  <div className="w-[20px] h-[20px] rounded-full bg-[#1e293b] border-2 border-neutral-600 shadow-inner" />
                </div>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------------
              CENTER SECTION:
              - Authentic J0409 Galvanometer Housing (-30 to +30)
              - Diodes & Bridge Rectifiers
              - Transistors (NPN, PNP, NFET, PFET)
              - Operational Amplifiers (LM741)
              - Knife Switches
             ------------------------------------------------------------- */}
          <div className="col-span-4 flex flex-col justify-between h-[585px] px-2 border-r border-blue-900/10">
            {/* Authentic J0409 Galvanometer Enclosure */}
            <div className="flex flex-col items-center">
              <div
                className="relative w-[210px] h-[145px] rounded-[10px] p-2 flex flex-col items-center justify-between"
                style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 70%, #cbd5e1 100%)',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.3)',
                  border: '2px solid #64748b',
                }}
              >
                {/* Clear Acrylic Dial Housing with Curved Scale */}
                <div className="relative w-full h-[95px] rounded-[6px] bg-white overflow-hidden flex flex-col items-center justify-between border border-neutral-300 shadow-inner">
                  <svg viewBox="0 0 200 90" className="w-full h-full overflow-visible">
                    {/* Scale Arc Line */}
                    <path d="M 35,68 A 75,75 0 0,1 165,68" fill="none" stroke="#1e293b" strokeWidth="1.2" />

                    {/* Scale Division Ticks: -30, -20, -10, 0, 10, 20, 30 */}
                    {[-30, -20, -10, 0, 10, 20, 30].map((val) => {
                      const angleRad = ((val / 30) * 40 - 90) * (Math.PI / 180);
                      const x1 = 100 + 74 * Math.cos(angleRad);
                      const y1 = 82 + 74 * Math.sin(angleRad);
                      const x2 = 100 + 64 * Math.cos(angleRad);
                      const y2 = 82 + 64 * Math.sin(angleRad);
                      const tx = 100 + 52 * Math.cos(angleRad);
                      const ty = 82 + 52 * Math.sin(angleRad) + 3;
                      return (
                        <g key={val}>
                          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f172a" strokeWidth="1.2" />
                          <text x={tx} y={ty} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#0f172a" fontFamily="'Times New Roman', serif">
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* Galvanometer 'G' Symbol */}
                    <text x="100" y="46" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#0d3b82" fontFamily="'Times New Roman', serif">
                      G
                    </text>

                    {/* J0409 and 2.5 marks */}
                    <text x="50" y="76" fontSize="6" fontWeight="bold" fill="#475569" fontFamily="monospace">J0409</text>
                    <text x="145" y="76" fontSize="6.5" fontWeight="bold" fill="#475569" fontFamily="monospace">⏦2.5</text>

                    {/* Dynamic Pointer Needle */}
                    <g style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: '100px 82px', transition: 'transform 120ms cubic-bezier(0.2, 0.8, 0.4, 1)' }}>
                      <line x1="100" y1="82" x2="100" y2="10" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
                      <circle cx="100" cy="82" r="3.2" fill="#0f172a" />
                    </g>
                  </svg>
                </div>

                {/* Bottom Terminal Block: [-], G0 (100Ω), G1 (2.4K) */}
                <div className="w-full bg-[#1e293b] rounded-[5px] px-2 py-1 flex items-center justify-between border border-neutral-700 shadow-md">
                  <div className="flex items-center gap-1">
                    {renderSocket('GALV:neg', 'black', 'Galvanometer (-) Terminal')}
                    <span className="text-[7.5px] font-mono text-white font-bold">[-]</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] font-mono text-neutral-300">100Ω</span>
                    {renderSocket('GALV:g0', 'black', 'G0 Terminal (100Ω internal)')}
                    <span className="text-[7.5px] font-mono text-white font-bold">G0</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] font-mono text-neutral-300">2.4K</span>
                    {renderSocket('GALV:g1', 'red', 'G1 (+) Terminal (2.4K internal)')}
                    <span className="text-[7.5px] font-mono text-red-400 font-bold">G1</span>
                  </div>
                </div>
              </div>

              {/* Diodes & Bridge Rectifiers directly beside/under Galvanometer */}
              <div className="w-full flex items-center justify-around mt-2">
                {/* Diode 1 */}
                <div className="flex flex-col items-center">
                  {renderSocket('D1:a', 'red')}
                  <svg width="12" height="24" viewBox="0 0 12 24" className="my-0.5">
                    <line x1="6" y1="0" x2="6" y2="8" stroke="#0d3b82" strokeWidth="1.8" />
                    <polygon points="1,8 11,8 6,16" fill="#0d3b82" stroke="#0d3b82" strokeWidth="1" />
                    <line x1="1" y1="16" x2="11" y2="16" stroke="#0d3b82" strokeWidth="2" />
                    <line x1="6" y1="16" x2="6" y2="24" stroke="#0d3b82" strokeWidth="1.8" />
                  </svg>
                  {renderSocket('D1:k', 'red')}
                </div>

                {/* Bridge Rectifier */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[8px] font-serif font-bold text-[#0d3b82]">AC</span>
                    {renderSocket('BR:ac1', 'red')}
                  </div>
                  <div className="flex items-center justify-between w-[85px]">
                    <div className="flex items-center gap-0.5">
                      {renderSocket('BR:neg', 'red')}
                      <span className="text-[8.5px] font-bold text-[#0d3b82]">−</span>
                    </div>
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <polygon points="12,1 23,12 12,23 1,12" fill="none" stroke="#0d3b82" strokeWidth="1.6" />
                      <circle cx="12" cy="12" r="1.8" fill="#0d3b82" />
                    </svg>
                    <div className="flex items-center gap-0.5">
                      <span className="text-[8.5px] font-bold text-[#0d3b82]">+</span>
                      {renderSocket('BR:pos', 'red')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[8px] font-serif font-bold text-[#0d3b82]">AC</span>
                    {renderSocket('BR:ac2', 'red')}
                  </div>
                </div>

                {/* Diode 2 */}
                <div className="flex flex-col items-center">
                  {renderSocket('D2:a', 'red')}
                  <svg width="12" height="24" viewBox="0 0 12 24" className="my-0.5">
                    <line x1="6" y1="0" x2="6" y2="8" stroke="#0d3b82" strokeWidth="1.8" />
                    <polygon points="1,8 11,8 6,16" fill="#0d3b82" stroke="#0d3b82" strokeWidth="1" />
                    <line x1="1" y1="16" x2="11" y2="16" stroke="#0d3b82" strokeWidth="2" />
                    <line x1="6" y1="16" x2="6" y2="24" stroke="#0d3b82" strokeWidth="1.8" />
                  </svg>
                  {renderSocket('D2:k', 'red')}
                </div>
              </div>
            </div>

            {/* Transistors (BJT & FET) */}
            <div className="flex flex-col gap-2 pt-1 border-t border-blue-900/15">
              {/* BJTs: NPN & PNP */}
              <div className="grid grid-cols-2 gap-3 items-center">
                {/* NPN */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col items-center">
                    <span className="text-[7.5px] font-bold text-[#0d3b82]">B</span>
                    {renderSocket('Q_NPN1:b', 'red')}
                  </div>
                  <svg width="34" height="28" viewBox="0 0 34 28">
                    <line x1="0" y1="14" x2="12" y2="14" stroke="#0d3b82" strokeWidth="1.8" />
                    <line x1="12" y1="5" x2="12" y2="23" stroke="#0d3b82" strokeWidth="2.2" />
                    <line x1="12" y1="8" x2="26" y2="2" stroke="#0d3b82" strokeWidth="1.8" />
                    <line x1="12" y1="20" x2="26" y2="26" stroke="#0d3b82" strokeWidth="1.8" />
                    <polygon points="21,20 26,26 19,25" fill="#0d3b82" />
                  </svg>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[7.5px] font-bold text-[#0d3b82]">C</span>
                      {renderSocket('Q_NPN1:c', 'red')}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[7.5px] font-bold text-[#0d3b82]">E</span>
                      {renderSocket('Q_NPN1:e', 'red')}
                    </div>
                  </div>
                </div>

                {/* PNP */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col items-center">
                    <span className="text-[7.5px] font-bold text-[#0d3b82]">B</span>
                    {renderSocket('Q_PNP1:b', 'red')}
                  </div>
                  <svg width="34" height="28" viewBox="0 0 34 28">
                    <line x1="0" y1="14" x2="12" y2="14" stroke="#0d3b82" strokeWidth="1.8" />
                    <line x1="12" y1="5" x2="12" y2="23" stroke="#0d3b82" strokeWidth="2.2" />
                    <line x1="12" y1="8" x2="26" y2="2" stroke="#0d3b82" strokeWidth="1.8" />
                    <line x1="12" y1="20" x2="26" y2="26" stroke="#0d3b82" strokeWidth="1.8" />
                    <polygon points="17,16 12,20 18,22" fill="#0d3b82" />
                  </svg>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[7.5px] font-bold text-[#0d3b82]">C</span>
                      {renderSocket('Q_PNP1:c', 'red')}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[7.5px] font-bold text-[#0d3b82]">E</span>
                      {renderSocket('Q_PNP1:e', 'red')}
                    </div>
                  </div>
                </div>
              </div>

              {/* FETs: NFET & PFET */}
              <div className="grid grid-cols-2 gap-3 items-center">
                {/* NFET */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col items-center">
                    <span className="text-[7.5px] font-bold text-[#0d3b82]">G</span>
                    {renderSocket('Q_NFET:g', 'red')}
                  </div>
                  <svg width="34" height="28" viewBox="0 0 34 28">
                    <line x1="0" y1="18" x2="12" y2="18" stroke="#0d3b82" strokeWidth="1.8" />
                    <line x1="12" y1="5" x2="12" y2="23" stroke="#0d3b82" strokeWidth="2.2" />
                    <line x1="17" y1="5" x2="17" y2="23" stroke="#0d3b82" strokeWidth="2.2" />
                    <line x1="17" y1="7" x2="28" y2="7" stroke="#0d3b82" strokeWidth="1.8" />
                    <line x1="17" y1="21" x2="28" y2="21" stroke="#0d3b82" strokeWidth="1.8" />
                  </svg>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[7.5px] font-bold text-[#0d3b82]">D</span>
                      {renderSocket('Q_NFET:d', 'red')}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[7.5px] font-bold text-[#0d3b82]">S</span>
                      {renderSocket('Q_NFET:s', 'red')}
                    </div>
                  </div>
                </div>

                {/* PFET */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col items-center">
                    <span className="text-[7.5px] font-bold text-[#0d3b82]">G</span>
                    {renderSocket('Q_PFET:g', 'red')}
                  </div>
                  <svg width="34" height="28" viewBox="0 0 34 28">
                    <line x1="0" y1="18" x2="12" y2="18" stroke="#0d3b82" strokeWidth="1.8" />
                    <line x1="12" y1="5" x2="12" y2="23" stroke="#0d3b82" strokeWidth="2.2" />
                    <line x1="17" y1="5" x2="17" y2="23" stroke="#0d3b82" strokeWidth="2.2" />
                    <line x1="17" y1="7" x2="28" y2="7" stroke="#0d3b82" strokeWidth="1.8" />
                    <line x1="17" y1="21" x2="28" y2="21" stroke="#0d3b82" strokeWidth="1.8" />
                  </svg>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[7.5px] font-bold text-[#0d3b82]">D</span>
                      {renderSocket('Q_PFET:d', 'red')}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[7.5px] font-bold text-[#0d3b82]">S</span>
                      {renderSocket('Q_PFET:s', 'red')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dual LM741 Operational Amplifiers */}
              <div className="flex items-center justify-between px-4 pt-1 border-t border-blue-900/15">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] font-bold text-[#0d3b82]">IN−</span>
                    {renderSocket('OP1:in_n', 'red')}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] font-bold text-[#0d3b82]">IN+</span>
                    {renderSocket('OP1:in_p', 'red')}
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] font-bold text-[#0d3b82]">+VCC</span>
                    {renderSocket('OP1:vcc_p', 'red')}
                  </div>
                  {/* LM741 Triangle */}
                  <svg width="36" height="24" viewBox="0 0 36 24">
                    <polygon points="2,1 32,12 2,23" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    <text x="12" y="15" fontSize="7" fontWeight="bold" fill="#0d3b82">LM741</text>
                  </svg>
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] font-bold text-[#0d3b82]">−VCC</span>
                    {renderSocket('OP1:vcc_n', 'black')}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {renderSocket('OP1:out', 'red')}
                  <span className="text-[7px] font-bold text-[#0d3b82]">O/P</span>
                </div>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------------
              RIGHT SECTION:
              - 18-Resistor Matrix (9 rows x 2 cols)
              - 555 Timer IC block (8 pins)
              - 3 Rotary Potentiometers (5k, 100k, 1M)
             ------------------------------------------------------------- */}
          <div className="col-span-4 flex flex-col justify-between h-[585px] pl-2">
            {/* 18-Resistor Matrix */}
            <div className="flex flex-col gap-[7px]">
              {/* Row 1: 5K Ω | 50 Ω */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('R_5k_1:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">5K Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_5k_1:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('R_50:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">50 Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_50:b', 'red')}
                </div>
              </div>

              {/* Row 2: 10K Ω | 100 Ω */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('R_10k_1:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">10K Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_10k_1:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('R_100:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">100 Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_100:b', 'red')}
                </div>
              </div>

              {/* Row 3: 10K Ω | 220 Ω */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('R_10k_2:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">10K Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_10k_2:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('R_220:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">220 Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_220:b', 'red')}
                </div>
              </div>

              {/* Row 4: 50K Ω | 470 Ω */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('R_50k:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">50K Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_50k:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('R_470:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">470 Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_470:b', 'red')}
                </div>
              </div>

              {/* Row 5: 100K Ω | 560 Ω */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('R_100k:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">100K Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_100k:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('R_560:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">560 Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_560:b', 'red')}
                </div>
              </div>

              {/* Row 6: 200K Ω | 1K Ω */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center justify-between">
                  {renderSocket('R_200k_1:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">200K Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_200k_1:b', 'red')}
                </div>
                <div className="flex items-center justify-between">
                  {renderSocket('R_1k_1:a', 'red')}
                  <div className="flex flex-col items-center mx-1">
                    <span className="text-[9px] font-bold font-serif text-[#0d3b82] leading-none mb-0.5">1K Ω</span>
                    <svg width="42" height="12" viewBox="0 0 42 12">
                      <path d="M 0,6 L 6,6 L 10,1 L 15,11 L 20,1 L 25,11 L 30,1 L 34,11 L 37,6 L 42,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                    </svg>
                  </div>
                  {renderSocket('R_1k_1:b', 'red')}
                </div>
              </div>
            </div>

            {/* 555 Timer IC Block */}
            <div className="flex flex-col items-center py-1 border-t border-blue-900/15">
              <span className="text-[9px] font-serif font-black text-[#0d3b82] mb-1">555 TIMER IC</span>
              {/* Top pins: 8, 7, 6, 5 */}
              <div className="flex items-center gap-3 mb-1">
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-bold text-[#0d3b82]">8</span>
                  {renderSocket('IC555:pin8', 'red')}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-bold text-[#0d3b82]">7</span>
                  {renderSocket('IC555:pin7', 'red')}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-bold text-[#0d3b82]">6</span>
                  {renderSocket('IC555:pin6', 'red')}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-bold text-[#0d3b82]">5</span>
                  {renderSocket('IC555:pin5', 'red')}
                </div>
              </div>

              {/* 555 Package Outline */}
              <div className="w-[120px] h-[16px] bg-[#0f172a] rounded-sm flex items-center justify-center shadow">
                <span className="text-[9px] font-mono font-bold text-neutral-300">NE555P</span>
              </div>

              {/* Bottom pins: 1, 2, 3, 4 */}
              <div className="flex items-center gap-3 mt-1">
                <div className="flex flex-col items-center">
                  {renderSocket('IC555:pin1', 'black')}
                  <span className="text-[7px] font-bold text-[#0d3b82]">1</span>
                </div>
                <div className="flex flex-col items-center">
                  {renderSocket('IC555:pin2', 'red')}
                  <span className="text-[7px] font-bold text-[#0d3b82]">2</span>
                </div>
                <div className="flex flex-col items-center">
                  {renderSocket('IC555:pin3', 'red')}
                  <span className="text-[7px] font-bold text-[#0d3b82]">3</span>
                </div>
                <div className="flex flex-col items-center">
                  {renderSocket('IC555:pin4', 'red')}
                  <span className="text-[7px] font-bold text-[#0d3b82]">4</span>
                </div>
              </div>
            </div>

            {/* Bottom: 3 Physical Rotary Potentiometers (5K, 100K, 1M) */}
            <div className="flex items-end justify-between px-1 pt-2 border-t border-blue-900/15">
              {/* Pot 1: 0 ➔ 5K Ω */}
              <div className="flex flex-col items-center">
                {renderPhysicalKnob('pot5k', internalPot5k, 'Potentiometer 5kΩ', 'black-red-cap')}
                <div className="flex items-center gap-1.5 mt-1">
                  {renderSocket('POT_5k:1', 'red')}
                  <div className="flex flex-col items-center">
                    <svg width="34" height="12" viewBox="0 0 34 12">
                      <path d="M 0,6 L 4,6 L 8,1 L 13,11 L 18,1 L 23,11 L 27,1 L 30,6 L 34,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="17" y1="12" x2="17" y2="4" stroke="#0d3b82" strokeWidth="1.6" />
                      <polygon points="14,6 17,2 20,6" fill="#0d3b82" />
                    </svg>
                    {renderSocket('POT_5k:w', 'red')}
                  </div>
                  {renderSocket('POT_5k:3', 'red')}
                </div>
                <span className="text-[8.5px] font-serif font-bold text-[#0d3b82] mt-0.5">
                  0 ➔ 5K Ω
                </span>
              </div>

              {/* Pot 2: 0 ➔ 100K Ω */}
              <div className="flex flex-col items-center">
                {renderPhysicalKnob('pot100k', internalPot100k, 'Potentiometer 100kΩ', 'knurled-silver')}
                <div className="flex items-center gap-1.5 mt-1">
                  {renderSocket('POT_100k:1', 'red')}
                  <div className="flex flex-col items-center">
                    <svg width="34" height="12" viewBox="0 0 34 12">
                      <path d="M 0,6 L 4,6 L 8,1 L 13,11 L 18,1 L 23,11 L 27,1 L 30,6 L 34,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="17" y1="12" x2="17" y2="4" stroke="#0d3b82" strokeWidth="1.6" />
                      <polygon points="14,6 17,2 20,6" fill="#0d3b82" />
                    </svg>
                    {renderSocket('POT_100k:w', 'red')}
                  </div>
                  {renderSocket('POT_100k:3', 'red')}
                </div>
                <span className="text-[8.5px] font-serif font-bold text-[#0d3b82] mt-0.5">
                  0 ➔ 100K Ω
                </span>
              </div>

              {/* Pot 3: 0 ➔ 1M Ω */}
              <div className="flex flex-col items-center">
                {renderPhysicalKnob('pot1M', internalPot1M, 'Potentiometer 1MΩ', 'black-red-cap')}
                <div className="flex items-center gap-1.5 mt-1">
                  {renderSocket('POT_1M:1', 'red')}
                  <div className="flex flex-col items-center">
                    <svg width="34" height="12" viewBox="0 0 34 12">
                      <path d="M 0,6 L 4,6 L 8,1 L 13,11 L 18,1 L 23,11 L 27,1 L 30,6 L 34,6" fill="none" stroke="#0d3b82" strokeWidth="1.8" />
                      <line x1="17" y1="12" x2="17" y2="4" stroke="#0d3b82" strokeWidth="1.6" />
                      <polygon points="14,6 17,2 20,6" fill="#0d3b82" />
                    </svg>
                    {renderSocket('POT_1M:w', 'red')}
                  </div>
                  {renderSocket('POT_1M:3', 'red')}
                </div>
                <span className="text-[8.5px] font-serif font-bold text-[#0d3b82] mt-0.5">
                  0 ➔ 1M Ω
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer: University & College Title */}
        <div className="w-full flex items-end justify-between pt-2 border-t border-blue-900/15">
          <span
            className="text-[13px] font-black tracking-wider uppercase text-[#0d3b82]"
            style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
          >
            ELECTRICAL AND ELECTRONIC TECHNICAL COLLEGE
          </span>
          <span
            className="text-[11px] font-bold tracking-wider uppercase text-[#0d3b82]/80"
            style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
          >
            EXPERIMENT BOARD • MODEL ET-01
          </span>
        </div>
      </div>
    </div>
  );
};
