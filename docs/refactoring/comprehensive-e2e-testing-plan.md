# 🧪 Comprehensive E2E Testing Plan - Business Logic Focus

**Last Updated:** Day 5 - Phase 5  
**Status:** Specifications Complete - Ready for Implementation  
**Expected Test Count:** ~80-100 comprehensive E2E tests  

---

## 🎯 Testing Philosophy

**Business Logic First:** Unlike typical UI-only E2E tests, this strategy prioritizes validating the core business functionality that Project Managers rely on daily.

**Key Principles:**
- **Accuracy Matters**: Timeline calculations must be mathematically correct
- **Real Data Testing**: Use actual DMGT asset types, not fictional test data
- **Crash Protection**: Verify auto-save/recovery actually prevents work loss
- **Performance Under Load**: 150+ tasks must render smoothly
- **Security by Design**: Prevent XSS attacks and malicious input

---

## 📋 TIER 1: Critical Business Logic Tests (Must Have)

### 1.1 Timeline Generation & Accuracy Tests

**Objective:** Verify timeline calculations follow CSV data exactly with proper working day logic.

#### Test Scenarios:

```javascript
test('Real CSV sequence validation', async () => {
  // Select "Digital Display - Creative (MMM creating)"
  await helpers.addAsset('Digital Display - Creative (MMM creating)');
  
  // Verify all 11 tasks appear in exact CSV order
  const tasks = await helpers.getTimelineTasks();
  expect(tasks).toHaveLength(11);
  expect(tasks[0]).toMatchObject({
    name: 'Digital Assets sent to MMM',
    duration: 1,
    owner: 'c'
  });
  expect(tasks[1]).toMatchObject({
    name: 'Amendment Approval Phase - 1st Mockup to Client', 
    duration: 3,
    owner: 'm'
  });
  // ... verify all 11 tasks match CSV exactly
});

test('Working day calculations accuracy', async () => {
  // 5-day task should span exactly 1 calendar week (Mon-Fri)
  await helpers.setGlobalLiveDate('2024-02-09'); // Friday
  await helpers.addAsset('Digital Display - Creative (MMM creating)');
  
  const firstTask = await helpers.getTask('Digital Assets sent to MMM');
  expect(firstTask.startDate).toBe('2024-02-08'); // Thursday
  expect(firstTask.endDate).toBe('2024-02-08'); // Same day (1-day task)
  
  const fiveDayTask = await helpers.getTask('Set Up, Browser Testing, Tagging Implementation, Link Testing');
  expect(fiveDayTask.duration).toBe(3);
  // Should span Mon-Wed, not Sat-Mon
});

test('Bank holiday timeline impact', async () => {
  // Set go-live date requiring work through Christmas period
  await helpers.setGlobalLiveDate('2024-01-08'); // Week after New Year
  await helpers.addAsset('Digital Display - Creative (MMM creating)'); // ~15 working days
  
  const projectStartDate = await helpers.getCalculatedStartDate();
  // Should account for Dec 25, 26, Jan 1 bank holidays
  expect(projectStartDate).toBe('2023-12-15'); // Not Dec 18th (without holidays)
});

test('Multiple asset coordination without conflicts', async () => {
  await helpers.addAsset('Email Campaigns');
  await helpers.addAsset('Video/Edits'); 
  await helpers.addAsset('Print - Metro/DM Advertorial');
  
  // Verify no task overlaps between different assets
  const allTasks = await helpers.getAllTimelineTasks();
  await helpers.verifyNoTaskConflicts(allTasks);
});
```

### 1.2 Accordion Effect Validation Tests

**Objective:** Verify duration changes cascade correctly through dependent tasks.

#### Test Scenarios:

```javascript
test('Duration increase shifts subsequent tasks forward', async () => {
  await helpers.setupBasicTimeline();
  const originalEndDate = await helpers.getProjectEndDate();
  
  // Increase middle task duration from 3→7 days (+4 days)
  await helpers.changeTaskDuration('Amendment Approval Phase - 1st Mockup to Client', 7);
  
  // Verify all subsequent tasks shifted forward by exactly 4 days
  const newEndDate = await helpers.getProjectEndDate();
  expect(newEndDate).toBe(helpers.addWorkingDays(originalEndDate, 4));
  
  // Verify specific task dates shifted correctly
  const subsequentTask = await helpers.getTask('Amendment Approval Phase - Client Feedback');
  expect(subsequentTask.startDate).toBe(helpers.addWorkingDays(originalSubsequentStart, 4));
});

test('Duration decrease compresses timeline correctly', async () => {
  await helpers.setupBasicTimeline();
  const originalDuration = await helpers.getProjectDuration();
  
  // Shorten task from 5→2 days (-3 days)
  await helpers.shortenTask('Set Up, Browser Testing, Tagging Implementation', 2);
  
  const newDuration = await helpers.getProjectDuration();
  expect(newDuration).toBe(originalDuration - 3);
  
  // Verify live date remains fixed, start date moves earlier
  const liveDate = await helpers.getGlobalLiveDate();
  const newStartDate = await helpers.getCalculatedStartDate();
  expect(newStartDate).toBe(helpers.subtractWorkingDays(originalStartDate, 3));
});

test('Custom task insertion triggers accordion effect', async () => {
  await helpers.setupBasicTimeline();
  const tasksBefore = await helpers.getTasksAfterPosition(5);
  
  // Insert 5-day custom task after Task 5
  await helpers.addCustomTaskAfter('Special Client Review', 5, 'Task 5');
  
  // Verify Tasks 6-11 all shifted by exactly 5 working days
  const tasksAfter = await helpers.getTasksAfterPosition(6); // Now position 6+
  for (let i = 0; i < tasksBefore.length; i++) {
    expect(tasksAfter[i].startDate).toBe(
      helpers.addWorkingDays(tasksBefore[i].startDate, 5)
    );
  }
});

test('Custom task deletion contracts timeline', async () => {
  // Setup timeline with custom task
  await helpers.setupTimelineWithCustomTask();
  const originalDuration = await helpers.getProjectDuration();
  
  // Remove 3-day custom task
  await helpers.removeCustomTask('Custom Review Task'); // 3 days
  
  // Verify timeline contracted by exactly 3 days
  const newDuration = await helpers.getProjectDuration();
  expect(newDuration).toBe(originalDuration - 3);
});
```

### 1.3 Go-Live Date Business Rules Tests

**Objective:** Verify warnings appear for impossible or problematic go-live dates.

#### Test Scenarios:

```javascript
test('Impossible date warnings for past requirements', async () => {
  // Add asset requiring 15 working days
  await helpers.addAsset('Digital Display - Creative (MMM creating)');
  
  // Set go-live date only 5 working days away
  const impossibleDate = helpers.addWorkingDays(new Date(), 5);
  await helpers.setGlobalLiveDate(impossibleDate);
  
  // Verify clear warning appears
  const warning = await page.locator('[data-testid="timeline-warning"]');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('requires starting on');
  await expect(warning).toContainText('Please choose a later');
  
  // Warning should show the calculated required start date (in the past)
  const requiredStartDate = helpers.subtractWorkingDays(impossibleDate, 15);
  await expect(warning).toContainText(helpers.formatDate(requiredStartDate));
});

test('Working day validation with complex timeline', async () => {
  // Create 50-working-day project
  await helpers.addMultipleAssets(['Digital Display - Creative (MMM creating)', 'Email Campaigns', 'Print - Metro/DM Advertorial']);
  const totalDuration = await helpers.getProjectDuration(); // ~50 working days
  
  // Set go-live date with only 30 working days notice
  const insufficientDate = helpers.addWorkingDays(new Date(), 30);
  await helpers.setGlobalLiveDate(insufficientDate);
  
  // Verify "insufficient time" warning
  await expect(page.locator('[data-testid="timeline-warning"]')).toContainText('insufficient time');
});

test('Bank holiday conflicts in go-live date', async () => {
  await helpers.addAsset('Email Campaigns');
  
  // Set go-live date on Christmas Day
  await helpers.setGlobalLiveDate('2024-12-25');
  
  // Verify appropriate handling (warning or auto-adjustment)
  const warning = await page.locator('[data-testid="bank-holiday-warning"]');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('bank holiday');
});
```

### 1.4 Undo/Redo System Integrity Tests

**Objective:** Verify complex state changes can be reliably undone/redone.

#### Test Scenarios:

```javascript
test('Complex undo chain with timeline recalculation', async () => {
  // Build complex timeline
  await helpers.addAsset('Digital Display - Creative (MMM creating)');
  const state1 = await helpers.captureTimelineState();
  
  await helpers.changeTaskDuration('Amendment Approval Phase - 1st Mockup to Client', 7);
  const state2 = await helpers.captureTimelineState();
  
  await helpers.addCustomTask('Custom Review', 3, 'Amendment Approval Phase - Client Feedback');
  const state3 = await helpers.captureTimelineState();
  
  await helpers.removeAsset('Digital Display - Creative (MMM creating)');
  const state4 = await helpers.captureTimelineState();
  
  // Undo sequence: each step should restore exact previous state
  await helpers.clickUndo();
  await expect(await helpers.captureTimelineState()).toEqual(state3);
  
  await helpers.clickUndo();
  await expect(await helpers.captureTimelineState()).toEqual(state2);
  
  await helpers.clickUndo();
  await expect(await helpers.captureTimelineState()).toEqual(state1);
});

test('Redo accuracy with accordion effect reapplication', async () => {
  await helpers.setupBasicTimeline();
  
  // Change duration and capture effect
  await helpers.changeTaskDuration('Task 3', 8); // +5 days
  const afterChange = await helpers.captureTimelineState();
  
  // Undo change
  await helpers.clickUndo();
  
  // Redo change - should reapply accordion effect identically
  await helpers.clickRedo();
  const afterRedo = await helpers.captureTimelineState();
  
  expect(afterRedo).toEqual(afterChange);
});

test('State history limits - 60 actions', async () => {
  // Perform 60+ actions
  for (let i = 0; i < 65; i++) {
    await helpers.addAsset('Email Campaigns', `Asset ${i}`);
    await helpers.removeAsset(`Asset ${i}`);
  }
  
  // Verify system doesn't crash and oldest states are purged
  const undoCount = await helpers.countAvailableUndos();
  expect(undoCount).toBeLessThanOrEqual(50); // History limit
  
  // Verify undo still works correctly
  await helpers.clickUndo();
  // Should undo successfully without errors
});

test('Undo during active edit maintains consistency', async () => {
  await helpers.setupBasicTimeline();
  
  // Start editing a task
  await helpers.startEditingTask('Task 3');
  
  // Trigger undo while edit is active
  await helpers.clickUndo();
  
  // Verify clean state recovery - no half-edited states
  const state = await helpers.captureTimelineState();
  await helpers.verifyStateConsistency(state);
});
```

---

## 📊 TIER 2: Data Integrity & Persistence Tests (Must Have)

### 2.1 Excel Export/Import Accuracy Tests

**Objective:** Verify Excel files accurately represent and restore timeline data.

#### Test Scenarios:

```javascript
test('Visual Gantt chart vs Excel data exact matching', async () => {
  await helpers.setupComplexTimeline(); // Multiple assets, custom tasks, duration changes
  
  // Capture visual timeline data
  const ganttData = await helpers.extractGanttChartData();
  
  // Export and parse Excel
  const excelFile = await helpers.downloadExcel();
  const excelData = await helpers.parseExcelFile(excelFile);
  
  // Compare every field: task names, start dates, end dates, durations, owners
  expect(excelData.tasks).toHaveLength(ganttData.tasks.length);
  
  for (let i = 0; i < ganttData.tasks.length; i++) {
    expect(excelData.tasks[i]).toMatchObject({
      name: ganttData.tasks[i].name,
      startDate: ganttData.tasks[i].startDate,
      endDate: ganttData.tasks[i].endDate,
      duration: ganttData.tasks[i].duration,
      owner: ganttData.tasks[i].owner
    });
  }
});

test('_DATA tab completeness for 100% restoration', async () => {
  // Create highly complex timeline
  await helpers.addMultipleAssets(['Digital Display - Creative (MMM creating)', 'Email Campaigns']);
  await helpers.changeTaskDuration('Task 3', 8);
  await helpers.addCustomTask('Special Review', 4, 'Task 7');
  await helpers.setAssetIndividualDate('Asset 1', '2024-03-15');
  
  const originalState = await helpers.captureCompleteApplicationState();
  
  // Export to Excel
  const excelFile = await helpers.downloadExcel();
  
  // Verify _DATA sheet contains complete JSON state
  const dataSheetContent = await helpers.parseExcelDataSheet(excelFile);
  expect(dataSheetContent).toMatchObject({
    version: expect.any(String),
    timestamp: expect.any(String),
    state: expect.objectContaining({
      assets: originalState.assets,
      tasks: originalState.tasks,
      dates: originalState.dates,
      customizations: originalState.customizations
    })
  });
  
  // Clear timeline and import
  await helpers.clearTimeline();
  await helpers.importExcel(excelFile);
  
  // Verify 100% identical restoration
  const restoredState = await helpers.captureCompleteApplicationState();
  expect(restoredState).toEqual(originalState);
});

test('Custom task preservation through round-trip', async () => {
  await helpers.setupBasicTimeline();
  
  // Add multiple custom tasks with different configurations
  await helpers.addCustomTask('Client Presentation', 2, 'Task 5', 'c');
  await helpers.addCustomTask('Internal Review', 1, 'Task 8', 'm');
  await helpers.addCustomTask('Final Approval', 3, 'Task 10', 'a');
  
  const customTasks = await helpers.getCustomTasks();
  
  // Round-trip through Excel
  const excelFile = await helpers.downloadExcel();
  await helpers.clearTimeline();
  await helpers.importExcel(excelFile);
  
  // Verify all custom tasks preserved with exact properties
  const restoredCustomTasks = await helpers.getCustomTasks();
  expect(restoredCustomTasks).toEqual(customTasks);
});

test('Duration override preservation through export/import', async () => {
  await helpers.setupBasicTimeline();
  
  // Override multiple task durations
  await helpers.changeTaskDuration('Task 2', 8); // was 3
  await helpers.changeTaskDuration('Task 5', 1); // was 4  
  await helpers.changeTaskDuration('Task 7', 10); // was 2
  
  const modifiedDurations = await helpers.getTaskDurations();
  
  // Export/import cycle
  const excelFile = await helpers.downloadExcel();
  await helpers.clearTimeline();
  await helpers.importExcel(excelFile);
  
  // Verify all duration overrides preserved
  const restoredDurations = await helpers.getTaskDurations();
  expect(restoredDurations).toEqual(modifiedDurations);
  
  // Verify accordion effects still work correctly with restored durations
  await helpers.changeTaskDuration('Task 2', 12); // +4 more days
  const newEndDate = await helpers.getProjectEndDate();
  // Should shift from restored state, not original
});
```

### 2.2 Auto-Save & Crash Recovery Tests

**Objective:** Verify crash protection prevents work loss in real scenarios.

#### Test Scenarios:

```javascript
test('Auto-save frequency during active work', async () => {
  await helpers.setupBasicTimeline();
  
  // Monitor save indicators during continuous work
  await helpers.startSaveIndicatorMonitoring();
  
  // Perform continuous work for 2 minutes
  for (let i = 0; i < 10; i++) {
    await helpers.addCustomTask(`Task ${i}`, 1, 'Task 5');
    await page.waitForTimeout(12000); // 12 seconds between actions
  }
  
  const saveEvents = await helpers.getSaveEvents();
  
  // Verify saves occurred approximately every 30 seconds
  expect(saveEvents.length).toBeGreaterThanOrEqual(3); // 2 minutes / 30 seconds = 4 expected saves
  
  // Verify save intervals are ~30 seconds
  for (let i = 1; i < saveEvents.length; i++) {
    const interval = saveEvents[i].timestamp - saveEvents[i-1].timestamp;
    expect(interval).toBeCloseTo(30000, -1000); // ±1 second tolerance
  }
});

test('Critical action saves trigger immediately', async () => {
  await helpers.setupBasicTimeline();
  
  // Monitor for immediate saves after critical actions
  await helpers.startSaveIndicatorMonitoring();
  
  // Perform critical actions
  await helpers.addAsset('Email Campaigns');
  await helpers.waitForSaveIndicator('✓ Saved');
  
  await helpers.changeTaskDuration('Task 3', 8);
  await helpers.waitForSaveIndicator('✓ Saved');
  
  await helpers.removeAsset('Email Campaigns');
  await helpers.waitForSaveIndicator('✓ Saved');
  
  const saveEvents = await helpers.getSaveEvents();
  expect(saveEvents).toHaveLength(3); // One save per critical action
  
  // Verify saves happened within 2 seconds of actions
  expect(saveEvents[0].actionToSaveDelay).toBeLessThan(2000);
  expect(saveEvents[1].actionToSaveDelay).toBeLessThan(2000);
  expect(saveEvents[2].actionToSaveDelay).toBeLessThan(2000);
});

test('Browser crash simulation with recovery prompt', async () => {
  await helpers.buildComplexTimeline();
  await helpers.makeAdditionalUnsavedChanges();
  
  // Simulate crash - force close browser
  await helpers.simulateBrowserCrash();
  
  // Reopen browser and navigate to app
  await helpers.reopenBrowser();
  await page.goto('/');
  
  // Verify recovery prompt appears immediately
  const recoveryPrompt = page.locator('[data-testid="recovery-prompt"]');
  await expect(recoveryPrompt).toBeVisible({ timeout: 5000 });
  
  // Verify helpful preview information
  await expect(recoveryPrompt).toContainText('We found unsaved work from');
  await expect(recoveryPrompt).toContainText('3 assets'); // Expected asset count
  await expect(recoveryPrompt).toContainText('2 custom tasks'); // Expected custom task count
  
  // Verify both options available
  await expect(page.locator('[data-testid="restore-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="start-fresh-button"]')).toBeVisible();
});

test('Recovery accuracy - Restore rebuilds exact state', async () => {
  await helpers.buildComplexTimeline();
  const exactState = await helpers.captureCompleteApplicationState();
  
  // Simulate crash and recovery
  await helpers.simulateBrowserCrash();
  await helpers.reopenBrowser();
  await page.goto('/');
  
  // Choose restore option
  await page.locator('[data-testid="restore-button"]').click();
  await helpers.waitForTimelineLoad();
  
  // Verify exact state restoration
  const restoredState = await helpers.captureCompleteApplicationState();
  expect(restoredState).toEqual(exactState);
  
  // Verify timeline functionality still works perfectly
  await helpers.changeTaskDuration('Task 3', 9);
  await helpers.verifyAccordionEffectApplied();
});

test('Recovery prompt messaging clarity', async () => {
  await helpers.buildTimeline();
  
  // Simulate crash and check messaging
  await helpers.simulateBrowserCrash();
  await helpers.reopenBrowser();
  await page.goto('/');
  
  const recoveryPrompt = page.locator('[data-testid="recovery-prompt"]');
  
  // Verify messaging follows our agreed strategy
  await expect(recoveryPrompt).toContainText('Auto-backup prevents work loss during crashes');
  await expect(recoveryPrompt).toContainText('Your work is temporarily saved in this browser');
  await expect(recoveryPrompt).toContainText('Export to Excel for permanent storage');
  
  // Verify no misleading "auto-saved" terminology
  await expect(recoveryPrompt).not.toContainText('auto-saved');
  await expect(recoveryPrompt).not.toContainText('permanently saved');
});

test('Start Fresh vs Restore functionality', async () => {
  await helpers.buildComplexTimeline();
  
  // Simulate crash
  await helpers.simulateBrowserCrash();
  await helpers.reopenBrowser();
  await page.goto('/');
  
  // Test "Start Fresh" option
  await page.locator('[data-testid="start-fresh-button"]').click();
  
  // Verify empty timeline
  const assets = await helpers.getSelectedAssets();
  expect(assets).toHaveLength(0);
  
  // Go back and test "Restore" option
  await helpers.simulateBrowserCrash();
  await helpers.reopenBrowser();
  await page.goto('/');
  
  await page.locator('[data-testid="restore-button"]').click();
  
  // Verify timeline restored
  const restoredAssets = await helpers.getSelectedAssets();
  expect(restoredAssets.length).toBeGreaterThan(0);
});

test('Storage failure graceful degradation', async () => {
  // Simulate localStorage quota exceeded
  await helpers.fillLocalStorageToCapacity();
  
  await helpers.buildComplexTimeline();
  
  // Verify app continues to function despite save failures
  const timeline = await helpers.getTimeline();
  expect(timeline).toBeDefined();
  
  // Verify graceful warning message
  const warning = page.locator('[data-testid="storage-warning"]');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('unable to save');
  await expect(warning).toContainText('export to Excel');
});
```

---

## 🔒 TIER 3: Security & Validation Tests (Important)

### 3.1 Input Validation & XSS Prevention Tests

**Objective:** Prevent malicious input from compromising the application.

#### Test Scenarios:

```javascript
test('XSS prevention in asset names', async () => {
  const maliciousInputs = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert("xss")>',
    'javascript:alert("xss")',
    '<svg onload=alert("xss")>',
    '"><script>alert("xss")</script>'
  ];
  
  for (const maliciousName of maliciousInputs) {
    await helpers.addAsset('Email Campaigns', maliciousName);
    
    // Verify script is sanitized, not executed
    const assetElement = await page.locator(`[data-testid*="asset-"]`).first();
    const displayedName = await assetElement.textContent();
    
    // Should not contain executable script tags
    expect(displayedName).not.toContain('<script>');
    expect(displayedName).not.toContain('javascript:');
    expect(displayedName).not.toContain('onerror=');
    
    // But should show sanitized version (user can see what they tried to enter)
    expect(displayedName).toContain('script'); // Sanitized but visible
    
    await helpers.removeAsset(maliciousName);
  }
});

test('SQL injection attempts in all input fields', async () => {
  const injectionPayloads = [
    "'; DROP TABLE tasks; --",
    "' OR '1'='1",
    "'; DELETE FROM timeline; --",
    "' UNION SELECT * FROM users --"
  ];
  
  await helpers.setupBasicTimeline();
  
  for (const payload of injectionPayloads) {
    // Test in asset names
    await helpers.tryAddAsset('Email Campaigns', payload);
    
    // Test in custom task names  
    await helpers.tryAddCustomTask(payload, 3, 'Task 5');
    
    // Test in date fields
    await helpers.trySetGlobalLiveDate(payload);
    
    // Test in duration fields
    await helpers.tryChangeTaskDuration('Task 3', payload);
  }
  
  // Verify app continues functioning normally (no SQL injection occurred)
  const timeline = await helpers.getTimeline();
  expect(timeline).toBeDefined();
  await helpers.verifyTimelineIntegrity();
});

test('Limit enforcement - 51st asset addition', async () => {
  // Add 50 assets (at the limit)
  for (let i = 1; i <= 50; i++) {
    await helpers.addAsset('Email Campaigns', `Asset ${i}`);
  }
  
  // Attempt to add 51st asset
  await helpers.tryAddAsset('Email Campaigns', 'Asset 51');
  
  // Verify hard block with clear message
  const errorMessage = await page.locator('[data-testid="limit-error"]');
  await expect(errorMessage).toBeVisible();
  await expect(errorMessage).toContainText('50 assets');
  await expect(errorMessage).toContainText('maximum');
  
  // Verify 51st asset was not added
  const assetCount = await helpers.getAssetCount();
  expect(assetCount).toBe(50);
});

test('Limit enforcement - 501st task addition', async () => {
  // This test requires creating many assets to reach 500+ tasks
  // For efficiency, we'll simulate the high task count
  await helpers.simulateHighTaskCount(499);
  
  // Attempt to add custom task that would create 501st task
  await helpers.tryAddCustomTask('Extra Task', 1, 'Task 400');
  
  // Verify task limit error
  const errorMessage = await page.locator('[data-testid="task-limit-error"]');
  await expect(errorMessage).toBeVisible();
  await expect(errorMessage).toContainText('500 tasks');
  await expect(errorMessage).toContainText('maximum');
});

test('Invalid date handling with clear error messages', async () => {
  const invalidDates = [
    'abc',
    '32/13/2024',
    '2024-13-45',
    'not-a-date',
    '2024/31/04', // April 31st doesn't exist
    '2023-02-29'  // 2023 is not a leap year
  ];
  
  for (const invalidDate of invalidDates) {
    await helpers.trySetGlobalLiveDate(invalidDate);
    
    // Verify validation error appears
    const errorMessage = await page.locator('[data-testid="date-validation-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('valid date');
    
    // Verify date was not accepted
    const actualDate = await helpers.getGlobalLiveDate();
    expect(actualDate).not.toBe(invalidDate);
  }
});
```

