## Petri Net Editor – Developer Guide

This guide helps developers understand the structure, key patterns, and testing strategy of the Petri Net Editor found under `petri-net-app/`. It also explains how simulation, history/undo, and PNML persistence are implemented.

### High-level Architecture

- **Front end**: A React application (Vite) renders the editor, canvas, panels, and simulation UI. The canvas is built with Konva (`react-konva`). Most logic lives in feature modules under `src/features/` and shared context under `src/contexts/`.
- **Backend**: There is no traditional server-side backend for the core app. The app runs entirely in the browser. For development, Vite serves the app and static assets. A small `server.cjs` exists to support certain local flows, but persistence and simulation happen client-side.
- **Simulation engine**: Pure JavaScript simulators with a shared core and event bus:
  - `PTSimulator` for classic P/T nets (integer tokens)
  - `AlgebraicSimulator` for algebraic nets (guards/terms solved with Z3)
  - Both implement a common `BaseSimulator` interface and are created via `SimulatorFactory`.
  - The legacy Pyodide-based simulator has been removed.

### Core React Patterns Used

- **Context for global editor state**: `src/contexts/PetriNetContext.jsx` exposes all editor state through a provider (`PetriNetProvider`). Components read/write state via `usePetriNet()`.
- **Custom hooks per domain**:
  - `src/features/elements/useElementManager.js` – create/select/move/delete places and transitions; handles grid snapping.
  - `src/features/arcs/useArcManager.js` – drive arc creation and completion.
  - `src/features/simulation/useSimulationManager.js` – orchestrate stepping, running, enabled transitions, and mode.
- **Container/manager components**:
  - `src/features/canvas/CanvasManager.jsx` – owns the Konva stage and routes clicks/mouse-move to element/arc managers. It renders the background grid, indicator overlays, and element layers.
  - `src/features/elements/ElementManager.jsx` and `src/features/arcs/ArcManager.jsx` – render shapes and bind events to handlers from the managers.
- **Composition-based UI**:
  - `src/App.jsx` composes: `Toolbar`, `PropertiesPanel`, `PetriNetPanel`, `SimulationManager`, and `CanvasManager` under the `PetriNetProvider`.
- **State exposure for e2e**: For Playwright tests, the app exposes limited globals (e.g., `window.__PETRI_NET_STATE__`, `window.__PETRI_NET_SIM_CORE__`, and the current `__PETRI_NET_MODE__`) from `src/App.jsx`.

### Canvas and Interaction Model

- The canvas (`react-konva`) uses a single `Stage` with layered rendering:
  - Background `Rect` (name: `background`) handles create-on-click in the current mode (`place` or `transition`).
  - A Grid overlay component (`src/components/Grid.jsx`) – not interactive (listening disabled).
  - Interactive layers managed by `ElementManager` and `ArcManager` to render places, transitions, and arcs.
- Pointer-to-virtual coordinate transforms enable zooming and panning without breaking creation coordinates.
- Grid snapping is optional, controlled by the toolbar toggle (`data-testid="grid-snap-toggle"`). A `SnapIndicator` shows the snap target.

### Simulation Implementation (New Architecture)

- Entry points:
  - `src/features/simulation/index.js` – re-exports the core, hook, simulators, factory, event bus, and utilities.
  - `src/features/simulation/simulator-core.js` – factory-based core that selects the simulator per net mode, exposes a unified API (`initialize`, `update`, `getEnabledTransitions`, `fireTransition`, `stepSimulation`, `activate/deactivate`, `setSimulationMode`).
  - `src/features/simulation/useSimulationManager.js` – React hook orchestrating simulation state; subscribes to events and updates enabled transitions, runs, steps, and error states.
  - `src/features/simulation/SimulationEventBus.js` – lightweight event bus used by simulators to emit `transitionsChanged` and `transitionFired`.
  - `src/features/simulation/SimulatorFactory.js` – returns `PTSimulator` or `AlgebraicSimulator` based on net mode.
  - `src/features/simulation/BaseSimulator.js` – shared interface and lifecycle for all simulators.
  - `src/features/simulation/conflict-resolver.js` – computes non-conflicting sets for maximal mode; used by the manager in both PT and APN flows.
  - `src/features/simulation/simulation-utils.js` – shared helpers and stats.
- Modes:
  - `single`: randomly selects one enabled transition to fire on step.
  - `maximal`: computes a maximal non-conflicting set of enabled transitions and fires them concurrently.
- Testing hooks:
  - `window.__PETRI_NET_SIM_CORE__` – bound to the active core instance for E2E control when needed.
  - `window.__PETRI_NET_STATE__` – current places/transitions/arcs for assertions (exposed in `App.jsx`).
  - `window.__ENABLED_TRANSITIONS__` – latest enabled transition ids (set by the manager upon `transitionsChanged`).
  - `window.__LAST_FIRED_TRANSITION_ID__` – last fired transition id (set by the manager upon `transitionFired`).

### History and Undo/Redo

