## Petri Net Editor – User Guide

This guide explains how to install, run, and use the Petri Net Editor to create Petri nets (PNs), configure settings, undo/redo edits, save/load PNML files, and run simulations.

### Install and Run

1) Prerequisites
- Node.js 18+ and npm
- Windows PowerShell (commands below are written for Windows)

2) Install dependencies
```bash
cd petri-net-app
npm install
```

3) Start the dev server
```bash
npm run dev
```
The app will open at `http://localhost:5173`. If a port is busy, Vite may auto-pick another port and show it in the terminal.

4) Run tests (optional)
- Unit tests: `npm test`
- E2E tests: `npm run test:e2e`

### Creating Petri Nets in the Editor

1) Canvas and toolbar
- The canvas is the central white area. The toolbar at the top provides tools: Select, Place, Transition, Arc, Auto, and Save/Load/Clear.

2) Add places
- Click the Place tool (label “Place”).
- Click on the canvas to add a place at that location.
- If “Snap to Grid” is enabled, a snap indicator shows the intended position.

3) Add transitions
- Click the Transition tool (label “Transition”).
- Click on the canvas where you want the transition.

4) Connect with arcs
- Click the Arc tool (label “Arc”).
- Click a source element (place or transition), then click a target element (transition or place) to create an arc.
- To cancel the arc while drawing, press Escape.

5) Select and edit
- Click the Select tool (label “Select”).
- Select any element and adjust properties in the right-hand Properties panel (e.g., tokens on a place, arc weight when an arc is selected).

Note on pictures: In the editor, the tools are visually distinct buttons. Add places (circles), transitions (rectangles), and connect them with arrows. The Properties panel appears on the right to adjust tokens and weights. (You can take screenshots of the toolbar, canvas with elements, and the Properties panel to include in internal documentation.)

### Settings Menu – Parameters

Open Settings via the “Settings” button in the top-right toolbar. The dialog supports:

- Max tokens (also caps arc weights)
  - Upper bound for tokens on a place and a cap applied to arc weights when firing transitions.

- Max iterations / Unlimited
  - Controls the maximum steps for long runs (e.g., “Run” to completion). Check “Unlimited” for no cap.

- Simulation mode
  - Single Transition: each step, one enabled transition is chosen at random and fired.
  - Maximal Concurrent: at each step, the largest non-conflicting set of enabled transitions is fired simultaneously.

Click Save to apply settings.

### Undo / Redo

- Use the Undo and Redo buttons in the History section of the toolbar.
- Keyboard shortcuts: Ctrl+Z (Undo), Ctrl+Y (Redo).
- Undo/Redo covers element creation/deletion, moves, property changes (tokens, arc weights), and connections.

### Save / Load PNs

- Save: Click “Save” in the File group to download the PN as a PNML file.
- Load: Click “Load” and choose a `.pnml` (or `.xml`) file. The net is parsed and shown on the canvas.
- Success messages auto-dismiss after a few seconds.

Tips:
- The app writes labels into PNML and restores them when loading.
- Only valid arcs (with existing source/target) are exported. Invalid arcs are skipped.

### Running Simulations

The Simulation panel is on the right (bottom section):

- Step
  - Execute one simulation step (fires one transition in Single mode or a maximal set in Maximal mode).
  - Disabled until the simulator is ready and there is at least one enabled transition.

- Simulate
  - Start continuous stepping with animation. Click Stop to halt.

- Run
  - Run to completion (until no transitions remain enabled) respecting settings (mode, iteration limits).

- Stop
  - Halts continuous simulate or run.

Visual cues (suggested pictures):
- A screenshot of the Simulation panel showing Step / Simulate / Run / Stop buttons.
- A net with tokens on places, and enabled transitions highlighted in the canvas.

### Troubleshooting

- Nothing happens on click
  - Make sure the correct tool is selected (Place/Transition/Arc/Select).
  - Ensure the canvas has focus and is visible.

- Simulation buttons disabled
  - The simulator becomes ready when a valid net with arcs exists and at least one transition can enable.
  - Check tokens and arc weights; transitions need sufficient tokens at input places.

- Load errors
  - Only PNML/XML files are supported. Ensure the file is valid PNML.


