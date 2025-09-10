#!/usr/bin/env node

/**
 * Task Bar Selector Discovery
 * Find the correct selectors for draggable task bars in the timeline
 */

const { chromium } = require('playwright');

async function findTaskBars() {
  console.log('🔍 Finding task bar selectors...');
  
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // Clear and set up timeline like the tests do
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  
  // Add assets
  const addButtons = page.locator('button:has-text("Add")');
  await addButtons.first().click();
  await page.waitForTimeout(800);
  await addButtons.nth(1).click();
  await page.waitForTimeout(800);
  
  // Set date
  await page.locator('input[type="date"]').first().fill('2025-12-25');
  await page.waitForTimeout(3000);
  
  console.log('✅ Timeline created, now analyzing DOM structure...');
  
  // Comprehensive DOM analysis
  const analysis = await page.evaluate(() => {
    const results = {};
    
    // Look for all possible task bar elements
    const selectors = [
      'td', 'div', 'span', 'rect', 'svg', '[draggable]', '[style*="position"]',
      '[class*="task"]', '[class*="bar"]', '[class*="gantt"]', '[class*="timeline"]',
      '[data-testid*="task"]', '[data-task]', '[data-id]'
    ];
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        const relevantElements = Array.from(elements).filter(el => {
          const rect = el.getBoundingClientRect();
          const hasSize = rect.width > 10 && rect.height > 10;
          const inTimelineArea = rect.x > 400; // Right side of screen where timeline is
          const hasText = el.textContent && el.textContent.trim().length > 0;
          const mightBeTaskBar = hasSize && inTimelineArea;
          
          return mightBeTaskBar;
        }).map(el => ({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          textContent: el.textContent ? el.textContent.substring(0, 50) : '',
          boundingBox: el.getBoundingClientRect(),
          draggable: el.draggable,
          style: el.style.cssText,
          attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ')
        }));
        
        if (relevantElements.length > 0) {
          results[selector] = relevantElements.slice(0, 5); // Top 5 matches
        }
      } catch (e) {
        // Ignore selector errors
      }
    });
    
    // Also check for any elements that might contain "Project Gantt Chart"
    const allElements = document.querySelectorAll('*');
    const ganttElements = Array.from(allElements).filter(el => 
      el.textContent && el.textContent.includes('Project Gantt Chart')
    );
    if (ganttElements.length > 0) {
      results['ganttAreaChildren'] = ganttElements.slice(0, 3).map(el => ({
        tagName: el.tagName,
        className: el.className,
        textContent: el.textContent ? el.textContent.substring(0, 50) : '',
        boundingBox: el.getBoundingClientRect()
      }));
    }
    
    return results;
  });
  
  console.log('\n📊 DOM Analysis Results:');
  console.log('========================');
  
  Object.entries(analysis).forEach(([selector, elements]) => {
    if (elements.length > 0) {
      console.log(`\n🎯 Selector: ${selector} (${elements.length} matches)`);
      elements.forEach((el, i) => {
        console.log(`  ${i + 1}. <${el.tagName}> class="${el.className}" draggable="${el.draggable}"`);
        console.log(`      Size: ${el.boundingBox.width}×${el.boundingBox.height} at (${el.boundingBox.x}, ${el.boundingBox.y})`);
        console.log(`      Text: "${el.textContent}"`);
        if (el.style) console.log(`      Style: ${el.style}`);
        console.log(`      Attrs: ${el.attributes}`);
      });
    }
  });
  
  // Try to find the most likely task bar candidates
  console.log('\n🎯 BEST TASK BAR CANDIDATES:');
  console.log('============================');
  
  const bestCandidates = await page.evaluate(() => {
    // Look specifically in the timeline table area
    const timelineTable = document.querySelector('table, [class*="gantt"], [class*="timeline"]');
    if (!timelineTable) return [];
    
    // Find elements that look like task bars (rectangular, positioned, in timeline area)
    const allElements = timelineTable.querySelectorAll('*');
    const candidates = Array.from(allElements).filter(el => {
      const rect = el.getBoundingClientRect();
      const isTaskBarSized = rect.width > 20 && rect.width < 500 && rect.height > 10 && rect.height < 100;
      const hasContent = el.textContent || el.style.backgroundColor || el.className.includes('task') || el.className.includes('bar');
      
      return isTaskBarSized && hasContent;
    }).slice(0, 10).map(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      textContent: el.textContent ? el.textContent.substring(0, 50) : '',
      boundingBox: el.getBoundingClientRect(),
      draggable: el.draggable,
      computedStyle: {
        backgroundColor: window.getComputedStyle(el).backgroundColor,
        cursor: window.getComputedStyle(el).cursor,
        position: window.getComputedStyle(el).position
      }
    }));
    
    return candidates;
  });
  
  bestCandidates.forEach((candidate, i) => {
    console.log(`\n${i + 1}. <${candidate.tagName}> class="${candidate.className}"`);
    console.log(`   Size: ${candidate.boundingBox.width}×${candidate.boundingBox.height}`);
    console.log(`   Text: "${candidate.textContent}"`);
    console.log(`   Draggable: ${candidate.draggable}`);
    console.log(`   Background: ${candidate.computedStyle.backgroundColor}`);
    console.log(`   Cursor: ${candidate.computedStyle.cursor}`);
  });
  
  await page.waitForTimeout(3000); // Keep browser open for manual inspection
  await browser.close();
  
  return bestCandidates;
}

findTaskBars().catch(console.error);