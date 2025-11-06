# Architecture Refactoring Report
Generated: After recent changes (Ctrl+A, cross-tab clipboard, batch run tests)

## Executive Summary

After reviewing the codebase architecture, several areas need refactoring to maintain code quality, reduce duplication, and improve maintainability. The main issues are:

1. **Files exceeding 300-line guideline** (9 files)
2. **Code duplication** (window globals, keyboard shortcuts)
3. **Mixed responsibilities** (App.jsx, PropertiesPanel.jsx)
4. **Inconsistent patterns** (test setup, window globals)

---

## 1. Files Exceeding 300 Lines

### Critical (Should Refactor Immediately)

#### 1.1 `useSimulationManager.js` (559 lines)
**Location:** `src/features/simulation/useSimulationManager.js`

**Issues:**
- Too many responsibilities: initialization, running, stepping, completion dialogs, worker management
- Complex state management with many refs
- Hard to test and maintain

**Recommendation:**
Split into:
- `useSimulationManager.js` (core orchestration, ~200 lines)
- `useSimulationWorker.js` (worker management, ~150 lines)
- `useSimulationCompletion.js` (completion dialog logic, ~100 lines)
- `simulationState.js` (state management utilities, ~100 lines)

#### 1.2 `PropertiesPanel.jsx` (369 lines)
**Location:** `src/components/PropertiesPanel.jsx`

**Issues:**
- Handles multiple element types (place, transition, arc)
- Complex form state management
- Mixed validation and UI logic

**Recommendation:**
Already has sub-components (`PlaceProperties`, `ArcBindingsEditor`, `TransitionGuardEditor`), but main component still too large. Extract:
- `usePropertiesForm.js` (form state management hook, ~150 lines)
- `PropertiesPanel.jsx` (orchestration only, ~150 lines)
- Keep existing sub-components

#### 1.3 `PetriNetContext.jsx` (343 lines)
**Location:** `src/contexts/PetriNetContext.jsx`

**Issues:**
- Too much state in one context
- Complex initialization logic
- Mixed concerns (editor state, simulation state, UI state)

**Recommendation:**
Consider splitting into:
- `PetriNetContext.jsx` (core editor state: elements, selection, mode, ~200 lines)
- `EditorUIContext.jsx` (UI state: zoom, scroll, grid, ~100 lines)
- Keep simulation state in context but simplify

#### 1.4 `App.jsx` (308 lines)
**Location:** `src/App.jsx`

**Issues:**
- Keyboard shortcuts duplicated (also in `useKeyboardShortcuts.js`)
- Window global setup mixed with component logic
- Layout and logic mixed

**Recommendation:**
- Extract keyboard shortcuts to `useKeyboardShortcuts.js` (remove duplication)
- Extract window globals setup to `src/utils/testGlobals.js`
- Keep App.jsx focused on layout only (~150 lines)

### Moderate Priority

#### 1.5 `algebraic-simulator.js` (460 lines)
**Location:** `src/features/simulation/algebraic-simulator.js`

**Recommendation:**
Split into:
- `algebraic-simulator.js` (core simulation logic, ~250 lines)
- `algebraic-constraints.js` (Z3 constraint solving, ~150 lines)
- `algebraic-bindings.js` (binding resolution, ~60 lines)

#### 1.6 `eval-bool.js` (456 lines)
**Location:** `src/utils/z3/eval-bool.js`

**Recommendation:**
Split by operation type:
- `eval-bool.js` (core evaluation, ~200 lines)
- `eval-bool-operators.js` (operator evaluation, ~150 lines)
- `eval-bool-helpers.js` (helper functions, ~100 lines)

#### 1.7 `reader.js` (363 lines)
**Location:** `src/utils/pnml/reader.js`

**Recommendation:**
Split by concern:
- `reader.js` (main parsing orchestration, ~150 lines)
- `reader-places.js` (place parsing, ~80 lines)
- `reader-transitions.js` (transition parsing, ~80 lines)
- `reader-arcs.js` (arc parsing, ~80 lines)

#### 1.8 `historyManager.js` (341 lines)
**Location:** `src/features/history/historyManager.js`

**Recommendation:**
Split into:
- `historyManager.js` (core history management, ~200 lines)
- `historyDiff.js` (diff calculation utilities, ~100 lines)
- `historyState.js` (state comparison utilities, ~40 lines)

#### 1.9 `simulator-core.js` (314 lines)
**Location:** `src/features/simulation/simulator-core.js`

**Status:** Borderline - acceptable but could be improved

**Recommendation:**
Consider extracting factory logic to separate file if it grows.

---

## 2. Code Duplication Issues

### 2.1 Window Global Variables
**Issue:** Window globals (`__PETRI_NET_*`) are scattered across multiple files:
- `App.jsx` - sets globals
- `useSimulationManager.js` - reads globals
- `SimulationManager.jsx` - sets/reads globals
- Multiple test files - sets/reads globals

**Recommendation:**
Create centralized utility:
```javascript
// src/utils/testGlobals.js
export const TestGlobals = {
  setState: (state) => { window.__PETRI_NET_STATE__ = state; },
  getState: () => window.__PETRI_NET_STATE__,
  setMode: (mode) => { window.__PETRI_NET_MODE__ = mode; },
  getMode: () => window.__PETRI_NET_MODE__,
  setClipboard: (clipboard) => { window.__PETRI_NET_CLIPBOARD__ = clipboard; },
  getClipboard: () => window.__PETRI_NET_CLIPBOARD__,
  // ... etc
};
```

