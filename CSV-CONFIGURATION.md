# CSV Configuration Setup

This document explains how to set up CSV configuration for the Accordion Timeline Generator to allow clients to manage their own asset types and workflows.

## Overview

The system now supports loading CSV configuration from multiple sources:
- **Development**: Local CSV file (default)
- **Testing**: GitHub config repository  
- **Production**: Client's SharePoint/OneDrive (hard-coded)

## Repository Structure

```
Main Project (accordion3f)
├── src/TimelineBuilder.js (reads CSV from configurable source)
└── public/Group_Asset_Task_Time.csv (fallback/development)

Config Repository (accordion-config) 
├── Group_Asset_Task_Time.csv (master configuration)
├── README.md (client instructions)
├── examples/adding-new-asset.md
└── .gitignore
```

## Configuration Options

### Development (Default)
```bash
# Uses local public/Group_Asset_Task_Time.csv
# No environment variables needed
```

### Testing with Config Repository
```bash
export REACT_APP_CSV_SOURCE=github
# Loads from GitHub raw URL (replace YOUR_ACCOUNT)
```

### Client Production 
```bash
export REACT_APP_CSV_SOURCE=production
export REACT_APP_CSV_URL="https://client.sharepoint.com/path/to/file.csv"
# Or hard-code the URL in production build
```

## Client Workflow

### Option 1: Git-Based (Development/Testing)
1. Client gets access to accordion-config repository
2. Edits CSV file in Excel
3. Commits and pushes changes
4. App automatically loads updated configuration

### Option 2: SharePoint-Based (Production)
1. Client uploads CSV to their SharePoint/OneDrive
2. Provides public read URL or sets up authentication
3. URL is hard-coded into production build
4. Client manages CSV through familiar Office tools

## Implementation Steps

### For Development/Testing
1. Create accordion-config repository on GitHub
2. Set `REACT_APP_CSV_SOURCE=github` to test
3. Update GitHub URL in TimelineBuilder.js (replace YOUR_ACCOUNT)

### For Production Delivery
1. Get client's SharePoint/OneDrive URL
2. Hard-code URL in production build:
   ```javascript
   const CSV_SOURCES = {
     'production': 'https://client-specific-url.csv'
   };
   ```
3. Build and containerize
4. Deliver with instructions for CSV management

## CSV Structure Requirements

The CSV must have these exact columns:
- `Category` - Asset grouping
- `Asset Type` - Becomes dropdown option
- `Task` - Individual task name
- `Duration (Days)` - Numeric duration
- `owner` - c/m/a/l codes only

## Error Handling

The system includes:
- CSV structure validation
- Clear error messages for invalid data
- Fallback to local CSV if external source fails
- Console logging for debugging

## Client Benefits

- **Self-service** - Add new assets without developer involvement
- **Familiar tools** - Edit in Excel/Excel Online
- **Version control** - Git history or SharePoint versioning
- **Access control** - Managed through existing systems
- **No code access** - Client never sees application source

## Security

- Client never has access to application code
- CSV-only repository or SharePoint folder access
- No authentication system to build or maintain
- Uses client's existing access control systems