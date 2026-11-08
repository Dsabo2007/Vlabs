import React from 'react';
import {
  Menu,
  X,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Trash2,
  LocateFixed,
  GraduationCap,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

interface ToolbarProps {
  onOpenDrawer: () => void;
  isDrawerOpen: boolean;
  wireColor: string;
  onSelectWireColor: (color: string) => void;
  wiresVisible: boolean;
  onToggleWires: () => void;
  onClearWires: () => void;
  onClearAll: () => void;
  onResetView: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onOpenDrawer,
  isDrawerOpen,
  wireColor,
  onSelectWireColor,
  wiresVisible,
  onToggleWires,
  onClearWires,
  onClearAll,
  onResetView,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  audioEnabled,
  onToggleAudio,
}) => {
  const WIRE_COLORS = [
    { id: 'red', name: 'Red (+)', bg: 'bg-red-500', ring: 'ring-red-400' },
    { id: 'black', name: 'Black (-/GND)', bg: 'bg-neutral-900 border border-neutral-600', ring: 'ring-neutral-400' },
    { id: 'blue', name: 'Blue (Signal)', bg: 'bg-sky-500', ring: 'ring-sky-400' },
    { id: 'yellow', name: 'Yellow (CH2)', bg: 'bg-amber-400', ring: 'ring-amber-300' },
    { id: 'green', name: 'Green (Earth)', bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
  ];

  return (
    <header className="h-12 bg-[#0a0d14] text-white flex flex-wrap items-stretch justify-between shadow-2xl border-b border-neutral-800 z-40 select-none shrink-0 font-sans">
      {/* Left: Burger Menu toggle (Sharp, flush with bar, morphs to X when drawer is open) + branding */}
      <div className="flex items-stretch min-w-0">
        <button
          onClick={onOpenDrawer}
          className={`h-full px-3.5 flex items-center justify-center border-r border-neutral-800 transition-colors shrink-0 ${
            isDrawerOpen
              ? 'bg-sky-950/60 text-sky-400 border-r-sky-800/60'
              : 'bg-transparent text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
          }`}
          title={isDrawerOpen ? 'إغلاق قائمة الأجهزة' : 'فتح قائمة الأجهزة'}
          aria-label="Toggle instruments shelf"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 px-3 min-w-0 border-r border-neutral-800/60">
          <div className="p-1 rounded-sm bg-neutral-900 border border-neutral-800 text-neutral-300 shrink-0 hidden sm:block">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[11px] font-bold tracking-wider text-neutral-100 uppercase font-mono truncate">
              <span className="hidden md:inline">ELECTRICAL AND ELECTRONIC TECHNICAL COLLEGE</span>
              <span className="md:hidden">VIRTUAL ELECTRONICS LAB</span>
            </h1>
            <p className="text-[10px] text-neutral-400 font-medium font-arabic truncate leading-tight">
              مختبر الدوائر والقياسات الافتراضي
            </p>
          </div>
        </div>
      </div>

      {/* Middle: Wire palette (Sharp, flush bar without rounded cards) */}
      <div className="order-3 sm:order-none w-full sm:w-auto h-full flex items-center gap-2 px-3 border-t sm:border-t-0 sm:border-r border-neutral-800/60 bg-[#0a0d14] overflow-x-auto">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-neutral-400 shrink-0">
          WIRE:
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {WIRE_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectWireColor(c.id)}
              className={`w-4 h-4 rounded-full ${c.bg} shadow transition-transform shrink-0 ${
                wireColor === c.id
                  ? `scale-125 ring-2 ring-offset-2 ring-offset-[#0a0d14] ${c.ring}`
                  : 'hover:scale-110 opacity-70 hover:opacity-100'
              }`}
              title={`لون السلك: ${c.name}`}
              aria-label={`Select ${c.name} wire`}
            />
          ))}
        </div>

        <div className="h-4 w-px bg-neutral-800 mx-1 shrink-0" />

        <button
          onClick={onToggleWires}
          className={`h-7 px-2 text-xs font-semibold flex items-center gap-1 transition-colors border border-neutral-800 shrink-0 ${
            wiresVisible
              ? 'text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800'
              : 'text-amber-400 bg-amber-950/40 border-amber-800/50'
          }`}
          title={wiresVisible ? 'إخفاء الأسلاك' : 'إظهار الأسلاك'}
        >
          {wiresVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={onClearWires}
          className="h-7 px-2 text-neutral-400 hover:text-rose-400 bg-neutral-900 hover:bg-rose-950/30 border border-neutral-800 text-xs transition-colors shrink-0 flex items-center gap-1"
          title="حذف جميع الأسلاك (Clear all wires)"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="text-[9.5px] font-arabic hidden lg:inline">حذف الأسلاك</span>
        </button>

        <button
          onClick={onClearAll}
          className="h-7 px-2.5 text-rose-300 hover:text-white bg-rose-950/50 hover:bg-rose-700 border border-rose-800/70 text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
          title="حذف تام: إزالة جميع الأجهزة والأسلاك من الطاولة"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="text-[9.5px] font-arabic">حذف تام</span>
        </button>
      </div>

      {/* Right: Sharp, flush view & audio controls */}
      <div className="flex items-stretch shrink-0">
        <div className="flex items-stretch border-l border-neutral-800">
          <button
            onClick={onZoomOut}
            className="h-full px-2.5 text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors flex items-center justify-center border-r border-neutral-800"
            title="تصغير Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="h-full px-2 flex items-center text-[10.5px] font-mono font-bold text-sky-400 min-w-[42px] justify-center border-r border-neutral-800">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={onZoomIn}
            className="h-full px-2.5 text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors flex items-center justify-center border-r border-neutral-800"
            title="تكبير Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onFitView}
            className="h-full px-2.5 text-neutral-400 hover:text-sky-300 hover:bg-neutral-800/80 transition-colors flex items-center justify-center border-r border-neutral-800"
            title="ملاءمة كل الأجهزة على الشاشة (Fit All)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={onResetView}
          className="h-full px-3 text-neutral-300 hover:text-white hover:bg-neutral-800/80 border-r border-neutral-800 flex items-center gap-1.5 text-xs font-semibold transition-colors"
          title="إعادة توسيط اللوحة (Center View)"
        >
          <LocateFixed className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono hidden sm:inline">CENTER</span>
        </button>

        <button
          onClick={onToggleAudio}
          className={`h-full px-3 flex items-center justify-center transition-colors ${
            audioEnabled
              ? 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
              : 'bg-rose-950/40 text-rose-400'
          }`}
          title={audioEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
