# Development Plan: Web-Based Algebraic Petri Net Editor and Simulator

## Progress Tracking
- ✅ Completed
- 🔄 In Progress
- ⬜ Not Started

## 1. Overview

This development plan outlines the implementation strategy for a web-based application to create, edit, and simulate Place/Transition (P/T) Petri Nets and Algebraic Petri Nets, as specified in the Software Specification (artifact_id: da7084fc-147f-45d0-80d9-2a8162d1e96c). The project is divided into two phases:
- **Phase 1**: Implement P/T Petri Net Editor and Simulator.
- **Phase 2**: Extend to Algebraic Petri Net Editor and Simulator, including axiomatic ADT definitions.

The application will be a single-page web app running in modern browsers, using JavaScript/React for the front end and Python/Pyodide for the backend, with XML-based storage for nets and ADTs. The plan assumes a team of 2–3 developers (front-end and back-end expertise) and a 6-month timeline, delivering a functional prototype meeting all functional and non-functional requirements.

## 2. Objectives
- Deliver a user-friendly, browser-based editor and simulator for P/T and algebraic Petri nets.
- Support up to 1000 places, 1000 transitions, and 1000 tokens, with a maximum of 20 tokens per place.
- Implement three simulation modes: interactive step-by-step, quick visual, and non-visual.
- Support axiomatic ADT definitions in XML, parsed but not used computationally in the prototype.
- Ensure performance (< 50ms editor actions, < 100ms P/T transitions, < 200ms algebraic transitions) and usability (learnable in < 5 minutes).
- Deploy as a static web app (e.g., GitHub Pages, Netlify) with no server component.

## 3. Tech Stack
- **Front End**:
  - ✅ **Framework**: React for component-based UI.
  - ✅ **Canvas**: React-Konva for rendering places, transitions, arcs, and token animations.
  - ✅ **Styling**: Tailwind CSS for responsive, modern UI design.
  - ⬜ **Utilities**: JavaScript for event handling, drag-and-drop, and undo/redo.
- **Back End**:
  - ⬜ **Runtime**: Pyodide (WebAssembly) for in-browser Python execution.
  - ⬜ **Libraries**: `lxml` for XML parsing, Python standard library for guard/action evaluation.
- **File Handling**: 
  - ⬜ Browser File API for local XML file loading/saving.
- **Build Tools**: 
  - ✅ Vite for bundling, testing, and development server.
- **Testing**: 
  - ✅ Jest for unit tests
  - ⬜ Cypress for end-to-end tests.
- **Deployment**: 
  - ⬜ Static hosting (GitHub Pages or Netlify).

## 4. Team and Roles
- **Front-End Developer (1–2)**: Implement React components, Konva.js canvas, drag-and-drop, and UI interactions.
- **Back-End Developer (1)**: Implement Pyodide-based simulator, XML parsing, and guard/action evaluation.
- **Shared Responsibilities**: Testing, documentation, deployment, and iteration planning.
- **Assumptions**: Developers have experience with JavaScript/React, Python, and web development; no external designers or DevOps required.

## 5. Milestones and Timeline
Total duration: **6 months** (26 weeks), divided into phases with iterative sprints (2 weeks each). Timelines are estimates, with buffer for debugging and refinement.

### Phase 1: P/T Petri Net Editor and Simulator (12 weeks)
#### Milestone 1.1: Project Setup and Basic Editor (4 weeks, Weeks 1–4)
- **Tasks**:
  - ✅ Set up project with Vite, React, React-Konva, Tailwind CSS.
  - ✅ Create basic UI layout: canvas, toolbar, properties panel, execution panel.
  - ✅ Implement canvas rendering for places (circles), transitions (rectangles), and arcs (arrows) with React-Konva.
  - ✅ Add drag-and-drop for creating/moving elements from toolbar to canvas.
  - ✅ Implement grid snapping (20x20 pixel grid) with toggle option.
  - ✅ Set up Jest for unit tests.
  - ⬜ Set up Cypress for end-to-end tests.
- **Deliverables**:
  - ✅ Project repository with build/test setup.
  - ✅ Basic editor UI with canvas, toolbar, and drag-and-drop functionality.
  - ✅ Unit tests for canvas rendering and drag-and-drop.
