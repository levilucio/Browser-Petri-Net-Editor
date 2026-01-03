## Petri Net Editor – User Guide

### About This Guide
This guide walks new and experienced users through the Petri Net Editor. You will:
- Understand the core theory behind Place/Transition (P/T) Petri nets and Algebraic Petri Nets (APNs).
- Learn every editor feature required to build, simulate, and export nets.
- Follow step-by-step examples to reproduce complete modeling workflows.

The guide assumes no prior knowledge of Petri nets. Readers familiar with the formalism may skip directly to the interface sections.

### Intended Audience
- **Modelers** who want to construct executable Petri nets for analysis or teaching.
- **Researchers** evaluating algebraic extensions with constraint solving.
- **Students** following a structured introduction to Petri nets.

### System Requirements
- Modern Chromium-based browser recommended (Chrome, Edge). Firefox and Safari are supported.
- Deployed application URL or local build produced with `npm run build`.
- For local usage: Node.js 18+, npm, 8 GB RAM (batch APN simulation benefits from ≥16 GB for large nets).

### Quick Start (Local Deployment)
1. Open a terminal and run:
   ```powershell
   Set-Location -Path .\petri-net-app
   npm install
   npm run dev
   ```
2. Navigate to `http://localhost:3000/` (or the URL printed by Vite).
3. To build a production bundle:
   ```powershell
   npm run build
   npm run preview
   ```

For packaged distribution, provide the compiled `dist` folder. End users only need to open `index.html` via a static web server.

---

## Part I – Place/Transition Petri Nets

### 1. Theory Primer
Petri nets describe concurrent systems via a bipartite graph of **places** and **transitions** connected by **arcs**.

- **Places** (drawn as circles) represent conditions or resources. Each holds a non-negative number of **tokens**.
- **Transitions** (drawn as rectangles) represent events that consume and produce tokens.
- **Arcs** connect places to transitions or transitions to places. Each arc has a **weight** (default 1).
- A **marking** is the assignment of tokens to all places. It captures the current system state.
- A transition is **enabled** when every input place contains at least as many tokens as the weight of the connecting arc.
- An enabled transition may **fire**, consuming input tokens and producing output tokens. The resulting marking is the next state.

Example mental model: A printer queue with places for `Jobs Waiting` and `Printer Ready`, and transitions for `Start Printing` and `Finish Printing`.

#### Terminology Cheatsheet
- **Input arc**: place → transition.
- **Output arc**: transition → place.
- **Enabled set**: all transitions that can fire in the current marking.
- **Concurrency**: independent transitions that can fire without interfering with each other.

### 2. Interface Overview (P/T Mode)
The editor has three main areas:

1. **Top toolbar**
   - **File**: Save, Save As, Load, Examples, Clear
   - **Editing**: Snap-to-grid and tool selection (Select / Place / Transition / Arc)
   - **ADT Manager**: open the Algebraic Data Type dialog (mainly used for Algebraic nets)
   - **History**: Undo / Redo
   - **Settings**: open Simulation Settings (simulation mode, net type, limits, etc.)

2. **Canvas (center)**: draw and edit net elements.
3. **Right sidebar**
   - **Properties** (top): edit the selected place/transition/arc.
   - **Petri Net** (middle): inspect the current marking and the enabled transition list.
   - **Simulation** (bottom on desktop): Step / Simulate / Run / Stop.

On touch devices, the toolbar collapses into a **Menu** button and the editor provides floating on-canvas controls for editing and simulation.

### 3. Building Your First P/T Net

#### 3.1 Create Places
1. Activate the **Place** tool.
2. Click on the canvas to add a place; names default to `P1`, `P2`, etc.
3. With **Snap to Grid** enabled, positioning aligns to 20×20 px increments.

#### 3.2 Add Transitions
1. Activate the **Transition** tool.
2. Click the desired location on the canvas.
3. Drag to reposition using the **Select** tool.

#### 3.3 Connect with Arcs
1. Switch to the **Arc** tool.
2. Click the source element, then click the target.
3. Press `Esc` to cancel an in-progress arc.
4. To edit arc waypoints, select the arc and drag the control points.

#### 3.4 Configure Tokens and Weights
1. Select a place to open properties.
2. Adjust **Initial Tokens** (0–20) and optional name.
3. Select an arc to edit the **Weight** (integer ≥ 1).

### 4. Editing and Layout Tools
- **Multi-select**: drag a selection box or hold `Shift` and click items. Move them together.
- **Keyboard shortcuts**: `Ctrl+C`, `Ctrl+V`, and `Ctrl+D` duplicate patterns quickly.
- **Undo/Redo**: toolbar buttons or `Ctrl+Z` / `Ctrl+Y`.
- **Zoom & Pan**: mouse wheel / trackpad zoom; use the canvas scroll/pan gestures (especially on touch devices).
- **Copy/Paste between tabs**: copy a sub-net from one browser tab and paste into another.

