import React from 'react';

interface WeekendSnapModalProps {
  open: boolean;
  targetLabel: string;
  suggestedDateLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const WeekendSnapModal: React.FC<WeekendSnapModalProps> = ({ open, targetLabel, suggestedDateLabel, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-[400px] max-w-[90vw]">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Non‑working day</h3>
          <p className="text-sm text-gray-600 mt-1">
            Only <strong>Live</strong> can land on weekends or bank holidays. You tried to place <strong>{targetLabel}</strong> on a non‑working day.
          </p>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-700">Snap to previous working day <strong>({suggestedDateLabel})</strong>?</p>
        </div>
        <div className="px-5 pb-5 flex items-center justify-end space-x-2">
          <button className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200" onClick={onCancel}>Cancel</button>
          <button className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={onConfirm}>Snap</button>
        </div>
      </div>
    </div>
  );
};

export default WeekendSnapModal;
