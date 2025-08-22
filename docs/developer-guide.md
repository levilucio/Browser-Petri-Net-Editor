## Petri Net Editor – Developer Guide

This guide helps developers understand the structure, key patterns, and testing strategy of the Petri Net Editor found under `petri-net-app/`. It also explains how simulation, history/undo, and PNML persistence are implemented.

### High-level Architecture

- **Front end**: A React application (Vite) renders the editor, canvas, panels, and simulation UI. The canvas is built with Konva (`react-konva`). Most logic lives in feature modules under `src/features/` and shared context under `src/contexts/`.
- **Backend**: There is no traditional server-side backend for the core app. The app runs entirely in the browser. For development, Vite serves the app and static assets. A small `server.cjs` exists to support certain local flows, but persistence and simulation happen client-side.
- **Simulation engine**: A Python-based simulator running in Pyodide (`src/features/simulation/pyodide-simulator.js`) that loads Python sources from `src/utils/python/*.py` for parity with Python reference logic.

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

### Simulation Implementation

- Entry points:
  - `src/features/simulation/index.js` – exports the simulator core factory.
  - `src/features/simulation/simulator-core.js` – unified API consumed by UI (`step`, `run`, `stop`, `setSimulationMode`, etc.).
  - `src/features/simulation/conflict-resolver.js` – logic for non-deterministic vs maximal firing sets.
  - `src/features/simulation/pyodide-simulator.js` – Python-backed engine via Pyodide loading `src/utils/python/petri_net_simulator.py`.
- Modes:
  - `single`: randomly selects one enabled transition to fire on step.
  - `maximal`: computes a maximal non-conflicting set of enabled transitions and fires them concurrently.
- Testing hooks:
  - `window.__PETRI_NET_SIM_CORE__` – allows tests to force mode and control stepping without UI races.
  - `window.__LAST_FIRED_TRANSITION_ID__` and `window.__FIRED_TRANSITIONS__` – the core exposes the last fired transition and the history to verify non-determinism.

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
- Two code paths exist:
  - JS helpers: `src/utils/pnml-parser.js` (also unit-tested) for parse/generate.
  - Python implementation via Pyodide: `src/utils/python/*` exposed through `src/utils/python/index.js`.
- The UI currently uses the Python path in `Toolbar.jsx`:
  - `import { exportToPNML, importFromPNML } from '../utils/python/index';`
  - File I/O uses an `<input type="file">` for loading and creates a downloadable blob for saving.
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

- **Python tests (Pyodide-backed logic)** – `src/utils/python/test_parser.py` verifies the Python PNML logic used in the Pyodide simulator path.

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
- History: `src/features/history/historyManager.js`
- PNML:
  - JS: `src/utils/pnml-parser.js`
  - Python: `src/utils/python/*`, glue in `src/features/simulation/pyodide-simulator.js` and `src/utils/python/index.js`
- Tests: `tests/*.spec.js`, `src/__tests__/**`, and `src/utils/python/test_parser.py`

### Conventions & Tips

- Prefer extending existing patterns (context + hooks + manager components) instead of introducing new ones.
- Keep canvas interactions inside managers; wire handlers through context or props.
- Use `updateHistory` for every mutating operation to keep undo/redo consistent.
- For E2E tests, prefer waiting on app state (`window.__PETRI_NET_STATE__`) and using `__PETRI_NET_SIM_CORE__` to avoid UI races.


