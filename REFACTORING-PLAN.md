# REFACTORING-PLAN.md
## Technical Blueprint for TimelineBuilder.js Architectural Overhaul

**Date**: 2025-09-06  
**Status**: 🎯 **PHASE 1 TECHNICAL DESIGN - FOR SENIOR DEV REVIEW**

**Authority**: Senior Developer Oversight Directive  
**Blueprint For**: Mandatory architectural refactoring to resolve state corruption bugs

---

## 📋 **EXECUTIVE SUMMARY**

### **Current State Analysis**: CRITICAL VIOLATIONS CONFIRMED
- **File Size**: 2,380 lines (596% over Golden Rule #2's 400-line limit)
- **State Hooks**: 28 useState hooks (massive Golden Rule #5 violation)
- **Mixed Concerns**: Single component handles CSV parsing, state management, UI rendering, auto-save, undo/redo, Excel import/export, drag operations, and timeline calculations
- **Root Cause**: State corruption occurs because 28 independent state setters cannot maintain consistency during rapid operations

### **Refactoring Strategy**: COMPLETE ARCHITECTURAL OVERHAUL
This blueprint details the **mandatory dismantling** of TimelineBuilder.js into **5 Golden Rules-compliant components** with **single useReducer state management** and **comprehensive TypeScript typing**.

---

## 🎯 **CURRENT ARCHITECTURE VIOLATIONS ANALYSIS**

### **Golden Rule Violations Identified**

#### **Rule #1 (Safety) - CRITICAL VIOLATION**
```javascript
// Current: 28 useState hooks create race conditions
const [selectedAssets, setSelectedAssets] = useState([]);
const [taskDependencies, setTaskDependencies] = useState({});
const [assetTaskDurations, setAssetTaskDurations] = useState({});
// ... 25 more useState hooks

// Problem: Rapid manipulation causes state inconsistency
// Drag operation calls 3-5 setters simultaneously
// Auto-save interrupts with additional setters
// Result: State corruption and data loss
```

#### **Rule #2 (400 Line Max) - SEVERE VIOLATION**
```javascript
// Current: 2,380 lines (596% over limit)
// Target: Break into 5 components, each <400 lines

TimelineBuilder.js: 2,380 lines → 5 components @ ~300 lines each
```

#### **Rule #4 (Clear Component Roles) - MAJOR VIOLATION**
```javascript
// Current: Single component handles EVERYTHING
// - CSV parsing and validation
// - State management (28 state hooks)
// - Timeline calculations
// - UI rendering (Gantt chart, controls, dialogs)
// - Auto-save and persistence
// - Undo/redo functionality
// - Excel import/export
// - Drag operation handling
// - Error management

// Target: Single Responsibility Principle
```

#### **Rule #5 (State Flows One Way) - FUNDAMENTAL VIOLATION**
```javascript
// Current: 28 independent state setters
const [csvData, setCsvData] = useState([]);
const [uniqueAssets, setUniqueAssets] = useState([]);
const [selectedAssets, setSelectedAssets] = useState([]);
// ... 25 more creating state conflicts

// Target: Single useReducer with typed actions
```

---

## 🏗️ **NEW COMPONENT ARCHITECTURE**

### **Component Breakdown** (Golden Rules Compliant)

#### **1. TimelineContainer.tsx** (~350 lines)
**Role**: State management and coordination ONLY
```typescript
// SINGLE RESPONSIBILITY: State management
import { useReducer, useEffect } from 'react';
import { timelineReducer, initialState } from '../reducers/timelineReducer';
import { TimelineContextProvider } from '../contexts/TimelineContext';

const TimelineContainer = () => {
  const [state, dispatch] = useReducer(timelineReducer, initialState);
  
  // Coordination logic only - NO UI rendering
  // Auto-save management
  // State hydration from localStorage
  // Undo/redo coordination
  
  return (
    <TimelineContextProvider value={{ state, dispatch }}>
      <TimelineRenderer />
    </TimelineContextProvider>
  );
};
```

#### **2. TimelineRenderer.tsx** (~380 lines)  
**Role**: Pure presentation and layout ONLY
```typescript
// SINGLE RESPONSIBILITY: UI rendering and layout
import { useTimelineContext } from '../contexts/TimelineContext';

const TimelineRenderer = () => {
  const { state } = useTimelineContext();
  
  // Pure presentation component
  // NO state management
  // NO business logic
  // Renders based on context state only
  
  return (
    <div className="timeline-app">
      <TimelineControls />
      <GanttChart />
      <TimelineMetrics />
    </div>
  );
};
```

#### **3. GanttChart.tsx** (~320 lines)
**Role**: SVG timeline rendering and drag operations ONLY  
```typescript
// SINGLE RESPONSIBILITY: SVG rendering and drag handling
import { useTimelineContext } from '../contexts/TimelineContext';
import { useDragOperations } from '../hooks/useDragOperations';

const GanttChart = () => {
  const { state, dispatch } = useTimelineContext();
  const { handleDragStart, handleDragMove, handleDragEnd } = useDragOperations(dispatch);
  
  // SVG rendering logic only
  // Drag event handling with proper queuing
  // Task bar visualization
  // Dependency line rendering
  
  return (
    <svg className="gantt-timeline">
      {state.tasks.timeline.map(task => (
        <rect 
          key={task.id}
          data-testid={`task-bar-${task.id}`}
          onMouseDown={handleDragStart(task.id)}
          // SVG task bar rendering
        />
      ))}
    </svg>
  );
};
```

#### **4. TimelineControls.tsx** (~290 lines)
**Role**: User input controls ONLY
```typescript  
// SINGLE RESPONSIBILITY: User input handling
import { useTimelineContext } from '../contexts/TimelineContext';

const TimelineControls = () => {
  const { state, dispatch } = useTimelineContext();
  
  // Asset selection controls
  // Date picker controls  
  // Import/export buttons
  // Add/remove asset controls
  
  return (
    <div className="timeline-controls">
      <AssetSelector />
      <DateControls />
      <ImportExportControls />
    </div>
  );
};
```

#### **5. DataManager.tsx** (~340 lines)
**Role**: CSV/Excel data processing ONLY
```typescript
// SINGLE RESPONSIBILITY: Data import/export
import { useTimelineContext } from '../contexts/TimelineContext';

const DataManager = () => {
  const { dispatch } = useTimelineContext();
  
  // CSV parsing and validation
  // Excel import/export logic
  // Data transformation utilities
  // Schema migration handling
  
  // NO UI rendering (renders modals only)
  // Communicates via context dispatch only
};
```

---

## 🔧 **NEW STATE MANAGEMENT SYSTEM**

### **Single State Shape** (Full TypeScript)
```typescript
// types/timeline.types.ts - ALREADY EXISTS AND IS COMPREHENSIVE
interface TimelineState {
  assets: AssetsState;      // Asset selection and configuration
  tasks: TasksState;        // Task management and timeline data  
  dates: DatesState;        // Date configuration and validation
  ui: UIState;             // UI state and error handling
  status: 'loading' | 'ready' | 'error' | 'hydrating';
}

// CRITICAL: State shape already defined in existing types file
// This existing file will be the foundation for new reducer
```

### **Reducer Design** (Golden Rule #5 Compliance)
```typescript
// reducers/timelineReducer.ts - NEW FILE
const timelineReducer = (state: TimelineState, action: TimelineAction): TimelineState => {
  switch (action.type) {
    case ActionType.DRAG_TASK:
      // SINGLE state update for drag operations
      // Prevents race conditions from multiple setters
      return {
        ...state,
        tasks: {
          ...state.tasks,
          timeline: updateTaskPosition(state.tasks.timeline, action.payload)
        }
      };
      
    case ActionType.ADD_DEPENDENCY:  
      // SINGLE state update for dependency creation
      return {
        ...state,
        tasks: {
          ...state.tasks,
          all: addDependencyToTask(state.tasks.all, action.payload)
        }
      };
      
    case ActionType.HYDRATE_FROM_STORAGE:
      // SINGLE state update for localStorage hydration
      return {
        ...state,
        ...action.payload,
        status: 'ready'
      };
      
    // All 28 current state changes flow through single reducer
    // Eliminates race conditions and state corruption
  }
};
```

### **Action Creators** (Type-Safe State Updates)
```typescript  
// actions/timelineActionCreators.ts - NEW FILE
export const dragTaskAction = (taskId: string, deltaX: number, deltaY: number): DragTaskAction => ({
  type: ActionType.DRAG_TASK,
  payload: { taskId, deltaX, deltaY }
});

export const addDependencyAction = (predecessorId: string, successorId: string, overlapDays: number): AddDependencyAction => ({
  type: ActionType.ADD_DEPENDENCY, 
  payload: { predecessorId, successorId, overlapDays }
});

// All state changes become type-safe, predictable actions
```

---

## 🛠️ **RISK MITIGATION INTEGRATION**

### **Risk: State Shape Breaking Changes**
**Mitigation Strategy**: Schema versioning with migration
```typescript
// utils/stateMigration.ts - NEW FILE  
interface StateVersion {
  version: number;
  data: any;
}

const currentVersion = 2;

export const migrateState = (storedState: StateVersion): TimelineState => {
  if (storedState.version < currentVersion) {
    // Apply migration transformations
    const migratedData = applyMigrations(storedState.data, storedState.version);
    return validateStateShape(migratedData);
  }
  return storedState.data;
};

// localStorage schema: { version: 2, data: TimelineState }
```

### **Risk: UI Rendering Inconsistencies**
**Mitigation Strategy**: Explicit ready flags
```typescript
// Derived state flags - NO manual booleans
const isTimelineReady = state.status === 'ready' && 
                       state.tasks.timeline.length > 0 &&
                       state.assets.selected.length > 0;

const isDataLoading = state.status === 'loading' || state.status === 'hydrating';

// UI renders conditionally based on derived state
```

### **Risk: Drag Operation Performance**
**Mitigation Strategy**: Event coalescing and queuing
```typescript
// hooks/useDragOperations.ts - NEW FILE
export const useDragOperations = (dispatch: React.Dispatch<TimelineAction>) => {
  const dragQueueRef = useRef<DragOperation[]>([]);
  const isProcessingRef = useRef(false);
  
  const processDragQueue = useCallback(async () => {
    if (isProcessingRef.current || dragQueueRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    
    // Coalesce multiple drag events into single state update
    const coalescedOperation = coalesceDragOperations(dragQueueRef.current);
    dispatch(dragTaskAction(coalescedOperation));
    
    dragQueueRef.current = [];
    isProcessingRef.current = false;
  }, [dispatch]);
  
  // Queue management prevents state corruption from rapid drags
};
```

### **Risk: Memory Leaks**
**Mitigation Strategy**: Bounded history and cleanup audit  
```typescript
// Maximum undo history size (prevents unbounded growth)
const MAX_HISTORY_SIZE = 50;

// Enhanced undo/redo with cleanup
const undoRedoReducer = (state: UndoRedoState, action: UndoRedoAction) => {
  switch (action.type) {
    case 'PUSH_HISTORY':
      return {
        ...state,
        history: [
          ...state.history.slice(-MAX_HISTORY_SIZE + 1), // Bounded size
          action.payload
        ]
      };
  }
};

// Cleanup audit for all useEffect hooks
const useCleanupAudit = () => {
  useEffect(() => {
    // All event listeners must have cleanup functions
    return () => {
      // Mandatory cleanup
    };
  }, []);
};
```

### **Risk: Hydration Race Conditions**  
**Mitigation Strategy**: Explicit hydration lifecycle
```typescript
// Hydration lifecycle management
const useHydration = () => {
  const [state, dispatch] = useTimelineContext();
  
  useEffect(() => {
    const hydrateFromStorage = async () => {
      dispatch({ type: ActionType.SET_STATUS, payload: 'hydrating' });
      
      const storedData = localStorage.getItem('timeline-state');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        const migratedState = migrateState(parsedData);
        
        dispatch({ 
          type: ActionType.HYDRATE_FROM_STORAGE, 
          payload: migratedState 
        });
      } else {
        dispatch({ type: ActionType.SET_STATUS, payload: 'ready' });
      }
    };
    
    hydrateFromStorage();
  }, []);
  
  // Auto-save disabled until hydration complete
  const autoSaveEnabled = state.status === 'ready';
};
```

---

## 🧪 **TEST INFRASTRUCTURE ENHANCEMENT**

### **data-testid Strategy** (Eliminates Test Fragility)
```typescript
// All interactive elements get explicit test IDs
<rect 
  data-testid={`task-bar-${task.id}`}
  data-task-type={task.assetType}
  data-drag-handle="true"
/>

<button 
  data-testid="add-asset-button"
  data-asset-type={assetType}
/>

<input 
  data-testid={`asset-live-date-${asset.id}`}
  data-input-type="date"
/>

// Test selectors become reliable and maintainable
```

### **Unit Test Foundation** (Must Fail Against Current Code)
```typescript
// __tests__/timelineReducer.test.ts - NEW FILE
describe('timelineReducer', () => {
  test('DRAG_TASK action updates task position consistently', () => {
    const initialState = createTestState();
    const dragAction = dragTaskAction('task-1', 100, 0);
    
    const newState = timelineReducer(initialState, dragAction);
    
    // This test MUST FAIL against current 28-useState implementation
    expect(newState.tasks.timeline[0].start).toBe('2025-12-27'); // Expected after drag
    expect(newState).not.toBe(initialState); // Immutable update
  });
  
  test('ADD_DEPENDENCY action prevents circular dependencies', () => {
    const state = createStateWithTasks(['A', 'B', 'C']);
    
    // Create A → B dependency
    const step1 = timelineReducer(state, addDependencyAction('A', 'B', 0));
    
    // Try to create B → A (circular)
    const step2 = timelineReducer(step1, addDependencyAction('B', 'A', 0));
    
    // Should reject circular dependency
    expect(step2.tasks.all.find(t => t.id === 'A').dependencies).toHaveLength(0);
  });
});
```

### **Property-Based Tests** (Invariant Validation)
```typescript
// __tests__/dragInvariants.test.ts - NEW FILE  
import fc from 'fast-check';

test('drag operations maintain timeline consistency', () => {
  fc.assert(fc.property(
    fc.array(fc.record({ id: fc.string(), duration: fc.nat() })),
    fc.nat(),
    (tasks, dragAmount) => {
      const state = createStateWithTasks(tasks);
      const draggedState = timelineReducer(state, dragTaskAction(tasks[0]?.id, dragAmount, 0));
      
      // Invariants that must always hold
      expect(draggedState.tasks.timeline.length).toBe(state.tasks.timeline.length);
      expect(draggedState.tasks.timeline.every(t => t.end >= t.start)).toBe(true);
      expect(draggedState.tasks.timeline.every(t => t.duration > 0)).toBe(true);
    }
  ));
});
```

### **Hydration Lifecycle Tests** (localStorage Integration)
```typescript
// __tests__/hydration.test.ts - NEW FILE
test('localStorage hydration preserves timeline integrity', () => {
  // Seed localStorage with known state
  const knownState = createComplexTimelineState();
  localStorage.setItem('timeline-state', JSON.stringify({
    version: 2,
    data: knownState  
  }));
  
  // Mount component
  const { result } = renderHook(() => useTimelineContext(), {
    wrapper: TimelineContextProvider
  });
  
  // Wait for hydration
  waitFor(() => {
    expect(result.current.state.status).toBe('ready');
  });
  
  // Assert identical rendering
  expect(result.current.state.tasks.timeline).toEqual(knownState.tasks.timeline);
  expect(result.current.state.assets.selected).toEqual(knownState.assets.selected);
});
```

---

## 📊 **IMPLEMENTATION ROADMAP**

### **Week 1: Foundation (Critical Path)**
```typescript
// Day 1-2: Core Infrastructure
✅ Create timelineReducer.ts with full typing
✅ Implement action creators with type safety  
✅ Add schema versioning system
✅ Create unit tests that FAIL against current implementation

// Day 3-4: Context and Hooks
✅ Implement TimelineContext with useReducer
✅ Create useDragOperations hook with queuing
✅ Add useHydration hook with lifecycle management
✅ Create useCleanupAudit hook for memory leak prevention

// Day 5: Integration Testing
✅ Add hydration lifecycle tests
✅ Implement property-based tests for invariants
✅ Create integration tests for new state management
```

### **Week 2: Component Refactoring**
```typescript
// Day 1-2: Container and Renderer
✅ Create TimelineContainer.tsx (state management only)
✅ Create TimelineRenderer.tsx (pure presentation)
✅ Add data-testid attributes to all interactive elements

// Day 3-4: Specialized Components  
✅ Create GanttChart.tsx with drag operations
✅ Create TimelineControls.tsx for user inputs
✅ Create DataManager.tsx for CSV/Excel handling

// Day 5: Integration and Testing
✅ Integration testing of new component architecture
✅ Cross-browser compatibility verification
✅ Performance benchmarking against current baseline
```

---

## ✅ **ACCEPTANCE CRITERIA FOR SENIOR DEV REVIEW**

### **Architecture Compliance**
```typescript
✅ All components <400 lines (Golden Rule #2)
✅ Single useReducer pattern (Golden Rule #5) 
✅ Clear separation of concerns (Golden Rule #4)
✅ Type-safe state management (Golden Rule #1)
✅ Comprehensive test coverage with failing tests against current implementation
```

### **Risk Mitigation Integration**
```typescript
✅ Schema versioning system implemented
✅ Explicit hydration lifecycle with proper loading states
✅ Drag operation queuing with event coalescing  
✅ Bounded undo/redo history with memory leak prevention
✅ data-testid attributes on all interactive SVG elements
```

### **Technical Foundation**
```typescript
✅ timelineReducer.ts handles all 28 current state changes
✅ Full TypeScript integration with existing types/timeline.types.ts
✅ Unit tests demonstrate current bug reproduction
✅ Property-based tests validate drag operation invariants
✅ Hydration tests prove localStorage state preservation
```

---

## 🎯 **SENIOR DEV REVIEW POINTS**

### **Critical Questions for Review**
1. **State Shape Approval**: Does the proposed reducer design handle all 28 current state changes safely?
2. **Component Boundaries**: Are the 5 component responsibilities clearly separated and maintainable?  
3. **Risk Mitigation**: Do the proposed mitigations adequately address identified risks?
4. **Test Strategy**: Will the unit tests catch the current bugs and prevent regressions?
5. **Migration Path**: Is the schema versioning strategy sufficient for protecting user data?

### **Implementation Dependencies**  
- ✅ **Existing types/timeline.types.ts**: Already comprehensive, will be foundation
- ✅ **Current CSV data structure**: Will be preserved through DataManager component
- ✅ **Existing TimelineCalculator**: Will integrate through reducer actions
- ⏳ **New test infrastructure**: Requires data-testid additions during implementation

---

## 🏁 **CONCLUSION**

This technical blueprint provides the **complete roadmap** for dismantling the 2,380-line TimelineBuilder.js into **5 Golden Rules-compliant components** with **single useReducer state management**.

**The design directly addresses the root cause** of both manipulation bugs (state corruption from 28 useState hooks) and recovery bugs (race conditions during hydration) through **disciplined architectural principles**.

**All identified risks have specific mitigation strategies** integrated into the design, and **comprehensive testing will validate the fix** before deployment.

This blueprint is **ready for senior developer review and approval** to proceed with Phase 2 implementation.

---

**Blueprint Status**: COMPLETE FOR REVIEW ✅  
**Technical Foundation**: SOLID ✅  
**Risk Mitigation**: COMPREHENSIVE ✅  
**Golden Rules Compliance**: FULL ✅  
**Ready for Phase 2**: PENDING SENIOR DEV APPROVAL ⏳