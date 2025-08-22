# Petri Net Editor and Simulator

A visual editor and simulator for Petri nets built with React, React-Konva, and a Pyodide-backed simulator. The app runs entirely in the browser and supports PNML import/export.

## Project Overview

This application allows users to:
- Create and edit Petri nets visually
- Add places, transitions, and arcs
- Set token counts and firing rules
- Simulate Petri net execution

## Project Structure

```
petri-net-editor/
├── petri-net-app/           # Main application directory
│   ├── public/              # Static assets
│   ├── src/                 # Source code
│   │   ├── components/      # React components
│   │   │   ├── Arc.jsx      # Arc component
│   │   │   ├── EnabledTransitionsPanel.jsx # Enabled transitions panel (if present)
│   │   │   ├── Place.jsx    # Place component
│   │   │   ├── PropertiesPanel.jsx # Properties panel
│   │   │   ├── Toolbar.jsx  # Toolbar component
│   │   │   └── Transition.jsx # Transition component
│   │   ├── App.jsx          # Main application component
│   │   ├── index.css        # Global styles
│   │   └── main.jsx         # Entry point
│   ├── index.html           # HTML entry point
│   ├── package.json         # Dependencies and scripts
│   └── vite.config.js       # Vite configuration
└── docs/                    # Documentation
    ├── developer-guide.md   # Developer guide
    └── user-guide.md        # User guide
```

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (comes with Node.js)

### Installation

1. Clone the repository
2. Open a terminal and navigate to the project directory
3. Navigate to the application directory:
   ```
   cd petri-net-app
   ```
4. Install dependencies:
   ```
   npm install
   ```
5. Start the development server:
   ```
   npm run dev
   ```
6. Open your browser and navigate to http://localhost:3000

### Alternative Setup (Without npm)

If you're having issues with npm, you can run the application using a simple HTTP server:

1. Navigate to the project directory
2. Start a simple HTTP server in the `petri-net-app/public` directory
3. Open the `index.html` file in your browser

## Usage

1. Use the toolbar to select the editing mode (Select, Place, Transition, Arc)
2. Click on the canvas to add places and transitions
3. Use arc mode to connect places to transitions or transitions to places
4. Select elements to edit their properties in the properties panel
5. Use the simulation panel to step, simulate, or run the Petri net

## Documentation

- User Guide: [docs/user-guide.md](docs/user-guide.md)
- Developer Guide: [docs/developer-guide.md](docs/developer-guide.md)

## License

MIT
