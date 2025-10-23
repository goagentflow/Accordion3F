import React from 'react';

type DepType = 'SS' | 'FF';

interface SameDayChooserProps {
  open: boolean;
  suggested: DepType;
  predecessorName?: string;
  successorName?: string;
  onConfirm: (depType: DepType) => void;
  onCancel: () => void;
}

const SameDayChooser: React.FC<SameDayChooserProps> = ({ open, suggested, predecessorName, successorName, onConfirm, onCancel }) => {
  const [selected, setSelected] = React.useState<DepType>(suggested);
  const [altHeld, setAltHeld] = React.useState(false);

  React.useEffect(() => setSelected(suggested), [suggested]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !altHeld) {
        setAltHeld(true);
        setSelected(prev => (prev === 'FF' ? 'SS' : 'FF'));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltHeld(false);
        setSelected(suggested);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [open, suggested, altHeld]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-[380px] max-w-[90vw]">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Same‑day link</h3>
          <p className="text-sm text-gray-600 mt-1">
            {successorName ? (<>
              Link <strong>{successorName}</strong> with {predecessorName ? <strong>{predecessorName}</strong> : 'selected task'} on the same working day.
            </>) : 'Choose how these tasks align on the same working day.'}
          </p>
        </div>
        <div className="p-5 space-y-3">
          <button
            className={`w-full text-left px-3 py-2 rounded border ${selected === 'FF' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'} hover:bg-gray-50`}
            onClick={() => setSelected('FF')}
          >
            <div className="font-medium text-gray-800">Finish together (FF=0)</div>
            <div className="text-xs text-gray-600">Bars end on the same working day</div>
          </button>
          <button
            className={`w-full text-left px-3 py-2 rounded border ${selected === 'SS' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'} hover:bg-gray-50`}
            onClick={() => setSelected('SS')}
          >
            <div className="font-medium text-gray-800">Start together (SS=0)</div>
            <div className="text-xs text-gray-600">Bars start on the same working day</div>
          </button>
        </div>
        <div className="px-5 pb-5 flex items-center justify-between text-xs text-gray-500">
          <span>Tip: hold Alt/Option to toggle</span>
          <div className="space-x-2">
            <button className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200" onClick={onCancel}>Cancel</button>
            <button className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => onConfirm(selected)}>Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SameDayChooser;
