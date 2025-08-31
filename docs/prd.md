# Software Specification: Web-Based Algebraic Petri Net Editor and Simulator

## 1. Overview

This specification outlines the requirements for a web-based application to create, edit, and simulate **Place/Transition (P/T) Petri Nets** and **Algebraic Petri Nets** interactively in a browser. The application will feature a graphical editor and a simulation engine, with data stored in human-readable XML format. The project is divided into two phases: (1) implementing P/T nets, and (2) extending to algebraic Petri nets with Z3-based constraint solving. The backend will be written in Python, and the front end will be implemented in JavaScript.

## 2. General Requirements

- **Platform**: Single-page web application running in modern browsers (Chrome, Firefox, Safari, Edge).
- **Backend**: Python, executed in the browser using Pyodide (WebAssembly).
- **Front End**: JavaScript, using React with Konva.js for canvas-based rendering and Tailwind CSS for styling.
- **Storage**:
  - P/T and algebraic Petri nets stored in human-readable XML files (inspired by PNML, no specific formatting preferences).
  - Algebraic data types (ADTs) stored in a separate human-readable XML file, including axiomatic definitions.
  - Saving/loading nets and ADTs from the user's local machine using the browser File API.
- **Interactivity**:
  - Graphical editor with drag-and-drop creation of Petri net objects, supporting colors, labels, grid snapping, undo/redo, and real-time validation.
  - Simulation with three modes: interactive step-by-step (highlighting transitions and animating token movement), non-interactive quick visual sequence, and non-interactive non-visual final marking calculation.
- **Scalability**: Support nets with up to 1000 places, 1000 transitions, and 1000 tokens.
- **Validation**: Ensure nets are structurally valid (e.g., no arcs between two places) and token count per place remains under 20, with errors displayed in the editor.
- **Deployment**: Static hosting (e.g., GitHub Pages, Netlify), no server component or specific hosting requirements.
- **Sharing**: No features for sharing nets.

## 3. Phase 1: Place/Transition Petri Net Editor and Simulator

### 3.1 P/T Net Definition
- **Places**: Nodes holding non-negative integer tokens (up to 20 per place).
- **Transitions**: Nodes that consume tokens from input places and produce tokens in output places.
- **Arcs**: Directed edges with integer weights (≥ 1) connecting places to transitions or transitions to places.
- **Marking**: Current state, defined by the number of tokens in each place.
- **Execution Semantics**:
  - A transition is enabled if each input place has at least as many tokens as the weight of the arc to the transition.
  - Firing an enabled transition consumes tokens from input places and produces tokens in output places according to arc weights, ensuring no place exceeds 20 tokens.
  - Transitions fire sequentially (no concurrent firing).

### 3.2 Functional Requirements
#### Editor
- **Canvas**:
  - Visual representation: places as circles (white fill, black stroke), transitions as rectangles (gray fill, black stroke), arcs as arrows (black).
  - **Drag-and-Drop**: Create places, transitions, and arcs by dragging from the toolbar to the canvas; move existing elements by dragging.
  - **Colors**: Distinct colors for places, transitions, and arcs; highlight selected elements (blue outline), invalid elements (red outline), and firing transitions (yellow fill during simulation).
  - **Labels**: Display names on places and transitions; show arc weights as numeric labels near arcs; show token counts near places.
  - **Grid Snapping**: Snap elements to a 20x20 pixel grid during creation and movement for alignment.
  - **Undo/Redo**: Support undoing/redoing actions (e.g., add/delete/move elements, edit properties) with a stack-based history (up to 50 actions).
  - **Validation**: Real-time validation of net structure and token limits, with errors shown as red outlines and tooltips (e.g., "Arc cannot connect two places", "Token count exceeds 20").
- **Toolbar**:
  - Buttons to add places, transitions, and arcs (drag to canvas).
  - Tools to save/load nets as XML files from the user's local machine.
  - Buttons for simulation modes (step-by-step, quick visual, non-visual), stop, and clear canvas.
  - Undo/redo buttons.
- **Properties Panel**:
  - Edit attributes: place name, initial tokens (integer 0–20), transition name, arc weight (integer ≥ 1).
  - Display validation errors for edited properties (e.g., "Tokens must be 0–20").
- **Execution Panel**:
  - Show current marking visually (token counts as numbers near places).
  - List enabled transitions with buttons to fire one at a time in step-by-step mode.
  - Support three simulation modes:
    - **Interactive Step-by-Step**: User clicks to select and fire an enabled transition; transition is highlighted (yellow fill) before tokens (black dots) move visually along arcs to update the marking.
    - **Non-Interactive Quick Visual**: Automatically fires enabled transitions in sequence (200ms per firing), with highlighted transitions and visible token movement, understandable by a human observer.
    - **Non-Interactive Non-Visual**: Computes the final marking without animation, displaying only the final token counts near places.

