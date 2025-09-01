# 📋 Accordion Timeline Builder - Master Refactoring Plan

## Overview
Transform the MVP timeline builder into a production-ready tool for DMGT's PM team (~20 users).

**Timeline:** 4 weeks  
**Approach:** Local development only, single push when complete  
**Priority:** Stability > Features  

---

## 🚨 PHASE 0: Critical Prerequisites
**Duration:** Day 1 (Morning)  
**Status:** Not Started

### Objectives
Fix critical issues before starting main refactoring.

### 0.1 Fix React Version Mismatch
- [ ] Downgrade @types/react from v19 to v18 to match react@18
- [ ] Downgrade @types/react-dom to v18
- [ ] Verify no type errors after alignment

### 0.2 Complete Missing Reducer Actions
- [ ] Implement UPDATE_TASK_BANK action (for CSV updates)
- [ ] Implement SET_DATE_ERRORS action
- [ ] Implement SET_CALCULATED_START_DATES action
- [ ] Implement BULK_UPDATE_DURATIONS action
- [ ] Test all actions work correctly

### 0.3 Setup Safe Switch-On Strategy
- [ ] Create feature flag or environment variable
- [ ] Keep both JS and TSX versions accessible
- [ ] Setup TimelineProvider wrapper at app root
- [ ] Create switch mechanism to toggle between versions

### Success Criteria
- [ ] No React version conflicts
- [ ] All reducer actions functional
- [ ] Can switch between JS/TSX versions safely

---

## 🏗️ PHASE 1: Architectural Foundation
**Duration:** Week 1 (4 days after Phase 0)  
**Status:** In Progress (Day 1 Complete)

### Objectives
Refactor the monolithic TimelineBuilder.js into a maintainable, testable architecture using modern React patterns.

### 1.1 Create useTimeline Custom Hook
- [ ] Create new file: `src/hooks/useTimeline.js`
- [ ] Move all timeline-related state logic
- [ ] Expose clean API for components
- [ ] Document all exported functions

### 1.2 Implement useReducer Pattern
- [ ] Define initial state structure:
  ```javascript
  {
    assets: [],
    tasks: [],
    customTasks: [],
    dates: { globalLiveDate, useGlobalDate, assetLiveDates },
    ui: { showInfoBox, editingTaskId },
    history: { past: [], future: [] }
  }
  ```
- [ ] Create reducer with actions:
  - [ ] `INITIALIZE_STATE`
  - [ ] `ADD_ASSET`
  - [ ] `REMOVE_ASSET` 
  - [ ] `UPDATE_ASSET`
  - [ ] `SET_GLOBAL_LIVE_DATE`
  - [ ] `SET_USE_GLOBAL_DATE`
  - [ ] `SET_ASSET_LIVE_DATE`
  - [ ] `ADD_CUSTOM_TASK`
  - [ ] `UPDATE_TASK_DURATION`
  - [ ] `UPDATE_TASK_NAME`
  - [ ] `IMPORT_TIMELINE`
  - [ ] `UNDO`
  - [ ] `REDO`
- [ ] Implement action creators
- [ ] Add validation to reducer

### 1.3 Split TimelineBuilder.js and GanttChart
Target: No file > 400 lines

- [ ] `TimelineBuilder.js` - Main orchestrator (300 lines max)
- [ ] Split `GanttChart.js` into:
  - [ ] `GanttChart.js` - Main container
  - [ ] `GanttTaskRow.js` - Individual task rows (with React.memo)
  - [ ] `GanttHeader.js` - Timeline header
  - [ ] `GanttGrid.js` - Background grid
- [ ] `hooks/useTimeline.js` - State management
- [ ] `services/TimelineCalculator.js` - Date/duration logic
- [ ] `services/DateUtilities.js` - Helper functions
- [ ] `services/StateManager.js` - Undo/redo logic
- [ ] `services/TaskBankManager.js` - Task management

### 1.4 Code Cleanup
- [ ] Remove all console.log statements
- [ ] Add JSDoc comments to all functions
- [ ] Standardize variable naming (no single letters)
- [ ] Extract magic numbers to constants
- [ ] Create `constants/timeline.js` for:
  - Colors
  - Sizes
  - Limits
  - Default values

### 1.5 Integration Testing Before Switch
- [ ] Create smoke test checklist:
  - [ ] Select assets → verify task bank updates
  - [ ] Set global date → see Gantt render
  - [ ] Edit task durations → verify recalculation
  - [ ] Test undo/redo functionality
  - [ ] Export to Excel → verify data integrity
- [ ] Test with TimelineProvider wrapper
- [ ] Verify no regressions from JS version
- [ ] Document any breaking changes

### Success Criteria
- [ ] TimelineBuilder.js < 400 lines
- [ ] GanttChart split into focused components
- [ ] All state managed through useReducer
- [ ] No console.log in production code
- [ ] All functions documented
- [ ] Smoke tests pass before switching entry point

---

## 💾 PHASE 2: Data Persistence & Recovery
**Duration:** Week 2 (5 days)  
**Status:** Not Started

### Objectives
Implement auto-save and Excel round-trip to prevent work loss.

### 2.1 LocalStorage Auto-Save
- [ ] Create `services/AutoSaveManager.js`
- [ ] Implement auto-save logic:
  - [ ] Save complete state every 30 seconds
  - [ ] Save on significant actions
  - [ ] Debounce rapid changes
- [ ] Add save indicator UI:
  - [ ] "Saving..." animation
  - [ ] "✓ Saved" confirmation
  - [ ] Last saved timestamp
- [ ] Implement recovery:
  - [ ] Check for saved state on load
  - [ ] Show recovery prompt with preview
  - [ ] One-click restoration
- [ ] Handle edge cases:
  - [ ] LocalStorage quota exceeded
  - [ ] Corrupted data
  - [ ] Browser compatibility

### 2.2 Excel Export Enhancement
- [ ] Keep existing visual sheets unchanged
- [ ] Add hidden "_DATA" sheet with:
  - [ ] Complete reducer state as JSON
  - [ ] Version identifier (app version)
  - [ ] Export timestamp
  - [ ] Metadata (PM name, project info)
  - [ ] Validation checksum
- [ ] Optimize for file size:
  - [ ] Compress JSON if needed
  - [ ] Remove redundant data
  - [ ] Warn if > 10MB

### 2.3 Excel Import Implementation
- [ ] Add "Import Timeline" button to UI
- [ ] Create file upload component:
  - [ ] Accept only .xlsx files
  - [ ] Show upload progress
  - [ ] Validate file size
- [ ] Parse Excel file:
  - [ ] Check for _DATA sheet
  - [ ] Validate data structure
  - [ ] Parse JSON state
  - [ ] Verify checksum
- [ ] Restore timeline:
  - [ ] Dispatch IMPORT_TIMELINE action
  - [ ] Show success message
  - [ ] Handle version mismatches
- [ ] Error handling:
  - [ ] Missing _DATA sheet
  - [ ] Corrupted data
  - [ ] Incompatible versions

### 2.4 Unsaved Changes Protection
- [ ] Track "dirty" state
- [ ] Warn on tab close if unsaved
- [ ] Offer quick export before leaving
- [ ] Show unsaved indicator in UI

### Success Criteria
- [ ] Auto-save works reliably
- [ ] Excel round-trip preserves all data
- [ ] No work lost on browser crash
- [ ] Clear save/load UI feedback

---

## 🛡️ PHASE 3: Security & Stability
**Duration:** Week 2-3 (3 days)  
**Status:** Not Started

### Objectives
Prevent crashes, handle errors gracefully, validate all inputs.

### 3.1 Input Validation
- [ ] Create `services/ValidationService.js`
- [ ] Validate text inputs:
  - [ ] Sanitize HTML/scripts
  - [ ] Limit lengths
  - [ ] Check special characters