### 5. Managing Net Files
- **Save** downloads the current net as PNML (`.pnml`).
- **Save As** prompts for a location even if an autosave handle exists.
- **Load** imports PNML/XML files created by this or other PN tools. Invalid arcs are skipped with an inline warning.
- **Clear** wipes the canvas and resets the undo stack.

### 6. Inspecting Enabled Transitions
- The canvas highlights enabled transitions with a glowing outline.
- The **Enabled Transitions** list is available in the **Petri Net** panel (right sidebar) and displays clickable entries for manual firing.
- Hovering an entry reveals bindings (for APNs) or token requirements (for P/T nets).

### 7. Simulating P/T Nets
Simulation controls are available:
- On **desktop**: in the right sidebar under **Simulation**.
- On **touch devices**: as a floating control at the bottom of the screen.

- **Step**: fire one transition (single mode) or a maximal conflict-free set (maximal concurrent mode).
- **Simulate**: continuous animation with per-step delay; click **Stop** to pause.
- **Run**: headless execution until no transitions remain enabled or the iteration limit is reached.
- **Stop**: cancels Simulate or Run immediately.
- **Completion Dialog**: shows duration and number of firings after Run completes.

#### 7.1 Simulation Settings (P/T Focus)
Open **Settings → Simulation Settings**:
- **Max iterations / Limit iterations**: cap total firings to prevent runaway nets.
- **Use non-visual execution for Run**: disables animation to accelerate completion.
- **Simulation Mode**:
  - *Single Transition*: randomly choose one enabled transition per step.
  - *Maximal Concurrent*: fire a maximal set of non-conflicting transitions concurrently.
- **Batch Mode**: keeps the worker alive for repeated runs (forces non-visual mode).

### 8. Working with Large P/T Nets
- Enable **Use non-visual execution** to avoid per-step rendering overhead.
- Prefer **Batch Mode** for repeated experiments; the worker stays warm after the first run.
- Use the **Run** button instead of continuous animation.
- Export intermediate markings by saving the net; tokens persist in the PNML marking.

### 9. Troubleshooting (P/T)
- **Transition never enables**: verify each input place has enough tokens to satisfy arc weights.
- **Arc creation fails**: arcs must connect places ↔ transitions only; not place ↔ place.
- **Run stops early**: check the iteration limit or ensure the net is not deadlocked.
- **Performance issues**: reduce animation usage, collapse complex subnets into modules, or switch to algebraic mode if structured data is needed.

---

## Part II – Algebraic Petri Nets (APNs)

### 10. What Changes in APN Mode
Algebraic Petri Nets extend P/T nets by letting places hold structured tokens and letting transitions evaluate algebraic expressions.

- Places carry tokens typed by an **Algebraic Data Type (ADT)**.
- Input arcs include **bindings** that pattern-match tokens.
- Transitions declare **guards** (Boolean conditions) and **actions** (term rewriting) evaluated through the **Z3 solver**.
- Markings become multisets of structured values rather than simple integers.

Switch to APN mode via **Settings → Net Type → Algebraic (Integer)** (the net must be empty; switching is locked when the canvas has content). The toolbar and canvas remain the same, but the properties panels expose type-specific fields.

### 11. Built-in Algebraic Data Types and Operations

| Type   | Sample Operations | Notes |
|--------|-------------------|-------|
| `Int`  | `+`, `-`, `*`, `==`, `!=`, `<`, `<=`, `>`, `>=` | Arithmetic operations return `Int` or `Bool`. |
| `Bool` | `and`, `or`, `not`, `==`, `!=` | Guards may combine Boolean expressions freely. |
| `String` | `concat`, `substring`, `isSubstringOf`, `length`, `==`, `!=` | Length returns an `Int`. Supports empty string `''`. |
| `List` | `length`, `concat`, `head`, `tail`, `append`, `sublist`, `isSublistOf`, `==`, `!=` | Lists can nest and mix types. |
| `Pair` | `fst`, `snd`, `==`, `!=` | Pattern matching allows destructuring `(x, y)`. |

Custom ADTs can be imported via the ADT Manager (see section 14).

### 12. Guards, Bindings, and Actions
- **Bindings**: label input arcs with variables (`x`, `order`, `(price, qty)`). During firing, tokens matching the pattern are substituted into the guard and action.
- **Guards**: Boolean expressions written in the properties panel (`order.qty > 0`, `length(items) > 1`).
- **Actions**: Output expressions (one per outgoing arc) produce the tokens placed after firing (`(customer, status)`, `append(history, newEntry)`).
- **Matching rules**:
  - Variables must be bound on an input arc before use.
  - Output expressions must match the target place’s type.
  - Guards must evaluate to `true` for the transition to fire.

### 13. APN Tutorial – Order Fulfillment Workflow

**Scenario**: Accept incoming purchase orders, split them into fulfillment tasks, and log completed shipments.

