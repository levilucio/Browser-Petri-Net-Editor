# SATEL Testing Demo Script

## Overview
This script describes a demonstration of the SATEL (Semi-Automatic Testing Language) features integrated into the Browser Petri Net Editor.

**Duration**: 2-3 minutes  
**Audience**: Users interested in testing algebraic Petri nets  
**Goal**: Showcase the complete workflow from creating test intentions to executing tests

---

## Demo Script

### Scene 1: Opening the Editor (0:00 - 0:15)
**Actions**:
1. Open browser to `http://localhost:3000`
2. Show the main editor interface with toolbar, canvas, and side panels
3. Briefly pan across the interface to orient viewers

**Narration**:
> "Welcome to the Browser Petri Net Editor with integrated SATEL testing capabilities. This tool allows you to design and test algebraic Petri nets directly in your browser."

---

### Scene 2: Loading the Manufacturing Example (0:15 - 0:45)
**Actions**:
1. Click **File** → **Examples** in toolbar
2. Select the **Manufacturing Workflow** example
3. Zoom out to show the complete net structure
4. Highlight key areas:
   - Input places (orderQueue, rawMaterialSupply, workerPool)
   - Production stages (Cutting, Assembly, Quality Check)
   - Output places (completedProducts, errorLog)

**Narration**:
> "We'll demonstrate SATEL using a production-grade manufacturing workflow system. This algebraic Petri net models a multi-stage production line with resource management, quality control, and error handling - much more complex than typical tutorial examples."

---

### Scene 3: Opening SATEL Panel (0:45 - 1:00)
**Actions**:
1. Click the **SATEL** button in the toolbar (top, in Testing section)
2. The SATEL panel slides in from the right side
3. Show the three main tabs:
   - Test Intentions
   - I/O Interface
   - Results

**Narration**:
> "The SATEL panel integrates seamlessly into the editor. It provides three main views: test intentions, I/O interface inspection, and test results."

---

### Scene 4: I/O Interface Tab (1:00 - 1:20)
**Actions**:
1. Click the **I/O Interface** tab
2. Scroll through the interface validation
3. Show sections:
   - Validation status (✓ valid)
   - Input Places (3 marked): orderQueue, rawMaterialSupply, workerPool
   - Output Places (3 marked): completedProducts, productionLog, errorLog
   - Input Transitions (1): receiveOrder
   - Output Transitions (3): passQualityCheck, rejectProduct, logProduction

**Narration**:
> "The I/O Interface tab shows which places and transitions are marked as inputs and outputs. This defines the system's interface with its environment - what we can control (stimulate) and what we can observe."

---

### Scene 5: Test Intentions Tab - Viewing (1:20 - 1:40)
**Actions**:
1. Click the **Test Intentions** tab
2. Show the list of pre-loaded test intentions (15 total)
3. Click on "Successful Production - Small Order" intention
4. Highlight the details:
   - Name and description
   - Oracle type (positive)
   - Event count (10 events)
   - Input/output constraints

**Narration**:
> "Test intentions specify high-level behaviors to test. This 'happy path' intention tests a small order flowing through all production stages to successful completion."

---

### Scene 6: Test Intentions Tab - Editing (1:40 - 2:00)
**Actions**:
1. Click **Edit** on the selected intention
2. Show the editing form:
   - Name field
   - Description textarea
   - Oracle type dropdown (positive/negative)
   - Event sequence editor with transition dropdowns
   - Add/remove event buttons