### 3.2 Performance & Edge Cases Tests

**Objective:** Ensure app remains responsive under load and edge conditions.

#### Test Scenarios:

```javascript
test('150-task timeline renders within performance limits', async () => {
  // Create massive timeline with 150+ tasks
  await helpers.createMassiveTimeline(150);
  
  // Measure render performance
  const renderStart = performance.now();
  await page.locator('[data-testid="gantt-chart"]').waitForSelector();
  const renderEnd = performance.now();
  
  // Should render within 2 seconds
  expect(renderEnd - renderStart).toBeLessThan(2000);
  
  // Verify interactivity remains responsive
  const interactionStart = performance.now();
  await helpers.changeTaskDuration('Task 50', 8);
  const interactionEnd = performance.now();
  
  // Interaction should complete within 500ms
  expect(interactionEnd - interactionStart).toBeLessThan(500);
});

test('Rapid interaction handling - faster than debounce', async () => {
  await helpers.setupBasicTimeline();
  
  // Rapidly click buttons faster than debounce intervals (typical debounce is 300ms)
  const rapidActions = [];
  for (let i = 0; i < 10; i++) {
    rapidActions.push(
      helpers.addCustomTask(`Rapid Task ${i}`, 1, 'Task 3')
    );
    await page.waitForTimeout(100); // 100ms intervals (faster than 300ms debounce)
  }
  
  // Wait for all actions to settle
  await page.waitForTimeout(2000);
  
  // Verify app didn't crash and state is consistent
  const timeline = await helpers.getTimeline();
  expect(timeline).toBeDefined();
  
  // Verify no duplicate tasks or corrupted state
  await helpers.verifyTimelineConsistency();
});

test('API failure graceful degradation - gov.uk unavailable', async () => {
  // Mock API failure for bank holidays
  await helpers.mockBankHolidayAPIFailure();
  
  // Reload app to trigger API call
  await page.reload();
  await helpers.waitForAppLoad();
  
  // Verify graceful warning message
  const warningToast = page.locator('[data-testid="api-warning-toast"]');
  await expect(warningToast).toBeVisible();
  await expect(warningToast).toContainText('Bank holidays unavailable');
  await expect(warningToast).toContainText('Timeline calculations may not account for UK holidays');
  
  // Verify app continues to function
  await helpers.addAsset('Email Campaigns');
  await helpers.setGlobalLiveDate('2024-03-15');
  
  // Timeline should still generate (without bank holiday adjustments)
  const timeline = await helpers.getTimeline();
  expect(timeline.length).toBeGreaterThan(0);
});

test('Memory leak prevention during rapid add/remove cycles', async () => {
  // Perform 100 rapid add/remove cycles
  for (let i = 0; i < 100; i++) {
    await helpers.addAsset('Email Campaigns', `Asset ${i}`);
    await helpers.addCustomTask(`Task ${i}`, 2, 'Task 3');
    await helpers.removeAsset(`Asset ${i}`);
    await helpers.removeCustomTask(`Task ${i}`);
  }
  
  // Force garbage collection if possible
  if ('gc' in window) {
    window.gc();
  }
  
  // Verify memory usage hasn't grown excessively
  // Note: This is a simplified test - proper memory testing requires specialized tools
  const finalState = await helpers.captureApplicationState();
  expect(finalState.assets.selected).toHaveLength(0);
  expect(finalState.tasks.custom).toHaveLength(0);
  
  // Verify app remains responsive
  await helpers.addAsset('Email Campaigns');
  const timeline = await helpers.getTimeline();
  expect(timeline).toBeDefined();
});
```

---

## 🔄 TIER 4: Integration Scenarios (Nice to Have)

### 4.1 Cross-Feature Interactions Tests

**Objective:** Verify complex interactions between different system features.

#### Test Scenarios:

