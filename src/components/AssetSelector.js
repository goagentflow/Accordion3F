import React, { useState } from 'react';

const AssetSelector = ({
    assets = [],
    selectedAssets = [],
    onAddAsset = () => {},
    onRemoveAsset = () => {},
    useGlobalDate = true,
    globalLiveDate = '',
    assetLiveDates = {},
    onAssetLiveDateChange = () => {},
    calculatedStartDates = {},
    dateErrors = [],
    onRenameAsset = () => {},
    onAssetStartDateChange = () => {}
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Filter assets based on search term
    const filteredAssets = (assets || []).filter(asset =>
        asset && typeof asset === 'string' && asset.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-GB', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    // Get the live date for a specific asset (ensure date format consistency)
    const getAssetLiveDate = (assetName) => {
        if (useGlobalDate) {
            return globalLiveDate;
        }
        return assetLiveDates[assetName] || globalLiveDate;
    };

    // Handle individual asset live date change (ensure proper date format)
    const handleAssetDateChange = (assetName, date) => {
    // This now allows the date to be set OR cleared
    onAssetLiveDateChange(assetName, date);
};
    // Check if asset has date conflict
    const hasDateError = (assetName) => {
        return dateErrors.includes(assetName);
    };

    // Calculate working days between two dates (matching TimelineBuilder logic)
    const calculateWorkingDaysBetween = (startDate, endDate) => {
        if (!startDate || !endDate) return 0;
       
        const start = new Date(startDate);
        const end = new Date(endDate);
       
        if (start >= end) return 0;
       
        let workingDays = 0;
        let currentDate = new Date(start);
       
        while (currentDate < end) {
            const dayOfWeek = currentDate.getDay();
            // Count if not weekend (0 = Sunday, 6 = Saturday)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                workingDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
       
        return workingDays;
    };

    // Get working days that need to be saved for an asset
    const getWorkingDaysToSave = (assetName) => {
        const calculatedStart = calculatedStartDates[assetName];
        if (!calculatedStart || !hasDateError(assetName)) return 0;
       
        const today = new Date();
        today.setHours(0, 0, 0, 0);
       
        // Ensure we're working with proper date format
        const startDate = new Date(calculatedStart);
       
        return calculateWorkingDaysBetween(startDate, today);
    };

    return (
        <div className="bg-white rounded-lg shadow-sm">
            {/* Info Box removed, now shown globally at the top of the app */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Select Assets</h3>
                <div className="text-sm text-gray-600">
                    {(selectedAssets || []).length} asset{(selectedAssets || []).length !== 1 ? 's' : ''} selected
                </div>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search assets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            {/* Assets List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredAssets.map((assetType) => (
                    <div key={assetType} className="flex items-center justify-between mb-2">
                        <span className="text-sm">{assetType}</span>
                        <button
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                            onClick={() => onAddAsset(assetType)}
                        >
                            Add
                        </button>
                    </div>
                ))}
            </div>

            {/* Display Selected Asset Instances */}
            <div className="mt-4">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Selected Assets</h4>
                {selectedAssets.length === 0 && (
                    <div className="text-xs text-gray-500">No assets selected.</div>
                )}
                {selectedAssets.map(asset => (
                    <div
                        key={asset.id}
                        className="border rounded p-3 mb-4 bg-gray-50"
                        style={{ minWidth: 320 }}
                    >
                        <div className="flex items-center mb-2">
                            <input
                                type="text"
                                value={asset.name}
                                onChange={e => onRenameAsset(asset.id, e.target.value)}
                                className="text-sm border rounded px-2 py-1 mr-2 w-40"
                            />
                            <input
                                type="date"
                                value={asset.startDate}
                                onChange={e => onAssetStartDateChange(asset.id, e.target.value)}
                                className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ml-2"
                                disabled={useGlobalDate}
                            />
                        </div>
                        <button
                            className="px-2 py-1 bg-red-500 text-white rounded text-xs mt-2 w-full"
                            onClick={() => onRemoveAsset(asset.id)}
                        >
                            Remove
                        </button>
                    </div>
                ))}
            </div>

            {/* Summary */}
            {(selectedAssets || []).length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm">
                        <div className="font-medium text-blue-900 mb-1">
                            Selected Assets: {(selectedAssets || []).map(a => a.name).join(', ')}
                        </div>
                        {dateErrors.length > 0 && (
                            <div className="text-red-700 text-xs">
                                ⚠️ {dateErrors.length} asset{dateErrors.length !== 1 ? 's' : ''} with date conflicts - manual adjustment needed
                            </div>
                        )}
                        {dateErrors.length === 0 && (selectedAssets || []).length > 0 && (
                            <div className="text-green-700 text-xs">
                                ✅ All assets can be completed on schedule
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetSelector;