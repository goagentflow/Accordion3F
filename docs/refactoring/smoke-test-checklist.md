# 🧪 Smoke Test Checklist

## Pre-Switch Testing (Before enabling USE_NEW_VERSION flag)

This checklist must be completed before switching from the JS to TSX version.

### ✅ Core Functionality Tests

#### 1. CSV Loading & Asset Selection
- [ ] CSV loads without errors
- [ ] Asset list populates correctly
- [ ] Can select multiple assets
- [ ] Can deselect assets
- [ ] Asset names display correctly

#### 2. Date Management
- [ ] Global live date can be set
- [ ] Toggle between global and individual dates works
- [ ] Individual asset dates can be set
- [ ] Date validation prevents past dates
- [ ] Weekend dates handled correctly

#### 3. Timeline Generation
- [ ] Timeline calculates backwards from live date
- [ ] Working days calculation excludes weekends
- [ ] Bank holidays are properly excluded
- [ ] Tasks appear in correct order
- [ ] Dependencies are respected

#### 4. Gantt Chart Display
- [ ] Gantt chart renders all tasks
- [ ] Task bars show correct duration
- [ ] Colors match task owners (Client/MMM/Agency)
- [ ] Weekend columns are visually distinct
- [ ] Bank holiday columns are marked

#### 5. Task Editing
- [ ] Click task name to edit (inline editing)
- [ ] Duration can be changed via input field
- [ ] Duration can be changed via dragging
- [ ] Changes persist after edit
- [ ] Custom task names are retained

#### 6. Custom Tasks
- [ ] Add Task button opens modal
- [ ] Can add custom task to specific asset
- [ ] Custom task appears in timeline
- [ ] Custom task can be edited like others
- [ ] Custom task persists through updates

#### 7. Undo/Redo
- [ ] Undo reverses last action
- [ ] Redo restores undone action
- [ ] Multiple undo/redo operations work
- [ ] State consistency maintained
- [ ] Custom tasks preserved in undo/redo

#### 8. Excel Export
- [ ] Export button generates Excel file
- [ ] Excel contains all tasks
- [ ] Dates are formatted correctly
- [ ] Colors match task owners
- [ ] Weekend/holiday highlighting present

#### 9. Error Handling
- [ ] Date conflicts show warnings
- [ ] Asset alerts display correctly
- [ ] Invalid inputs show error messages
- [ ] App doesn't crash on edge cases
- [ ] Graceful handling of API failures

#### 10. Performance
- [ ] No lag with 50+ tasks
- [ ] Smooth scrolling in Gantt
- [ ] Quick response to edits
- [ ] No memory leaks after extended use
- [ ] Undo/redo performs quickly

### 🔄 Regression Tests

#### Compare JS vs TSX versions:
- [ ] Same CSV produces identical timeline
- [ ] Date calculations match exactly
- [ ] UI elements in same positions
- [ ] All features present in both versions
- [ ] No console errors in either version

### 📋 Test Data

Use these test scenarios:

1. **Simple Test**
   - 2 assets
   - Global live date: 2 weeks from today
   - No custom tasks
   
2. **Complex Test**
   - 5 assets
   - Individual live dates
   - 3 custom tasks per asset
   - Edit several task durations
   - Test undo/redo 5 times

3. **Edge Cases**
   - Weekend live date
   - Bank holiday live date
   - Past date attempt
   - 365-day duration task
   - Empty asset selection

### ✅ Switch Approval

Before setting `USE_NEW_VERSION = true`:

- [ ] All core functionality tests pass
- [ ] No regressions detected
- [ ] Performance acceptable
- [ ] No console errors
- [ ] Team approval received

### 📝 Notes

Record any issues found:

```
Date: 
Tester:
Issues Found:
- 
- 
Resolution:
```

### 🚀 Post-Switch Monitoring

After enabling TSX version:

- [ ] Monitor for 24 hours
- [ ] Check error logs
- [ ] Gather user feedback
- [ ] Document any issues
- [ ] Have rollback plan ready

---

**Remember:** The old JS version remains available by setting `USE_NEW_VERSION = false` in `src/index.js`