```javascript
test('Undo during auto-save maintains state consistency', async () => {
  await helpers.setupBasicTimeline();
  
  // Start monitoring auto-save intervals
  await helpers.startAutoSaveMonitoring();
  
  // Make change and immediately trigger undo during auto-save window
  await helpers.changeTaskDuration('Task 3', 8);
  
  // Wait until auto-save is actively running (but not complete)
  await helpers.waitForAutoSaveInProgress();
  
  // Immediately trigger undo
  await helpers.clickUndo();
  
  // Wait for both operations to complete
  await helpers.waitForAutoSaveComplete();
  await helpers.waitForUndoComplete();
  
  // Verify state consistency - undo should have won
  const currentState = await helpers.captureTimelineState();
  const expectedState = await helpers.getStateBeforeLastAction();
  expect(currentState).toEqual(expectedState);
  
  // Verify no corrupted auto-save data
  await helpers.verifyLocalStorageConsistency();
});

test('Validation during Excel import with malformed data', async () => {
  // Create Excel file with malicious/malformed data
  const maliciousExcel = await helpers.createMaliciousExcelFile({
    _DATA: {
      assets: [{ id: '<script>alert("xss")</script>' }],
      tasks: [{ name: "'; DROP TABLE; --", duration: -999 }]
    }
  });
  
  // Attempt to import malicious file
  await helpers.tryImportExcel(maliciousExcel);
  
  // Verify appropriate error handling
  const errorMessage = page.locator('[data-testid="import-error"]');
  await expect(errorMessage).toBeVisible();
  await expect(errorMessage).toContainText('Invalid data');
  
  // Verify app remains secure and functional
  const currentState = await helpers.captureTimelineState();
  await helpers.verifyStateIntegrity(currentState);
});

test('Complex timeline edge cases - cross-year projects', async () => {
  // Create timeline that spans December → January  
  await helpers.setGlobalLiveDate('2024-01-15'); // Mid-January go-live
  await helpers.addAsset('Digital Display - Creative (MMM creating)'); // ~15 working days
  
  const calculatedStartDate = await helpers.getCalculatedStartDate();
  
  // Should handle year boundary correctly
  expect(calculatedStartDate).toContain('2023-12'); // December 2023
  
  // Verify bank holidays handled across year boundary
  const timeline = await helpers.getTimeline();
  const christmasTask = timeline.find(task => 
    task.startDate <= '2023-12-25' && task.endDate >= '2023-12-25'
  );
  
  if (christmasTask) {
    // Task spanning Christmas should account for holiday
    expect(christmasTask.adjustedForHolidays).toBe(true);
  }
});

test('Leap year handling - February 29th calculations', async () => {
  // Test with leap year (2024)
  await helpers.setGlobalLiveDate('2024-03-01'); // March 1st, 2024
  await helpers.addAsset('Email Campaigns'); // Multi-day project
  
  const timeline = await helpers.getTimeline();
  const febTask = timeline.find(task => 
    task.startDate <= '2024-02-29' && task.endDate >= '2024-02-29'
  );
  
  if (febTask) {
    // Should correctly handle February 29th as valid date
    expect(febTask.startDate).toBeDefined();
    expect(new Date(febTask.startDate)).toBeInstanceOf(Date);
  }
  
  // Test with non-leap year (2023)
  await helpers.setGlobalLiveDate('2023-03-01');
  await helpers.clearAndRecalculateTimeline();
  
  const timeline2023 = await helpers.getTimeline();
  // Should not attempt to use February 29th, 2023 (invalid date)
  const invalidDate = timeline2023.some(task => 
    task.startDate === '2023-02-29' || task.endDate === '2023-02-29'
  );
  expect(invalidDate).toBe(false);
});

test('Weekend boundary cases - task ending Friday vs Monday', async () => {
  // Task ending on Friday
  await helpers.setGlobalLiveDate('2024-02-09'); // Friday
  await helpers.addTaskEndingOn('2024-02-08'); // Thursday (1-day task)
  
  const fridayTask = await helpers.getLastTask();
  expect(fridayTask.endDate).toBe('2024-02-08'); // Thursday
  
  // Next task should start Monday (not Saturday)
  const nextTask = await helpers.getTaskAfter(fridayTask);
  if (nextTask) {
    expect(nextTask.startDate).toBe('2024-02-09'); // Friday (next working day)
  }
  
  // Multi-day task spanning weekend
  await helpers.addMultiDayTask(3); // 3-day task
  const weekendSpanningTask = await helpers.getLastTask();
  
  // Should skip weekend properly
  if (weekendSpanningTask.startDate === '2024-02-09') { // Friday start
    expect(weekendSpanningTask.endDate).toBe('2024-02-13'); // Tuesday end (Fri + Mon + Tue = 3 working days)
  }
});
```

### 4.2 User Experience Edge Cases Tests

**Objective:** Ensure smooth user experience in edge scenarios.

#### Test Scenarios:

```javascript
test('Unsaved changes warning on browser close', async () => {
  await helpers.buildTimeline();
  
  // Make unsaved changes
  await helpers.changeTaskDuration('Task 3', 7);
  await helpers.waitForUnsavedIndicator();
  
  // Simulate user trying to close browser tab
  const beforeUnloadPromise = page.evaluate(() => {
    return new Promise(resolve => {
      window.addEventListener('beforeunload', (e) => {
        resolve(e.returnValue);
      });
      
      // Trigger beforeunload event
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
    });
  });
  
  const warningMessage = await beforeUnloadPromise;
  
  // Verify appropriate warning
  expect(warningMessage).toContain('unsaved changes');
  expect(warningMessage).toContain('sure you want to leave');
});

test('Gov.UK API fallback with user messaging', async () => {
  // Test multiple API failure scenarios
  const failureScenarios = [
    { type: 'timeout', delay: 10000 },
    { type: 'network_error', status: 0 },
    { type: 'server_error', status: 500 },
    { type: 'invalid_json', response: 'invalid json' }
  ];
  
  for (const scenario of failureScenarios) {
    await helpers.mockAPIFailure('bank-holidays', scenario);
    await page.reload();
    await helpers.waitForAppLoad();
    
    // Verify consistent fallback behavior
    const warningToast = page.locator('[data-testid="api-fallback-toast"]');
    await expect(warningToast).toBeVisible();
    await expect(warningToast).toContainText('Could not load bank holidays');
    await expect(warningToast).toContainText('Timeline calculations may not account for UK holidays');
    
    // Verify app continues functioning
    await helpers.addAsset('Email Campaigns');
    const timeline = await helpers.getTimeline();
    expect(timeline.length).toBeGreaterThan(0);
    
    await helpers.resetAPIMocks();
  }
});

test('Keyboard navigation for accessibility', async () => {
  await helpers.setupBasicTimeline();
  
  // Navigate entire interface using only keyboard
  await page.keyboard.press('Tab'); // Focus first element
  
  // Navigate to asset selector
  const activeElement1 = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  
  // Navigate to add asset button
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
  }
  
  // Add asset using keyboard
  await page.keyboard.press('Enter');
  
  // Navigate to task editing
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
  }
  
  // Edit task duration using keyboard
  await page.keyboard.press('Enter');
  await page.keyboard.type('5');
  await page.keyboard.press('Enter');
  
  // Verify changes applied correctly
  const updatedTask = await helpers.getTask('Task 1');
  expect(updatedTask.duration).toBe(5);
  
  // Verify focus management throughout
  const finalActiveElement = await page.evaluate(() => document.activeElement?.tagName);
  expect(['INPUT', 'BUTTON', 'SELECT']).toContain(finalActiveElement);
});
```

---

## 📊 Testing Implementation Strategy

### Priority Implementation Order:

1. **Week 1: TIER 1 Critical Business Logic**
   - Fix existing asset type mismatches first
   - Implement timeline generation accuracy tests
   - Build accordion effect validation tests
   - Create go-live date business rule tests

2. **Week 2: TIER 2 Data Integrity**  
   - Excel export/import accuracy validation
   - Auto-save and crash recovery testing
   - Recovery prompt functionality verification

3. **Week 3: TIER 3 Security & Performance**
   - XSS prevention and input validation  
   - Performance testing with 150+ tasks
   - API failure graceful degradation

4. **Week 4: TIER 4 Integration & Polish**
   - Cross-feature interaction testing
   - Edge cases and boundary conditions
   - User experience edge scenarios

### Expected Outcomes:

- **~80-100 comprehensive E2E tests** covering real PM workflows
- **Business logic validation** ensuring mathematical accuracy  
- **Data integrity assurance** preventing work loss
- **Security hardening** against malicious input
- **Performance validation** under realistic load
- **Real DMGT data testing** matching production usage

### Test Infrastructure Requirements:

**Enhanced Test Helpers Needed:**
- Timeline state capture and comparison utilities
- Excel file parsing and validation tools  
- Browser crash simulation capabilities
- Performance measurement and monitoring
- API mocking and failure simulation
- Accessibility testing utilities

**Test Data Requirements:**
- Real DMGT asset types from CSV file
- Bank holiday data for multiple years
- Sample malicious input payloads
- Performance test datasets (150+ tasks)
- Complex timeline scenarios for edge testing

---

## 🎯 Success Metrics

**Coverage Goals:**
- **Business Logic**: 100% of core PM workflows tested
- **Data Integrity**: All export/import scenarios covered
- **Security**: All input vectors validated against XSS/injection
- **Performance**: 150+ task scenarios confirmed <2 second render
- **Recovery**: All crash scenarios tested with exact restoration

**Quality Benchmarks:**
- Zero false positives (tests that fail on working code)
- Zero false negatives (tests that pass on broken code)  
- Real-world scenario accuracy (tests match actual PM usage)
- Clear failure diagnostics (failed tests provide actionable info)

This comprehensive testing plan ensures the Timeline Builder is production-ready for DMGT's PM team with complete confidence in business logic accuracy, data integrity, and user experience quality.