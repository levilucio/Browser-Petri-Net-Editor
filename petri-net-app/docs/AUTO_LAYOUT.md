# Auto-Layout for Petri Nets

## Overview

The Petri Net Editor now includes automatic layout capabilities to help organize your nets for better readability.

## Features

### 1. Automatic Layout Algorithm

The auto-layout feature uses a **hierarchical (Sugiyama-style) layout algorithm** optimized for Petri nets:

- **Layer Assignment**: Places and transitions are organized into alternating horizontal layers based on network flow
- **Minimized Crossings**: Nodes within layers are ordered to reduce arc crossings using the barycenter heuristic
- **Even Spacing**: Nodes are positioned with consistent spacing for a clean, professional appearance

The algorithm works particularly well for:
- Workflow nets with clear input → processing → output structure
- Nets with marked `io_type` properties (`input`, `internal`, `output`)
- Both manually created nets and programmatically generated nets

### 2. Orthogonal Edge Routing

Arcs now support **orthogonal/angled polyline routing** for clearer visualization:

- Arcs can have waypoints that create elbow/Manhattan-style routing
- Reduces visual clutter from crossing diagonal lines
- Better distinguishes parallel flows
- Automatically computed during auto-layout

Arcs without waypoints continue to render as straight lines (backward compatible).

## Using Auto-Layout

### Desktop

Click the **Auto-layout** button in the toolbar under the "Layout" section.

### Mobile

Open the menu and select **Auto-layout** from the Layout section.

### Effect

- All places and transitions will be repositioned based on the layout algorithm
- Existing arcs are preserved
- The operation can be undone via the History buttons
- Manual adjustments can still be made after auto-layout

## Example Nets

The following example nets come with **curated manual layouts** that demonstrate best practices:

1. **Manufacturing Workflow** - Complex multi-stage production pipeline
2. **Option Request Handler** - Simple ADT constructor partitioning
3. **Result Validation Pipeline** - Error handling flow
4. **List Processing** - Empty vs non-empty list handling

These examples load with pre-positioned coordinates but can still be auto-laid out if desired.

## Algorithm Details

### Layout Parameters

```javascript
LAYER_SPACING = 200px  // Horizontal space between layers
NODE_SPACING = 100px   // Vertical space between nodes
MARGIN_X = 100px       // Left margin
MARGIN_Y = 100px       // Top margin
```

### Layer Assignment

1. Identifies input places (marked `io_type: 'input'` or having no incoming arcs)
2. Performs breadth-first traversal from input places
3. Alternates between place and transition layers
4. Handles disconnected components by placing them in a final layer

### Crossing Minimization

Uses the barycenter heuristic with multiple iterations:
- For each node in layer L+1, computes average position of predecessors in layer L
- Sorts nodes by their barycenter values
- Iterates up to 10 times or until no changes occur

### Orthogonal Routing

Waypoints are computed based on layer flow:
- **Horizontal flow**: Two-bend routing (horizontal → vertical → horizontal)
- **Close vertical neighbors**: Three-bend routing for clarity
- **Direct connections**: Simple straight lines when appropriate

## Compatibility

- ✅ Works with P/T nets and Algebraic nets
- ✅ Preserves all node properties (tokens, guards, actions, sorts)
- ✅ Compatible with simulation and SATEL testing
- ✅ Respects existing arc properties (weights, bindings, labels)
- ✅ Undo/redo supported
- ✅ Maintains manual drag-and-drop capability after auto-layout

## Limitations

- Auto-layout is optimized for **directed acyclic flows**; cyclic structures may not be optimally placed
- Very large nets (100+ nodes) may require manual refinement after auto-layout
- Self-loops and back-arcs are supported but may create visual overlap

## Future Enhancements

Potential improvements for future versions:
- Force-directed layout as an alternative algorithm
- User-configurable spacing parameters
- Layout constraints (fixed positions, alignment guides)
- Per-arc routing style selection (straight vs orthogonal)