- **Success Criteria**:
  - ✅ Render and move places, transitions, and arcs on canvas.
  - ✅ Implement grid snapping with visual feedback and toggle option.
  - ✅ UI layout matches specification (Section 3.2).

#### Milestone 1.2: P/T Net Editor Features (4 weeks, Weeks 5–8)
- **Tasks**:
  - Add labels for place/transition names, arc weights, and token counts.
  - Implement colors: white fill for places, gray fill for transitions, black arcs, blue outline for selected elements, red outline for invalid elements.
  - Add undo/redo (stack-based, up to 50 actions) for add/delete/move actions.
  - Implement properties panel for editing place name, initial tokens (0–20), transition name, arc weight (≥ 1).
  - Add real-time validation: no arcs between places/transitions, valid weights, token limits (0–20).
  - Implement XML parser/serializer for P/T nets using `lxml` (Pyodide).
  - Add toolbar buttons for save/load XML files via File API.
- **Deliverables**:
  - Fully functional P/T net editor with labels, colors, undo/redo, and validation.
  - XML parser/serializer supporting the schema in Section 3.3.
  - Unit tests for validation and XML handling; Cypress tests for editor interactions.
- **Success Criteria**:
  - Create, edit, save, and load valid P/T nets with up to 1000 places/transitions.
  - Validation errors displayed as red outlines and tooltips.
  - Undo/redo supports all editing actions.

#### Milestone 1.3: P/T Net Simulator (4 weeks, Weeks 9–12)
- **Tasks**:
  - Implement simulator engine in Python (Pyodide) to compute enabled transitions and update markings.
  - Add execution panel to display current marking and enabled transitions.
  - Implement three simulation modes:
    - **Step-by-Step**: User selects enabled transition; yellow highlight and token animation (black dots).
    - **Quick Visual**: Automated firing (200ms delay) with animation.
    - **Non-Visual**: Compute final marking without animation.
  - Add toolbar buttons for simulation modes, stop, and clear canvas.
  - Ensure token limit (20 per place) is enforced during firing.
  - Optimize performance (< 100ms per transition, < 50ms editor actions).
  - Write comprehensive tests for simulator logic and performance.
- **Deliverables**:
  - Complete P/T net simulator with all modes and visual feedback.
  - Documentation for Phase 1 features and usage.
  - Test suite covering simulator, validation, and performance.
- **Success Criteria**:
  - Simulate P/T nets with correct marking updates and token animations.
  - All modes functional, with performance within limits.
  - Learn basic editing/simulation in < 5 minutes (tested via user feedback).

### Phase 2: Algebraic Petri Net Extension (12 weeks)
#### Milestone 2.1: ADT Management and XML Parsing (4 weeks, Weeks 13–16)
- **Tasks**:
  - Extend XML parser to handle algebraic net schema (Section 4.4) with types, guards, actions, and bindings.
  - Implement ADT XML parser for Section 4.5 schema, including `<type>`, `<operation>`, `<axioms>`, and `<axiom>` elements.
  - Validate ADT definitions: operation arity/result types, axiom syntax (well-formed equations, type-consistent variables).
  - Create ADT management interface (UI panel) to load/edit/save ADT XML files via File API.
  - Store axioms as strings without computational use (per prototype requirements).
  - Add support for standard ADTs (Integer, Boolean, List, Character, String) and custom ADTs (e.g., Float).
  - Write tests for ADT parsing and validation.
- **Deliverables**:
  - ADT XML parser and management interface.
  - Extended net parser for algebraic nets.
  - Unit tests for ADT and net parsing.
- **Success Criteria**:
  - Load and validate ADT XML files, including axioms, for standard and custom types.
  - Parse algebraic nets with guards, actions, and bindings.

#### Milestone 2.2: Algebraic Net Editor Extensions (4 weeks, Weeks 17–20)
- **Tasks**:
  - Extend canvas to display typed tokens (e.g., “[1, 2]” for Integer, “[[1], [2]]” for List) with color-coded types (blue for Integer, green for Boolean, orange for List, purple for Character, red for String).
  - Add guard/action labels on transitions (truncated, with tooltips).
  - Extend properties panel to edit guards (e.g., `(x + 5 == 7) or (x + 5 == 9)`) and actions (e.g., `y = x * 2 + 3`, `y = x + z, w = x - z`) with syntax highlighting.
  - Support multiple input/output arcs and variables (e.g., `x`, `z` inputs, `y`, `w` outputs).
  - Validate guards/actions: Boolean guards, type-consistent actions, variable matching, single ADT per place.
  - Extend drag-and-drop to assign ADTs to places and bindings to arcs.
  - Update undo/redo to include type assignments and guard/action edits.
  - Ensure editor performance (< 50ms per action).
  - Write tests for editor extensions and validation.
