import React from 'react';
import { PowerSupplyState, Port } from '../types/lab';
import { SevenSegmentDisplay } from '../components/SevenSegment';
import { Knob } from '../components/Knob';
import { PortJack } from '../components/PortJack';
import { labAudio } from '../utils/audio';
import { X } from 'lucide-react';

interface PowerSupplyProps {
  state: PowerSupplyState;
  onStateChange: (updater: (prev: PowerSupplyState) => PowerSupplyState) => void;
  ports: Port[];
  connectedPortIds: Set<string>;
  wiringSourcePort: Port | null;
  onPortClick: (port: Port) => void;
  onClose?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}

/**
 * ATTEN APS3005S / APS3005Si — Single-output Regulated DC Power Supply (0–30 V, 0–5 A).
 * Faithful reproduction of real physical bench unit:
 * - Decoupled independent Coarse and Fine potentiometers (moving coarse NEVER rotates fine!)
 * - Accurate 4-digit current (A) and 3-digit voltage (V) red LED seven-segment displays
 * - Red A and V indicators, C.C. (Constant Current) and C.V. (Constant Voltage) status LEDs
 * - Authentic hardware styling with red capsule banners, fluted knobs, power rocker switch,
 *   and three distinct banana binding posts (-, GND, +).
 */
export const PowerSupply: React.FC<PowerSupplyProps> = ({
  state,
  onStateChange,
  ports,
  connectedPortIds,
  wiringSourcePort,
  onPortClick,
  onClose,
  onDragStart,
}) => {
  const handleTogglePower = () => {
    labAudio.playPowerToggle(!state.power);
    onStateChange((prev) => {
      const next = !prev.power;
      return { ...prev, power: next, outputEnabled: next };
    });
  };

  // Resolve independent coarse and fine knob positions
  // Voltage: Coarse (0 to 30V in 1V steps), Fine (0 to 1.0V in 0.02V steps)
  const vCoarse = state.vCoarse !== undefined
    ? state.vCoarse
    : Math.min(30, Math.floor(state.voltageSet));
  const vFine = state.vFine !== undefined
    ? state.vFine
    : Math.max(0, Math.min(1.0, +(state.voltageSet - vCoarse).toFixed(2)));

  // Current: Coarse (0.1 to 5.0A in 0.1A steps), Fine (0 to 0.2A in 0.01A steps)
  const iCoarse = state.iCoarse !== undefined
    ? state.iCoarse
    : Math.min(5, Math.floor(state.currentLimit * 10) / 10);
  const iFine = state.iFine !== undefined
    ? state.iFine
    : Math.max(0, Math.min(0.2, +(state.currentLimit - iCoarse).toFixed(3)));

  const handleVoltageCoarseChange = (newCoarse: number) => {
    onStateChange((prev) => {
      const curFine = prev.vFine !== undefined ? prev.vFine : vFine;
      const combined = Math.min(30, Math.max(0, +(newCoarse + curFine).toFixed(2)));
      return {
        ...prev,
        vCoarse: newCoarse,
        voltageSet: combined,
      };
    });
  };

  const handleVoltageFineChange = (newFine: number) => {
    onStateChange((prev) => {
      const curCoarse = prev.vCoarse !== undefined ? prev.vCoarse : vCoarse;
      const combined = Math.min(30, Math.max(0, +(curCoarse + newFine).toFixed(2)));
      return {
        ...prev,
        vFine: newFine,
        voltageSet: combined,
      };
    });
  };

  const handleCurrentCoarseChange = (newCoarse: number) => {
    onStateChange((prev) => {
      const curFine = prev.iFine !== undefined ? prev.iFine : iFine;
      const combined = Math.min(5, Math.max(0.01, +(newCoarse + curFine).toFixed(3)));
      return {
        ...prev,
        iCoarse: newCoarse,
        currentLimit: combined,
      };
    });
  };

  const handleCurrentFineChange = (newFine: number) => {
    onStateChange((prev) => {
      const curCoarse = prev.iCoarse !== undefined ? prev.iCoarse : iCoarse;
      const combined = Math.min(5, Math.max(0.01, +(curCoarse + newFine).toFixed(3)));
      return {
        ...prev,
        iFine: newFine,
        currentLimit: combined,
      };
    });
  };

  // Formatted readouts matching real ATTEN APS3005S/Si LED displays
  const iDisplay = state.power ? Math.max(0, state.currentActual).toFixed(3) : 'OFF';
  const vDisplay = state.power ? Math.max(0, state.voltageActual).toFixed(1) : 'OFF';

  const posPort = ports.find((p) => p.id === 'psu:pos' || p.id.endsWith(':pos'));
  const negPort = ports.find((p) => p.id === 'psu:neg' || p.id.endsWith(':neg'));
  const gndPort = ports.find((p) => p.id === 'psu:gnd' || p.id.endsWith(':gnd'));

  const isCv = state.power && state.mode === 'CV';
  const isCc = state.power && state.mode === 'CC';

  const renderTerminal = (port: Port | undefined, label: string, labelColor: string) => {
    if (!port) return null;
    const connected = connectedPortIds.has(port.id);
    const selected = wiringSourcePort?.id === port.id;
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="p-0.5 bg-[#1a1b1e] rounded-full border border-neutral-400 shadow-md flex items-center justify-center">
          <PortJack
            port={port}
            connectedCount={connected ? 1 : 0}
            isSelectedForWiring={selected}
            onPortClick={onPortClick}
            hideLabel={true}
          />
        </div>
        <span className="text-[10px] font-black font-mono leading-none tracking-tight" style={{ color: labelColor }}>
          {label}
        </span>
      </div>
    );
  };

  return (
    <div
      data-psu
      data-psu-power={state.power ? 'on' : 'off'}
      data-psu-mode={state.mode}
      data-psu-v={state.voltageActual.toFixed(2)}
      data-psu-i={state.currentActual.toFixed(3)}
      className="relative select-none text-slate-800 font-sans w-[370px]"
    >
      {/* Ivory/Cream Industrial Metal Cabinet */}
      <div className="group relative rounded-[20px] border-2 border-[#d5cec0] bg-[linear-gradient(180deg,#faf8f2_0%,#f3eee4_45%,#e8e1d3_100%)] p-3 shadow-[0_28px_60px_rgba(0,0,0,0.65),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.2)]">
        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute right-2 top-2 z-20 flex h-4 w-4 items-center justify-center rounded text-[#8f887b] opacity-60 transition-opacity hover:bg-rose-700 hover:text-white hover:opacity-100"
            title="إخفاء مزود القدرة"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Top Metallic Nameplate Banner + Drag Handle (Accurate to Physical ATTEN APS3005S image.png) */}
        <div
          onPointerDown={onDragStart}
          style={{ touchAction: 'none' }}
          className="relative mx-auto flex h-[34px] w-[98%] cursor-grab items-center justify-between px-3.5 rounded-[7px] border border-[#2b0507] bg-gradient-to-b from-[#6b151b] via-[#4d0c12] to-[#340609] shadow-[inset_0_1px_1px_rgba(255,255,255,0.28),0_2px_5px_rgba(0,0,0,0.6)] active:cursor-grabbing hover:brightness-105 transition-all select-none"
          title="اسحب مزود القدرة من هنا (Drag power supply)"
        >
          {/* Brand Logo & Model */}
          <div className="flex items-center">
            <span className="text-[12.5px] font-black font-mono tracking-wider text-white drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.9)]">
              ATTEN
            </span>
            {/* Authentic Rosette / Star Logo Mark */}
            <span className="text-[9px] text-[#f87171] mx-1.5 drop-shadow">
              ❋
            </span>
            <span className="text-[12.5px] font-black font-mono tracking-wider text-[#f59e0b] drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.9)]">
              APS3005S
            </span>
          </div>

          {/* Subtitle text matching image.png exactly without any cluttered parentheses */}
          <div className="flex items-center">
            <span className="text-[9px] font-mono font-bold tracking-[0.14em] text-white/95 uppercase drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
              REGULATED DC POWER SUPPLY
            </span>
          </div>
        </div>

        {/* Black Recessed Front Control Panel */}
        <div className="relative mt-2 rounded-[12px] border-2 border-black bg-[linear-gradient(180deg,#19191d_0%,#0e0f12_40%,#08080a_100%)] p-3 shadow-[inset_0_3px_14px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.6)]">
          
          {/* Two Digital LED Display Windows */}
          <div className="grid grid-cols-2 gap-3 px-1">
            
            {/* Current Display (Left) */}
            <div className="flex flex-col items-center">
              <div className="flex h-[56px] w-full items-center justify-center rounded-[6px] border border-[#3b1214] bg-[#070505] shadow-[0_0_12px_rgba(220,38,38,0.2),inset_0_0_12px_#000]">
                <SevenSegmentDisplay
                  value={iDisplay}
                  digits={4}
                  color="red"
                  size="lg"
                  className="!border-0 !bg-transparent !px-0 !py-0 !shadow-none"
                />
              </div>

              {/* Unit indicator & C.C. Status */}
              <div className="mt-1.5 flex items-center justify-between w-full px-3">
                <div className="flex items-center space-x-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${state.power ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-red-950/60'}`} />
                  <span className="text-[7.5px] font-mono font-bold text-red-400">A</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-[7px] font-mono font-bold text-neutral-300">C.C.</span>
                  <span
                    className={`h-2 w-2 rounded-full border border-black/80 transition-all ${
                      isCc ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-red-950/40'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Voltage Display (Right) */}
            <div className="flex flex-col items-center">
              <div className="flex h-[56px] w-full items-center justify-center rounded-[6px] border border-[#3b1214] bg-[#070505] shadow-[0_0_12px_rgba(220,38,38,0.2),inset_0_0_12px_#000]">
                <SevenSegmentDisplay
                  value={vDisplay}
                  digits={4}
                  color="red"
                  size="lg"
                  className="!border-0 !bg-transparent !px-0 !py-0 !shadow-none"
                />
              </div>

              {/* Unit indicator & C.V. Status */}
              <div className="mt-1.5 flex items-center justify-between w-full px-3">
                <div className="flex items-center space-x-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${state.power ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-red-950/60'}`} />
                  <span className="text-[7.5px] font-mono font-bold text-red-400">V</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-[7px] font-mono font-bold text-neutral-300">C.V.</span>
                  <span
                    className={`h-2 w-2 rounded-full border border-black/80 transition-all ${
                      isCv ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-emerald-950/40'
                    }`}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Knobs Section: CURRENT (Left Pair) & VOLTAGE (Right Pair) */}
          <div className="mt-3.5 grid grid-cols-2 gap-3">
            
            {/* CURRENT Knob Pair */}
            <div className="flex flex-col items-center">
              {/* CURRENT Red Capsule Header */}
              <div className="mb-2 w-full h-[16px] rounded-[3px] border border-[#dc2626] bg-gradient-to-r from-[#991b1b] via-[#dc2626] to-[#991b1b] flex items-center justify-center shadow-sm">
                <span className="text-[7.5px] font-black font-mono tracking-widest text-white uppercase drop-shadow-sm">
                  CURRENT
                </span>
              </div>

              <div className="flex items-center justify-around w-full px-1">
                {/* COARSE Knob */}
                <div className="flex flex-col items-center">
                  <Knob
                    label="CURRENT COARSE"
                    color="atten"
                    size="md"
                    hideLabel
                    value={vCoarse === undefined ? 1.0 : iCoarse}
                    min={0.1}
                    max={5.0}
                    step={0.1}
                    formatValue={(v) => `${v.toFixed(1)}A`}
                    onChange={handleCurrentCoarseChange}
                  />
                  <span className="mt-1 text-[6.5px] font-mono font-black tracking-wider text-amber-500">
                    COARSE
                  </span>
                </div>

                {/* FINE Knob */}
                <div className="flex flex-col items-center">
                  <Knob
                    label="CURRENT FINE"
                    color="atten"
                    size="md"
                    hideLabel
                    value={iFine}
                    min={0}
                    max={0.2}
                    step={0.01}
                    formatValue={(v) => `+${v.toFixed(2)}A`}
                    onChange={handleCurrentFineChange}
                  />
                  <span className="mt-1 text-[6.5px] font-mono font-black tracking-wider text-amber-500">
                    FINE
                  </span>
                </div>
              </div>
            </div>

            {/* VOLTAGE Knob Pair */}
            <div className="flex flex-col items-center">
              {/* VOLTAGE Red Capsule Header */}
              <div className="mb-2 w-full h-[16px] rounded-[3px] border border-[#dc2626] bg-gradient-to-r from-[#991b1b] via-[#dc2626] to-[#991b1b] flex items-center justify-center shadow-sm">
                <span className="text-[7.5px] font-black font-mono tracking-widest text-white uppercase drop-shadow-sm">
                  VOLTAGE
                </span>
              </div>

              <div className="flex items-center justify-around w-full px-1">
                {/* COARSE Knob */}
                <div className="flex flex-col items-center">
                  <Knob
                    label="VOLTAGE COARSE"
                    color="atten"
                    size="md"
                    hideLabel
                    value={vCoarse}
                    min={0}
                    max={30}
                    step={1}
                    formatValue={(v) => `${v.toFixed(0)}V`}
                    onChange={handleVoltageCoarseChange}
                  />
                  <span className="mt-1 text-[6.5px] font-mono font-black tracking-wider text-amber-500">
                    COARSE
                  </span>
                </div>

                {/* FINE Knob */}
                <div className="flex flex-col items-center">
                  <Knob
                    label="VOLTAGE FINE"
                    color="atten"
                    size="md"
                    hideLabel
                    value={vFine}
                    min={0}
                    max={1.0}
                    step={0.02}
                    formatValue={(v) => `+${v.toFixed(2)}V`}
                    onChange={handleVoltageFineChange}
                  />
                  <span className="mt-1 text-[6.5px] font-mono font-black tracking-wider text-amber-500">
                    FINE
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Bottom Section: Power Rocker Switch + Output Terminals */}
        <div className="mt-2.5 flex items-center justify-between px-2">
          
          {/* White Mains Power Rocker Switch with Purple Bezel */}
          <div className="flex flex-col items-center">
            <button
              data-psu-switch
              type="button"
              onClick={handleTogglePower}
              className="relative h-[30px] w-[58px] rounded-[6px] border-2 border-[#4338ca] bg-[#eef2ff] p-[2px] shadow-[0_2px_6px_rgba(0,0,0,0.35),inset_0_1px_2px_rgba(0,0,0,0.2)] active:scale-95 transition-all"
              title="POWER — تشغيل/إطفاء مزود القدرة"
              aria-label="Power switch"
            >
              <span
                className={`absolute top-[2px] bottom-[2px] w-[26px] rounded-[4px] border border-[#94a3b8] bg-[linear-gradient(180deg,#ffffff_0%,#e2e8f0_60%,#cbd5e1_100%)] shadow-md transition-all flex items-center justify-center ${
                  state.power ? 'left-[2px]' : 'left-[26px]'
                }`}
              >
                <span className="w-1.5 h-3 bg-neutral-400/50 rounded-sm" />
              </span>
            </button>
            <span className="text-[6.5px] font-mono font-black text-neutral-600 tracking-wider mt-0.5">
              POWER
            </span>
          </div>

          {/* Three Protruding Output Terminals: Negative (-), GND, Positive (+) */}
          <div className="flex items-center space-x-4 pr-1">
            {renderTerminal(negPort, '−', '#1e293b')}
            {renderTerminal(gndPort, 'GND', '#16a34a')}
            {renderTerminal(posPort, '+', '#dc2626')}
          </div>

        </div>

      </div>
    </div>
  );
};

