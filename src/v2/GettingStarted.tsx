import React, { useState, useCallback } from 'react';

const GettingStarted: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => {
    setOpen(false);
    setShowAll(false);
  }, []);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openModal}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
        >
          🚀 Getting started
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

              {!showAll ? (
                <div className="space-y-6 text-gray-700">
                  <div className="text-center mb-2">
                    <p className="text-gray-600 text-lg">Quick Start (5 steps)</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-4">
                      <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Name Your Project (Required)</h3>
                        <p className="text-gray-600 text-sm">Add a client or campaign name (e.g., Barclays Autumn Campaign). This is required and appears in your Excel header, sheet tab and filename; export is disabled until it’s set.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Select your assets (Required)</h3>
                        <p className="text-gray-600 text-sm">Use the left panel to add the marketing assets you need. You can add the same type multiple times, just rename each one so you know what's what.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Set your go live dates (Required)</h3>
                        <p className="text-gray-600 text-sm">Use one global date for everything, or set individual dates per asset. Go live dates can fall on weekends or bank holidays (the "Live" task anchors there), while all other tasks use working days only. Special requirements: Weekend Saturday Supplement Full Page must have a Saturday go-live date, and You Sunday Supplement Full Page must have a Sunday go-live date.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">4</div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Review and adjust</h3>
                        <p className="text-gray-600 text-sm">Change task durations, rename tasks to match your workflow and drag tasks to reorder or create overlaps. Warnings will appear if adjustments are required, please take action to remedy.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-4">
                      <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">5</div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Save your work</h3>
                        <p className="text-gray-600 text-sm">Export to Excel to save a copy. Import that Excel file later to resume where you left off, but don't edit the tab called “Data” or your imported Excel will no longer regenerate a timeline.</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-6 mt-2">
                    <button onClick={() => setShowAll(true)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Show all instructions →</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 text-gray-700">
                  <h3 className="text-xl font-semibold text-gray-800">Complete Instructions</h3>

                  <section>
                    <h4 className="font-semibold text-gray-800 mb-1">Custom Tasks</h4>
                    <p className="text-gray-600 text-sm">Click “Add Task” to create your own. Choose “Insert After” and it’ll start on the next working day after your chosen task.</p>
                  </section>

                  <section>
                    <h4 className="font-semibold text-gray-800 mb-1">Warnings & Conflicts</h4>
                    <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                      <li>Left panel “Timeline Status” shows how many working days you need to save across how many assets.</li>
                      <li>Right panel "Timeline Conflicts" lists assets that can't meet their current go live dates. Weekend Saturday Supplement Full Page requires a Saturday go-live date, and You Sunday Supplement Full Page requires a Sunday go-live date. You'll need to manually select the appropriate day and uncheck the "Use same live date for all assets" box.</li>
                      <li>Fix conflicts by reducing duration, adjusting go live dates or making tasks run concurrently.</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-semibold text-gray-800 mb-1">Editing Tasks</h4>
                    <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1">
                      <li>Rename: Click the task name and type.</li>
                      <li>Duration: Adjust the number next to the task or drag the right edge to change duration.</li>
                      <li>Move: Drag the bar to change start date (may create overlaps within the asset).</li>
                    </ul>
                  </section>

                  <section>
                    <h4 className="font-semibold text-gray-800 mb-1">Working Days & Holidays</h4>
                    <p className="text-gray-600 text-sm">Your “Live” task can be scheduled for any date, including weekends and bank holidays. All other tasks are automatically scheduled on working days only, skipping weekends and bank holidays.</p>
                  </section>

                  <div className="border-t pt-4 mt-2">
                    <button onClick={() => setShowAll(false)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">← Back to quick start</button>
                  </div>
                </div>
              )}

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
