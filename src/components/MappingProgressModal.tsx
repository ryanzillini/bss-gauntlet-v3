import React from 'react';

interface MappingStage {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
}

interface MappingProgressModalProps {
  isOpen: boolean;
  stages: MappingStage[];
  onClose: () => void;
}

const MappingProgressModal: React.FC<MappingProgressModalProps> = ({ isOpen, stages, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-pure-black flex items-center justify-center z-50">
      <div className="bg-[#121212] border border-pure-white/10 rounded-lg p-6 max-w-2xl w-full mx-4 space-y-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-pure-white">Mapping Progress</h2>
          <button
            onClick={onClose}
            className="text-pure-white/50 hover:text-pure-white transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {stages.map((stage) => (
            <div key={stage.id} className="flex items-start gap-3 p-3 rounded-lg bg-[#1A1A1A] border border-pure-white/5">
              {/* Status Icon */}
              <div className="mt-1">
                {stage.status === 'pending' && (
                  <div className="h-5 w-5 rounded-full border-2 border-pure-white/20" />
                )}
                {stage.status === 'in-progress' && (
                  <div className="h-5 w-5 rounded-full border-2 border-info border-t-transparent animate-spin" />
                )}
                {stage.status === 'complete' && (
                  <div className="h-5 w-5 rounded-full bg-success/20 text-success flex items-center justify-center">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {stage.status === 'error' && (
                  <div className="h-5 w-5 rounded-full bg-error/20 text-error flex items-center justify-center">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="text-sm font-medium text-pure-white mb-1">{stage.title}</h3>
                <p className="text-xs text-pure-white/70">{stage.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MappingProgressModal; 