- Implemented in `src/features/history/historyManager.js` and wired through the context in `src/contexts/PetriNetContext.jsx`.
- Pattern: immutable snapshots with two stacks: `undoStack` and `redoStack`.
  - On each mutating operation, the new state is pushed via `updateHistory(newState)`.
  - Undo pops from `undoStack` to current state, pushing the prior current state to `redoStack`.
  - Redo pops from `redoStack` back to current state.
- UI wiring:
  - `Toolbar` uses `canUndo`, `canRedo`, `onUndo`, and `onRedo` from context.
  - Keyboard shortcuts handled in `App.jsx` (`Ctrl+Z`/`Ctrl+Y` or `Delete` when an item is selected).

### Persistence (PNML Import/Export)

- PNML is the interchange format for saving and loading Petri nets.
- Two code paths exist (the UI currently uses the Python glue for I/O):
  - JS helpers: `src/utils/pnml-parser.js` – parse/generate PNML and persist additional metadata.
  - Python glue: `src/utils/python/*` exposed through `src/utils/python/index.js` – used by `Toolbar.jsx` for file I/O.
- Net mode persistence:
  - The PNML written by the app includes the Petri Net mode as an attribute on `<net>` (e.g., `netMode="pt"` or `netMode="algebraic"`).
  - On load, the stored `netMode` is used to choose the simulator; inference from content is a fallback only if no mode is present.
  - `Toolbar.jsx` ensures the current mode is added when saving and resets the editor/simulator before loading.
- Labels and names:
  - When generating PNML, place/transition labels are prioritized for the `<name><text>` element; when parsing PNML, labels are populated back into the element’s `label` property.
- No server/database persistence is used; everything is browser-side import/export.

### Testing Strategy

- **End-to-end (E2E): Playwright** – `petri-net-app/tests/`
  - `editor.spec.js`: Editor interactions – creating places/transitions/arcs, setting weights, deleting elements, and basic canvas behaviors.
  - `simulation.spec.js`: Simulation flows – load PNMLs (`petri-net2.pnml`, `petri-net3.pnml`), verify non-determinism, run-to-completion, and maximal mode behavior.
  - `large-scale.spec.js`: Scaled creation tests (optimized to exclude arc creation for speed).
  - Helpers: The app exposes `window.__PETRI_NET_STATE__`, `__PETRI_NET_SIM_CORE__`, and related globals to reduce flakiness and avoid UI races.

- **Unit tests: Jest** – `src/__tests__/`
  - Component/UI smoke tests under `src/__tests__/components/`.
  - Utilities, parsers, and simulation helpers under `src/__tests__/utils/` and `src/__tests__/features/` (e.g., `pnml-parser.test.js`, `simulator.test.js`).
  - History manager tests under `src/__tests__/features/history/`.

- **Algebraic solver (Z3) notes**:
  - Z3 runs as a WebAssembly worker and requires cross-origin isolation (`COOP/COEP`). Vite dev server sets the required headers in `vite.config.js` and serves Z3 static assets.
  - Direct unit tests for Z3 are limited in Node/JSDOM; APN behavior is exercised via E2E tests.

### Development Notes

- Start dev server:
  - Windows PowerShell: `Set-Location -Path .\petri-net-app; npm run dev`
- Run E2E tests:
  - `npm run test:e2e` (Playwright)
  - Targeted: `npm run test:e2e -- tests/simulation.spec.js` or with `-g "pattern"`
- Run unit tests (Jest):
  - `npm test`

### Key Files Overview

- App composition and state exposure: `src/App.jsx`
- Toolbar + PNML import/export UI: `src/components/Toolbar.jsx`
- Canvas and interactions: `src/features/canvas/CanvasManager.jsx`
- Element management: `src/features/elements/useElementManager.js`, `src/features/elements/ElementManager.jsx`
- Arc management: `src/features/arcs/useArcManager.js`, `src/features/arcs/ArcManager.jsx`
- Simulation core and engines: `src/features/simulation/*`
  - `simulator-core.js`, `useSimulationManager.js`, `SimulationEventBus.js`, `SimulatorFactory.js`, `BaseSimulator.js`, `pt-simulator.js`, `algebraic-simulator.js`, `conflict-resolver.js`, `simulation-utils.js`
- History: `src/features/history/historyManager.js`
- PNML:
  - JS: `src/utils/pnml-parser.js`
  - Python glue: `src/utils/python/*`, used by `src/utils/python/index.js`
- Tests: `tests/*.spec.js`, `src/__tests__/**`, and `src/utils/python/test_parser.py`

### Conventions & Tips

- Prefer extending existing patterns (context + hooks + manager components) instead of introducing new ones.
- Keep canvas interactions inside managers; wire handlers through context or props.
- Use `updateHistory` for every mutating operation to keep undo/redo consistent.
- For E2E tests, prefer waiting on app state (`window.__PETRI_NET_STATE__`) and using `__PETRI_NET_SIM_CORE__` to avoid UI races.


