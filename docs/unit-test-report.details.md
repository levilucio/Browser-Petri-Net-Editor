## Appendix — Unit Test Details

_Per-suite two-line overviews and one-sentence bullets per test._

### src/__tests__/App.test.jsx
- Group: Misc — Miscellaneous tests.
- Scope: validates “App Component” paths across 4 tests.

- App Component: renders main components.
- App Component: starts with select mode.
- App Component: changes mode when toolbar buttons are clicked.
- App Component: selects elements when clicked in select mode.

### src/__tests__/components/AdtDialog.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “AdtDialog” paths across 7 tests.

- AdtDialog: renders nothing when closed.
- AdtDialog: displays registry preview when open.
- AdtDialog: invokes onClose when close button is clicked.
- AdtDialog: solves equations via sandbox.
- AdtDialog: evaluates arithmetic expressions and formats result.
- AdtDialog: falls back to boolean evaluation when arithmetic throws.
- AdtDialog: shows error when sandbox input is empty.

### src/__tests__/components/Arc.algebraic.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “Arc (algebraic bindings)” paths across 2 tests.

- Arc (algebraic bindings): shows bindings when netMode is algebraic-int.
- Arc (algebraic bindings): hides bindings when netMode is pt.

### src/__tests__/components/Arc.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “Arc Component” paths across 7 tests.

- Arc Component: renders correctly with valid source and target.
- Arc Component: applies selected styling when isSelected is true.
- Arc Component: calls onClick handler when clicked.
- Arc Component: returns null if source is not found.
- Arc Component: returns null if target is not found.
- Arc Component: renders arrow points for the arc.
- Arc Component: cancels arc creation when clicking on empty canvas (placeholder).

### src/__tests__/components/EnabledTransitionsPanel.close.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “EnabledTransitionsPanel close control” paths across 1 tests.

- EnabledTransitionsPanel close control: onClose is called when clicking close icon.

### src/__tests__/components/EnabledTransitionsPanel.empty.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “EnabledTransitionsPanel empty state” paths across 1 tests.

- EnabledTransitionsPanel empty state: renders empty text when no enabled transitions.

### src/__tests__/components/EnabledTransitionsPanel.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “EnabledTransitionsPanel” paths across 4 tests.

- EnabledTransitionsPanel: does not render when closed.
- EnabledTransitionsPanel: renders enabled transitions and fires on click.
- EnabledTransitionsPanel: close control is not counted among transition buttons.
- EnabledTransitionsPanel: close control calls onClose.

### src/__tests__/components/PetriNetPanel.algebraic.markings.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “PetriNetPanel algebraic markings” paths across 1 tests.

- PetriNetPanel algebraic markings: shows only non-empty algebraic places and formats token values.

### src/__tests__/components/PetriNetPanel.empty.toggle.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “PetriNetPanel toggles and empty state” paths across 1 tests.

- PetriNetPanel toggles and empty state: shows empty state when no places and toggles panel visibility.

### src/__tests__/components/PetriNetPanel.enabled.multiple.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “PetriNetPanel multiple enabled transitions” paths across 1 tests.

- PetriNetPanel multiple enabled transitions: renders two enabled transitions and fires both on click.

### src/__tests__/components/PetriNetPanel.enabled.toggle.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “PetriNetPanel enabled transitions toggle” paths across 1 tests.

- PetriNetPanel enabled transitions toggle: panel shows and hides via toggle button.

### src/__tests__/components/PetriNetPanel.enabled.transitions.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “PetriNetPanel enabled transitions” paths across 1 tests.

- PetriNetPanel enabled transitions: clicking enabled transition button fires it via context handler.

### src/__tests__/components/PetriNetPanel.pt.markings.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “PetriNetPanel PT markings” paths across 1 tests.

- PetriNetPanel PT markings: shows numeric token badges for PT mode.

### src/__tests__/components/PetriNetPanel.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “PetriNetPanel” paths across 3 tests.

- PetriNetPanel: renders PT markings as counts.
- PetriNetPanel: renders algebraic markings as formatted tokens.
- PetriNetPanel: enabled transitions panel renders and fires via onFire.

### src/__tests__/components/Place.algebraic.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “Place (algebraic tokens)” paths across 2 tests.

- Place (algebraic tokens): renders small integer tokens as scattered numbers.
- Place (algebraic tokens): renders large integer token list as count indicator.

### src/__tests__/components/Place.drag.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “Place drag lifecycle” paths across 1 tests.

- Place drag lifecycle: drag start/move/end toggles flags, snaps, and calls onChange.

### src/__tests__/components/Place.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “Place Component” paths across 6 tests.

- Place Component: renders with correct position.
- Place Component: applies selected styling when isSelected is true.
- Place Component: displays correct place name.
- Place Component: displays correct token count.
- Place Component: calls onSelect handler when clicked.
- Place Component: is draggable.

### src/__tests__/components/PropertiesPanel.algebraic.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “PropertiesPanel (algebraic mode)” paths across 3 tests.

- PropertiesPanel (algebraic mode): place: updates valueTokens and tokens from Algebraic Tokens input.
- PropertiesPanel (algebraic mode): arc: validates and updates bindings array when expressions are valid.
- PropertiesPanel (algebraic mode): place: supports recursively nested pair tokens.

### src/__tests__/components/PropertiesPanel.behaviors.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “PropertiesPanel behavior details” paths across 6 tests.

- PropertiesPanel behavior details: clears algebraic tokens when input emptied.
- PropertiesPanel behavior details: parses algebraic tokens and triggers type inference.
- PropertiesPanel behavior details: shows binding validation error when arc input invalid.
- PropertiesPanel behavior details: updates bindings and re-runs type inference on success.
- PropertiesPanel behavior details: persists guard when valid expression supplied.
- PropertiesPanel behavior details: shows guard error when boolean expression invalid.

### src/__tests__/components/PropertiesPanel.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “PropertiesPanel Component” paths across 10 tests.

- PropertiesPanel Component: renders empty panel when no element is selected.
- PropertiesPanel Component: renders place properties when a place is selected.
- PropertiesPanel Component: renders transition properties when a transition is selected.
- PropertiesPanel Component: renders arc properties when an arc is selected.
- PropertiesPanel Component: updates place name when input changes.
- PropertiesPanel Component: updates place tokens when input changes.
- PropertiesPanel Component: updates transition name when input changes.
- PropertiesPanel Component: updates arc weight when input changes.
- PropertiesPanel Component: validates token count within range (0-20).
- PropertiesPanel Component: validates arc weight within range (1-20).

