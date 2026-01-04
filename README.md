# Petri Net Editor and Simulator

A visual editor and simulator for Petri nets built with **React** + **react-konva**. The app runs entirely in the browser and supports PNML import/export.

## Project Structure (current)

This repository is a monorepo-style folder with the actual webapp in `petri-net-app/`:

```
Browser-Petri-Net-Editor/
├── petri-net-app/              # Vite + React app
│   ├── public/                 # Static assets (PNML examples, Z3 wasm/js, etc.)
│   ├── src/                    # App source (components/, features/, contexts/, utils/, workers/)
│   ├── tests/                  # Playwright E2E tests
│   ├── tools/                  # Build utilities (node/ + python/)
│   ├── index.html
│   ├── server.cjs
│   ├── vite.config.js
│   ├── jest.config.cjs
│   └── package.json
├── docs/
│   ├── developer-guide.md
│   └── user-guide.md
└── README.md
```

## Development Setup

### Prerequisites

- **Node.js** (installed) + **npm**

### Install

```powershell
Set-Location -Path .\petri-net-app
npm install
```

### Run (dev server)

```powershell
Set-Location -Path .\petri-net-app
npm run dev
```

Open `http://localhost:3000`.

## Documentation

- User Guide: `docs/user-guide.md`
- Developer Guide: `docs/developer-guide.md`

## License

MIT