### 2.2 Keyboard Shortcuts Duplication
**Issue:** Keyboard shortcuts are handled in both:
- `App.jsx` (lines 165-208) - mode switching, undo/redo, delete
- `useKeyboardShortcuts.js` - copy/paste, delete, select all

**Recommendation:**
Move ALL keyboard shortcuts to `useKeyboardShortcuts.js`:
- Move mode switching (p, t, a, s keys) from App.jsx
- Move undo/redo (Ctrl+Z, Ctrl+Y) from App.jsx
- Keep App.jsx free of keyboard logic

### 2.3 Test Setup Duplication
**Issue:** Window global cleanup/setup repeated in multiple test files.

**Recommendation:**
Create test utilities:
```javascript
// src/__tests__/utils/testGlobals.js
export function setupTestGlobals() { /* ... */ }
export function cleanupTestGlobals() { /* ... */ }
```

---

## 3. Architectural Improvements

### 3.1 Extract Window Globals Setup from App.jsx
**Current:** Window globals are set in a large useEffect in App.jsx (lines 64-108)

**Recommendation:**
```javascript
// src/utils/testGlobals.js
export function syncWindowGlobals(state) {
  window.__PETRI_NET_STATE__ = {
    places: state.elements.places,
    transitions: state.elements.transitions,
    arcs: state.elements.arcs,
    selectedElements: state.selectedElements
  };
  window.__PETRI_NET_MODE__ = state.mode;
  window.__PETRI_NET_CLIPBOARD__ = state.clipboardRef;
  // ... simulation settings
}

// In App.jsx:
useEffect(() => {
  syncWindowGlobals({ elements, selectedElements, mode, clipboardRef, simulationSettings });
}, [elements, selectedElements, mode, clipboardRef, simulationSettings]);
```

### 3.2 Extract Zoom Logic from App.jsx
**Current:** Zoom handling is in App.jsx (lines 110-132)

**Recommendation:**
Create `useCanvasZoom.js` hook:
```javascript
// src/features/canvas/useCanvasZoom.js
export function useCanvasZoom(zoomLevel, setZoomLevel, canvasScroll, setCanvasScroll, ...) {
  const handleZoom = (delta) => { /* ... */ };
  return { handleZoom };
}
```

### 3.3 Simplify PropertiesPanel State Management
**Current:** Complex form state management in PropertiesPanel.jsx

**Recommendation:**
Extract to `usePropertiesForm.js` hook to handle:
- Form value state
- Validation
- Element updates
- Type-specific logic

---

## 4. Priority Refactoring Plan

### Phase 1: High Impact, Low Risk (Week 1)
1. ✅ Extract window globals to utility (2 hours)
2. ✅ Move all keyboard shortcuts to `useKeyboardShortcuts.js` (3 hours)
3. ✅ Extract zoom logic to hook (2 hours)

### Phase 2: Medium Impact, Medium Risk (Week 2)
4. ✅ Split `App.jsx` (remove keyboard shortcuts, extract globals) (4 hours)
5. ✅ Split `PropertiesPanel.jsx` (extract form hook) (4 hours)
6. ✅ Split `PetriNetContext.jsx` (extract UI context) (6 hours)

### Phase 3: High Impact, Higher Risk (Week 3-4)
7. ✅ Split `useSimulationManager.js` (8 hours)
8. ✅ Split `algebraic-simulator.js` (6 hours)
9. ✅ Split `eval-bool.js` (4 hours)

### Phase 4: Lower Priority (Week 5+)
10. ✅ Split `reader.js` (4 hours)
11. ✅ Split `historyManager.js` (4 hours)

---

## 5. Code Quality Metrics

### Current State
- **Files over 300 lines:** 9 files
- **Largest file:** 559 lines (`useSimulationManager.js`)
- **Average file size:** ~150 lines (good)
- **Code duplication:** Medium (window globals, keyboard shortcuts)

### Target State
- **Files over 300 lines:** 0 files
- **Largest file:** < 300 lines
- **Average file size:** ~150 lines (maintain)
- **Code duplication:** Low (centralized utilities)

---

## 6. Testing Considerations

After refactoring, ensure:
1. All existing tests still pass
2. New utilities have unit tests
3. Integration tests verify behavior unchanged
4. E2E tests verify UI functionality

---

## 7. Recommendations Summary

### Immediate Actions
1. **Extract window globals utility** - Reduces duplication, improves testability
2. **Consolidate keyboard shortcuts** - Removes duplication, improves maintainability
3. **Extract zoom logic** - Simplifies App.jsx

### Short-term (Next Sprint)
4. **Split App.jsx** - Focus on layout only
5. **Split PropertiesPanel.jsx** - Extract form management
6. **Split PetriNetContext.jsx** - Separate concerns

### Medium-term (Next Month)
7. **Split useSimulationManager.js** - Most critical large file
8. **Split algebraic-simulator.js** - Improve maintainability
9. **Split eval-bool.js** - Improve readability

### Long-term (Future)
10. **Split reader.js** - When working on PNML features
11. **Split historyManager.js** - When adding history features

---

## Notes

- All refactoring should be done incrementally
- Each phase should be tested before moving to next
- Keep backward compatibility during refactoring
- Update documentation as files are split