### src/__tests__/components/Transition.drag.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “Transition drag lifecycle” paths across 1 tests.

- Transition drag lifecycle: drag start/move/end toggles flags, snaps, and calls onChange.

### src/__tests__/components/Transition.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “Transition Component” paths across 7 tests.

- Transition Component: renders with correct position.
- Transition Component: applies selected styling when isSelected is true.
- Transition Component: displays correct transition name.
- Transition Component: calls onSelect handler when clicked.
- Transition Component: is draggable.
- Transition Component: renders correctly with transition data.
- Transition Component: has correct dimensions.

### src/__tests__/components/UndoRedoButtons.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “Undo/Redo Buttons” paths across 5 tests.

- Undo/Redo Buttons: should render undo and redo buttons.
- Undo/Redo Buttons: should call onUndo when undo button is clicked.
- Undo/Redo Buttons: should call onRedo when redo button is clicked.
- Undo/Redo Buttons: should disable undo button when canUndo is false.
- Undo/Redo Buttons: should disable redo button when canRedo is false.

### src/__tests__/components/hooks/useGlobalTypeInference.test.js
- Group: UI Components — React components and hooks behavior.
- Scope: validates “computeGlobalTypeInferenceForState” paths across 5 tests.

- computeGlobalTypeInferenceForState: returns original state when net mode is not algebraic-int.
- computeGlobalTypeInferenceForState: returns original state when no annotations are computed.
- computeGlobalTypeInferenceForState: annotates input arc bindings based on place token type.
- computeGlobalTypeInferenceForState: propagates list element type annotations.
- computeGlobalTypeInferenceForState: annotates guard and output arcs based on inferred variables.

### src/__tests__/components/toolbar/useToolbarActions.saveas.test.jsx
- Group: UI Components — React components and hooks behavior.
- Scope: validates “useToolbarActions - Save / Save As” paths across 8 tests.

- useToolbarActions - Save / Save As: Save As uses showSaveFilePicker and stores handle.
- useToolbarActions - Save / Save As: Save overwrites when handle exists.
- useToolbarActions - Save / Save As: handleSave falls back to anchor download when File System API unavailable.
- useToolbarActions - Save / Save As: handleOpenAdtManager toggles dialog state when setter provided.
- useToolbarActions - Save / Save As: handleClear uses resetEditor when provided.
- useToolbarActions - Save / Save As: handleClear resets state when resetEditor is absent.
- useToolbarActions - Save / Save As: handleLoad imports PNML and updates state.
- useToolbarActions - Save / Save As: handleLoad surfaces validation errors for invalid files.

### src/__tests__/contexts/AdtContext.test.jsx
- Group: Contexts — React context providers and consumers.
- Scope: validates “AdtContext registry” paths across 6 tests.

- AdtContext registry: provides base types as read-only definitions.
- AdtContext registry: registerCustomADTXml accepts validated custom XML.
- AdtContext registry: registerCustomADTXml rejects duplicate names.
- AdtContext registry: registerCustomADTXml propagates validator errors.
- AdtContext registry: clearCustomADTs removes custom definitions and exported XML.
- AdtContext registry: useAdtRegistry throws outside provider boundary.

### src/__tests__/contexts/PetriNetContext.selection.test.jsx
- Group: Contexts — React context providers and consumers.
- Scope: validates “PetriNetContext selection state” paths across 2 tests.

- PetriNetContext selection state: setSelection focuses last entry; clearSelection resets.
- PetriNetContext selection state: setSelection([]) unsets focused element; isIdSelected behaves accordingly.

### src/__tests__/contexts/PetriNetContext.test.jsx
- Group: Contexts — React context providers and consumers.
- Scope: validates “PetriNetContext” paths across 6 tests.

- PetriNetContext: usePetriNet throws outside of provider.
- PetriNetContext: exposes default state and toggles grid snapping.
- PetriNetContext: snapToGrid respects gridSnappingEnabled flag.
- PetriNetContext: resetEditor clears elements and history.
- PetriNetContext: handleUndo and handleRedo use history manager.
- PetriNetContext: setSelection updates selected elements and focused element.

### src/__tests__/features/BaseSimulator.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “BaseSimulator” paths across 6 tests.

- BaseSimulator: initialize validates input and sets simulator state.
- BaseSimulator: update enforces initialization and normalizes nets.
- BaseSimulator: fireTransition checks readiness and enabled transitions.
- BaseSimulator: emitTransitionsChanged and emitTransitionFired normalize payloads.
- BaseSimulator: reset clears state and delegates to subclass resetSpecific.
- BaseSimulator: getSimulationStats returns totals when initialized.

### src/__tests__/features/SimulationEventBus.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “SimulationEventBus” paths across 3 tests.

- SimulationEventBus: registers, emits, and removes listeners.
- SimulationEventBus: emit catches listener errors and continues notifying others.
- SimulationEventBus: removeAllListeners clears scoped or all listeners.

### src/__tests__/features/algebraic-simulator.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “AlgebraicSimulator (smoke)”, “Pairs support” paths across 14 tests.

- AlgebraicSimulator (smoke): enables transition with simple variable binding and guard, consumes and produces.
- AlgebraicSimulator (smoke): bool guard with bool tokens enables and fires.
- AlgebraicSimulator (smoke): typed bindings x:int, y:bool consume tokens on step.
- AlgebraicSimulator (smoke): typed bindings produce x to P2 and y to P3 with correct bools.
- AlgebraicSimulator (smoke): maximal mode fires non-conflicting int/bool transitions concurrently.
- AlgebraicSimulator (smoke): mixed multiset place supports ints and bools; bool binding matches on bools only.
- AlgebraicSimulator (smoke): updates enabled transitions when guard changes without re-initialize.
- AlgebraicSimulator (smoke): updates output production when output arc bindings change without reload.
- Pairs support: supports pair tokens and pair equality in guards.
- Pairs support: type mismatch between input (String) and output (Int) keeps transition disabled.
- Pairs support: output arc fst(z:Pair) projects first component.
- Pairs support: list deconstruction [1,x:Int,y:Int,z:Int,5] enables transition.
- Pairs support: output list construction with variables produces a list token.
- Pairs support: output list construction with literals produces a list token.

### src/__tests__/features/assignment.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “findSatisfyingAssignment” paths across 8 tests.