- [ ] Validate dates:
  - [ ] Format checking
  - [ ] Reasonable ranges (1970-2100)
  - [ ] Invalid date handling
- [ ] Validate numbers:
  - [ ] Positive integers only
  - [ ] Maximum values (365 days)
  - [ ] Type checking
- [ ] File validation:
  - [ ] File type (.xlsx only)
  - [ ] File size (<50MB)
  - [ ] Content structure

### 3.2 Error Boundaries
- [ ] Create `ErrorBoundary.js` component
- [ ] Wrap main app
- [ ] Implement fallback UI
- [ ] Add error reporting
- [ ] Provide recovery options

### 3.3 User-Friendly Errors
- [ ] Replace technical messages
- [ ] Add helpful suggestions
- [ ] Provide recovery actions
- [ ] Log errors properly (not console)

### 3.4 Performance Guards
- [ ] Limit undo history (50 states)
- [ ] Maximum tasks (500)
- [ ] Calculation timeout (5 seconds)
- [ ] Infinite loop detection
- [ ] Memory usage monitoring

### Success Criteria
- [ ] No app crashes from bad input
- [ ] All errors show helpful messages
- [ ] Graceful degradation
- [ ] No infinite loops

---

## ⚡ PHASE 4: Performance Optimization
**Duration:** Week 3 (2 days)  
**Status:** Not Started

### Objectives
Ensure smooth performance for typical use cases (50-150 tasks).

### 4.1 Component Optimization
- [ ] Add React.memo to GanttTaskRow components
- [ ] Implement proper comparison function for memo
- [ ] Prevent unnecessary re-renders on unrelated state changes
- [ ] Optimize task selection and highlighting

### 4.2 Input Optimization  
- [ ] Debounce duration input changes
- [ ] Batch rapid state updates
- [ ] Optimize dropdown rendering
- [ ] Prevent layout thrashing

### 4.3 Calculation Optimization
- [ ] Memoize expensive date calculations with useMemo
- [ ] Cache working day lookups
- [ ] Cache bank holiday API responses
- [ ] Optimize dependency recalculation

### 4.4 State Management Optimization
- [ ] Optimize reducer for minimal updates
- [ ] Use useCallback for event handlers
- [ ] Batch related state changes
- [ ] Minimize Context re-renders

### Success Criteria
- [ ] 150 tasks perform smoothly
- [ ] < 50ms input response time
- [ ] No lag when editing durations
- [ ] Smooth undo/redo operations
- [ ] Graceful offline behavior for bank holidays API

---

## 🧪 PHASE 5: Testing & Quality Assurance
**Duration:** Week 3-4 (5 days)  
**Status:** 90% Complete - BREAKTHROUGH ACHIEVED ✅  
**Approach:** Playwright E2E First, Manual Testing Second

### Objectives
Ensure reliability through comprehensive testing with focus on real browser behavior.

### Why Playwright-First Approach?

Traditional unit tests miss real-world bugs that only appear during actual browser interactions:
- **Race conditions** from rapid user actions
- **Event bubbling** issues between nested components
- **Focus management** problems in modals and forms
- **Async timing** conflicts between auto-save and user edits
- **Browser-specific** quirks (especially Safari date inputs)

By running Playwright E2E tests BEFORE manual testing:
1. **Systematic bugs get caught and fixed first**
2. **Manual testers focus on UX quality, not bug hunting**
3. **Time allocated (Day 3) for fixing E2E findings**
4. **Higher confidence in production readiness**

### Comprehensive Testing Strategy

**Business Logic First:** Unlike typical UI-only E2E tests, our strategy prioritizes validating the core business functionality that PMs rely on:
- **Timeline calculations must be accurate** (working days, bank holidays, dependencies)
- **Accordion effect must work perfectly** (duration changes cascade correctly)
- **Data integrity is critical** (Excel round-trip preserves everything)
- **Crash protection actually works** (recovery prompts restore exact state)