- **Deliverables**:
  - Algebraic net editor with typed tokens, guard/action editing, and multiple input/output support.
  - Unit tests for editor features; Cypress tests for UI interactions.
- **Success Criteria**:
  - Create/edit algebraic nets with typed places, guards, actions, and multiple arcs.
  - Validation errors displayed for invalid guards/actions or token limits.

#### Milestone 2.3: Algebraic Net Simulator and Finalization (4 weeks, Weeks 21–24)
- **Tasks**:
  - Extend simulator engine to evaluate guards (e.g., `(x + 5 == 7) or (x + 5 == 9)`) and actions (e.g., `y = x + z, w = x - z`) using Python’s operational semantics.
  - Support nested lists and all ADT operations (Section 4.3).
  - Implement binding evaluation for multiple input places (e.g., `x = 2, z = 3`).
  - Handle runtime errors (e.g., division by zero) with user notifications (e.g., “Division by zero in action”).
  - Extend execution panel to show bindings and action results (e.g., `y = 5, w = -1`).
  - Update simulation modes:
    - **Step-by-Step**: User selects binding; animates multiple output tokens (e.g., “5”, “-1”).
    - **Quick Visual**: Automated firing with 200ms delay and animations.
    - **Non-Visual**: Compute final marking.
  - Ensure token limit (20 per place) and performance (< 200ms per algebraic transition).
  - Finalize documentation and test suite.
- **Deliverables**:
  - Complete algebraic net simulator with all modes and visual feedback.
  - Comprehensive documentation (installation, usage, developer guide).
  - Test suite covering simulator, validation, and performance.
- **Success Criteria**:
  - Simulate algebraic nets with correct guard/action evaluation and token animations.
  - Support multiple inputs/outputs, nested lists, and all ADT operations.
  - Meet performance and usability goals.

#### Milestone 2.4: Testing, Refinement, and Deployment (2 weeks, Weeks 25–26)
- **Tasks**:
  - Conduct end-to-end testing with sample P/T and algebraic nets (up to 1000 places/transitions).
  - Test axiom parsing with standard and custom ADTs.
  - Gather user feedback on usability (learnability < 5 minutes).
  - Fix bugs and optimize performance (editor < 50ms, P/T transitions < 100ms, algebraic transitions < 200ms).
  - Deploy to static hosting (GitHub Pages or Netlify).
  - Finalize documentation and prepare handoff.
- **Deliverables**:
  - Deployed application.
  - Final test reports and documentation.
  - User guide for editing and simulation.
- **Success Criteria**:
  - Stable, bug-free application meeting all requirements.
  - Successful deployment and user testing confirming usability.

## 6. Task Breakdown and Dependencies
### Phase 1 Tasks
- **Setup (Weeks 1–2)**: 
  - ✅ Initialize project, configure Vite/React/React-Konva/Tailwind CSS.
  - ⬜ Configure Pyodide.
  - Dependencies: None.
- **Basic Editor (Weeks 3–4)**: 
  - ✅ Canvas rendering, drag-and-drop, UI layout.
  - Dependencies: Setup complete.
- **Editor Features (Weeks 5–8)**: 
  - 🔄 Custom hooks for state management.
  - ⬜ Labels, colors, undo/redo, properties panel, validation, XML handling.
  - Dependencies: Basic editor.
- **Simulator (Weeks 9–12)**: 
  - ⬜ Engine, execution panel, simulation modes, performance optimization.
  - Dependencies: Editor features.

### Phase 2 Tasks
- **ADT Parsing (Weeks 13–16)**: ADT XML parser, management interface, axiom validation.
  - Dependencies: Phase 1 complete.
- **Editor Extensions (Weeks 17–20)**: Typed tokens, guard/action editing, multiple arcs, validation.
  - Dependencies: ADT parsing.
- **Simulator Extensions (Weeks 21–24)**: Guard/action evaluation, binding handling, runtime errors, simulation modes.
  - Dependencies: Editor extensions.