- findSatisfyingAssignment: returns environment and picks when bindings succeed.
- findSatisfyingAssignment: falls back to evaluateBooleanPredicate when pure guard evaluation fails.
- findSatisfyingAssignment: returns null when insufficient tokens are available.
- findSatisfyingAssignment: returns null when guard evaluation fails for all strategies.
- findSatisfyingAssignment: pattern binding rejects conflicting variable assignments.
- findSatisfyingAssignment: arith binding requires evaluated value to match numeric token.
- findSatisfyingAssignment: bool binding accepts only matching boolean tokens.
- findSatisfyingAssignment: pair binding matches literal pair structures.

### src/__tests__/features/clipboard-utils.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “clipboard-utils” paths across 2 tests.

- clipboard-utils: collectSelection returns only selected nodes and arcs connecting selected endpoints.
- clipboard-utils: remapIdsForPaste creates new IDs and offsets coordinates.

### src/__tests__/features/conflict-resolver.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “ConflictResolver” paths across 6 tests.

- ConflictResolver: detects conflicts between transitions competing for same int tokens.
- ConflictResolver: distinguishes between int and bool requirements for shared place.
- ConflictResolver: finds maximal non-conflicting transition sets.
- ConflictResolver: collects combinations of requested size.
- ConflictResolver: extracts input and output places for transitions.
- ConflictResolver: clearCache removes cached entries.

### src/__tests__/features/graph-index.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “buildGraphIndex” paths across 1 tests.

- buildGraphIndex: indexes simple PT net with mixed arc id fields.

### src/__tests__/features/history/historyManager.branches.test.js
- Group: History — Undo/redo and state differencing.
- Scope: validates “HistoryManager branches” paths across 2 tests.

- HistoryManager branches: no-op add when states equal.
- HistoryManager branches: undo/redo return null when not possible.

### src/__tests__/features/history/historyManager.diffs.test.js
- Group: History — Undo/redo and state differencing.
- Scope: validates “HistoryManager diffs paths” paths across 2 tests.

- HistoryManager diffs paths: transition count difference triggers new state.
- HistoryManager diffs paths: arc secondary property difference triggers new state.

### src/__tests__/features/history/historyManager.moreDiffs.test.js
- Group: History — Undo/redo and state differencing.
- Scope: validates “HistoryManager compareStates additional branches” paths across 6 tests.

- HistoryManager compareStates additional branches: place valueTokens difference triggers new state.
- HistoryManager compareStates additional branches: transition guard change triggers new state.
- HistoryManager compareStates additional branches: arc bindings change triggers new state.
- HistoryManager compareStates additional branches: arc anglePoints change triggers new state.
- HistoryManager compareStates additional branches: arc label/sourceType/targetType difference triggers new state.
- HistoryManager compareStates additional branches: deepCopyState produces independent copies.

### src/__tests__/features/history/historyManager.test.js
- Group: History — Undo/redo and state differencing.
- Scope: validates “HistoryManager” paths across 11 tests.

- HistoryManager: should initialize with initial state.
- HistoryManager: should add new state and allow undo.
- HistoryManager: should not add duplicate state.
- HistoryManager: detects arc label change as a different state.
- HistoryManager: detects transition guard and place valueTokens diffs.
- HistoryManager: should undo and redo correctly.
- HistoryManager: should limit history to maxStates.
- HistoryManager: should handle undo when at beginning of history.
- HistoryManager: should handle redo when at end of history.
- HistoryManager: should truncate future states when adding after undo.
- HistoryManager: should limit history to exactly 50 states as per requirements.

### src/__tests__/features/history/historyManager.validate.test.js
- Group: History — Undo/redo and state differencing.
- Scope: validates “HistoryManager validateState basics” paths across 1 tests.

- HistoryManager validateState basics: coerces empty or missing structures to empty arrays.

### src/__tests__/features/net-ops.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “net-ops” paths across 3 tests.

- net-ops: deleteNodesAndIncidentArcs removes nodes and their incident arcs.
- net-ops: copySelection returns nodes and arcs with both endpoints selected.
- net-ops: pasteClipboard remaps IDs and offsets positions.

### src/__tests__/features/pattern-deconstruction.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “Pattern Deconstruction” paths across 9 tests.

- Pattern Deconstruction: pattern parsing and matching works for (F,x) pattern.
- Pattern Deconstruction: pattern matching extracts correct bindings.
- Pattern Deconstruction: pattern matching fails for wrong types.
- Pattern Deconstruction: pattern matching fails for wrong structure.
- Pattern Deconstruction: variable typing validation enforces type annotations.
- Pattern Deconstruction: auto-type annotation adds default types.
- Pattern Deconstruction: stringify pattern preserves type annotations.
- Pattern Deconstruction: algebraic simulator enables transition with pattern deconstruction.
- Pattern Deconstruction: algebraic simulator handles multiple pattern bindings.

### src/__tests__/features/pattern-output-production.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “Pattern Output Production” paths across 3 tests.

- Pattern Output Production: produces pattern literal (T,2) on output arc.
- Pattern Output Production: produces pattern literal (F,1) on output arc.
- Pattern Output Production: produces multiple pattern literals on different output arcs.

### src/__tests__/features/pt-simulator.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “PTSimulator” paths across 3 tests.

- PTSimulator: initializes, determines enabled transitions, and fires tokens.
- PTSimulator: validatePTNet rejects algebraic guards and actions.
- PTSimulator: resetSpecific restores default maxTokens.

### src/__tests__/features/selection-utils.arcs.move.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “applyMultiDragDelta moves arc anglePoints only when both endpoints are selected” paths across 1 tests.

- applyMultiDragDelta moves arc anglePoints only when both endpoints are selected: angle points move when both ends selected; remain when not.

### src/__tests__/features/selection-utils.nosnap.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “selection-utils no-snap path” paths across 1 tests.

- selection-utils no-snap path: applyMultiDragDeltaFromSnapshot without snapping uses raw deltas.

### src/__tests__/features/selection-utils.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “selection-utils” paths across 5 tests.

- selection-utils: isCenterInRect detects points inside regardless of rect direction.
- selection-utils: buildSelectionFromRect collects places and transitions whose centers are inside.
- selection-utils: toggleSelection adds and removes items by id/type.
- selection-utils: applyMultiDragDeltaFromSnapshot shifts selected nodes and arc points; supports snapping.
- selection-utils: applyMultiDragDelta shifts only selected nodes and arcs whose endpoints are selected.

