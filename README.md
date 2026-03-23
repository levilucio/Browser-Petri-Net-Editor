# Browser Petri Net Editor

A browser-based visual editor and simulator for **Place/Transition Petri nets** and **Algebraic Petri Nets**, built with **React**, **react-konva**, and browser-side symbolic tooling.

The project supports:
- interactive construction and editing of Petri nets in the browser
- execution and simulation of classical P/T nets
- **algebraic net** modeling with structured tokens, bindings, guards, and actions
- **PNML import/export**
- browser-side symbolic evaluation using **Z3/WebAssembly workers**

Unlike a simple diagramming tool, this editor aims to combine **formal modeling**, **interactive visualization**, and **executable semantics** in a single browser-native environment.

## Highlights

- **Visual editor** for places, transitions, arcs, labels, and markings
- **Simulation engine** for P/T nets and Algebraic Petri Nets
- **Single-step** and **maximal concurrent** execution modes
- **Undo/redo**, selection tools, grid snapping, zooming, and touch-friendly controls
- **PNML persistence** for saving and loading models
- **Z3-backed algebraic reasoning** in the browser for guard evaluation and symbolic terms
- **Unit and E2E test coverage** with Jest and Playwright

## Why this project is interesting

Petri nets are a compact formalism for representing concurrency, synchronization, and state transitions.
This project explores what it looks like to bring that formalism into a modern browser UI while preserving executable behavior.

The result is not just a canvas editor, but a modeling environment that sits at the intersection of:

- formal methods
- simulation systems
- interactive visual tooling
- browser-based symbolic computation

## Repository layout

This repository contains the application in `petri-net-app/`:

```text
Browser-Petri-Net-Editor/
├── petri-net-app/     # Vite + React application
├── docs/              # user and developer documentation
└── README.md
```

## Quick start

### Prerequisites

- Node.js
- npm

### Install

```powershell
Set-Location -Path .\petri-net-app
npm install
```

### Run locally

```powershell
Set-Location -Path .\petri-net-app
npm run dev
```

Open `http://localhost:3000`.

## Documentation

- User guide: `docs/user-guide.md`
- Developer guide: `docs/developer-guide.md`

## Architecture overview

The application is split into several main concerns:

- **Editor/UI layer**: React components, canvas rendering, toolbars, panels, touch/desktop interaction
- **Document state**: places, transitions, arcs, labels, markings, history, and selection
- **Simulation layer**: common simulation core with mode-specific simulators
- **Algebraic tooling**: structured-token support, guards/actions, and browser-side Z3 integration
- **Persistence layer**: PNML import/export and local file workflows

## Project goals

This project was built to explore whether a modern browser application can support not only visual Petri net editing, but also meaningful execution semantics and symbolic reasoning.

Key goals:
- make Petri net modeling interactive and accessible
- support both classical and algebraic net variants
- preserve formal structure while providing a usable UI
- push simulation and symbolic analysis directly into the browser

## License

MIT
