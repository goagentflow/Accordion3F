import React, { useState, useCallback } from 'react';

const GettingStarted: React.FC = () => {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openModal}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
        >
          🚀 Getting Started
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Getting Started</h2>
                <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
              </div>
              <div className="space-y-4 text-gray-700">
                <p>Build your campaign timeline in 4 simple steps:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Select your assets from the left panel</li>
                  <li>Set your go-live date(s)</li>
                  <li>Review your timeline and resolve conflicts</li>
                  <li>Export to Excel when ready (and re-import with amends)</li>
                </ol>
                <p className="text-sm text-gray-600">
                  Tip: If go-live falls on a weekend/holiday, the live task will anchor to that date;
                  earlier tasks adjust to working days.
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={closeModal} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GettingStarted;