### src/__tests__/features/selection-utils.thresholds.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “selection-utils small branches” paths across 2 tests.

- selection-utils small branches: applyMultiDragDeltaFromSnapshot returns prev when snapshot missing.
- selection-utils small branches: buildSelectionFromRect returns empty when null inputs.

### src/__tests__/features/simulation-utils.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “simulation-utils validations”, “simulation-utils helpers” paths across 9 tests.

- simulation-utils validations: validatePetriNet reports structural issues.
- simulation-utils validations: validatePetriNet passes healthy net.
- simulation-utils helpers: deepClonePetriNet produces independent copy.
- simulation-utils helpers: comparePetriNetStates differentiates changes.
- simulation-utils helpers: getMarkingVector summarises place tokens.
- simulation-utils helpers: isDeadlock inspects enabled transitions.
- simulation-utils helpers: toPNML and fromPNML round-trip basic structure.
- simulation-utils helpers: fromPNML rethrows parser failures.
- simulation-utils helpers: getSimulationStats aggregates counts and enabled transitions.

### src/__tests__/features/simulator-core.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “SimulatorCore” paths across 12 tests.

- SimulatorCore: initializes simulator with configured mode.
- SimulatorCore: determineNetMode falls back to algebraic when guards present.
- SimulatorCore: update delegates to underlying simulator.
- SimulatorCore: stepSimulation returns current state when no transitions enabled.
- SimulatorCore: runToCompletion fires enabled transitions until exhausted.
- SimulatorCore: reset clears simulator reference.
- SimulatorCore: reuses simulator when mode unchanged and queues listeners before initialization.
- SimulatorCore: determineNetMode covers algebraic-int alias, bindings, and valueTokens.
- SimulatorCore: getEnabledTransitions and fireTransition handle error scenarios gracefully.
- SimulatorCore: activateSimulation throws when simulator missing and logs when present.
- SimulatorCore: runToCompletion in maximal mode reports progress, honors cancel, and restores event bus.
- SimulatorCore: runToCompletion restores event bus even when firing fails.

### src/__tests__/features/simulator-factory.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “SimulatorFactory” paths across 4 tests.

- SimulatorFactory: creates PT simulator for pt mode.
- SimulatorFactory: creates algebraic simulator for algebraic mode.
- SimulatorFactory: throws for unknown net mode.
- SimulatorFactory: reports available types and support checks.

### src/__tests__/features/token-io.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “token-io helpers” paths across 2 tests.

- token-io helpers: consumeTokens reduces fallback counts and removes indexed value tokens.
- token-io helpers: produceTokens handles binding varieties, weights, and defaults.

### src/__tests__/features/type-inference.test.js
- Group: Features — Feature-layer logic.
- Scope: validates “Type Inference”, “inferTokenType”, “inferVariableTypes”, “List element inference (deterministic only)”, “autoAnnotateTypes” paths across 15 tests.

- Type Inference › inferTokenType: should infer Int for numbers.
- Type Inference › inferTokenType: should infer Bool for booleans.
- Type Inference › inferTokenType: should infer Pair for pair objects.
- Type Inference › inferTokenType: should infer String for strings.
- Type Inference › inferTokenType: should default to Int for unknown types.
- Type Inference › inferVariableTypes: should infer types for arc variables from source place tokens.
- Type Inference › inferVariableTypes: should infer types for transition variables from input arcs.
- Type Inference › inferVariableTypes: should handle pattern bindings.
- Type Inference › inferVariableTypes: should return empty map for invalid inputs.
- Type Inference › List element inference (deterministic only): infers Int for variables bound to list elements when all list elements are Int.
- Type Inference › List element inference (deterministic only): does not infer when list element types are ambiguous.
- Type Inference › autoAnnotateTypes: should annotate variables with inferred types.
- Type Inference › autoAnnotateTypes: should not annotate variables that already have types.
- Type Inference › autoAnnotateTypes: should handle empty or invalid inputs.
- Type Inference › autoAnnotateTypes: should handle complex expressions.

### src/__tests__/features/useKeyboardShortcuts.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useKeyboardShortcuts” paths across 4 tests.

- useKeyboardShortcuts: Delete removes selected nodes and incident arcs.
- useKeyboardShortcuts: Ctrl+C then Ctrl+V pastes with offset and new ids.
- useKeyboardShortcuts: Keys ignored when target is editable.
- useKeyboardShortcuts: Shift key toggles isShiftPressedRef.

### src/__tests__/features/useKeyboardShortcuts.thresholds.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useKeyboardShortcuts edge branches” paths across 1 tests.

- useKeyboardShortcuts edge branches: ignores keys in editable targets.

### src/__tests__/features/useSimulationManager.branches.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useSimulationManager branches” paths across 1 tests.

- useSimulationManager branches: clearError resets simulationError and stopAllSimulations clears flags.

### src/__tests__/features/useSimulationManager.di.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useSimulationManager with DI core” paths across 4 tests.

- useSimulationManager with DI core: initializes, refreshes enabled, and fires a specific transition.
- useSimulationManager with DI core: stepSimulation picks an enabled transition and fires.
- useSimulationManager with DI core: startContinuousSimulation activates and runs at least one step.
- useSimulationManager with DI core: startRunSimulation activates and schedules steps.

### src/__tests__/features/useSimulationManager.errors.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useSimulationManager error paths” paths across 3 tests.

- useSimulationManager error paths: initialize error leaves simulator not ready (error logged but not stored).
- useSimulationManager error paths: update error clears enabled transitions and sets error.
- useSimulationManager error paths: fireTransition error sets simulationError and does not mutate state.

### src/__tests__/features/useSimulationManager.flows.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useSimulationManager flows” paths across 4 tests.

- useSimulationManager flows: stepSimulation (single) picks an enabled transition and fires it.
- useSimulationManager flows: startContinuousSimulation runs then stops when no more enabled transitions.
- useSimulationManager flows: startRunSimulation fires until no more enabled transitions.
- useSimulationManager flows: event bus updates enabled transitions and applies transitionFired new net.

### src/__tests__/features/useSimulationManager.noenabled.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useSimulationManager continuous no-enabled exits early” paths across 1 tests.

- useSimulationManager continuous no-enabled exits early: startContinuousSimulation returns without toggling when no enabled.

### src/__tests__/features/useSimulationManager.nonvisual.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useSimulationManager non-visual & error paths” paths across 8 tests.