**Four-Tier Approach:**
- **Tier 1**: Core PM workflows that must never fail
- **Tier 2**: Data persistence that prevents work loss
- **Tier 3**: Security and performance under load
- **Tier 4**: Edge cases and integration scenarios

**Real Data Testing:** All tests use actual DMGT asset types from the CSV file, not fictional test data, ensuring tests match production usage patterns.

**Expected Coverage:** ~80-100 comprehensive E2E tests focusing on business logic validation, complementing the 97 unit tests for complete coverage.

### 5.1 Unit Tests (Day 1-2) ✅ COMPLETE
- [x] ValidationService tests - XSS prevention, sanitization (62 tests) ✅
- [x] TimelineCalculator tests - Date calculations, timeline building (35 tests) ✅
- [x] Component tests - ValidatedInput, ValidationToasts ✅
- [x] Reducer tests - All actions, state immutability ✅
- [x] 97 total unit tests passing ✅

### 5.2 Playwright E2E Tests (Day 2-5) ✅ INFRASTRUCTURE COMPLETE
**Day 2-4 - Framework Setup:**
- [x] Playwright setup and configuration ✅
- [x] Professional test suite architecture with 25+ scenarios ✅
- [x] Multi-browser support (Chrome, Firefox, Safari, Mobile) ✅
- [x] Immutable data-testid strategy implementation ✅
- [x] Robust test helpers with content-based asset finding ✅

**Day 5 - Critical Breakthrough:**
- [x] TypeScript compilation errors systematically resolved ✅
- [x] App compilation and runtime success achieved ✅
- [x] All testing infrastructure validated and ready ✅

**TIER 1: Critical Business Logic Tests (Must Have)**
- [ ] **Timeline Generation & Accuracy**
  - [ ] Real CSV sequence testing with actual DMGT asset types
  - [ ] Working day calculations (5-day task = 1 calendar week)
  - [ ] Bank holiday impact on timeline calculations
  - [ ] Multiple asset coordination without conflicts
- [ ] **Accordion Effect Validation**
  - [ ] Duration increase: task 3→7 days shifts all subsequent tasks +4 days
  - [ ] Duration decrease: task 5→2 days compresses timeline by 3 days
  - [ ] Custom task insertion triggers appropriate accordion effect
  - [ ] Custom task deletion contracts timeline correctly
- [ ] **Go-Live Date Business Rules**
  - [ ] Impossible date warnings (requires past start date)
  - [ ] Working day validation (50-day project with 30-day notice)
  - [ ] Bank holiday conflicts (go-live on Christmas Day)
- [ ] **Undo/Redo System Integrity**
  - [ ] Complex undo chains with timeline recalculation
  - [ ] Redo accuracy with accordion effect reapplication
  - [ ] State history limits (60 actions, oldest purged)
  - [ ] Undo during active edit maintains state consistency

**TIER 2: Data Integrity & Persistence Tests (Must Have)**
- [ ] **Excel Export/Import Accuracy**
  - [ ] Visual Gantt chart vs Excel data matching (every task, date, duration)
  - [ ] _DATA tab completeness for 100% identical restoration
  - [ ] Custom task preservation through round-trip
  - [ ] Duration override preservation through export/import
- [ ] **Auto-Save & Crash Recovery**
  - [ ] Auto-save frequency (30-second intervals during activity)
  - [ ] Critical action saves (immediate save after asset/duration changes)
  - [ ] Browser crash simulation with recovery prompt verification
  - [ ] Recovery accuracy: "Restore" rebuilds exact timeline state
  - [ ] Recovery prompt messaging: "Auto-backup prevents work loss during crashes"
  - [ ] "Start Fresh" vs "Restore" functionality validation
  - [ ] Storage failure graceful degradation (localStorage quota exceeded)

