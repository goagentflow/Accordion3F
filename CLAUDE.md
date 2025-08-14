# Accordion Timeline Builder

A React-based campaign project management tool for marketing teams to plan and visualize digital campaign timelines.

## What This Project Does

This application helps marketing agencies and teams manage multi-asset campaign timelines by:

- **Backwards Timeline Planning**: Set campaign go-live dates and automatically calculate when work must start
- **Asset Management**: Select from predefined campaign assets (Digital Display, Social, Print, etc.) with standard task workflows
- **Schedule Optimization**: "Accordion" timelines by adjusting task durations when deadlines are tight
- **Visual Planning**: Interactive Gantt chart with drag-to-resize functionality
- **Professional Excel Export**: Generate well-formatted, styled Excel files for client and team sharing
- **Excel Round-Trip Workflow** *(save-capability branch)*: Save and restore complete timeline configurations for client revision workflows
- **Team Collaboration**: Share timelines via professional Excel output with proper formatting and colors

## Key Features

### Core Functionality (main branch)
- **CSV-Driven Asset Database**: Tasks and durations loaded from `Group_Asset_Task_Time.csv`
- **Business Day Calculations**: Respects weekends and UK bank holidays
- **Flexible Date Management**: Global launch dates or individual asset go-live dates
- **Custom Task Support**: Add bespoke tasks to standard workflows
- **Undo/Redo System**: Full history tracking with keyboard shortcuts
- **Timeline Warnings**: Alerts when schedules conflict with available time
- **High-Quality Excel Export**: Uses ExcelJS library to create professional spreadsheets with proper styling

### Enhanced Features (save-capability branch)
- **Excel Round-Trip Save/Restore**: Import previously exported Excel files to restore complete timeline configurations
- **Client Revision Workflow**: Export → client review → import → edit → re-export cycle
- **Embedded State Preservation**: Timeline state invisibly embedded in Excel files for seamless restoration
- **Safe Import UX**: Import only available on empty timelines to prevent accidental data loss

## Architecture

- **Frontend**: React 18 with hooks-based state management
- **Styling**: Tailwind CSS for responsive design
- **Data Processing**: PapaParse for CSV handling, ExcelJS for professional Excel export
- **State Management**: Local state with comprehensive undo/redo system

## Primary Use Case

Marketing agencies managing campaigns with multiple deliverables (display ads, social content, print materials) need to determine realistic project start dates and optimize schedules to meet client deadlines while accounting for approval cycles and non-working days. The Excel export capability makes it easy to share professional-looking timelines with clients and stakeholders.

## Development Commands

```bash
npm start    # Start development server
npm run build # Build for production
npm test     # Run tests
```

## Data Structure

The application expects a CSV file with columns:
- Category
- Asset Type  
- Task
- Duration (Days)
- owner (c=client, m=MMM/agency, a=3rd party, l=live)

## File Structure

- `src/TimelineBuilder.js` - Main application component with state management
- `src/components/CampaignSetup.js` - Date configuration and timeline status
- `src/components/AssetSelector.js` - Asset selection and individual editing
- `src/components/GanttChart.js` - Interactive timeline visualization and Excel export
- `public/Group_Asset_Task_Time.csv` - Asset database with predefined workflows