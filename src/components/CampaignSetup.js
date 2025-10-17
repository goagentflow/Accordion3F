import React, { useState } from 'react';

const CampaignSetup = React.memo(({ 
    clientCampaignName,
    onClientCampaignNameChange,
    globalLiveDate, 
    onGlobalLiveDateChange, 
    useGlobalDate, 
    onUseGlobalDateChange, 
    projectStartDate, 
    dateErrors,
    workingDaysNeeded,
    bankHolidays = []
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

    // Detect if a date is a non-working day (weekend or bank holiday)
    const isNonWorkingDay = (dateString) => {
        if (!dateString) return false;
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return false;
        const day = d.getDay();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const iso = `${yyyy}-${mm}-${dd}`;
        return day === 0 || day === 6 || (Array.isArray(bankHolidays) && bankHolidays.includes(iso));
    };

    // Check if calculated start date is in the past
    const isStartDateInPast = dateErrors.length > 0;

    return (
        <div className="mb-6">
            <h3 className="text-lg font-medium mb-4 text-gray-700 flex items-center">
                <span className="mr-2">📅</span>
                Campaign Setup
            </h3>

            {/* Client/Campaign Name */}
            <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client/Campaign Name *
                </label>
                <input
                    type="text"
                    value={clientCampaignName || ''}
                    onChange={(e) => onClientCampaignNameChange && onClientCampaignNameChange(e.target.value)}
                    placeholder="e.g., Barclays Autumn Campaign"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    data-testid="project-name"
                />
            </div>

            {/* Campaign Live Date */}
            <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Live Date *
                </label>
                {/* Helper text for instructions, smaller than the label */}
                <p className="text-xs text-gray-500 mb-2">
                    If campaign elements start on different days, uncheck the box and set each asset's start date when selected.
                </p>
                <input
                    type="date"
                    value={globalLiveDate}
                    onChange={handleLiveDateChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    data-testid="global-live-date"
                />
                {globalLiveDate && (
                    <p className="text-xs text-gray-500 mt-1">
                        {formatDate(globalLiveDate)}
                    </p>
                )}
            </div>

            {/* Non-working day info for go-live (amber) */}
            {globalLiveDate && isNonWorkingDay(globalLiveDate) && (
                <div className="mb-4 bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-md p-3 text-sm">
                    <div className="font-medium">Heads up: Go-live is on a non‑working day</div>
                    <div className="mt-1">
                        The live task will be anchored to this date. All other tasks adjust to working days only.
                    </div>
                </div>
            )}

            {/* Use Global Date Toggle */}
            <div className="mb-3">
                <label className="flex items-center">
                    <input
                        type="checkbox"
                        checked={useGlobalDate}
                        onChange={handleUseGlobalToggle}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        data-testid="use-global-date-checkbox"
                    />
                    <span className="text-sm text-gray-700">
                        Use same live date for all assets
                    </span>
                </label>
            </div>

            {/* Calculated Project Start Date - Made less prominent */}
            {projectStartDate && (
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Earliest Work Start Date
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
                            Work can begin on this date to complete by {formatDate(globalLiveDate)}
                        </p>
                    )}
                </div>
            )}

            {/* Real-time Working Days Indicator */}
            {workingDaysNeeded && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Timeline Status
                    </label>
                    <div className={`px-3 py-2 border rounded-md ${
                        workingDaysNeeded.needed > 0
                            ? 'border-red-300 bg-red-50'
                            : workingDaysNeeded.needed < 0
                            ? 'border-green-300 bg-green-50'
                            : 'border-blue-300 bg-blue-50'
                    }`}>
                        <div className="text-sm font-medium">
                            {workingDaysNeeded.needed > 0 ? (
                                <span className="text-red-700">
                                    {(() => {
                                        const count = Array.isArray(dateErrors) ? dateErrors.length : 0;
                                        const x = workingDaysNeeded.needed;
                                        const y = count;
                                        const dayLabel = x !== 1 ? 'days' : 'day';
                                        const assetLabel = y !== 1 ? 'assets' : 'asset';
                                        return `⚠️ ${x} ${dayLabel} need to be saved to start on time across ${y} ${assetLabel}`;
                                    })()}
                                </span>
                            ) : workingDaysNeeded.needed < 0 ? (
                                <span className="text-green-700">
                                    ✅ {Math.abs(workingDaysNeeded.needed)} day{Math.abs(workingDaysNeeded.needed) !== 1 ? 's' : ''} to spare
                                </span>
                            ) : (
                                <span className="text-blue-700">
                                    🎯 You're on target
                                </span>
                            )}
                        </div>
                        {/* Removed Available/Allocated row per UX request */}
                    </div>
                </div>
            )}

            {/* Removed Client Deadline (Optional) section */}

            {/* Summary */}
            {globalLiveDate && projectStartDate && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">Timeline Summary</h4>
                    <div className="text-xs text-blue-700">
                        <p><strong>Campaign Live Date:</strong> {formatDate(globalLiveDate)}</p>
                        <p><strong>Earliest Work Start:</strong> {formatDate(projectStartDate)}</p>
                        {isStartDateInPast && (
                            <p className="text-red-600 font-medium mt-1">
                                ⚠️ Manual task adjustment required
                            </p>
                        )}
                        {dateErrors.length > 0 && (
                            <p className="text-red-600 font-medium mt-1">
                                ⚠️ {dateErrors.length} asset{dateErrors.length !== 1 ? 's' : ''} with date conflicts - manual adjustment needed
                            </p>
                        )}
                        {dateErrors.length === 0 && !isStartDateInPast && (
                            <p className="text-green-600 font-medium mt-1">
                                ✅ All assets can be completed on schedule
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison - only re-render when relevant props change
    return (
        prevProps.clientCampaignName === nextProps.clientCampaignName &&
        prevProps.globalLiveDate === nextProps.globalLiveDate &&
        prevProps.useGlobalDate === nextProps.useGlobalDate &&
        prevProps.projectStartDate === nextProps.projectStartDate &&
        prevProps.dateErrors?.length === nextProps.dateErrors?.length &&
        JSON.stringify(prevProps.workingDaysNeeded) === JSON.stringify(nextProps.workingDaysNeeded)
    );
});

CampaignSetup.displayName = 'CampaignSetup';

export default CampaignSetup;
