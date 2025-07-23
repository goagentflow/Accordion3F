import React, { useState } from 'react';

const CampaignSetup = ({ 
    globalLiveDate, 
    onGlobalLiveDateChange, 
    useGlobalDate, 
    onUseGlobalDateChange, 
    projectStartDate, 
    dateErrors 
}) => {
    // Remove the clientDeadline state and handleDeadlineChange

    // Handle global live date change
    const handleLiveDateChange = (e) => {
        const newDate = e.target.value;
        onGlobalLiveDateChange(newDate);
    };

    // Handle use global date toggle
    const handleUseGlobalToggle = (e) => {
        onUseGlobalDateChange(e.target.checked);
    };

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    // Check if calculated start date is in the past
    const isStartDateInPast = dateErrors.length > 0;

    return (
        <div className="mb-6">
            <h3 className="text-lg font-medium mb-4 text-gray-700 flex items-center">
                <span className="mr-2">📅</span>
                Campaign Setup
            </h3>

            {/* Campaign Live Date */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Live Date *
                </label>
                {/* Helper text for instructions, smaller than the label */}
                <p className="text-xs text-gray-500 mb-2">
                    If campaign elements start on different days, uncheck the box and set each asset’s start date when selected.
                </p>
                <input
                    type="date"
                    value={globalLiveDate}
                    onChange={handleLiveDateChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                />
                {globalLiveDate && (
                    <p className="text-xs text-gray-500 mt-1">
                        {formatDate(globalLiveDate)}
                    </p>
                )}
            </div>

            {/* Use Global Date Toggle */}
            <div className="mb-4">
                <label className="flex items-center">
                    <input
                        type="checkbox"
                        checked={useGlobalDate}
                        onChange={handleUseGlobalToggle}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                        Use same live date for all assets
                    </span>
                </label>
            </div>

            {/* Calculated Project Start Date */}
            {projectStartDate && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Calculated Project Start Date
                    </label>
                    <div className={`px-3 py-2 border rounded-md ${
                        isStartDateInPast 
                            ? 'border-red-300 bg-red-50 text-red-700' 
                            : 'border-gray-300 bg-gray-50 text-gray-700'
                    }`}>
                        <span className="font-medium">
                            {formatDate(projectStartDate)}
                        </span>
                        {isStartDateInPast && (
                            <span className="ml-2 text-red-600 text-sm">
                                ⚠️ In the past
                            </span>
                        )}
                    </div>
                    {projectStartDate && !isStartDateInPast && (
                        <p className="text-xs text-gray-500 mt-1">
                            Project can start on schedule
                        </p>
                    )}
                </div>
            )}

            {/* Removed Client Deadline (Optional) section */}

            {/* Summary */}
            {globalLiveDate && projectStartDate && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">Timeline Summary</h4>
                    <div className="text-xs text-blue-700">
                        <p>Start: {formatDate(projectStartDate)}</p>
                        <p>Live: {formatDate(globalLiveDate)}</p>
                        {isStartDateInPast && (
                            <p className="text-red-600 font-medium mt-1">
                                ⚠️ Manual task adjustment required
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CampaignSetup;