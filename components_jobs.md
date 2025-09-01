# Components Jobs - User Journey File Mapping

This document explains what files and components get activated at each stage of the user journey through the Accordion Timeline Builder app.

## 🎯 **USER JOURNEY: FILES IN ACTION**

### **STEP 1: User Opens the App**
**What happens:** Browser loads the application

**Files activated:**
- **`index.js`** - *The doorman* - Opens the door, starts everything up
- **`TimelineBuilder.js`** - *The main coordinator* - Takes control, sets up the workspace
- **`index.css`** - *The decorator* - Makes everything look nice with colors and fonts

**What you see:** The main screen with "Accordion Timeline Builder" header and "Getting Started" button

---

### **STEP 2: User Uploads a CSV File**
**What happens:** User drags/drops or selects a CSV file

**Files activated:**
1. **`TimelineBuilder.js`** - *The receptionist* - Receives the file, starts processing
2. **`AssetSelector.js`** - *The organizer* - Reads the CSV, creates the list of available assets
3. **`ValidationService.ts`** - *The inspector* - Checks if the CSV format is correct

**What you see:** List of assets appears (e.g., "TV Ad", "Radio Spot", "Digital Banner")

---

### **STEP 3: User Sets a Go-Live Date**
**What happens:** User picks a date on the calendar

**Files activated:**
1. **`CampaignSetup.js`** - *The scheduler* - Captures the date, shows the calendar
2. **`TimelineBuilder.js`** - *The coordinator* - Stores this date, prepares for timeline creation
3. **`dateHelpers.ts`** - *The calendar expert* - Validates the date, checks if it's a working day

**What you see:** Date picker interface, selected date displays

---

### **STEP 4: User Selects Assets**
**What happens:** User checks boxes next to assets they want

**Files activated:**
1. **`AssetSelector.js`** - *The selector* - Shows checkboxes, tracks which ones are selected
2. **`TimelineBuilder.js`** - *The coordinator* - Remembers the choices
3. **`TimelineCalculator.ts`** - *The mathematician* - Starts preparing calculations

**What you see:** Checkboxes get ticked, selected assets highlighted

---

### **STEP 5: Magic Happens - Timeline Generates**
**What happens:** App automatically creates the timeline

**Files activated (this is where it gets busy!):**
1. **`TimelineCalculator.ts`** - *The mathematician* - Does all the math
   - Counts backward from go-live date
   - Calculates task durations
   - Figures out start dates

2. **`dateHelpers.ts`** - *The calendar expert* - Helps with the math
   - Skips weekends
   - Handles bank holidays
   - Converts calendar days to working days

3. **`TimelineBuilder.js`** - *The coordinator* - Assembles everything together

4. **`GanttChart.js`** - *The artist* - Starts drawing the timeline

**What you see:** Timeline suddenly appears with colored bars

---

### **STEP 6: Timeline Displays**
**What happens:** The beautiful timeline appears on screen

**Files activated:**
1. **`GanttChart.js`** - *The canvas* - Creates the main drawing area
2. **`GanttHeader.js`** - *The ruler* - Draws the date columns at the top
3. **`GanttTaskRow.js`** - *The painter* - Draws each colored task bar
4. **`GanttLegend.js`** - *The guide* - Shows what colors mean (our recent work!)
5. **`ganttUtils.js`** - *The toolkit* - Provides drawing tools and measurements

**What you see:** Full timeline with:
- Date columns across the top
- Colored bars for each task
- Legend showing what colors mean

---

### **STEP 7: User Drags a Task (Editing)**
**What happens:** User clicks and drags to change task duration

**Files activated:**
1. **`GanttTaskRow.js`** - *The detector* - Notices the mouse drag, measures the change
2. **`TimelineBuilder.js`** - *The coordinator* - Updates the task information
3. **`TimelineCalculator.ts`** - *The mathematician* - Recalculates affected dates
4. **`useUndoRedo.ts`** - *The historian* - Saves this change for potential undo
5. **`GanttChart.js`** - *The artist* - Redraws the updated timeline

**What you see:** Task bar gets longer/shorter, other tasks may shift

---

### **STEP 8: Auto-Save Kicks In**
**What happens:** App automatically saves work (every 30 seconds)

**Files activated:**
1. **`useAutoSave.ts`** - *The guardian* - Triggers the save
2. **`AutoSaveManager.ts`** - *The librarian* - Actually saves the data
3. **`SaveIndicator.tsx`** - *The reporter* - Shows "Saved" message

**What you see:** Little "Saved" indicator appears briefly

---

### **STEP 9: User Presses Undo (Ctrl+Z)**
**What happens:** User wants to undo their last change

**Files activated:**
1. **`useUndoRedo.ts`** - *The time machine* - Goes back one step in history
2. **`TimelineBuilder.js`** - *The coordinator* - Restores the previous state
3. **`GanttChart.js`** - *The artist* - Redraws the old version

**What you see:** Timeline returns to previous state

---

### **STEP 10: User Exports to Excel**
**What happens:** User clicks "Export" button

**Files activated:**
1. **`TimelineBuilder.js`** - *The coordinator* - Gathers all the data
2. **`ExcelExporter.js`** - *The translator* - Converts timeline data into Excel format
3. Browser - Downloads the file

**What you see:** Excel file downloads to computer

---

### **STEP 11: User Imports an Excel File**
**What happens:** User uploads a previously exported timeline

**Files activated:**
1. **`ExcelImporter.js`** - *The reader* - Opens and reads the Excel file
2. **`ValidationService.ts`** - *The inspector* - Checks if the data is valid
3. **`TimelineBuilder.js`** - *The coordinator* - Loads the data and rebuilds everything
4. **All the display files** - Redraw the imported timeline

**What you see:** Timeline loads with the imported data

---

## 🎭 **THE KEY PLAYERS (Think of them as job roles)**

**TimelineBuilder.js** = *The Project Manager* - Coordinates everything, makes decisions

**TimelineCalculator.ts** = *The Mathematician* - Does all the number crunching

**GanttChart.js** = *The Artist* - Draws the visual timeline

**dateHelpers.ts** = *The Calendar Expert* - Handles all date-related tasks

**ValidationService.ts** = *The Quality Inspector* - Makes sure everything is correct

**useUndoRedo.ts** = *The Historian* - Remembers everything for undo/redo

**AutoSaveManager.ts** = *The Guardian* - Protects your work by saving automatically

The beauty is that each file has ONE clear job, and they all work together like a well-orchestrated team to create your timeline experience!