- useSimulationManager non-visual & error paths: falls back to getSimulationStats when simulator core reports not ready.
- useSimulationManager non-visual & error paths: non-visual run uses runToCompletion when worker run disabled.
- useSimulationManager non-visual & error paths: worker run handles progress and completion events.
- useSimulationManager non-visual & error paths: handleFireTransition reports errors for invalid simulator state.
- useSimulationManager non-visual & error paths: stopAllSimulations cancels worker and clears simulation flags.
- useSimulationManager non-visual & error paths: startRunSimulation iterates run loop in visual mode.
- useSimulationManager non-visual & error paths: startContinuousSimulation reports errors from simulator core.
- useSimulationManager non-visual & error paths: stepSimulation surfaces errors from simulator core.

### src/__tests__/features/useSimulationManager.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useSimulationManager (DI)” paths across 1 tests.

- useSimulationManager (DI): initially computes enabled transitions and fires a transition.

### src/__tests__/features/useSimulationManager.timers.edgecases.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useSimulationManager timers edge cases” paths across 2 tests.

- useSimulationManager timers edge cases: startRunSimulation with no enabled transitions exits quickly.
- useSimulationManager timers edge cases: startContinuousSimulation respects stop and clears interval.

### src/__tests__/features/useSimulationManager.worker.test.jsx
- Group: Features — Feature-layer logic.
- Scope: validates “useSimulationManager worker and non-visual runs” paths across 9 tests.

- useSimulationManager worker and non-visual runs: startRunSimulation uses worker path and processes completion.
- useSimulationManager worker and non-visual runs: startRunSimulation surfaces worker errors and stops running state.
- useSimulationManager worker and non-visual runs: startRunSimulation falls back to runToCompletion when worker runs are disabled.
- useSimulationManager worker and non-visual runs: handleFireTransition surfaces structural errors from simulator.
- useSimulationManager worker and non-visual runs: falls back to getSimulationStats when simulator core is not ready.
- useSimulationManager worker and non-visual runs: handles simulator update errors by clearing state and surfacing error.
- useSimulationManager worker and non-visual runs: handleFireTransition reports when simulator type is none.
- useSimulationManager worker and non-visual runs: stepSimulation handles maximal mode with object transitions.
- useSimulationManager worker and non-visual runs: handleFireTransition applies updates when simulator returns valid net.

### src/__tests__/setupTests.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “Test Environment Setup” paths across 1 tests.

- Test Environment Setup: import.meta.env is properly mocked.

### src/__tests__/utils/adt-parser.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “ADT parser and validator” paths across 3 tests.

- ADT parser and validator: parses ADT XML.
- ADT parser and validator: validates ADT structure.
- ADT parser and validator: generates ADT XML.

### src/__tests__/utils/arcTypes.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “arcTypes” paths across 2 tests.

- arcTypes: infers source/target types from arc.type when not provided.
- arcTypes: normalizeArc fills sourceType/targetType and preserves id.

### src/__tests__/utils/ast-eval.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “ast-eval evaluatePatternLiteral” paths across 1 tests.

- ast-eval evaluatePatternLiteral: evaluates pair/list/tuple and vars.

### src/__tests__/utils/list-adt.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “List ADT Support”, “List Literal Parsing”, “List Function Parsing”, “List Stringification”, “List Variable Type Annotations”, “List Evaluation with Bindings”, “Type Inference for Lists” paths across 32 tests.

- List ADT Support › List Literal Parsing: parses empty list.
- List ADT Support › List Literal Parsing: parses list with single element.
- List ADT Support › List Literal Parsing: parses list with multiple integers.
- List ADT Support › List Literal Parsing: parses list with mixed types.
- List ADT Support › List Literal Parsing: parses nested lists.
- List ADT Support › List Literal Parsing: parses list with variables.
- List ADT Support › List Function Parsing: parses length function with list literal.
- List ADT Support › List Function Parsing: parses concat function with two list literals.
- List ADT Support › List Function Parsing: parses head function.
- List ADT Support › List Function Parsing: parses tail function.
- List ADT Support › List Function Parsing: parses append function.
- List ADT Support › List Function Parsing: parses sublist function.
- List ADT Support › List Function Parsing: parses isSublistOf function.
- List ADT Support › List Stringification: stringifies empty list.
- List ADT Support › List Stringification: stringifies list with integers.
- List ADT Support › List Stringification: stringifies nested lists.
- List ADT Support › List Variable Type Annotations: parses list variable with type annotation.
- List ADT Support › List Variable Type Annotations: stringifies list variable with type annotation.
- List ADT Support › List Evaluation with Bindings: evaluates empty list literal.
- List ADT Support › List Evaluation with Bindings: evaluates list literal with integers.
- List ADT Support › List Evaluation with Bindings: evaluates list literal with variables.
- List ADT Support › List Evaluation with Bindings: evaluates length of list.
- List ADT Support › List Evaluation with Bindings: evaluates concat of two lists.
- List ADT Support › List Evaluation with Bindings: evaluates head of list.
- List ADT Support › List Evaluation with Bindings: evaluates tail of list.
- List ADT Support › List Evaluation with Bindings: evaluates append to list.
- List ADT Support › List Evaluation with Bindings: evaluates sublist.
- List ADT Support › List Evaluation with Bindings: evaluates isSublistOf (true case).
- List ADT Support › List Evaluation with Bindings: evaluates isSublistOf (false case).
- List ADT Support › List Evaluation with Bindings: evaluates nested list operations.
- List ADT Support › Type Inference for Lists: infers List type for array tokens.
- List ADT Support › Type Inference for Lists: infers other types correctly.

### src/__tests__/utils/logger.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “logger” paths across 3 tests.

- logger: debug logs in development by default.
- logger: debug suppressed in production unless setDebug(true).
- logger: info/warn/error always forward.

### src/__tests__/utils/netMode.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “detectNetModeFromContent” paths across 3 tests.

- detectNetModeFromContent: returns pt for empty or non-algebraic nets.
- detectNetModeFromContent: returns algebraic-int when algebraic features present.
- detectNetModeFromContent: detects algebraic via transition guard or arc bindings.

### src/__tests__/utils/parse-facades.edgecases.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “parseArithmetic edge cases” paths across 1 tests.

- parseArithmetic edge cases: whitespace-only and invalid input handling.

### src/__tests__/utils/parse-facades.more.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “parseArithmetic simple literals” paths across 1 tests.

- parseArithmetic simple literals: parses int and string literal.

