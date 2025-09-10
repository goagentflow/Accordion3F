# Concurrency V1 UAT Test Plan
## Comprehensive Fragility Detection & Bug Reproduction

### 🎯 **Primary Objective**
Identify and reproduce intermittent bugs causing:
- Timeline/Gantt chart clearing unexpectedly
- Assets disappearing from the list
- State corruption requiring user to restart
- Drag-to-move dependency persistence failures

### 🔬 **Test Strategy**
**Systematic Exhaustion Approach**: Test every permutation of user actions to find non-deterministic failure patterns.

---

## 📋 **Test Suite Breakdown**

### **1. Fragility Detection Tests** (`concurrency-v1-fragility.spec.ts`)

#### **Race Condition Detection:**
- Auto-save during drag operations
- Timeline recalculation during user input
- State updates during recovery prompt
- Multiple rapid state changes
- Save conflicts during editing

#### **Memory Pressure Tests:**
- 100+ assets with dependencies
- Rapid asset creation/deletion cycles
- Large timeline calculations
- Browser storage quota limits

#### **Timing-Sensitive Operations:**
- Actions during auto-save debounce
- Interrupting timeline calculations
- Network delays during CSV loading
- Browser back/forward navigation

---

### **2. State Persistence Tests** (`concurrency-v1-persistence.spec.ts`)

#### **Save/Reload Cycles:**
- Create timeline → Save → Refresh → Verify
- Drag to create overlap → Save → Refresh → Verify dependencies
- Modify during auto-save → Force refresh → Check integrity
- Partial save scenarios → Recovery verification

#### **Storage Corruption Scenarios:**
- Malformed localStorage data
- Storage quota exceeded
- Concurrent tab modifications
- Browser crash simulation

#### **Recovery Edge Cases:**
- Accept recovery during active editing
- Reject recovery with unsaved changes
- Recovery prompt appearing during operations
- Multiple recovery prompts

---

### **3. User Journey Chaos Tests** (`concurrency-v1-chaos.spec.ts`)

#### **Random Action Sequences:**
- 1000+ random user actions
- Rapid clicking patterns
- Keyboard shortcuts during mouse operations
- Drag operations with interruptions

#### **Edge Case Combinations:**
```
Test Matrix Examples:
- Add Asset → Drag Task → Change Date → Delete Asset → Refresh
- Toggle Global Date → Add Custom Task → Drag → Save → Undo → Refresh  
- Import Excel → Rename Asset → Drag Multiple → Force Save → Recovery
```

#### **Stress Patterns:**
- Rapid fire button clicks
- Mouse events during keyboard input
- Drag start/cancel/restart cycles
- Multi-touch simulation (mobile)

---

### **4. Dependency Stress Tests** (`concurrency-v1-dependencies.spec.ts`)

#### **Drag-to-Move Edge Cases:**
- Drag during timeline calculation
- Create circular dependencies
- Move task with existing dependencies
- Drag multiple tasks simultaneously
- Rapid drag operations

#### **State Consistency:**
- Dependency creation during save
- Moving predecessor tasks
- Deleting tasks with dependencies
- Bulk dependency operations

#### **Persistence Verification:**
- Create dependency → Refresh → Verify positions
- Complex dependency chains → Save/reload
- Dependencies with custom tasks
- Cross-asset dependencies

---

### **5. Asset Bug Detection Tests** (`concurrency-v1-asset-bugs.spec.ts`)

#### **Asset Disappearance Patterns:**
```javascript
// Known problematic sequences to test:
1. Add multiple assets → Rename → Change dates → Action during auto-save
2. Delete middle asset → Undo → Save → Refresh
3. Toggle between global/individual dates rapidly
4. Import Excel → Modify → Clear → Undo → Save
5. Copy asset → Rename → Drag tasks → Delete original
```

#### **Timeline Clearing Scenarios:**
- State updates during render
- Invalid date calculations
- Memory leaks causing crashes
- Storage corruption recovery

#### **Data Integrity:**
- Asset count consistency
- Task assignment verification
- Date relationship validation
- Name/ID consistency

---

## 🚨 **Critical Failure Detection**

### **Immediate Red Flags:**
- ❌ Timeline becomes empty without user action
- ❌ Assets vanish from selection list
- ❌ Drag operations don't persist after refresh
- ❌ Save indicator shows saved but data is lost
- ❌ Console errors during normal operations

### **Intermittent Warning Signs:**
- ⚠️ Same actions produce different results
- ⚠️ UI becomes unresponsive briefly
- ⚠️ Memory usage grows continuously
- ⚠️ Save operations take unusually long
- ⚠️ Recovery prompts appear unexpectedly

---

## 📊 **Test Execution Plan**

### **Phase 1: Baseline Testing** (30 minutes)
- Run existing tests to ensure app works normally
- Verify current functionality works as expected
- Establish performance baselines

### **Phase 2: Systematic Edge Cases** (2 hours)
- Execute each test suite methodically
- Log every action with timestamps
- Record screen during all operations
- Capture state before/after each action

### **Phase 3: Chaos Testing** (1 hour)
- Random action sequences
- Stress testing with high load
- Concurrent operations
- Browser limit testing

### **Phase 4: Pattern Analysis** (30 minutes)
- Review all failure recordings
- Identify common sequences leading to bugs
- Document reproduction steps
- Categorize failure types

---

## 📈 **Success Metrics**

### **Bug Discovery:**
- Reproduce intermittent failures consistently
- Identify exact action sequences causing bugs
- Document state corruption patterns
- Find memory leaks or performance issues

### **Data Quality:**
- Zero data loss scenarios
- Complete state recovery
- Deterministic behavior
- Performance within acceptable limits

### **Documentation:**
- Complete reproduction steps for each bug
- Video evidence of failures
- State dumps at failure points
- Performance metrics during failures

---

## 🔧 **Test Environment Setup**

### **Browser Configuration:**
- Chrome DevTools open (Network, Console, Memory tabs)
- Slow 3G network simulation for timing issues
- Memory profiling enabled
- Video recording active

### **App State:**
- Clean localStorage start
- Multiple test data scenarios
- Various asset types and complexities
- Different date ranges and configurations

### **Monitoring:**
- Real-time console output
- Memory usage tracking
- Network activity monitoring
- LocalStorage change detection

---

## 📝 **Expected Outputs**

### **Bug Reports:**
- `CONCURRENCY-V1-BUG-REPORT.md` - Complete findings
- `concurrency-v1-failures/` - Screenshots & videos
- `test-results/concurrency-v1/` - Detailed test results

### **Performance Data:**
- Memory usage patterns
- Save/load operation timings
- Timeline calculation performance
- Browser resource consumption

### **Reproduction Guides:**
- Step-by-step bug recreation
- Minimal reproduction cases
- Environmental factors
- Workaround documentation

---

**This comprehensive test plan will systematically expose the fragility issues and provide concrete reproduction steps for fixing the intermittent bugs.**