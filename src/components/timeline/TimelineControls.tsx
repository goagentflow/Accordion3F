/**
 * TimelineControls - User Input Controls ONLY
 * Single Responsibility: Handle user input and control interactions
 * 
 * CRITICAL: This component handles ONLY user input, NO state management
 * All state changes flow through context dispatch
 */

import React, { useCallback } from 'react';
import { useTimelineAssets, useTimelineDates, useTimelineUI, useTimelineActions } from '../../contexts/TimelineContext';
import { ActionType } from '../../types/timeline.types';

// Import existing components that handle specific control areas
import AssetSelector from '../AssetSelector';
import CampaignSetup from '../CampaignSetup';

// ============================================
// Asset Controls Section
// ============================================

function AssetControlsSection(): JSX.Element {
  const assets = useTimelineAssets();
  const { dispatch } = useTimelineActions();
  
  const handleAddAsset = useCallback((assetType: string, name?: string) => {
    dispatch({
      type: ActionType.ADD_ASSET,
      payload: {
        assetType,
        name: name || assetType,
        startDate: ''
      }
    });
  }, [dispatch]);
  
  const handleRemoveAsset = useCallback((assetId: string) => {
    dispatch({
      type: ActionType.REMOVE_ASSET,
      payload: { assetId }
    });
  }, [dispatch]);
  
  return (
    <div className="asset-controls">
      <h3>Assets</h3>
      
      {/* Existing Asset Selector Component */}
      <AssetSelector 
        availableAssets={assets.available}
        selectedAssets={assets.selected}
        onAddAsset={handleAddAsset}
        onRemoveAsset={handleRemoveAsset}
      />
      
      {/* Asset Management Buttons */}
      <div className="asset-buttons">
        <button
          data-testid="add-asset-button"
          onClick={() => handleAddAsset('Digital Display', 'New Asset')}
          className="btn btn-primary"
        >
          + Add Asset
        </button>
        
        <button
          onClick={() => dispatch({ type: ActionType.CLEAR_ALL })}
          className="btn btn-secondary"
          data-testid="clear-all-button"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}

// ============================================
// Date Controls Section
// ============================================

function DateControlsSection(): JSX.Element {
  const dates = useTimelineDates();
  const { dispatch } = useTimelineActions();
  
  const handleGlobalDateChange = useCallback((date: string) => {
    dispatch({
      type: ActionType.SET_GLOBAL_LIVE_DATE,
      payload: { date }
    });
  }, [dispatch]);
  
  const handleToggleGlobalDate = useCallback(() => {
    dispatch({ type: ActionType.TOGGLE_USE_GLOBAL_DATE });
  }, [dispatch]);
  
  return (
    <div className="date-controls">
      <h3>Campaign Dates</h3>
      
      {/* Global Date Toggle */}
      <div className="global-date-control">
        <label>
          <input
            type="checkbox"
            checked={dates.useGlobalDate}
            onChange={handleToggleGlobalDate}
            data-testid="use-global-date-checkbox"
          />
          Use global live date for all assets
        </label>
      </div>
      
      {/* Global Live Date Picker */}
      {dates.useGlobalDate && (
        <div className="global-date-picker">
          <label htmlFor="global-live-date">Global Live Date:</label>
          <input
            id="global-live-date"
            type="date"
            value={dates.globalLiveDate}
            onChange={(e) => handleGlobalDateChange(e.target.value)}
            data-testid="global-live-date-input"
          />
        </div>
      )}
      
      {/* Campaign Setup Component */}
      <CampaignSetup />
      
      {/* Bank Holidays */}
      <div className="bank-holidays-control">
        <label htmlFor="bank-holidays">Bank Holidays (comma separated dates):</label>
        <input
          id="bank-holidays"
          type="text"
          placeholder="2024-12-25, 2024-12-26"
          onChange={(e) => {
            const holidays = e.target.value.split(',').map(d => d.trim()).filter(d => d);
            dispatch({
              type: ActionType.SET_BANK_HOLIDAYS,
              payload: { holidays }
            });
          }}
          data-testid="bank-holidays-input"
        />
      </div>
    </div>
  );
}

// ============================================
// UI Controls Section
// ============================================

function UIControlsSection(): JSX.Element {
  const ui = useTimelineUI();
  const { dispatch } = useTimelineActions();
  
  const handleToggleInfoBox = useCallback(() => {
    dispatch({ type: ActionType.TOGGLE_INFO_BOX });
  }, [dispatch]);
  
  return (
    <div className="ui-controls">
      <h3>Display Options</h3>
      
      {/* Info Box Toggle */}
      <div className="info-box-control">
        <label>
          <input
            type="checkbox"
            checked={ui.showInfoBox}
            onChange={handleToggleInfoBox}
            data-testid="toggle-info-box-checkbox"
          />
          Show analytics info box
        </label>
      </div>
      
      {/* Getting Started Toggle */}
      <div className="getting-started-control">
        <label>
          <input
            type="checkbox"
            checked={ui.showGettingStarted}
            onChange={() => dispatch({
              type: ActionType.SET_GETTING_STARTED,
              payload: { show: !ui.showGettingStarted }
            })}
            data-testid="toggle-getting-started-checkbox"
          />
          Show getting started guide
        </label>
      </div>
    </div>
  );
}

// ============================================
// Undo/Redo Controls
// ============================================

function UndoRedoControls(): JSX.Element {
  const { undo, redo, canUndo, canRedo } = useTimelineActions();
  
  return (
    <div className="undo-redo-controls">
      <h3>Actions</h3>
      
      <div className="undo-redo-buttons">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="btn btn-secondary"
          data-testid="undo-button"
          title="Undo last action"
        >
          ⟲ Undo
        </button>
        
        <button
          onClick={redo}
          disabled={!canRedo}
          className="btn btn-secondary"
          data-testid="redo-button"
          title="Redo last undone action"
        >
          ⟳ Redo
        </button>
      </div>
    </div>
  );
}

// ============================================
// Main Controls Component
// ============================================

export function TimelineControls(): JSX.Element {
  console.log('[TimelineControls] Rendering controls');
  
  return (
    <div className="timeline-controls">
      
      {/* Asset Management */}
      <AssetControlsSection />
      
      {/* Date Configuration */}
      <DateControlsSection />
      
      {/* UI Options */}
      <UIControlsSection />
      
      {/* Undo/Redo */}
      <UndoRedoControls />
      
    </div>
  );
}

export default TimelineControls;