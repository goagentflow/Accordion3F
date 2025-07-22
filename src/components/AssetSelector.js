import React, { useState } from 'react';

const AssetSelector = ({
    assets = [],
    selectedAssets = [],
    onAssetToggle = () => {},
    useGlobalDate = true,
    globalLiveDate = '',
    assetLiveDates = {},
    onAssetLiveDateChange = () => {},
    calculatedStartDates = {},
    dateErrors = []
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
                {filteredAssets.map((asset) => {
                    const isSelected = (selectedAssets || []).includes(asset);
                    const hasError = hasDateError(asset);
                    const assetLiveDate = getAssetLiveDate(asset);
                    const calculatedStart = calculatedStartDates[asset];
                    const workingDaysToSave = getWorkingDaysToSave(asset);
                   
                    return (
                        <div
                            key={asset}
                            className={`border rounded-lg p-3 ${
                                hasError
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-gray-200 bg-white'
                            }`}
                        >
                            {/* Asset Selection */}
                            <div className="flex items-start space-x-3">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => onAssetToggle(asset)}
                                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium ${
                                        hasError ? 'text-red-900' : 'text-gray-900'
                                    }`}>
                                        {asset}
                                        {hasError && (
                                            <span className="ml-2 text-red-600">
                                                ⚠️ Need to save {workingDaysToSave} working day{workingDaysToSave !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>

                                    {/* Date Information */}
                                    {isSelected && (
                                        <div className="mt-2 space-y-2">
                                            {/* Live Date */}
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs text-gray-600 w-16">Live Date:</span>
                                                {useGlobalDate ? (
                                                    <span className="text-xs text-gray-700">
                                                        {assetLiveDate ? formatDate(assetLiveDate) : 'Not set'}
                                                        <span className="ml-1 text-gray-500">(Global)</span>
                                                    </span>
                                                ) : (
                                                   <input
    type="date"
    value={assetLiveDates[asset] || ''}
    onChange={(e) => handleAssetDateChange(asset, e.target.value)}
    className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
/>
                                                )}
                                            </div>

                                            {/* Calculated Start Date */}
                                            {calculatedStart && (
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-xs text-gray-600 w-16">Must Start:</span>
                                                    <span className={`text-xs font-medium ${
                                                        hasError ? 'text-red-700' : 'text-green-700'
                                                    }`}>
                                                        {formatDate(calculatedStart)}
                                                        {hasError && (
                                                            <span className="ml-1 text-red-600">(Past)</span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            {(selectedAssets || []).length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm">
                        <div className="font-medium text-blue-900 mb-1">
                            Selected Assets: {(selectedAssets || []).join(', ')}
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