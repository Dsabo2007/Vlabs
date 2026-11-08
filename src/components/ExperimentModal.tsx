import React from 'react';
import { LabExperiment } from '../types/lab';
import { X, BookOpen, CheckCircle2, ArrowRight } from 'lucide-react';

interface ExperimentModalProps {
  experiment: LabExperiment;
  isOpen: boolean;
  onClose: () => void;
  onLoadPreset: () => void;
}

export const ExperimentModal: React.FC<ExperimentModalProps> = ({
  experiment,
  isOpen,
  onClose,
  onLoadPreset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-cyan-300" />
            <div>
              <h2 className="text-base font-extrabold">{experiment.title}</h2>
              <p className="text-xs text-blue-200 font-medium">{experiment.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-700">
          <div>
            <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider mb-1">
              Objective & Description
            </h3>
            <p className="leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              {experiment.description}
            </p>
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider mb-1">
              Theoretical Background & Formulae
            </h3>
            <p className="leading-relaxed bg-blue-50/50 p-3 rounded-lg border border-blue-100 font-mono text-xs text-blue-950">
              {experiment.theory}
            </p>
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider mb-1 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Expected Experimental Outcome</span>
            </h3>
            <p className="leading-relaxed bg-emerald-50/60 p-3 rounded-lg border border-emerald-100 text-emerald-950 text-xs">
              {experiment.expectedOutcome}
            </p>
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-900">
            <span className="font-bold">Laboratory Tip: </span>
            Use the <strong>AUTO</strong> button on the Oscilloscope for automatic vertical and horizontal scaling. You can click on any wire to disconnect it, or select wire colors from the top toolbar.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 p-3 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Close Guide
          </button>
          <button
            onClick={() => {
              onLoadPreset();
              onClose();
            }}
            className="px-4 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <span>Load Preset Wiring & Values</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
