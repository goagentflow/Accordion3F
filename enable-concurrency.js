/**
 * Concurrency Feature Enabler
 * Run this in the browser console to enable all concurrency features for testing
 */

// Enable all DAG/concurrency features
if (typeof window !== 'undefined' && window.timelineFeatureFlags) {
  console.log('🚀 Enabling concurrency features for testing...');
  
  window.timelineFeatureFlags.enableDAGFeatureSet();
  
  console.log('✅ All concurrency features enabled:');
  console.log('- DAG Timeline Calculator');
  console.log('- Task Overlapping');
  console.log('- Critical Path Display');
  console.log('- Dependency Management UI');
  console.log('- Debug Mode');
  
  console.log('\n📍 Refresh the page to see the changes');
  console.log('\n🔧 To check status: window.timelineFeatureFlags.status()');
  console.log('🔧 To disable: window.timelineFeatureFlags.reset()');
} else {
  console.error('❌ Feature flag interface not available. Make sure you\'re in development mode.');
}