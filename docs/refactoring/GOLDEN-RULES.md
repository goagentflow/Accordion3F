# 🏆 GOLDEN RULES - Accordion Timeline Refactoring

**These rules guide every decision we make during refactoring.**

Remember them. Follow them. Invoke them when something feels wrong.

---

## 📜 THE 7 GOLDEN RULES

### 🔒 Rule #1: Safety First - Protect Data & Users
**"No data leaks, no crashes, no lost work"**

#### What This Means:
- **Validate EVERYTHING** - Every input, every date, every number
- **Sanitize display data** - Prevent XSS attacks
- **Handle errors gracefully** - Never show white screen of death
- **Protect user work** - Auto-save, recovery, warnings
- **No sensitive data exposure** - No secrets in console.logs

#### Examples:

```javascript
// ❌ BAD: No validation
const duration = parseInt(userInput);
taskDuration = duration;

// ✅ GOOD: Full validation
const duration = parseInt(userInput);
if (isNaN(duration) || duration < 1 || duration > 365) {
  showError("Please enter a duration between 1 and 365 days");
  return;
}
taskDuration = duration;
```

#### Red Flags:
- User input going straight to state
- No try-catch blocks
- Console.log with full state objects
- No error boundaries
- No auto-save

#### Check: *"What's the worst thing a user could do here?"*

---

### 📏 Rule #2: 400 Line Maximum
**"If it's over 400 lines, it's doing too much"**

#### What This Means:
- **No file over 400 lines** - Period.
- **Split by responsibility** - One file, one purpose
- **Extract utilities** - Reusable logic goes in utils/
- **Component composition** - Many small components > one large component

#### Examples:

```javascript
// ❌ BAD: TimelineBuilder.js (1700 lines)
// - State management
// - Date calculations  
// - UI rendering
// - Excel export
// - Undo/redo
// All in one file!

// ✅ GOOD: Split by responsibility
// TimelineBuilder.js (300) - Orchestration only
// hooks/useTimeline.js (250) - State management
// utils/dateCalculations.js (200) - Date logic
// services/ExcelExport.js (300) - Export logic
// hooks/useUndoRedo.js (150) - History management
```

#### File Size Guidelines:
- **Components**: 200-300 lines max
- **Hooks**: 100-250 lines max  
- **Utilities**: 100-200 lines max
- **Services**: 200-400 lines max

#### Check: *"Can I explain this file's job in one sentence?"*

---

### ♻️ Rule #3: DRY - Don't Repeat Yourself
**"Write once, use everywhere"**

#### What This Means:
- **No copy-paste coding** - Extract to functions
- **Single source of truth** - One place for each calculation
- **Reusable utilities** - Build a library of helpers
- **Shared constants** - No magic numbers/strings

#### Examples:

```javascript
// ❌ BAD: Same logic in 3 places
// File1.js
const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

// File2.js  
const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

// ✅ GOOD: One source of truth
// utils/dateHelpers.js
export const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

// Everywhere else
import { isWeekend } from 'utils/dateHelpers';
```

#### When to Extract:
- Used in 2+ places? → Extract to utility
- Complex calculation? → Extract to function
- Business rule? → Extract to service
- UI pattern? → Extract to component

#### Check: *"Have I written this before?"*

---

### 🎭 Rule #4: Clear Component Roles
**"Every component has ONE job"**

#### Component Types & Responsibilities:

```javascript
// 1. DUMB/PRESENTATIONAL - Just display
const TaskRow = ({ task, color }) => (
  <div style={{background: color}}>
    {task.name}: {task.duration} days
  </div>
);

// 2. SMART/CONTAINER - Manage state & logic
const TaskManager = () => {
  const [tasks, dispatch] = useReducer(reducer, []);
  return <TaskList tasks={tasks} onEdit={...} />;
};

// 3. HOOKS - Reusable logic
const useAutoSave = (data) => {
  useEffect(() => {
    const timer = setTimeout(() => save(data), 30000);
    return () => clearTimeout(timer);
  }, [data]);
};

// 4. SERVICES - Pure business logic (no React)
const calculateWorkingDays = (start, end) => {
  // Pure calculation, no hooks, no state
};
```

