/**
 * Type declarations for legacy CampaignSetup.js component
 * Provides TypeScript interface for the untyped JavaScript component
 */

declare module './components/CampaignSetup' {
  import React from 'react';

  export interface CampaignSetupProps {
    globalLiveDate: string;
    onGlobalLiveDateChange: (date: string) => void;
    useGlobalDate: boolean;
    onUseGlobalDateChange: (checked: boolean) => void;
    projectStartDate: string;
    dateErrors: string[];
    workingDaysNeeded?: {
      available: number;
      allocated: number;
      needed: number;
    };
  }

  declare const CampaignSetup: React.FC<CampaignSetupProps>;
  export default CampaignSetup;
}