3. Click **Cancel** (don't save changes)

**Narration**:
> "You can create and edit test intentions using a simple form. Define the sequence of transitions that should fire, along with expected inputs and outputs."

---

### Scene 7: Creating a New Intention (2:00 - 2:20)
**Actions**:
1. Click **+ Create Test Intention**
2. Fill in basic fields:
   - Name: "Demo: Quick Quality Check"
   - Description: "Simplified quality check test"
   - Oracle Type: Positive
3. Add 3 events to sequence:
   - scheduleJob
   - startCutting
   - completeCutting
4. Click **Save**

**Narration**:
> "Creating a new test intention is straightforward. Name it, describe what it tests, choose whether it's a positive (expected) or negative (forbidden) behavior, and define the event sequence."

---

### Scene 8: Generating Test Suite (2:20 - 2:35)
**Actions**:
1. Click **Generate Test Suite** button at bottom of panel
2. Show "Generating..." state
3. Wait for generation to complete
4. Automatically switch to Results tab
5. Show test suite statistics:
   - Test Cases Generated: 16
   - Test Intentions: 16 (15 original + 1 new)
   - States Explored: ~450
   - Reduction Applied: Yes

**Narration**:
> "SATEL automatically generates concrete test cases from your high-level intentions. It explores the reachability graph and applies reduction hypotheses to create an effective test suite."

---

### Scene 9: Executing Tests (2:35 - 2:50)
**Actions**:
1. Click **Execute Tests** button
2. Show "Executing..." state with progress
3. Display execution results:
   - Total Tests: 16
   - Passed: 14 ✓
   - Failed: 0
   - Errors: 2
4. Show the "All tests passed!" banner
5. Scroll through individual test case results (Pass/Fail badges)

**Narration**:
> "Execute the generated tests against the Petri net simulator. SATEL validates that actual behavior matches the expected oracles defined in your test intentions."

---

### Scene 10: Exploring Test Details (2:50 - 3:05)
**Actions**:
1. Scroll through the test cases list
2. Show a passing test case with details:
   - Test number
   - Associated intention
   - Path length
   - PASS badge
3. Show a test with errors:
   - Error message
   - Expected vs. actual
4. Switch back to Test Intentions tab to show the cycle

**Narration**:
> "Each test result links back to its intention. You can inspect which paths were taken, what assertions passed or failed, and iteratively refine your test suite."

---

### Scene 11: Closing Summary (3:05 - 3:15)
**Actions**:
1. Close the SATEL panel by clicking the X
2. Show the editor with the manufacturing net still loaded
3. Quick pan across the net one more time

**Narration**:
> "SATEL provides a complete testing workflow - from defining high-level test intentions to executing concrete test cases - all integrated seamlessly into the Petri net editor. Try it yourself at github.com/levilucio/Browser-Petri-Net-Editor."

---

## Key Takeaways for Viewers

After watching this demo, viewers should understand:

1. **Integration**: SATEL is integrated into the main editor, not a separate tool
2. **I/O Interface**: The importance of marking inputs/outputs to define the testable interface
3. **Test Intentions**: High-level, declarative way to specify behaviors to test
4. **Automatic Generation**: Test cases are generated automatically from intentions
5. **Execution**: Tests run against the actual simulator with pass/fail validation
6. **Iteration**: The workflow supports iterative refinement of tests

---

## Technical Notes for Recording

### Recording Setup
- **Resolution**: 1920x1080 (1080p)
- **Frame Rate**: 30 fps
- **Format**: MP4 (H.264)
- **Duration**: ~3 minutes

### UI Focus Points
- Toolbar: SATEL button clearly visible
- Panel: Full width of panel visible, tabs legible
- Canvas: Zoom level that shows net structure clearly
- Text: All UI text must be readable at 1080p

### Transitions
- Smooth cursor movements
- Pause briefly on key information (1-2 seconds)
- Use subtle zoom for emphasis on complex areas
- Fade or cut cleanly between major sections

### Audio (if narrated)
- Clear voiceover or on-screen captions
- Background music optional, subtle if used
- Sound effects for clicks/transitions optional

---

## Alternate Quick Demo (30 seconds)

For a rapid overview:

1. **Load Example** (5s): Open manufacturing net
2. **Open SATEL** (3s): Click SATEL button
3. **Show Intentions** (7s): Scroll through 15 test intentions list
4. **Generate** (5s): Click Generate, show count
5. **Execute** (5s): Click Execute, show green "All passed"
6. **Results** (5s): Quick scroll through test case list

**Narration**:
> "SATEL testing in 30 seconds: Load a net, open the SATEL panel, define test intentions, generate test cases, execute, and verify results. Complete testing workflow integrated into the editor."

---

## File Locations

- **Live Demo**: https://levilucio.github.io/Browser-Petri-Net-Editor/
- **Standalone Demo Page**: https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html
- **Repository**: https://github.com/levilucio/Browser-Petri-Net-Editor
- **Branch**: `cursor/satel-apn-testing-eaea`
- **Manufacturing Example**: `petri-net-app/src/satel/examples/manufacturing/`

---

## Follow-up Actions After Demo

Suggested next steps to show viewers:

1. Clone the repository
2. Install dependencies (`npm install`)
3. Run locally (`npm run dev`)
4. Load the manufacturing example
5. Try creating their own test intentions
6. Explore other examples (drink vending, banking)
7. Read the detailed documentation in SATEL_README.md

---

## Common Issues & Troubleshooting

### If test generation fails:
- Check that the net is in Algebraic mode (Settings → Net Mode)
- Verify I/O interface is valid (I/O Interface tab)
- Ensure transition IDs in intentions match actual transitions

### If tests fail unexpectedly:
- Review the error messages in test results
- Check guards on transitions (may block execution)
- Verify input constraints match initial marking

### If SATEL button is not visible:
- Ensure you're in Algebraic mode (SATEL only works with algebraic nets)
- Check toolbar Settings section

---

## Credits

- **SATEL Theory**: Based on Levi Lucio's PhD thesis (University of Geneva, 2009)
- **Implementation**: Cursor Cloud Agent (2026)
- **Petri Net Editor**: Browser-based editor with React + Konva
- **Example System**: Manufacturing workflow designed for realistic testing scenarios