#### Simulator Engine
- **Parsing**: Load P/T net from XML, validate structure and token limits, and initialize marking.
- **Execution**:
  - Compute enabled transitions based on current marking.
  - Update marking when a transition fires, ensuring no place exceeds 20 tokens.
  - Support three modes: step-by-step (user-driven), quick visual (automated with animation), and non-visual (compute final marking).
- **Output**: Visual marking (token counts displayed near places) for all modes; no additional formats (e.g., JSON, text log).
- **Serialization**: Convert net and marking to human-readable XML for saving.

#### Validation Rules
- No arcs between two places or two transitions.
- Arc weights must be positive integers.
- Initial markings must be 0–20 tokens per place.
- Firing transitions must not result in more than 20 tokens in any place.
- Each place and transition must have a unique ID and non-empty name.

### 3.3 XML Format for P/T Nets
- **Schema**: Human-readable, inspired by PNML, with clear structure, minimal nesting, and no specific formatting preferences (e.g., indentation or attribute vs. element usage).
- **Elements**:
  - `<place>`: ID, name, initial marking (integer 0–20).
  - `<transition>`: ID, name.
  - `<arc>`: ID, source, target, weight (integer).
- **Example**:
  ```xml
  <pnml>
    <net id="net1" type="PTNet">
      <place id="p1">
        <name>P1</name>
        <initialMarking>2</initialMarking>
      </place>
      <place id="p2">
        <name>P2</name>
        <initialMarking>0</initialMarking>
      </place>
      <transition id="t1">
        <name>T1</name>
      </transition>
      <arc id="a1" source="p1" target="t1" weight="1"/>
      <arc id="a2" source="t1" target="p2" weight="1"/>
    </net>
  </pnml>
  ```
- **Validation**: Optional XML Schema Definition (XSD) for correctness, prioritizing human readability.

### 3.4 Non-Functional Requirements
- **Performance**:
  - Editor: Real-time rendering and validation for nets with up to 1000 places and 1000 transitions (< 50ms per action).
  - Simulator: Execute transitions in < 100ms for P/T nets within scale limits.
- **Usability**:
  - Intuitive interface with tooltips, error messages, and visual feedback.
  - Learn basic editing/simulation in < 5 minutes.
- **Compatibility**: Support XML files compatible with PNML-based tools (e.g., TAPAAL) where feasible, prioritizing human readability.

## 4. Phase 2: Algebraic Petri Net Extension

### 4.1 Algebraic Petri Net Definition
This phase is implemented incrementally, starting with integer-only algebraic Petri nets and extending to a full type system.

#### 4.1.1 Integer-Only Phase
- **Places**: Hold integer tokens (simple integers only, no expressions), up to 20 tokens per place.
- **Transitions**: Include guards (boolean expressions with integer arithmetic and comparisons) and actions (integer operations producing output tokens).
- **Arcs**: Labeled with variables or patterns for binding tokens and performing term unification.
- **Execution Semantics**:
  - A transition is enabled if its guard evaluates to true for some binding of input tokens using Z3 solver.
  - Pattern matching on input arcs supports variable binding and term unification (e.g., matching `(x,1)` with token `(2,1)` to bind `x = 2`).
  - Firing executes the action, producing output tokens based on the binding, ensuring no place exceeds 20 tokens.
  - Sequential firing with Z3-based constraint solving.

#### 4.1.2 Full Type System Phase
- **Places**: Hold multisets of tokens with support for Integer, Boolean, List, Pair, and String types, up to 20 tokens per place.
- **Transitions**: Extended guards and actions supporting all types with Z3 theories.
- **Arcs**: Enhanced pattern matching for complex types including destructuring and construction.
- **Execution Semantics**:
  - Z3-based solving for all type operations and constraints.
  - Advanced pattern matching for lists, pairs, and complex structures.
  - Multiset operations with mixed token types.