1. **Select APN Mode**
   - Open **Settings → Net Type → Algebraic (Integer)**.
   - Confirm the canvas is empty; otherwise use **File → Clear**.

2. **Create Places**
   - `IncomingOrders` (type `List`) with initial token `[{"id": 101, "items": [("widget", 3)]}]`.
   - `Inventory` (type `List`) with token `[("widget", 50)]`.
   - `Shipments` (type `List`) initially `[]`.

3. **Create Transitions**
   - `ValidateOrder` with guard `length(order.items) > 0`.
   - `AssembleShipment` with guard `stockQty >= reqQty`.

4. **Bind Input Arcs**
   - `IncomingOrders → ValidateOrder`: binding `order`.
   - `Inventory → AssembleShipment`: binding `(sku, stockQty)`.
   - `ValidateOrder → AssembleShipment`: binding `(order)` (output arc carrying validated order).

5. **Define Actions**
   - `ValidateOrder` output: forward `order` to the next place via arc binding `order`.
   - `AssembleShipment` outputs:
     - To `Inventory`: `(sku, stockQty - reqQty)`
     - To `Shipments`: `append(shipments, (order.id, sku, reqQty))`

6. **Run the Net**
   - Use **Step** to inspect binding resolution.
   - Inspect the **Enabled Transition** entry to view selected `sku`, `stockQty`, `reqQty`.
   - Use **Run (Non-Visual)** to process large order batches.

### 14. ADT Manager and Equation Sandbox
- Open via the **ADT** button in the toolbar.
- **Available Data Types**: browse built-in operations and axioms.
- **Sandbox**:
  - Enter expressions (e.g., `isSubstringOf("abc", "zabcx")`) or equations (`x + y = 7`).
  - Provide bindings (`{"x":2, "y":5}` or `x=2, y=5`) to evaluate predicates.
  - Without bindings, equations trigger solving attempts (up to five solutions).
- **Custom ADTs**:
  - Import XML snippets conforming to the ADT schema.
  - Use `Export` to retrieve custom definitions for sharing.

### 15. Simulation Settings for APNs
- **Batch Mode**: recommended for heavy APN runs. Forces non-visual execution and pre-warms the worker pool.
- **Non-visual Run**: always enabled in batch mode; optional otherwise.
- **Max iterations**: important for preventing solver loops when guards refer to expansive bindings.
- **Simulation Mode**: maximal concurrency is ideal for data-parallel transitions (e.g., processing independent orders).

### 16. Z3 Solver Configuration
Open **Settings** and click **Z3 Settings**.
- **Pool size**: number of persistent web workers (0 = on-demand). Batch mode raises pool to 8 automatically.
- **idleTimeoutMs**: shrink pool when idle; increase for frequent short runs.
- **Pre-warm**: spawn workers as soon as algebraic mode activates to reduce first-run latency.
- **Solver timeout**: maximum time (ms) spent on a single guard evaluation. Lower values improve responsiveness; higher values handle complex constraints.

### 17. APN Troubleshooting
- **Guard never satisfies**: inspect the binding preview in the enabled transition panel; confirm variables map to the expected structure.
- **Type mismatch errors**: ensure output expressions conform to place type definitions.
- **Solver timeout**: raise the solver timeout or simplify guards. Check for recursive equations in user-defined ADTs.
- **Unexpected worker reuse**: disable batch mode or reduce pool size to zero to spin down workers after each run.

---

## Appendices

### Appendix A – File Formats
- **PNML (P/T)**: `<place>`, `<transition>`, `<arc>` elements with markings stored in `<initialMarking>`.
- **APN XML**: extends PNML with `<type>`, `<guard>`, `<action>`, and binding attributes. All files remain human-readable.
- **ADT XML**: list of `<type>` entries, each with `<operation>` and optional `<axioms>` (see `docs/STRING_ADT_USAGE.md` for schema details).

### Appendix B – Screenshot Checklist
Screenshots are currently not tracked in this repository. If you want to add them later, prefer keeping them under `docs/images/` and referencing them from this guide.

### Appendix C – Keyboard Shortcuts
- `Ctrl + Z` / `Ctrl + Y`: Undo / Redo.
- `Ctrl + C` / `Ctrl + V`: Copy / Paste selection (cross-tab supported).
- `Ctrl + A`: Select all elements.
- `Delete` or `Backspace`: Remove selected elements.

### Appendix D – Glossary
- **Deadlock**: marking where no transitions are enabled.
- **Invariant**: property preserved across all markings (e.g., total tokens).
- **Maximal concurrency**: largest set of transitions that can fire simultaneously without conflict.
- **Non-visual run**: simulation mode without intermediate animations, suitable for large nets or batch processing.

---

### Feedback and Support
Please report issues or request enhancements via the project issue tracker. Include logs (`logs/latest.log`), exported PNML/APN files, and solver settings when relevant.