#### Role Clarity Test:
- **Dumb components** shouldn't have useState
- **Smart components** shouldn't have complex styling
- **Hooks** shouldn't render JSX
- **Services** shouldn't import React

#### Check: *"Is this component trying to be everything?"*

---

### 🔄 Rule #5: State Flows One Way
**"Single source of truth, predictable updates"**

#### What This Means:
- **One way to update** - Through actions/dispatch only
- **Immutable updates** - Never mutate, always replace
- **Predictable flow** - Action → Reducer → State → UI
- **No side effects in reducers** - Pure functions only

#### Examples:

```javascript
// ❌ BAD: Multiple update patterns
// Component A
setTasks([...tasks, newTask]);
// Component B  
tasks.push(newTask); // Mutating!
// Component C
localStorage.setItem('tasks', JSON.stringify(tasks));

// ✅ GOOD: Single update pattern
// Any component
dispatch({ type: 'ADD_TASK', payload: newTask });

// One reducer handles everything
const reducer = (state, action) => {
  switch(action.type) {
    case 'ADD_TASK':
      const newState = {
        ...state,
        tasks: [...state.tasks, action.payload]
      };
      saveToLocalStorage(newState); // Side effect in middleware
      return newState;
  }
};
```

#### State Rules:
- Never mutate arrays/objects directly
- All updates go through reducer
- Side effects in useEffect, not reducer
- Component reads state, dispatches actions

#### Check: *"Is there exactly ONE way to change this data?"*

---

### 💼 Rule #6: PM-Friendly Always
**"If a PM can lose work or get confused, we've failed"**

#### What This Means:
- **Never lose work** - Auto-save, recover, backup
- **Clear messaging** - No technical jargon in UI
- **Obvious feedback** - Show saving, saved, errors
- **Preserve workflows** - Don't change Excel format
- **Forgive mistakes** - Always provide undo/recovery

#### Examples:

```javascript
// ❌ BAD: Technical error
alert("Error: Cannot parse DateTime object");

// ✅ GOOD: User-friendly message
showMessage("Please select a valid date for your timeline");

// ❌ BAD: Silent failure
saveToLocalStorage(data); // Could fail silently

// ✅ GOOD: Clear feedback
try {
  saveToLocalStorage(data);
  showIndicator("✓ Saved");
} catch (e) {
  showWarning("Unable to auto-save. Please export to Excel.");
}
```

#### PM Experience Checklist:
- ✅ Can recover from browser crash?
- ✅ Clear what's happening (saving, loading)?
- ✅ Errors make sense to non-developers?
- ✅ Can undo mistakes?
- ✅ Excel format unchanged?

#### Check: *"Would a stressed PM at 5pm Friday understand this?"*

---

### 🧪 Rule #7: Regression Testing
**"Add regression tests for critical bugs and user-reported issues"**

#### What This Means:
- **Every critical bug fix** needs a test that prevents it from happening again
- **User-reported issues** require regression tests even if "fixed" by other changes
- **Complex feature interactions** need tests to prevent silent breakage
- **Focus on high-impact areas** rather than testing everything

#### Examples:

```javascript
// ❌ BAD: Fix bug but don't test it
function calculateOverlap(task1, task2) {
  // Fixed: Was returning wrong overlap calculation
  return Math.max(0, task1.end - task2.start);
}

// ✅ GOOD: Fix bug AND add regression test
// Bug fix in code PLUS:
// __tests__/regression/overlap-calculation.test.js
test('overlap calculation handles negative scenarios correctly', () => {
  const task1 = { start: '2025-01-01', end: '2025-01-05' };
  const task2 = { start: '2025-01-10', end: '2025-01-15' };
  
  // This was the bug: returned negative overlap
  expect(calculateOverlap(task1, task2)).toBe(0);
});
```

#### When to Add Regression Tests:
- **Critical bugs** that caused data loss or crashes
- **User-reported issues** that made it to production
- **Excel import/export problems** that break workflows
- **Timeline calculation errors** that affect project dates
- **Performance issues** that made the app unusable