### 4.2 Functional Requirements
#### Editor Extensions
- **Canvas**:
  - Display typed tokens (e.g., "[1, 2]" for Integer, "[true, false]" for Boolean, "[[1], [2, 3]]" for List, etc., near places).
  - Show guards and actions as labels on transitions (truncated with tooltip for full text).
  - Use colors to indicate token types (e.g., blue for Integer, green for Boolean, orange for List, purple for Character, red for String).
  - Highlight firing transitions (yellow fill) and animate token movement for multiple output arcs (e.g., tokens "7" and "-3" moving to different places).
  - **Drag-and-Drop**: Extend to support assigning ADTs to places and bindings to multiple input/output arcs.
  - **Grid Snapping**: Consistent with Phase 1 (20x20 pixel grid).
  - **Undo/Redo**: Extend to include type assignments, guard/action edits.
  - **Validation**: Check guard/action syntax, type compatibility, token limits (max 20 per place), and variable usage across multiple input/output arcs.
- **Properties Panel**:
  - Edit guards (e.g., `(x + 5 == 7) or (x + 5 == 9)`) and actions (e.g., `y = x * 2 + 3`, `y = x + z`, `m = append(l, [1, 2])`) with syntax highlighting.
  - Support actions with multiple input variables (e.g., `y = x + z` from two input places) and multiple output variables (e.g., `y = x + z, w = x - z` for two output places).
  - Allow all syntactically and type-correct action expressions, including potentially error-prone operations (e.g., `y = x / z`).
  - Validate actions for:
    - Variable usage (must match input arc bindings).
    - Type consistency (e.g., `y = x / z` requires Integer `x`, `z`, `y`).
    - Output compatibility (each output variable matches its target place's type).
  - Display validation errors (e.g., "Undefined variable z", "Type mismatch in action").
- **Execution Panel**:
  - Show valid token bindings for enabled transitions (e.g., `x = 2, z = 3` for guard `x + z > 0`).
  - Display action results for multiple outputs (e.g., `y = 5, w = -1` for `y = x + z, w = x - z`).
  - Support three simulation modes:
    - **Interactive Step-by-Step**: User selects a binding (e.g., `x = 2, z = 3`); transition highlights (yellow fill); tokens (e.g., "5", "-1") move visually to output places.
    - **Non-Interactive Quick Visual**: Automatically fires enabled transitions (200ms per firing), animating multiple output tokens (e.g., "5" to one place, "-1" to another).
    - **Non-Interactive Non-Visual**: Computes final marking, displaying token values near places.
  - Handle runtime errors (e.g., division by zero in `y = x / z` when `z = 0`) by displaying an error message (e.g., "Division by zero in action") and preventing the transition from firing.
- **ADT Management**:
  - Interface to load/edit/save ADTs from a local XML file, supporting actions with nested lists, multiple inputs/outputs, and axiomatic definitions.

#### Simulator Engine Extensions
- **Z3 Integration**: Integrate Z3 solver through Pyodide for constraint solving and unification across all supported types.
- **ADT Parsing**: Load and validate ADTs from XML, including operations and axiomatic definitions, supporting Integer, Boolean, List (with nesting), Character, and String.
- **Parsing**: Extend P/T net parser to handle guards, actions, typed tokens, token limits, and multiple input/output arcs.
- **Execution**:
  - Evaluate guards for all possible token bindings across multiple input places using Z3 solver (e.g., `x = 2, z = 3` for guard `x + z > 0`).
  - Execute actions to produce output tokens for multiple output arcs, supporting complex transformations:
    - Integer: `y = x * 2 + 3`, `y = x / z`, `y = x + z`.
    - Boolean: `c = b and not d`.
    - List: `m = append(get(l, 0), 1)`, `m = pop(append(l, [1, 2]))`.
    - Character: `d = if c = 'a' then 'b' else 'c'`.
    - String: `t = s + slice(s, 0, 2)`.
  - Support actions with multiple outputs (e.g., `y = x + z, w = x - z` producing tokens for two places).
  - Catch runtime errors (e.g., division by zero) during action evaluation, preventing firing and notifying the user.
  - Ensure token limits (max 20 per place) are respected.
  - Set Z3 solver timeout to 10 seconds for performance.
- **Output**: Visual marking (token values displayed near places) reflecting action results (e.g., "5", "-1" for multiple outputs).
- **Serialization**: Extend P/T net XML to include guards, actions, types, and multiple input/output arcs in a human-readable format.

#### Validation Rules (Extended)
- Guards must be Boolean expressions compatible with the place's token type (e.g., `x > 0` for Integer, `s != ''` for String).
- Actions must produce output tokens matching arc bindings and the target place's type, using variables from input arcs.
- Arc bindings must reference variables used in guards/actions and match the place's type.
- Each place is restricted to one ADT (no multi-sorted tokens).
- Maximum 20 tokens per place (counting each value, e.g., a list like [1, 2] counts as one token).
- List operations must respect element types (e.g., homogeneous lists, nested lists allowed).

### 4.3 Supported Algebraic Data Types and Operations
- **Integer**:
  - Operations: `+`, `-`, `*`, `/` (integer division), `>`, `<`, `==`, `!=`.
  - Example Action: `y = x * x - 2`, `y = x + z`, `y = x / z`.
  - Z3 Integration: Full support for integer arithmetic and comparison operations.
- **Boolean**:
  - Operations: `and`, `or`, `not`, `==`, `!=`.
  - Example Action: `c = b and not d`.
  - Z3 Integration: Boolean logic operations with Z3 theories.
- **List**:
  - Operations: `len`, `append`, `pop`, `get`, `==`, `!=`.
  - Supports nested lists (e.g., List[List[Integer]]).
  - Example Action: `m = append(get(l, 0), 1)`, `m = append(l, k)`.
  - Z3 Integration: List operations with Z3 sequence theories.
- **Pair/Tuple**:
  - Operations: Construction, destructuring, comparison.
  - Example Action: `p = (x, y)`, `(a, b) = p`.
  - Z3 Integration: Tuple operations with Z3 theories.
- **String**:
  - Operations: `+` (concatenation), `len`, `==`, `!=`, `slice`.
  - Example Action: `t = s + slice(k, 0, 1)`.
  - Z3 Integration: String operations with Z3 string theories.
- **Action Logic**:
  - Actions combine operations, constants, multiple input variables, and conditionals (e.g., `y = x + z if x > z else z - x`).
  - Support multiple output variables (e.g., `y = x + z, w = x - z` for two output places).
  - All syntactically and type-correct expressions are allowed, with runtime error handling (e.g., division by zero).
  - Z3-based solving for all constraint satisfaction and unification problems.

### 4.4 XML Format for Algebraic Petri Nets
- **Schema**: Extend P/T net schema with type, guard, action, and binding elements, prioritizing human readability.
- **Elements**:
  - `<place>`: Add `<type>` (e.g., "Integer", "List[List[Integer]]").
  - `<transition>`: Add `<guard>` and `<action>` (string expressions, supporting multiple outputs).
  - `<arc>`: Add `<binding>` (variable or expression).
- **Example** (Multiple Inputs/Outputs):
  ```xml
  <pnml>
    <net id="net1" type="AlgebraicPetriNet">
      <place id="p1">
        <name>P1</name>
        <type>Integer</type>
        <initialMarking>[2, 4, 6]</initialMarking>
      </place>
      <place id="p2">
        <name>P2</name>
        <type>Integer</type>
        <initialMarking>[3, 5]</initialMarking>
      </place>
      <place id="p3">
        <name>P3</name>
        <type>Integer</type>
        <initialMarking>[]</initialMarking>
      </place>
      <place id="p4">
        <name>P4</name>
        <type>Integer</type>
        <initialMarking>[]</initialMarking>
      </place>
      <transition id="t1">
        <name>T1</name>
        <guard>x + z > 5</guard>
        <action>y = x + z, w = x - z</action>
      </transition>
      <arc id="a1" source="p1" target="t1" binding="x"/>
      <arc id="a2" source="p2" target="t1" binding="z"/>
      <arc id="a3" source="t1" target="p3" binding="y"/>
      <arc id="a4" source="t1" target="p4" binding="w"/>
    </net>
  </pnml>
  ```
  - **Behavior**:
    - Guard: `x + z > 5` (e.g., `x = 2, z = 5` → `2 + 5 > 5` → true).
    - Action: `y = x + z, w = x - z` → `y = 7, w = -3`.
    - Output: Token `7` to `p3`, token `-3` to `p4`.

### 4.5 XML Format for Algebraic Data Types
- **Schema**: Define types and operation signatures for Z3 theory integration.
- **Elements**:
  - `<type>`: Name (e.g., "Integer", "List[List[Integer]]").
  - `<operation>`: Name, arity, result type (e.g., "+", arity=2, result="Integer").
- **Purpose**: 
  - Display operation signatures in the editor for user reference.
  - Map operations to corresponding Z3 theory functions.
  - No custom axiomatic definitions - semantics provided entirely by Z3.
- **Example**:
  ```xml
  <algebraicDataTypes>
    <type name="Integer">
      <operation name="+" arity="2" result="Integer"/>
      <operation name="*" arity="2" result="Integer"/>
      <operation name="/" arity="2" result="Integer"/>
      <operation name=">" arity="2" result="Boolean"/>
      <operation name="==" arity="2" result="Boolean"/>
    </type>
    <type name="Boolean">
      <operation name="and" arity="2" result="Boolean"/>
      <operation name="or" arity="2" result="Boolean"/>
      <operation name="not" arity="1" result="Boolean"/>
    </type>
    <type name="List">
      <operation name="append" arity="2" result="List"/>
      <operation name="len" arity="1" result="Integer"/>
      <operation name="get" arity="2" result="Any"/>
    </type>
    <type name="Pair">
      <operation name="pair" arity="2" result="Pair"/>
      <operation name="fst" arity="1" result="Any"/>
      <operation name="snd" arity="1" result="Any"/>
    </type>
    <type name="String">
      <operation name="+" arity="2" result="String"/>
      <operation name="len" arity="1" result="Integer"/>
      <operation name="slice" arity="3" result="String"/>
    </type>
  </algebraicDataTypes>
  ```
- **Notes**:
  - Operation signatures are for editor display and type checking only.
  - All semantics (arithmetic, logic, list operations, etc.) come from Z3 theories.
  - No custom equations or rewriting rules - Z3 handles all constraint solving.
  - Types map directly to Z3 theory domains (Int, Bool, Seq, etc.).

### 4.6 Non-Functional Requirements
- **Performance**:
  - Editor: Handle nets with up to 1000 places, 1000 transitions, and 1000 tokens in < 50ms per action.
  - Simulator: Execute P/T transitions in < 100ms, algebraic transitions within Z3 timeout constraints (10 seconds).
- **Usability**:
  - Syntax highlighting for guard/action expressions (supporting all ADTs).
  - Clear error messages for invalid expressions, type mismatches, or token limit violations.
  - Learn basic editing/simulation in < 5 minutes.
- **Extensibility**:
  - Allow users to define new ADTs, operations, and axiomatic definitions in XML.
  - Axioms support future extensions (e.g., verification) without affecting prototype functionality.
- **Z3 Integration**:
  - Z3 solver timeout set to 10 seconds for performance.
  - Support for all Z3 theories relevant to supported data types.
  - Efficient constraint solving and unification for pattern matching.

## 5. Technical Constraints
- **Backend**: Python with Pyodide, using libraries like `lxml` for XML parsing and Z3 for constraint solving.
- **Z3 Integration**: Z3 solver integrated through Pyodide for all algebraic operations and pattern matching.
- **Type System**: ADT XML files define only operation signatures for editor display and type checking. All semantics come from Z3 theories.
- **Front End**: JavaScript with React, Konva.js for canvas, and Tailwind CSS for styling.
- **File I/O**: Use browser File API for local XML file handling (no server storage).
- **Security**: Sanitize guard/action expressions to prevent code injection. All computation uses Z3's safe theory functions.
- **No Server**: All computation in-browser, no network calls for core functionality.

## 6. Assumptions
- No specific accessibility requirements (e.g., screen reader support).
- No user-defined functions in guards/actions (only Z3 theory operations).
- Token movement animation uses simple text labels (e.g., "1", "'abc'") moving along arcs.
- Non-interactive quick visual mode uses a fixed 200ms delay per firing for human comprehensibility.
- XML files are saved with default browser formatting (e.g., standard indentation).
- ADT definitions are for operation signature display only - all semantics come from Z3.
- Z3 solver provides efficient constraint solving for all supported data types.

## 7. Deliverables
- **Phase 1**:
  - Web-based P/T net editor with drag-and-drop, colors, labels, grid snapping, undo/redo, and real-time validation (including token limit of 20).
  - Simulator engine with step-by-step, quick visual, and non-visual modes, outputting visual markings.
  - XML parser/serializer for saving/loading nets from local machine.
  - Documentation and test cases.
- **Phase 2**:
  - Extended editor for algebraic Petri nets with Z3 integration, starting with integer-only nets and extending to full type system support.
  - Extended simulator with Z3-based guard/action evaluation, multiple input/output arcs, and three simulation modes.
  - ADT management interface for displaying operation signatures and XML parser for local file handling.
  - Updated documentation and test cases.

## 8. Success Criteria
- **Phase 1**: Users can create, edit, save, load, and simulate P/T nets with up to 1000 places and 1000 transitions, with correct execution, visual feedback (markings and animations), and validation (including token limit).
- **Phase 2**: Users can define ADTs (Integer, Boolean, List, Pair, String) with operation signatures visible in the editor, create/edit algebraic nets with single-typed places and multiple input/output arcs, and simulate them with Z3-based expression evaluation and nested lists.
- **Usability**: Intuitive interface, with < 5 minutes to learn basic editing and simulation.
- **Reliability**: No crashes during editing or simulation; all nets validated before execution; ADT signatures parsed correctly; Z3 integration working reliably within timeout constraints.