### src/__tests__/utils/parse-facades.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “Parse facade modules” paths across 3 tests.

- Parse facade modules: arithmetic facade exports match core and parse simple int.
- Parse facade modules: pattern facade exports match core and parse simple var.
- Parse facade modules: types facade exports match core and infer types.

### src/__tests__/utils/parse/arithmetic-impl.errors.more.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “parseArithmetic more errors” paths across 4 tests.

- parseArithmetic more errors: unterminated string literal.
- parseArithmetic more errors: bad list separators and terminators.
- parseArithmetic more errors: function call missing closing paren.
- parseArithmetic more errors: unexpected character.

### src/__tests__/utils/parse/arithmetic-impl.errors.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “parseArithmetic errors” paths across 2 tests.

- parseArithmetic errors: throws on uppercase variable start.
- parseArithmetic errors: throws on unexpected character.

### src/__tests__/utils/parse/arithmetic-impl.stringify.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “stringifyArithmetic” paths across 4 tests.

- stringifyArithmetic: int and string.
- stringifyArithmetic: list and pair via list of elements rendered.
- stringifyArithmetic: binop formatting with nesting.
- stringifyArithmetic: funcall formatting with args.

### src/__tests__/utils/parse/arithmetic-impl.stringify.vars.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “stringifyArithmetic vars and annotations” paths across 1 tests.

- stringifyArithmetic vars and annotations: variable without and with annotation.

### src/__tests__/utils/parse/types-impl.annotations.errors.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “types-impl annotations errors” paths across 1 tests.

- types-impl annotations errors: invalid explicit type annotation is preserved but defaults applied to others.

### src/__tests__/utils/parse/types-impl.auto.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “autoAnnotateTypes basics” paths across 1 tests.

- autoAnnotateTypes basics: adds default type for unknown lowercase vars and preserves typed vars.

### src/__tests__/utils/pnml-parser.algebraic.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “PNML (algebraic annotations)” paths across 3 tests.

- PNML (algebraic annotations): parsePNML reads algebraic tokens, guard/action, and bindings.
- PNML (algebraic annotations): generatePNML: bindings suppress inscription even with weight > 1.
- PNML (algebraic annotations): algebraic tokens: booleans T/F round-trip in PNML.

### src/__tests__/utils/pnml-parser.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “PNML Parser (real)” paths across 5 tests.

- PNML Parser (real): parsePNML parses a simple PNML (with namespaces) into JSON.
- PNML Parser (real): parsePNML returns empty arrays for invalid/empty input without throwing.
- PNML Parser (real): generatePNML produces a PNML string from a JSON Petri net and validates arcs.
- PNML Parser (real): generatePNML emits APN namespace elements when algebraic annotations present.
- PNML Parser (real): generatePNML handles mixed arc formats (source/target and sourceId/targetId).

### src/__tests__/utils/pnml.normalize.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml normalizeNet” paths across 2 tests.

- pnml normalizeNet: fills defaults and maps aliases.
- pnml normalizeNet: preserves valueTokens and derives tokens length.

### src/__tests__/utils/pnml.reader.binding-split.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader binding top-level comma split” paths across 1 tests.

- pnml reader binding top-level comma split: keeps nested list intact and splits top-level.

### src/__tests__/utils/pnml.reader.bindings.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader non-APN bindings” paths across 1 tests.

- pnml reader non-APN bindings: splits binding text by commas and preserves single binding.

### src/__tests__/utils/pnml.reader.defaults.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader defaults and naming” paths across 1 tests.

- pnml reader defaults and naming: defaults name/label and position when missing.

### src/__tests__/utils/pnml.reader.errors.coverage.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader error branches” paths across 2 tests.

- pnml reader error branches: invalid xml returns empty result and logs errors.
- pnml reader error branches: missing net/page elements returns empty result.

### src/__tests__/utils/pnml.reader.metadata.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader arc metadata and APN text nodes” paths across 2 tests.

- pnml reader arc metadata and APN text nodes: reads source/target directions from metadata; defaults when missing.
- pnml reader arc metadata and APN text nodes: reads APN namespaced text for type/guard/action.

### src/__tests__/utils/pnml.reader.missingpage.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader missing page” paths across 1 tests.

- pnml reader missing page: returns empty result when page element is missing.

### src/__tests__/utils/pnml.reader.more.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader additional branches” paths across 1 tests.

- pnml reader additional branches: parses APN namespaced fields, positions, complex tokens, heuristics and bindings.

### src/__tests__/utils/pnml.reader.string-escapes.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader parses string escape sequences in valueTokens” paths across 1 tests.

- pnml reader parses string escape sequences in valueTokens: parses \n, \t, \r, \' and \\ correctly.

### src/__tests__/utils/pnml.reader.tokens.strings-and-pair-split.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader tokens and arc defaults” paths across 2 tests.

- pnml reader tokens and arc defaults: keeps commas inside strings, parses pair, drops unknown token.
- pnml reader tokens and arc defaults: arc type falls back and invalid weight ignored.

### src/__tests__/utils/pnml.reader.tokens.various.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader parses various algebraic tokens” paths across 1 tests.

- pnml reader parses various algebraic tokens: booleans, numbers, lists, nested pairs; drops unknowns.

### src/__tests__/utils/pnml.reader.weights.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml reader weight parsing” paths across 1 tests.

- pnml reader weight parsing: parses numeric inscription to weight and ignores non-numeric.

### src/__tests__/utils/pnml.writer.action-apnns.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer adds xmlns:apn when action provided” paths across 1 tests.

- pnml writer adds xmlns:apn when action provided: xmlns:apn present with action only.

### src/__tests__/utils/pnml.writer.apnns.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer adds xmlns:apn when APN elements used” paths across 1 tests.

- pnml writer adds xmlns:apn when APN elements used: xmlns:apn present when guard provided.

### src/__tests__/utils/pnml.writer.binding-array.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer binding (array) omits inscription and joins values” paths across 1 tests.

- pnml writer binding (array) omits inscription and joins values: bindings array present, joined with comma and no inscription.

### src/__tests__/utils/pnml.writer.binding-string.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer binding (string) omits inscription and adds apn binding” paths across 1 tests.

- pnml writer binding (string) omits inscription and adds apn binding: binding string present, no inscription even if weight > 1.

### src/__tests__/utils/pnml.writer.branches.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer branches” paths across 1 tests.

