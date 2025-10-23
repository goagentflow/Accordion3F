import React, { useState } from 'react';
import { TimelineProvider, useTimeline } from '../hooks/useTimeline';
import { CatalogProvider } from './CatalogContext';
import CatalogInitializer from './CatalogInitializer';
import BankHolidays from './BankHolidays';
import Orchestrator from './Orchestrator';
import GettingStarted from './GettingStarted';
import useExcelExport from '../hooks/useExcelExport';
import ImportManager from './ImportManager';
import LeftColumn from './LeftColumn';
import RightColumn from './RightColumn';

// Header actions placed inside provider to safely access context
const HeaderActions: React.FC = () => {
  const { undo, redo, canUndo, canRedo } = useTimeline();
  const { state } = useTimeline();
  const { exportTimeline } = useExcelExport();

  const handleExport = async () => {
    await exportTimeline();
  };

  return (
    <div className="flex gap-2">
      <ImportManager />
      <button
        onClick={handleExport}
        disabled={!state.tasks?.timeline || state.tasks.timeline.length === 0 || !(state.ui?.clientCampaignName && state.ui.clientCampaignName.trim())}
        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
        title="Export Timeline to Excel"
      >
        📊 Export
      </button>
      <button
        onClick={undo}
        disabled={!canUndo}
        className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        ↩️ Undo
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Y)"
      >
        ↪️ Redo
      </button>
    </div>
  );
};

/**
 * TimelineBuilderV2 – Parity-first shell behind a feature flag
 */
export const TimelineBuilderV2: React.FC = () => {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  return (
    <TimelineProvider>
      <CatalogProvider>
        <div className="bg-gray-100 min-h-screen">
          <header className="bg-white shadow-md">
            <div className="container mx-auto px-6 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-800">Accordion Timeline Builder</h1>
              <HeaderActions />
            </div>
          </header>
          <main className="container mx-auto p-6">
            <CatalogInitializer />
            <BankHolidays />
            <Orchestrator />
            <GettingStarted />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {leftCollapsed ? (
                <div className="lg:col-span-1 flex">
                  <button
                    data-testid="expand-left-panel"
                    onClick={() => setLeftCollapsed(false)}
                    className="w-[50px] py-3 rounded-lg border border-gray-200 bg-white shadow flex flex-col items-center justify-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    title="Expand Campaign Setup"
                    aria-expanded="false"
                    aria-controls="left-panel"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="text-gray-500">
                      <path d="M22.7 19.3l-6.4-6.4a6 6 0 00-7.6-7.6l3 3a2.5 2.5 0 01-3.5 3.5l-3-3A6 6 0 0013 16.3l6.4 6.4a1 1 0 001.4-1.4z" fill="currentColor" />
                    </svg>
                    <span className="my-2 text-gray-500 leading-none">›</span>
                    <span className="text-[10px] text-gray-600 tracking-wide">Setup</span>
                  </button>
                </div>
              ) : (
                <div className="lg:col-span-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-500 pl-1">Timeline Setup</div>
                    <button
                      data-testid="collapse-left-panel"
                      onClick={() => setLeftCollapsed(true)}
                      className="text-gray-500 hover:text-gray-700 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                      title="Collapse Campaign Setup"
                      aria-expanded="true"
                      aria-controls="left-panel"
                    >
                      ‹
                    </button>
                  </div>
                  <LeftColumn />
                </div>
              )}
              <div className={`${leftCollapsed ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                <RightColumn />
              </div>
            </div>
          </main>
        </div>
      </CatalogProvider>
    </TimelineProvider>
  );
};

export default TimelineBuilderV2;

