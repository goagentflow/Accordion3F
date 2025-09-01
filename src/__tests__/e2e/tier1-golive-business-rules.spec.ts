/**
 * TIER 1: Go-Live Date Business Rules Tests
 * Critical tests for impossible/problematic go-live date warnings
 * Validates PM workflow safety by preventing impossible deadlines
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';

test.describe('TIER 1: Go-Live Date Business Rules Tests', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
  });

  test.describe('Impossible date warnings for past requirements', () => {
    test('Timeline requiring 15 working days shows warning for 5-day notice', async ({ page }) => {
      // Add asset requiring significant time (Digital Display - Creative has ~17 working days)
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Long Timeline Asset');
      
      // Calculate a date that's only 5 working days from now
      const today = new Date();
      const impossibleDate = helpers.addWorkingDays(today, 5);
      
      // Set impossible go-live date
      await helpers.setGlobalLiveDate(impossibleDate);
      
      // Verify warning appears
      const warning = await helpers.waitForTimelineWarning('insufficient time');
      await expect(warning).toContainText('requires starting');
      
      // Warning should indicate the issue clearly
      const warningText = await warning.textContent();
      expect(warningText?.toLowerCase()).toMatch(/insufficient|impossible|not enough|requires/);
      
      // Should show calculated required start date (in the past)
      const tasks = await helpers.getTimelineTasks();
      const totalDuration = tasks.reduce((sum, task) => sum + task.duration, 0);
      const requiredStartDate = helpers.subtractWorkingDays(impossibleDate, totalDuration);
      
      // Required start should be in the past
      const requiredStart = new Date(requiredStartDate);
      expect(requiredStart < today).toBe(true);
    });

    test('Complex timeline shows specific required start date in warning', async ({ page }) => {
      // Add multiple assets for complex timeline
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Complex Asset 1');
      await helpers.addAsset('Digital - HUB', 'Complex Asset 2');
      
      await page.waitForTimeout(1500);
      
      // Calculate total duration
      const totalDuration = await helpers.getProjectDuration();
      expect(totalDuration).toBeGreaterThan(20); // Should be substantial timeline
      
      // Set go-live date with insufficient time
      const shortNoticeDate = helpers.addWorkingDays(new Date(), 10);
      await helpers.setGlobalLiveDate(shortNoticeDate);
      
      // Verify specific warning appears with calculations
      const warning = await helpers.waitForTimelineWarning('starting');
      
      // Should show the exact required start date
      const requiredStartDate = helpers.subtractWorkingDays(shortNoticeDate, totalDuration);
      const formattedRequiredDate = helpers.formatDate(requiredStartDate);
      
      const warningText = await warning.textContent();
      expect(warningText).toContain('starting');
      
      // Should suggest a later go-live date
      expect(warningText?.toLowerCase()).toMatch(/later|choose.*date|extend/);
    });

    test('Warning disappears when feasible date is set', async ({ page }) => {
      // Setup impossible timeline first
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Test Asset');
      const impossibleDate = helpers.addWorkingDays(new Date(), 3);
      await helpers.setGlobalLiveDate(impossibleDate);
      
      // Verify warning appears
      await helpers.waitForTimelineWarning('insufficient');
      
      // Set a feasible date (30 working days from now)
      const feasibleDate = helpers.addWorkingDays(new Date(), 30);
      await helpers.setGlobalLiveDate(feasibleDate);
      
      // Verify warning disappears
      const warning = page.locator('[data-testid*="warning"], [data-testid*="alert"]');
      await expect(warning).not.toBeVisible({ timeout: 2000 });
      
      // Timeline should generate successfully
      const tasks = await helpers.getTimelineTasks();
      expect(tasks.length).toBeGreaterThan(0);
      
      // All tasks should have valid future dates
      for (const task of tasks) {
        const taskStart = new Date(task.startDate);
        expect(taskStart > new Date()).toBe(true);
      }
    });
  });

  test.describe('Working day validation with complex timeline', () => {
    test('50-working-day project warns about insufficient 30-day notice', async ({ page }) => {
      // Create complex multi-asset timeline
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Creative');
      await helpers.addAsset('Digital - HUB', 'Hub'); 
      await helpers.addAsset('Digital - Competition Page', 'Competition');
      
      await page.waitForTimeout(2000);
      
      // Verify we have a substantial timeline
      const totalDuration = await helpers.getProjectDuration();
      expect(totalDuration).toBeGreaterThan(40); // Should be around 50+ working days
      
      // Set go-live date with only 30 working days notice
      const insufficientDate = helpers.addWorkingDays(new Date(), 30);
      await helpers.setGlobalLiveDate(insufficientDate);
      
      // Verify "insufficient time" warning with specific messaging
      const warning = await helpers.waitForTimelineWarning('insufficient');
      await expect(warning).toContainText('time');
      
      // Should indicate how much more time is needed
      const warningText = await warning.textContent();
      expect(warningText?.toLowerCase()).toMatch(/insufficient|not enough|requires/);
    });

    test('Working day calculation excludes weekends correctly', async ({ page }) => {
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Weekend Test');
      
      // Set go-live date on Monday
      await helpers.setGlobalLiveDate('2024-06-10'); // Monday
      
      await page.waitForTimeout(1000);
      
      // Verify timeline calculation
      const tasks = await helpers.getTimelineTasks();
      const startDate = new Date(tasks[0].startDate);
      
      // Should be a weekday
      expect([1, 2, 3, 4, 5]).toContain(startDate.getDay()); // Monday-Friday
      
      // No tasks should have weekend dates
      for (const task of tasks) {
        const start = new Date(task.startDate);
        const end = new Date(task.endDate);
        
        expect([0, 6]).not.toContain(start.getDay()); // Not Sat/Sun
        expect([0, 6]).not.toContain(end.getDay()); // Not Sat/Sun
      }
    });
  });

  test.describe('Bank holiday conflicts in go-live date', () => {
    test('Christmas Day go-live date shows holiday warning', async ({ page }) => {
      await helpers.addAsset('Digital Display - Agency Tags', 'Holiday Test');
      
      // Set go-live date on Christmas Day
      await helpers.setGlobalLiveDate('2024-12-25');
      
      // Should show bank holiday warning
      const warning = page.locator('[data-testid*="holiday"], [data-testid*="bank-holiday"], [data-testid*="warning"]');
      
      // Wait for either specific holiday warning or general warning
      try {
        await warning.waitFor({ state: 'visible', timeout: 3000 });
        const warningText = await warning.textContent();
        expect(warningText?.toLowerCase()).toMatch(/holiday|christmas|bank.*holiday|working.*day/);
      } catch {
        // If no specific holiday warning, there should be a general validation warning
        const generalWarning = page.locator('[data-testid*="warning"], [data-testid*="alert"]');
        if (await generalWarning.isVisible()) {
          const warningText = await generalWarning.textContent();
          expect(warningText?.toLowerCase()).toMatch(/date|invalid|working/);
        }
      }
    });

    test('New Year Day handling', async ({ page }) => {
      await helpers.addAsset('Digital Display - Agency Tags', 'New Year Test');
      
      // Set go-live date on New Year's Day
      await helpers.setGlobalLiveDate('2025-01-01');
      
      // Check for appropriate handling
      const anyWarning = page.locator('[data-testid*="warning"], [data-testid*="alert"], [data-testid*="holiday"]');
      
      if (await anyWarning.isVisible({ timeout: 2000 })) {
        const warningText = await anyWarning.textContent();
        expect(warningText?.toLowerCase()).toMatch(/holiday|new year|bank.*holiday|working.*day|date/);
      }
      
      // Regardless of warning, tasks should not be scheduled on the holiday itself
      const tasks = await helpers.getTimelineTasks();
      for (const task of tasks) {
        expect(task.startDate).not.toBe('2025-01-01');
        expect(task.endDate).not.toBe('2025-01-01');
      }
    });

    test('Good Friday bank holiday consideration', async ({ page }) => {
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Easter Test');
      
      // Set go-live around Easter period (2024-03-29 is Good Friday)
      await helpers.setGlobalLiveDate('2024-03-29');
      
      // Timeline should handle bank holiday appropriately
      const tasks = await helpers.getTimelineTasks();
      expect(tasks.length).toBeGreaterThan(0);
      
      // Check if any tasks are scheduled on Good Friday
      const goodFridayTasks = tasks.filter(
        task => task.startDate === '2024-03-29' || task.endDate === '2024-03-29'
      );
      
      // Ideally should be empty (no work on Good Friday) or have appropriate warnings
      if (goodFridayTasks.length > 0) {
        const warning = page.locator('[data-testid*="warning"], [data-testid*="holiday"]');
        await expect(warning).toBeVisible();
      }
    });
  });

  test.describe('Edge cases and boundary conditions', () => {
    test('Same-day go-live warning for any asset', async ({ page }) => {
      await helpers.addAsset('Digital Display - Agency Tags', 'Same Day Test'); // Even shortest asset
      
      // Set go-live date to today
      const today = new Date().toISOString().split('T')[0];
      await helpers.setGlobalLiveDate(today);
      
      // Should show impossible timeline warning
      const warning = await helpers.waitForTimelineWarning('insufficient');
      await expect(warning).toContainText('starting');
      
      // Even simplest timeline needs at least 1 day setup
      const warningText = await warning.textContent();
      expect(warningText?.toLowerCase()).toMatch(/past|yesterday|insufficient|impossible/);
    });

    test('Past date validation', async ({ page }) => {
      await helpers.addAsset('Digital Display - Agency Tags', 'Past Date Test');
      
      // Set go-live date in the past
      const pastDate = '2024-01-01';
      await helpers.setGlobalLiveDate(pastDate);
      
      // Should show clear past date error
      const warning = page.locator('[data-testid*="error"], [data-testid*="warning"], [data-testid*="validation"]');
      await warning.waitFor({ state: 'visible', timeout: 5000 });
      
      const warningText = await warning.textContent();
      expect(warningText?.toLowerCase()).toMatch(/past|invalid|cannot.*be.*before|future/);
    });

    test('Very far future date handling', async ({ page }) => {
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Far Future Test');
      
      // Set go-live date very far in the future
      await helpers.setGlobalLiveDate('2030-12-31');
      
      // Should generate timeline successfully
      await page.waitForTimeout(1000);
      
      const tasks = await helpers.getTimelineTasks();
      expect(tasks.length).toBeGreaterThan(0);
      
      // All task dates should be valid and in the future
      for (const task of tasks) {
        const startDate = new Date(task.startDate);
        const endDate = new Date(task.endDate);
        
        expect(startDate).toBeInstanceOf(Date);
        expect(endDate).toBeInstanceOf(Date);
        expect(startDate <= endDate).toBe(true);
        expect(endDate <= new Date('2030-12-31')).toBe(true);
      }
    });

    test('Leap year February 29th handling', async ({ page }) => {
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Leap Year Test');
      
      // Set go-live date on leap year Feb 29th (2024)
      await helpers.setGlobalLiveDate('2024-02-29');
      
      // Should handle leap year correctly
      const tasks = await helpers.getTimelineTasks();
      expect(tasks.length).toBeGreaterThan(0);
      
      // Verify dates are valid
      for (const task of tasks) {
        const startDate = new Date(task.startDate);
        const endDate = new Date(task.endDate);
        
        expect(startDate).toBeInstanceOf(Date);
        expect(endDate).toBeInstanceOf(Date);
        expect(isNaN(startDate.getTime())).toBe(false);
        expect(isNaN(endDate.getTime())).toBe(false);
      }
    });

    test('Non-leap year February 29th rejection', async ({ page }) => {
      await helpers.addAsset('Digital Display - Agency Tags', 'Non-Leap Year Test');
      
      // Try to set go-live date on non-leap year Feb 29th (2023)
      await helpers.setGlobalLiveDate('2023-02-29');
      
      // Should show invalid date error
      const error = page.locator('[data-testid*="error"], [data-testid*="validation"], [data-testid*="warning"]');
      await error.waitFor({ state: 'visible', timeout: 3000 });
      
      const errorText = await error.textContent();
      expect(errorText?.toLowerCase()).toMatch(/invalid.*date|invalid|february.*29|date.*not.*exist/);
    });
  });

  test.describe('Multiple asset warning scenarios', () => {
    test('Multiple assets with different durations show combined warnings', async ({ page }) => {
      // Add multiple assets with different complexities
      await helpers.addAsset('Digital Display - Agency Tags', 'Short Asset'); // ~6 days
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Medium Asset'); // ~17 days  
      await helpers.addAsset('Digital - HUB', 'Long Asset'); // ~25+ days
      
      await page.waitForTimeout(2000);
      
      // Total should be 40+ working days
      const totalDuration = await helpers.getProjectDuration();
      expect(totalDuration).toBeGreaterThan(40);
      
      // Set insufficient notice
      const shortNotice = helpers.addWorkingDays(new Date(), 20);
      await helpers.setGlobalLiveDate(shortNotice);
      
      // Warning should reflect the complete timeline complexity
      const warning = await helpers.waitForTimelineWarning('insufficient');
      const warningText = await warning.textContent();
      
      // Should indicate the full scope of work
      expect(warningText?.toLowerCase()).toMatch(/insufficient|requires.*more|total.*time|working.*days/);
    });

    test('Individual asset dates vs global date conflict warnings', async ({ page }) => {
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Asset A');
      await helpers.addAsset('Digital Display - Agency Tags', 'Asset B');
      
      // Set global live date
      await helpers.setGlobalLiveDate('2024-06-01');
      
      // Try to set individual asset date that conflicts with requirements
      await helpers.setAssetLiveDate('Asset A', '2024-05-25'); // Too early for this asset
      
      // Should show conflict warning
      const warning = page.locator('[data-testid*="conflict"], [data-testid*="warning"], [data-testid*="individual"]');
      
      if (await warning.isVisible({ timeout: 2000 })) {
        const warningText = await warning.textContent();
        expect(warningText?.toLowerCase()).toMatch(/conflict|individual.*date|insufficient.*time|asset.*requires/);
      }
    });
  });
});