**TIER 3: Security & Validation Tests (Important)**
- [ ] **Input Validation & XSS Prevention**
  - [ ] Malicious asset names: `<script>alert('xss')</script>` sanitization
  - [ ] SQL injection attempts in all input fields
  - [ ] Limit enforcement: 51st asset/501st task hard blocks
  - [ ] Invalid date handling with clear error messages
- [ ] **Performance & Edge Cases**
  - [ ] 150-task timeline renders within 2 seconds
  - [ ] Rapid interaction handling (faster than debounce intervals)
  - [ ] API failure graceful degradation (gov.uk bank holidays unavailable)
  - [ ] Memory leak prevention during rapid add/remove cycles

**TIER 4: Integration Scenarios (Nice to Have)**
- [ ] **Cross-Feature Interactions**
  - [ ] Undo during auto-save: state consistency verification
  - [ ] Validation during Excel import with malformed data
  - [ ] Complex timeline edge cases (cross-year, leap year, weekend boundaries)
- [ ] **User Experience Edge Cases**
  - [ ] Unsaved changes warning on browser close (beforeunload event)
  - [ ] Gov.UK API fallback with appropriate user messaging
  - [ ] Keyboard navigation for accessibility compliance

**Legacy UI Tests (Keep Existing)**
- [ ] Asset management workflows with real DMGT asset types
- [ ] Task editing and custom task creation flows
- [ ] Basic Excel export → import round-trip testing

### 5.3 Manual Testing (Day 4)
**Focus Areas (Post-Playwright):**
- [ ] User experience and "feel"
- [ ] Visual issues Playwright can't catch
- [ ] Complex multi-step workflows
- [ ] Accessibility (keyboard nav, screen readers)
- [ ] Performance with real PM data (150+ tasks)
- [ ] Fix any manual testing findings

### 5.4 Documentation (Day 4)
- [ ] User guide for PMs
- [ ] Technical documentation
- [ ] Test coverage report
- [ ] Update README

### Success Criteria
- [x] 97+ unit tests passing ✅
- [x] Professional E2E testing infrastructure complete ✅
- [x] TypeScript compilation success achieved ✅
- [x] App running successfully (http://localhost:3000) ✅
- [ ] **TIER 1: Critical Business Logic Tests** (Timeline generation, accordion effect, undo/redo, go-live warnings)
- [ ] **TIER 2: Data Integrity Tests** (Excel accuracy, auto-save/recovery, crash protection)
- [ ] **TIER 3: Security & Performance Tests** (XSS prevention, limits, 150-task performance)
- [ ] **TIER 4: Integration & Edge Cases** (Cross-feature interactions, API failures)
- [ ] Manual testing confirms good UX and messaging clarity
- [ ] Documentation complete with testing strategy
- [ ] Works in Chrome, Firefox, Safari with real DMGT data

---

## 🚀 Future Enhancements (Post-Launch)

### Custom Asset Templates
- New feature allowing PMs to create asset types
- Requires separate specification
- Not part of initial refactoring

### Additional Features
- Template library
- Collaboration features
- Advanced Excel options
- Integration with PM tools

---

## 📝 Implementation Notes

### Git Strategy
1. All work on local branch
2. No pushing until complete
3. Single push when tested
4. Client sees only working version

### Daily Workflow
1. Check REFACTORING-STATUS.md
2. Update progress locally
3. Commit locally (no push)
4. Update status at end of day

### Testing Strategy
- Test each phase before moving on
- Keep old code as reference
- Maintain backwards compatibility
- Document breaking changes

### Risk Mitigation
- Keep backup of working version
- Test thoroughly before pushing
- Have rollback plan ready
- Document all decisions

---

## ✅ Definition of Done

The refactoring is complete when:

1. **Architecture:** Clean, maintainable code structure
2. **Persistence:** Never loses work
3. **Security:** No vulnerabilities
4. **Performance:** Handles large timelines
5. **Quality:** Tested and documented
6. **Deployment:** Single working push to main

---

Last Updated: [Update when modifying plan]