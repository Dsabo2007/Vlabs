import React from 'react';
import { X, GripHorizontal } from 'lucide-react';
import { Port } from '../types/lab';
import { labAudio } from '../utils/audio';

interface Props {
  instanceId: string;
  ports: Port[];
  connectedPortIds: Set<string>;
  portConnectionCounts?: Map<string, number>;
  wiringSourcePort: Port | null;
  onPortClick: (port: Port) => void;
  onClose: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

/**
 * Passive & Active Filter trainer.
 * Layout coordinates below are expressed in the pixel space of the reference
 * photo (1280x578) and cropped to the board face with VB_X0/VB_W so that the
 * schematic, labels and sockets line up 1:1 with the real board.
 */
const VB_X0 = 262;
const VB_W = 848;
const VB_H = 578;
const INK = '#eceff3';

// ---- schematic symbol helpers (all return SVG path data) ----
const resV = (x: number, y: number) => `M${x} ${y} v4 l-6 3 l12 6 l-12 6 l12 6 l-12 6 l6 3 v4`;
const resHp = (x: number, y: number) => `M${x} ${y} h4 l3 -6 l6 12 l6 -12 l6 12 l6 -12 l3 6 h4`;
const capH = (x: number, y: number) => `M${x - 14} ${y} h14 M${x} ${y - 9} v18 M${x + 6} ${y - 9} v18 M${x + 6} ${y} h14`;
const coilH = (x: number, y: number) => `M${x} ${y} h4 a6 7 0 0 1 12 0 a6 7 0 0 1 12 0 a6 7 0 0 1 12 0 a6 7 0 0 1 12 0 h4`;
const coilV = (x: number, y: number) => `M${x} ${y} v4 a7 6 0 0 1 0 12 a7 6 0 0 1 0 12 a7 6 0 0 1 0 12 v4`;
const capV = (x: number, y: number) => `M${x} ${y} v12 M${x - 9} ${y + 12} h18 M${x - 9} ${y + 18} h18 M${x} ${y + 18} v12`;
const opamp = (tipX: number, tipY: number) => {
  const bx = tipX - 44;
  return `M${bx} ${tipY - 21} L${bx} ${tipY + 21} L${tipX} ${tipY} Z`;
};
const gnd = (x: number, y: number) => `M${x} ${y} v6 M${x - 8} ${y + 6} h16 M${x - 5} ${y + 10} h10 M${x - 2} ${y + 14} h4`;

const T: React.FC<{ x: number; y: number; children: React.ReactNode; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number }> =
  ({ x, y, children, size = 12, anchor = 'start', weight = 600 }) =>
    <text x={x} y={y} fill={INK} fontSize={size} fontWeight={weight} textAnchor={anchor} fontFamily="Arial, Helvetica, sans-serif">{children}</text>;

// Opamp with +/- marks, label and supply markers
const Op: React.FC<{ tipX: number; tipY: number; label: string; supply?: boolean; plusOnTop?: boolean }> = ({ tipX, tipY, label, supply, plusOnTop }) => {
  const bx = tipX - 44;
  return <g>
    <path d={opamp(tipX, tipY)} fill="none" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
    <text x={bx + 5} y={tipY - (plusOnTop ? -14 : 8)} fill={INK} fontSize="13" fontWeight="700">{plusOnTop ? '+' : '−'}</text>
    <text x={bx + 5} y={tipY + (plusOnTop ? -8 : 14)} fill={INK} fontSize="13" fontWeight="700">{plusOnTop ? '−' : '+'}</text>
    <T x={bx + 14} y={tipY + 36} size={11} weight={700}>{label}</T>
    {supply && <g>
      <T x={tipX + 6} y={tipY - 10} size={10.5}>+12V</T><path d={`M${tipX + 2} ${tipY - 6} v-10 m-3 4 l3 -5 l3 5`} stroke={INK} fill="none" strokeWidth="1.2" />
      <T x={tipX + 6} y={tipY + 28} size={10.5}>−12V</T><path d={`M${tipX + 2} ${tipY + 14} v10 m-3 -4 l3 5 l3 -5`} stroke={INK} fill="none" strokeWidth="1.2" />
    </g>}
  </g>;
};

export const FilterBoard: React.FC<Props> = ({ instanceId, ports, connectedPortIds, portConnectionCounts, wiringSourcePort, onPortClick, onClose, onDragStart }) => {
  /** Banana socket placed by photo-pixel coordinates. */
  const socket = (suffix: string, x: number, y: number, hole = false) => {
    const port = ports.find(p => p.id === `${instanceId}:${suffix}`);
    if (!port) return null;
    const connected = connectedPortIds.has(port.id);
    const source = wiringSourcePort?.id === port.id;
    const stacked = portConnectionCounts?.get(port.id) ?? 0;

    // Colour-code by section so inputs/outputs are readable on the blue PCB
    const isInput = /(^|_)in(_p|_n)?$/.test(suffix) || suffix.endsWith('_in');
    const isOutput = /(^|_)out(_p|_n)?$/.test(suffix) || suffix.endsWith('_out');
    const sectionColor = suffix.startsWith('lpf') ? '#22d3ee' : suffix.startsWith('hpf') ? '#fbbf24' : suffix.startsWith('bpf') ? '#c084fc' : '#cbd5e1';
    const roleColor = isInput ? '#34d399' : isOutput ? '#f472b6' : sectionColor;

    return <button
      key={suffix}
      type="button"
      data-port-id={port.id}
      data-port-role={isInput ? 'IN' : isOutput ? 'OUT' : 'TAP'}
      title={`${port.name} — ${isInput ? 'INPUT' : isOutput ? 'OUTPUT' : 'PATCH'} • ${stacked > 0 ? `${stacked} سلك` : 'غير موصول'}`}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); labAudio.playPlugSnap(); onPortClick(port); }}
      style={{ position: 'absolute', left: `${((x - VB_X0) / VB_W) * 100}%`, top: `${(y / VB_H) * 100}%`, transform: 'translate(-50%,-50%)' }}
      className="p-0 bg-transparent border-0 cursor-pointer z-10 touch-manipulation"
    >
      <span className="absolute -inset-2.5 rounded-full cursor-pointer pointer-events-auto" />
      <span
        className={`block w-[26px] h-[26px] rounded-full border-[4px] shadow-[0_1px_3px_rgba(0,0,0,.8)] bg-[#0b0c0e] ${source ? 'ring-2 ring-cyan-400 scale-110' : 'hover:ring-2 hover:ring-white/50'} relative`}
        style={{
          borderColor: hole ? '#2a2d33' : roleColor,
          boxShadow: connected ? `0 0 0 2px #0b0c0e, 0 0 9px 1px ${roleColor}` : undefined,
        }}
      >
        <span className={`absolute inset-[5px] rounded-full ${connected ? 'bg-amber-300 shadow-[0_0_8px_#fcd34d]' : 'bg-[#1b1d21]'}`} />
        {stacked > 1 && (
          <span className="absolute -bottom-[7px] -right-[7px] min-w-[14px] h-[14px] px-[2px] rounded-full bg-sky-500 text-white text-[8px] font-black flex items-center justify-center border border-white">
            {stacked}
          </span>
        )}
      </span>
    </button>;
  };

  const lpf = 'lpf', hpf = 'hpf';

  const schematic = <svg viewBox={`${VB_X0} 0 ${VB_W} ${VB_H}`} className="absolute inset-0 w-full h-full" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <T x={688} y={58} size={19} anchor="middle" weight={500}>Passive and Active Filter</T>

    {/* ================= SECOND ORDER LOW PASS (active) ================= */}
    {/* input rail + R1 into U1:A (−) */}
    <path d="M326 256 V172 M326 148 V105 H397" />
    <path d={resV(326, 148)} /> <T x={337} y={152}>R1</T>
    <path d="M326 105 V63 H668 V190" />
    <Op tipX={441} tipY={122} label="U1:A" plusOnTop />
    <path d="M397 138 H382" /><path d={gnd(380, 138)} />
    <path d="M441 122 H473 V165" /><path d={resV(468, 165).replace(/^M468/, 'M468')} />
    <path d="M468 165 V145 M468 189 V210 H386 V292" />
    <T x={480} y={180}>R4</T>
    {/* R2 / R5 chain into U1:B */}
    <path d="M326 256 H337" /><path d={resHp(337, 256)} /><T x={352} y={247}>R2</T>
    <path d="M378 256 H393 V293 H388" />
    <path d="M386 292 V305" />
    <path d="M393 256 H415" /><path d={resHp(415, 256)} /><T x={430} y={246}>R5</T>
    <path d="M456 256 H462 V327 H437" />
    <Op tipX={437} tipY={327} label="U1:B" plusOnTop />
    <path d="M393 343 H372" /><path d={gnd(372, 343)} />
    <path d="M437 327 H490" /><path d={resHp(490, 327)} /><T x={506} y={314}>R6</T>
    <path d="M520 327 H541 V252 M541 327 H575" />
    <path d="M462 327 V383 H660" />
    {/* U1:C */}
    <Op tipX={612} tipY={335} label="U1:C" supply plusOnTop />
    <path d="M572 345 H556" /><path d={gnd(556, 345)} />
    <path d="M612 335 H668 V258 M668 335 V376" />
    {/* R3 feedback + caps C1/C3 (J1/J3) and C2/C4 (J2/J4) */}
    <path d="M473 122 V97 H581" /><path d={resHp(581, 97)} /><T x={597} y={89}>R3</T>
    <path d="M621 97 H636 V127" />
    <path d={capH(590, 126)} /><path d={capH(590, 153)} />
    <path d="M571 126 H576 M571 153 H576 M610 126 H668 M610 153 H636 M636 127 V153 M668 63 V153 M636 126 H668" />
    <path d="M668 212 V258 M668 190 V212" /><path d={resV(668, 190)} /><T x={640} y={211}>R7</T>
    <path d="M541 252 H600" /><path d="M541 282 H600" />
    <path d={capH(620, 253)} /><path d={capH(620, 282)} />
    <path d="M640 253 H668 M640 282 H668 M668 258 V282" />
    <T x={528} y={128} size={11} anchor="end">J1</T><T x={528} y={158} size={11} anchor="end">J3</T>
    <T x={584} y={116} size={11}>C1</T><T x={584} y={147} size={11}>C3</T>
    <T x={534} y={254} size={11} anchor="end">J2</T><T x={534} y={288} size={11} anchor="end">J4</T>
    <T x={632} y={243} size={11}>C2</T><T x={632} y={274} size={11}>C4</T>
    <T x={342} y={296} size={11} weight={700}>I/P</T>
    <T x={660} y={400} size={11} weight={700} anchor="middle">O/P</T>
    <T x={342} y={410} size={12.5} weight={700}>SECOND ORDER LOW PASS FILTER</T>

    {/* ================= SECOND ORDER HIGH PASS (active) ================= */}
    <path d="M706 178 V120 H776 M706 160 V120" />
    <path d={resV(706, 155)} /><T x={720} y={168}>R1</T>
    <path d="M706 120 V70 H1043 V198" />
    <path d="M706 184 V205" />
    <Op tipX={818} tipY={127} label="U1:A" plusOnTop />
    <path d="M776 143 H762" /><path d={gnd(760, 143)} />
    <path d="M818 127 H845 V172 M845 172 V190 M845 190 V210" /><path d={resV(845, 172)} /><T x={856} y={186}>R4</T>
    <path d="M845 210 H760 V320 H776" />
    <path d="M760 320 V210" />
    <Op tipX={820} tipY={330} label="U1:B" plusOnTop />
    <path d="M776 346 H762" /><path d={gnd(760, 346)} />
    <path d="M820 330 H880" /><path d={resHp(880, 330)} /><T x={893} y={321}>R5</T>
    <path d="M914 330 H946 V337" />
    <Op tipX={990} tipY={337} label="U1:C" supply plusOnTop />
    <path d="M946 347 H934" /><path d={gnd(934, 347)} />
    <path d="M990 337 H1043 V212 M1043 337 V383" />
    <path d="M920 290 H1012 V270" /><path d={resHp(940, 290)} /><T x={965} y={282}>R6</T>
    <path d="M946 330 V290 M1012 270 V240" />
    <path d="M845 127 V105 H957" /><path d={resHp(957, 105)} /><T x={970} y={97}>R2</T>
    <path d="M991 105 H1010 V130 M1010 130 H1003 M1010 130 V157 H1003" />
    <path d={capH(960, 130)} /><path d={capH(960, 157)} />
    <path d="M866 130 H946 M866 157 H946" />
    <path d={capH(960, 210)} /><path d={capH(960, 240)} />
    <path d="M980 210 H1012 M980 240 H1012 M1012 210 V270" />
    <T x={918} y={134} size={11} anchor="end">J1</T><T x={918} y={162} size={11} anchor="end">J3</T>
    <T x={956} y={120} size={11}>C1</T><T x={956} y={147} size={11}>C3</T>
    <T x={918} y={214} size={11} anchor="end">J2</T><T x={918} y={244} size={11} anchor="end">J4</T>
    <T x={956} y={200} size={11}>C2</T><T x={956} y={230} size={11}>C4</T>
    <T x={1026} y={211} size={11} anchor="end">R3</T>
    <path d="M1043 198 V212" /><path d={resV(1043, 190)} />
    <T x={728} y={238} size={11} weight={700}>I/P</T>
    <T x={1046} y={406} size={11} weight={700} anchor="middle">O/P</T>
    <T x={737} y={412} size={12.5} weight={700}>SECOND ORDER HIGH PASS FILTER</T>
    <path d="M706 205 V215" />

    {/* separator */}
    <path d="M366 436 H970" strokeWidth="1.3" />

    {/* ================= PASSIVE LPF ================= */}
    <path d="M318 473 H346" /><path d={coilH(346, 473)} /><T x={364} y={462} weight={700}>L1</T>
    <path d="M398 473 H404 M404 473 H419" /><path d={coilH(419, 473)} /><T x={440} y={462} weight={700}>L2</T>
    <path d="M471 473 H482" />
    <path d="M404 473 V495" /><path d={capV(404, 495)} /><T x={414} y={512} weight={700}>C</T>
    <path d="M404 525 V543 M318 543 H482" />
    <T x={400} y={562} size={15} weight={700} anchor="middle">LPF</T>
    <T x={305} y={497} size={11} weight={700} anchor="end">I/P</T>
    <T x={484} y={508} size={11} weight={700}>O/P</T>

    {/* ================= PASSIVE HPF ================= */}
    <path d="M577 510 V474 H600" /><path d={capH(614, 474)} /><T x={608} y={460} weight={700}>C1</T>
    <path d="M634 474 H690" /><path d={capH(702, 474)} /><T x={692} y={460} weight={700}>C2</T>
    <path d="M722 474 H738 V508" />
    <path d="M660 474 V488" /><path d={coilV(660, 488)} /><T x={673} y={512} weight={700}>L</T>
    <path d="M660 530 V543 M577 543 H738" />
    <T x={659} y={562} size={15} weight={700} anchor="middle">HPF</T>
    <T x={563} y={512} size={11} weight={700} anchor="end">I/P</T>
    <T x={730} y={512} size={11} weight={700} anchor="end">O/P</T>

    {/* ================= PASSIVE BPF ================= */}
    <path d="M823 478 H850" /><path d={coilH(850, 478)} /><T x={870} y={462} weight={700}>L1</T>
    <path d="M902 478 H908" /><path d={capH(922, 478)} /><T x={911} y={463} weight={700}>C1</T>
    <path d="M928 478 H934" /><path d={capH(944, 478)} /><T x={942} y={463} weight={700}>C2</T>
    <path d="M964 478 H968" /><path d={coilH(968, 478)} /><T x={990} y={462} weight={700}>L2</T>
    <path d="M1020 478 H1030" />
    <path d="M936 478 V500 M936 500 H908 V512 M936 500 H966 V510" />
    <path d={coilV(908, 512)} /><T x={886} y={532} weight={700}>L3</T>
    <path d={capV(966, 510)} /><T x={976} y={528} weight={700}>C3</T>
    <path d="M908 554 V545 M966 540 V545 M826 545 H1032 M908 545 H966" />
    <T x={930} y={562} size={15} weight={700} anchor="middle">BPF</T>
    <T x={812} y={505} size={11} weight={700} anchor="end">I/P</T>
    <T x={1020} y={505} size={11} weight={700} anchor="end">O/P</T>
  </svg>;

  return <div className="w-[1010px] overflow-hidden rounded-md border-[8px] border-[#1765b3] bg-[#0b0c0e] shadow-[0_22px_65px_rgba(0,0,0,.65)] text-white select-none">
    <div onPointerDown={onDragStart} style={{ touchAction: 'none' }} className="h-8 px-3 flex items-center justify-between bg-gradient-to-r from-[#1765b3] to-[#287ac5] cursor-move text-white">
      <div className="flex items-center gap-2"><GripHorizontal className="w-4 h-4" /><span className="text-[11px] font-black tracking-wider">PASSIVE AND ACTIVE FILTER TRAINER</span></div>
      <div className="flex items-center gap-3"><span className="text-[9px] font-mono">FILTER LAB • LPF / HPF / BPF</span><button onMouseDown={e => e.stopPropagation()} onClick={onClose} className="p-1 hover:bg-rose-600 rounded" title="Close board"><X className="w-4 h-4" /></button></div>
    </div>
    {/* Board face: black panel with white silkscreen, exactly like the physical trainer */}
    <div className="relative w-full bg-[#0d0e10] border-b-[3px] border-[#3a3d42]" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
      {schematic}

      {/* Active LPF sockets */}
      {socket('lpf_in_p', 320, 272)}{socket('lpf_in_n', 320, 315)}
      {socket('lpf_j1_a', 487, 122)}{socket('lpf_j3_a', 487, 152)}
      {socket('lpf_j1_b', 551, 120)}{socket('lpf_j3_b', 551, 152)}
      {socket('lpf_j2_a', 548, 247)}{socket('lpf_j4_a', 548, 283)}
      {socket('lpf_j2_b', 611, 247)}{socket('lpf_j4_b', 616, 285)}
      {socket('lpf_out_p', 660, 376)}{socket('lpf_out_n', 660, 420)}

      {/* Active HPF sockets */}
      {socket('hpf_in_p', 712, 206)}{socket('hpf_in_n', 712, 263)}
      {socket('hpf_j1_a', 866, 130)}{socket('hpf_j3_a', 866, 157)}
      {socket('hpf_j1_b', 933, 125)}{socket('hpf_j3_b', 933, 158)}
      {socket('hpf_j2_a', 866, 210)}{socket('hpf_j4_a', 866, 240)}
      {socket('hpf_j2_b', 933, 208)}{socket('hpf_j4_b', 933, 240)}
      {socket('hpf_out_p', 1046, 383)}{socket('hpf_out_n', 1046, 427)}

      {/* Passive LPF / HPF / BPF sockets (tap_a / tap_b = common returns) */}
      {socket('lpf_in', 318, 473)}{socket('lpf_tap_a', 318, 543)}{socket('lpf_out', 482, 478)}{socket('lpf_tap_b', 482, 545)}
      {socket('hpf_in', 577, 510)}{socket('hpf_tap_a', 577, 543)}{socket('hpf_out', 738, 508)}{socket('hpf_tap_b', 738, 543)}
      {socket('bpf_in', 823, 478)}{socket('bpf_tap_a', 826, 545)}{socket('bpf_out', 1030, 478, true)}{socket('bpf_tap_b', 1032, 545)}
    </div>
  </div>;
};