- pnml writer branches: skips invalid arcs and emits valid arcs with defaults.

### src/__tests__/utils/pnml.writer.inscription.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer inscription branch” paths across 1 tests.

- pnml writer inscription branch: adds inscription when weight > 1 and no bindings.

### src/__tests__/utils/pnml.writer.markings.format.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer formats valueTokens in initialMarking” paths across 1 tests.

- pnml writer formats valueTokens in initialMarking: formats booleans, strings with quotes, lists and pairs.

### src/__tests__/utils/pnml.writer.metadata.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer arc metadata” paths across 2 tests.

- pnml writer arc metadata: writes default source/target directions when not provided.
- pnml writer arc metadata: writes custom source/target directions when provided.

### src/__tests__/utils/pnml.writer.noinscription.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer no inscription when bindings present” paths across 1 tests.

- pnml writer no inscription when bindings present: omits inscription if bindings exist even when weight > 1.

### src/__tests__/utils/pnml.writer.omissions.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer omissions for empty/none” paths across 1 tests.

- pnml writer omissions for empty/none: omits binding when bindings array empty.

### src/__tests__/utils/pnml.writer.place-type-apnns.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “pnml writer adds apn:type for place types” paths across 1 tests.

- pnml writer adds apn:type for place types: xmlns:apn and apn:type present when place has type.

### src/__tests__/utils/python.index.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “python/index PNML wrappers”, “python/index ADT helpers” paths across 7 tests.

- python/index PNML wrappers: exportToPNML delegates to generatePNML.
- python/index PNML wrappers: exportToPNML rethrows generator errors.
- python/index PNML wrappers: importFromPNML resolves parsed structure.
- python/index PNML wrappers: importFromPNML surfaces parser errors.
- python/index ADT helpers: importADT delegates to parseADT.
- python/index ADT helpers: validateADTSpec passes through to validateADT.
- python/index ADT helpers: exportADT calls generateADT.

### src/__tests__/utils/string-adt.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “String ADT Support”, “String Literal Parsing”, “String Function Parsing”, “String Stringify”, “String Variables” paths across 16 tests.

- String ADT Support › String Literal Parsing: parses simple string literal.
- String ADT Support › String Literal Parsing: parses string literal with spaces.
- String ADT Support › String Literal Parsing: parses empty string.
- String ADT Support › String Literal Parsing: handles escaped single quotes.
- String ADT Support › String Literal Parsing: handles escape sequences.
- String ADT Support › String Function Parsing: parses concat function with two string literals.
- String ADT Support › String Function Parsing: parses concat function with variables.
- String ADT Support › String Function Parsing: parses substring function.
- String ADT Support › String Function Parsing: parses length function.
- String ADT Support › String Function Parsing: parses nested concat calls.
- String ADT Support › String Stringify: stringify string literal.
- String ADT Support › String Stringify: stringify string with escaped quote.
- String ADT Support › String Stringify: stringify concat function.
- String ADT Support › String Stringify: stringify substring function.
- String ADT Support › String Variables: parses string variable with type annotation.
- String ADT Support › String Variables: parses concat with mixed literals and variables.

### src/__tests__/utils/token-format.empty.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “token-format empty/misc” paths across 2 tests.

- token-format empty/misc: formatTokensList empty yields empty string.
- token-format empty/misc: formatToken('') prints quoted empty string.

### src/__tests__/utils/token-format.more.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “token-format more cases” paths across 2 tests.

- token-format more cases: nested pair formatting.
- token-format more cases: list of mixed tokens.

### src/__tests__/utils/token-format.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “token-format” paths across 9 tests.

- token-format: formats booleans as T/F.
- token-format: formats strings with single quotes.
- token-format: formats numbers via String.
- token-format: formats pairs using (__pair__, fst, snd).
- token-format: formats pairs using fst/snd without __pair__.
- token-format: formats nested pairs and lists.
- token-format: formats lists recursively.
- token-format: formatTokensList joins by comma and space.
- token-format: formatTokensList returns empty string for empty/invalid.

### src/__tests__/utils/token-utils.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “token-utils” paths across 3 tests.

- token-utils: getTokensForPlace returns algebraic tokens when present.
- token-utils: getTokensForPlace falls back to numeric tokens.
- token-utils: isPair detects encoded pairs.

### src/__tests__/utils/types-impl.infer.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “types-impl inferVariableTypes” paths across 2 tests.

- types-impl inferVariableTypes: arc: falls back to source place token type for bindings.
- types-impl inferVariableTypes: transition: collects typed vars from guard and can annotate.

### src/__tests__/utils/types-impl.more.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “types-impl light coverage” paths across 3 tests.

- types-impl light coverage: capitalizeTypeNames upgrades primitive suffixes.
- types-impl light coverage: inferTokenType returns correct types.
- types-impl light coverage: autoAnnotateTypes annotates untyped vars.

### src/__tests__/utils/z3-arith.test.js
- Group: Misc — Miscellaneous tests.
- Scope: validates “z3-arith convenience exports” paths across 4 tests.

- z3-arith convenience exports: evaluateAction returns empty object for falsy or malformed input.
- z3-arith convenience exports: evaluateAction parses assignments and evaluates expressions.
- z3-arith convenience exports: evaluateAction skips segments without assignment target.
- z3-arith convenience exports: evaluatePredicate proxies to evaluateBooleanPredicate.

### src/__tests__/utils/z3/builders.errors.more.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “z3 builders errors (unknowns)” paths across 2 tests.

- z3 builders errors (unknowns): unknown function throws.
- z3 builders errors (unknowns): unknown operator throws.

### src/__tests__/utils/z3/builders.errors.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “z3 builders error branches” paths across 2 tests.

- z3 builders error branches: unknown function throws.
- z3 builders error branches: unknown operator throws.

### src/__tests__/utils/z3/builders.fallbacks.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “z3 builders fallbacks” paths across 2 tests.

- z3 builders fallbacks: collectVariables traverses funcall args and binop.
- z3 builders fallbacks: pair encodes as concatenated string via builders.

### src/__tests__/utils/z3/builders.strings.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “builders string support” paths across 1 tests.

- builders string support: String.val and length via builder.

### src/__tests__/utils/z3/eval-arith.errors.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-arith error branches” paths across 9 tests.

- eval-arith error branches: concat type errors.
- eval-arith error branches: substring type/arity errors.
- eval-arith error branches: length invalid type.
- eval-arith error branches: head/tail errors.
- eval-arith error branches: append/sublist errors.
- eval-arith error branches: isSublistOf type errors.
- eval-arith error branches: fst/snd require pair.
- eval-arith error branches: division by zero.
- eval-arith error branches: unknown function throws.

