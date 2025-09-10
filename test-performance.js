#!/usr/bin/env node

/**
 * Performance Test Script - P0 Critical Issue Resolution
 * Tests the prerequisite test suite execution time to validate performance fix
 */

const { spawn } = require('child_process');

console.log('🚀 P0 PERFORMANCE TEST: Testing prerequisite test suite execution time...\n');

const startTime = Date.now();

const testProcess = spawn('npm', ['test', '--', '--watchAll=false', 'src/__tests__/unit/timelineReducerPrerequisites.test.ts'], {
  stdio: 'inherit'
});

testProcess.on('close', (code) => {
  const endTime = Date.now();
  const executionTime = (endTime - startTime) / 1000;
  
  console.log(`\n📊 PERFORMANCE RESULTS:`);
  console.log(`⏱️  Execution time: ${executionTime.toFixed(3)} seconds`);
  console.log(`🎯 Target time: <60 seconds`);
  
  if (executionTime < 60) {
    console.log(`✅ PERFORMANCE REQUIREMENT MET: ${executionTime.toFixed(3)}s << 60s`);
    console.log(`🏆 P0 CRITICAL ISSUE RESOLVED: Test suite runs in ${executionTime.toFixed(3)} seconds`);
    process.exit(0);
  } else {
    console.log(`❌ PERFORMANCE REQUIREMENT FAILED: ${executionTime.toFixed(3)}s >= 60s`);
    console.log(`🚨 P0 CRITICAL ISSUE PERSISTS: Test suite too slow`);
    process.exit(1);
  }
});

testProcess.on('error', (error) => {
  console.error(`❌ Test execution failed:`, error);
  process.exit(1);
});