- **Testing/Deployment (Weeks 25–26)**: End-to-end testing, user feedback, deployment.
  - Dependencies: Simulator extensions.

## 7. Risks and Mitigation
- **Risk: Pyodide Integration Challenges** (e.g., performance, library compatibility).
  - **Mitigation**: Test Pyodide early (Week 1) with `lxml` and basic guard/action evaluation; fallback to JavaScript-based parsing if needed.
- **Risk: Performance Bottlenecks** (e.g., canvas rendering, binding evaluation for large nets).
  - **Mitigation**: Profile performance in each milestone; optimize Konva.js rendering and limit binding iterations (e.g., cap at 20 tokens per place).
- **Risk: Complex Validation Logic** (e.g., type consistency, axiom syntax).
  - **Mitigation**: Implement validation incrementally, with unit tests for each rule; use `lxml` for robust XML validation.
- **Risk: Usability Issues** (e.g., learning curve > 5 minutes).
  - **Mitigation**: Conduct usability testing in Weeks 12 and 24; refine UI based on feedback, adding tooltips and clear error messages.

## 8. Resource Requirements
- **Team**: 2–3 developers (1–2 front-end, 1 back-end).
  - Estimated effort: ~20 hours/week per developer, ~1500 total hours over 6 months.
- **Hardware**: Standard development laptops (no special requirements).
- **Software**: Free/open-source tools (Vite, React, Konva.js, Tailwind CSS, Pyodide, Jest, Cypress).
- **Hosting**: Free static hosting (GitHub Pages or Netlify).
- **Budget**: Minimal (primarily developer time; no licensing or server costs).

## 9. Success Criteria
- **Phase 1** (Week 12):
  - Functional P/T net editor with drag-and-drop, colors, labels, grid snapping, undo/redo, and validation (token limit 20).
  - Simulator with step-by-step, quick visual, and non-visual modes, showing correct markings and animations.
  - XML-based saving/loading, performance within limits (< 50ms editor, < 100ms transitions).
- **Phase 2** (Week 26):
  - Algebraic net editor with typed tokens, guard/action editing, multiple input/output arcs, and nested list support.
  - Simulator supporting guard/action evaluation, three modes, and runtime error handling.
  - ADT management with axiomatic definitions parsed/stored (not computed).
  - Performance (< 50ms editor, < 200ms algebraic transitions), usability (learnable in < 5 minutes), and stable deployment.

## 10. Monitoring and Reporting
- **Sprints**: 2-week iterations with planning, review, and retrospective meetings.
- **Progress Tracking**: Use GitHub Projects to track tasks, issues, and milestones.
- **Reporting**: Bi-weekly status reports to stakeholders (if applicable), covering completed tasks, risks, and upcoming goals.
- **Testing**: Continuous unit testing with Jest; end-to-end testing with Cypress before each milestone.
- **User Feedback**: Collect feedback in Weeks 12 and 24 to ensure usability goals.

## 11. Assumptions
- Developers are familiar with React, Konva.js, and Python/Pyodide.
- No accessibility requirements (e.g., screen readers) unless specified later.
- XML formatting prioritizes human readability; no strict PNML compliance required.
- Axiomatic definitions are for formal specification only, with no computational use in the prototype.
- Static hosting meets deployment needs; no server-side processing required.

## 12. Next Steps
- **Week 1**:
  - ✅ Finalize team assignments and set up repository.
  - ✅ Install dependencies (Vite, React, React-Konva, Tailwind CSS).
  - ⬜ Install Pyodide.
  - ✅ Create initial project structure.
  - ⬜ Run basic Pyodide test.
- **Week 2**:
  - ✅ Design UI mockups for canvas, toolbar, properties, and execution panels.
  - ✅ Begin canvas implementation with React-Konva.
  - ✅ Plan first sprint tasks.
- **Current Focus**:
  - 🔄 Implement custom hooks for state management
    - 🔄 usePetriNet.js - Main model-related hook for Petri net state management
    - 🔄 useEditor.js - Editor-specific state and operations
    - ⬜ useGridSnapping.js - Grid-related functionality
    - ⬜ usePetriNetSimulation.js - Simulation-related logic
  - ⬜ Enhance Place component with token visualization
  - ⬜ Implement grid snapping functionality
  - ⬜ Add undo/redo functionality