### src/__tests__/utils/z3/eval-arith.lists.coverage.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “evaluateArithmeticWithBindings list ops (ground terms)” paths across 3 tests.

- evaluateArithmeticWithBindings list ops (ground terms): head/tail on list.
- evaluateArithmeticWithBindings list ops (ground terms): append (element) and sublist.
- evaluateArithmeticWithBindings list ops (ground terms): isSublistOf true/false.

### src/__tests__/utils/z3/eval-arith.ops.coverage.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-arith operators and ADT functions coverage” paths across 7 tests.

- eval-arith operators and ADT functions coverage: numeric binops + - * / precedence.
- eval-arith operators and ADT functions coverage: list concat and length.
- eval-arith operators and ADT functions coverage: head and tail success including empty tail.
- eval-arith operators and ADT functions coverage: append and sublist.
- eval-arith operators and ADT functions coverage: isSublistOf true and false.
- eval-arith operators and ADT functions coverage: fst and snd on pair.
- eval-arith operators and ADT functions coverage: isSubstringOf returns boolean.

### src/__tests__/utils/z3/eval-arith.solver.coverage.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “evaluateArithmetic solver integrations” paths across 3 tests.

- evaluateArithmetic solver integrations: solves simple integer expressions.
- evaluateArithmetic solver integrations: throws on division by zero.
- evaluateArithmetic solver integrations: rejects unknown operators.

### src/__tests__/utils/z3/eval-arith.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-arith JS reductions” paths across 7 tests.

- eval-arith JS reductions: pair literal and list length.
- eval-arith JS reductions: string concat and substring.
- eval-arith JS reductions: list concat merges arrays.
- eval-arith JS reductions: isSubstringOf returns expected booleans.
- eval-arith JS reductions: fst and snd extract pair components.
- eval-arith JS reductions: tail returns empty list for empty inputs.
- eval-arith JS reductions: variable resolution pulls from provided bindings.

### src/__tests__/utils/z3/eval-bool.eq-pairs-strings.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-bool equality over pairs and strings” paths across 2 tests.

- eval-bool equality over pairs and strings: ('ab' == concat('a','b')) and ((1,2) == (1,2)).
- eval-bool equality over pairs and strings: ('ab' != 'ac') and ((1,2) != (2,1)).

### src/__tests__/utils/z3/eval-bool.funcall.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-bool function calls” paths across 1 tests.

- eval-bool function calls: isSubstringOf("lo", "hello") is true.

### src/__tests__/utils/z3/eval-bool.invalid-compare.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-bool mixed-type compare behaviour” paths across 1 tests.

- eval-bool mixed-type compare behaviour: comparing list with int yields false (no throw).

### src/__tests__/utils/z3/eval-bool.invalids.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-bool invalid inputs” paths across 2 tests.

- eval-bool invalid inputs: unexpected end throws.
- eval-bool invalid inputs: unknown token after parse throws.

### src/__tests__/utils/z3/eval-bool.mixed-adt.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “boolean with mixed ADT terms” paths across 2 tests.

- boolean with mixed ADT terms: length(concat([], tail(['x','a']))) == 1 and fst((1,2)) < 3.
- boolean with mixed ADT terms: isSubstringOf('lo', concat('hel','lo')) and snd((2,3)) == 3.

### src/__tests__/utils/z3/eval-bool.moreops.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-bool more operators” paths across 3 tests.

- eval-bool more operators: xor and implies.
- eval-bool more operators: iff equivalence true.
- eval-bool more operators: mixed words/symbols precedence.

### src/__tests__/utils/z3/eval-bool.precedence.matrix.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-bool precedence matrix” paths across 5 tests.

- eval-bool precedence matrix: not binds tighter than and/or/xor.
- eval-bool precedence matrix: and over or with parentheses.
- eval-bool precedence matrix: xor, implies, iff combinations.
- eval-bool precedence matrix: mixed operators precedence sanity.
- eval-bool precedence matrix: invalid sequences throw.

### src/__tests__/utils/z3/eval-bool.symbols.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-bool symbol operators and invalid inputs” paths across 3 tests.

- eval-bool symbol operators and invalid inputs: ! && || precedence and grouping (with parens).
- eval-bool symbol operators and invalid inputs: mixed words and symbols with precedence (with parens).
- eval-bool symbol operators and invalid inputs: invalid inputs throw.

### src/__tests__/utils/z3/eval-bool.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “eval-bool parser and evaluator” paths across 3 tests.

- eval-bool parser and evaluator: word operators and precedence.
- eval-bool parser and evaluator: word operators variant.
- eval-bool parser and evaluator: negation and xor/implies/iff parsing.

### src/__tests__/utils/z3/eval-term.strings.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “evaluateTermWithBindings string variable support” paths across 3 tests.

- evaluateTermWithBindings string variable support: length(s) with string binding.
- evaluateTermWithBindings string variable support: length(concat(s, 'x')) with string binding.
- evaluateTermWithBindings string variable support: length(substring(s, 1, 2)) with string binding.

### src/__tests__/utils/z3/eval-term.with-bindings.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “evaluateTermWithBindings (Z3-backed)” paths across 3 tests.

- evaluateTermWithBindings (Z3-backed): simple numeric term under bindings.
- evaluateTermWithBindings (Z3-backed): complex numeric expression under bindings.
- evaluateTermWithBindings (Z3-backed): length over string literal via Z3 string theory.

### src/__tests__/utils/z3/solve-equation.test.js
- Group: Z3 evaluation — Symbolic arithmetic/boolean evaluation and builders.
- Scope: validates “Z3 solveEquation and solveInequality” paths across 2 tests.

- Z3 solveEquation and solveInequality: solveEquation x + 2 = 5.
- Z3 solveEquation and solveInequality: solveInequality x < 3.

### src/__tests__/workers/worker-factory.test.js
- Group: Workers — Web worker factory and fallbacks.
- Scope: validates “createSimulationWorker” paths across 5 tests.

- createSimulationWorker: returns null when window is undefined.
- createSimulationWorker: returns null when Worker API missing.
- createSimulationWorker: returns null during test environments.
- createSimulationWorker: uses primary worker factory when environment allows.
- createSimulationWorker: falls back to absolute worker path when primary creation fails.
