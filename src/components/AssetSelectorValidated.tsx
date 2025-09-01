/**
 * AssetSelectorValidated Component
 * Enhanced version with integrated validation
 * Provides immediate feedback on invalid inputs
 */

import React, { useState, useCallback } from 'react';
import ValidatedInput from './ValidatedInput';
import { useValidation } from '../contexts/ValidationContext';
import { Asset } from '../types/timeline.types';
import { VALIDATION_LIMITS } from '../services/ValidationService';

interface AssetSelectorValidatedProps {
  availableAssets: string[];
  selectedAssets: Asset[];
  onAddAsset: (assetType: string, name?: string) => void;
  onRemoveAsset: (assetId: string) => void;
  onRenameAsset: (assetId: string, newName: string) => void;
  onSetAssetStartDate: (assetId: string, date: string) => void;
  useGlobalDate: boolean;
}

const AssetSelectorValidated = React.memo<AssetSelectorValidatedProps>(({
  availableAssets,
  selectedAssets,
  onAddAsset,
  onRemoveAsset,
  onRenameAsset,
  onSetAssetStartDate,
  useGlobalDate
}) => {
  const { showToast } = useValidation();
  const [selectedAssetType, setSelectedAssetType] = useState('');
  const [customAssetName, setCustomAssetName] = useState('');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  // Check if at asset limit
  const isAtLimit = selectedAssets.length >= VALIDATION_LIMITS.MAX_ASSETS;
  const nearLimit = selectedAssets.length >= VALIDATION_LIMITS.MAX_ASSETS - 5;

  const handleAddAsset = useCallback(() => {
    if (!selectedAssetType) {
      showToast('Please select an asset type', 'warning');
      return;
    }

    if (isAtLimit) {
      showToast(`Maximum asset limit (${VALIDATION_LIMITS.MAX_ASSETS}) reached`, 'error');
      return;
    }

    onAddAsset(selectedAssetType, customAssetName || selectedAssetType);
    setSelectedAssetType('');
    setCustomAssetName('');
  }, [selectedAssetType, customAssetName, isAtLimit, onAddAsset, showToast]);

  const handleRenameAsset = useCallback((assetId: string, newName: string, isValid: boolean) => {
    if (isValid) {
      onRenameAsset(assetId, newName);
    }
  }, [onRenameAsset]);

  const handleDateChange = useCallback((assetId: string, date: string, isValid: boolean) => {
    if (isValid) {
      onSetAssetStartDate(assetId, date);
    }
  }, [onSetAssetStartDate]);

  return (
    <div className="asset-selector bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Select Assets 
        <span className="ml-2 text-sm font-normal text-gray-500">
          ({selectedAssets.length} / {VALIDATION_LIMITS.MAX_ASSETS})
        </span>
      </h2>

      {/* Warning when approaching limit */}
      {nearLimit && !isAtLimit && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ Approaching asset limit. You can add {VALIDATION_LIMITS.MAX_ASSETS - selectedAssets.length} more assets.
          </p>
        </div>
      )}

      {/* Add Asset Section */}
      <div className="mb-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label htmlFor="asset-type" className="block text-sm font-medium text-gray-700 mb-1">
              Asset Type
            </label>
            <select
              id="asset-type"
              value={selectedAssetType}
              onChange={(e) => setSelectedAssetType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isAtLimit}
            >
              <option value="">Select an asset type...</option>
              {availableAssets.map(asset => (
                <option key={asset} value={asset}>{asset}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <ValidatedInput
              id="custom-asset-name"
              value={customAssetName}
              onChange={(value) => {
                if (typeof value === 'string') {
                  setCustomAssetName(value);
                }
              }}
              validationType="asset"
              label="Custom Name (Optional)"
              placeholder="Enter custom name..."
              disabled={isAtLimit}
            />
          </div>

          <button
            onClick={handleAddAsset}
            disabled={!selectedAssetType || isAtLimit}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              !selectedAssetType || isAtLimit
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isAtLimit ? 'Limit Reached' : 'Add Asset'}
          </button>
        </div>
      </div>

      {/* Selected Assets List */}
      {selectedAssets.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Selected Assets</h3>
          <div className="space-y-2">
            {selectedAssets.map(asset => (
              <div
                key={asset.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border border-gray-200"
              >
                {/* Asset Name */}
                <div className="flex-1">
                  {editingAssetId === asset.id ? (
                    <ValidatedInput
                      id={`asset-name-${asset.id}`}
                      value={asset.name}
                      onChange={(value, isValid) => {
                        if (typeof value === 'string') {
                          handleRenameAsset(asset.id, value, isValid);
                        }
                      }}
                      validationType="asset"
                      placeholder="Enter asset name..."
                      autoFocus
                    />
                  ) : (
                    <div
                      className="font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                      onClick={() => setEditingAssetId(asset.id)}
                    >
                      {asset.name}
                      <span className="ml-2 text-xs text-gray-500">(click to edit)</span>
                    </div>
                  )}
                </div>

                {/* Start Date (if not using global date) */}
                {!useGlobalDate && (
                  <div className="w-48">
                    <ValidatedInput
                      id={`asset-date-${asset.id}`}
                      value={asset.startDate}
                      onChange={(value, isValid) => {
                        if (typeof value === 'string') {
                          handleDateChange(asset.id, value, isValid);
                        }
                      }}
                      validationType="date"
                      type="date"
                      placeholder="Select date..."
                    />
                  </div>
                )}

                {/* Remove Button */}
                <button
                  onClick={() => onRemoveAsset(asset.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  aria-label={`Remove ${asset.name}`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedAssets.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No assets selected. Add an asset to get started.</p>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo - only re-render when relevant props change
  
  // Check arrays by length first (most common change)
  if (prevProps.availableAssets.length !== nextProps.availableAssets.length ||
      prevProps.selectedAssets.length !== nextProps.selectedAssets.length) {
    return false;
  }
  
  // Compare primitive props
  if (prevProps.useGlobalDate !== nextProps.useGlobalDate) {
    return false;
  }
  
  // Shallow compare availableAssets array
  for (let i = 0; i < prevProps.availableAssets.length; i++) {
    if (prevProps.availableAssets[i] !== nextProps.availableAssets[i]) {
      return false;
    }
  }
  
  // Deep compare selectedAssets array - check essential properties
  for (let i = 0; i < prevProps.selectedAssets.length; i++) {
    const prev = prevProps.selectedAssets[i];
    const next = nextProps.selectedAssets[i];
    
    if (!prev || !next || 
        prev.id !== next.id ||
        prev.name !== next.name ||
        prev.startDate !== next.startDate ||
        prev.type !== next.type) {
      return false;
    }
  }
  
  // Function props don't need comparison as they should be memoized via useCallback
  return true;
});

AssetSelectorValidated.displayName = 'AssetSelectorValidated';

export default AssetSelectorValidated;