#### Test Categories:
```javascript
// 1. Data Integrity Tests
test('Excel roundtrip preserves all task dependencies', () => {
  // Ensures export → import doesn't lose data
});

// 2. User Workflow Tests  
test('undo/redo works for bulk operations', () => {
  // Ensures users don't lose work
});

// 3. Edge Case Tests
test('handles invalid date inputs gracefully', () => {
  // Ensures app doesn't crash on bad data
});

// 4. Performance Tests
test('timeline calculation completes within 5 seconds for 100 tasks', () => {
  // Ensures app stays responsive
});
```

#### Check: *"If this breaks again, would users notice immediately?"*

---

## 🚨 VIOLATION ALERTS

When you see these patterns, STOP and fix:

| Violation | Rule Broken | Fix |
|-----------|-------------|-----|
| File > 400 lines | Rule #2 | Split immediately |
| Copy-pasted code | Rule #3 | Extract to utility |
| No validation | Rule #1 | Add validation now |
| Component doing everything | Rule #4 | Separate concerns |
| Direct state mutation | Rule #5 | Use reducer |
| Technical error message | Rule #6 | Make it friendly |
| Bug fix without test | Rule #7 | Add regression test |

---

## 💬 MAGIC PHRASES

Say these to invoke rules during coding:

- **"Rule check"** → Review against all rules
- **"Safety check"** → Apply Rule #1
- **"Too long"** → Apply Rule #2  
- **"DRY check"** → Apply Rule #3
- **"Role check"** → Apply Rule #4
- **"State check"** → Apply Rule #5
- **"PM check"** → Apply Rule #6
- **"Test check"** → Apply Rule #7

---

## 📊 QUICK REFERENCE CARD

```javascript
// COPY THIS TO YOUR DESK/MONITOR

🏆 7 GOLDEN RULES - QUICK CHECK
--------------------------------
1. 🔒 SAFE?     Validated, error-handled, no data loss?
2. 📏 SMALL?    Under 400 lines?
3. ♻️ DRY?      Written once, used many?
4. 🎭 FOCUSED?  One component, one job?
5. 🔄 FLOWING?  State flows one way?
6. 💼 FRIENDLY? PM can't lose work or get confused?
7. 🧪 TESTED?   Critical bugs have regression tests?

IF NO TO ANY → STOP AND FIX
```

---

## 📈 MEASURING SUCCESS

At the end of refactoring, we should have:

- **Zero files > 400 lines** (currently: 1 at 1700 lines)
- **Zero duplicate code blocks** (currently: many)
- **100% input validation** (currently: ~10%)
- **Single state update pattern** (currently: multiple)
- **Zero technical error messages** (currently: several)
- **Auto-save + recovery working** (currently: none)
- **Regression tests for all critical bugs** (currently: some)

---

## 🎯 APPLYING TO CURRENT CODE

Current `TimelineBuilder.js` violations:
- ❌ Rule #2: 1700+ lines (need to split)
- ❌ Rule #3: Date calculations repeated
- ❌ Rule #4: One component doing everything
- ❌ Rule #5: 30+ useState calls
- ❌ Rule #1: Minimal validation
- ❌ Rule #6: No auto-save
- ✅ Rule #7: Some regression tests added

**This refactoring will fix ALL of these!**

---

## 📝 ENFORCEMENT PROTOCOL

1. **Start of session**: Read rules reminder
2. **New file created**: Check Rule #2 and #4
3. **Copy-paste detected**: Apply Rule #3
4. **State update added**: Check Rule #5
5. **User input added**: Apply Rule #1
6. **Error message written**: Check Rule #6
7. **Bug fix completed**: Apply Rule #7
8. **End of session**: Full rule check

---

## 🏁 REMEMBER

These rules exist to:
- Prevent future 1700-line files
- Stop bugs before they happen
- Make code others can maintain
- Protect PM productivity
- Build trust in the tool

**When in doubt, check the rules!**

---

*Last Updated: September 13, 2025*
*Version: 1.1 - Added Rule #7: Regression Testing*