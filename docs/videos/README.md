# SATEL Demo Videos

This directory contains screen-capture demonstrations of the SATEL implementation for algebraic Petri nets.

## Videos

### 1. satel-demo-overview.mp4
**Duration**: ~2-3 minutes  
**Content**: Overview of SATEL concepts, live demo page walkthrough

**Shows**:
- SATEL overview (test intentions, I/O interface, reduction hypotheses)
- Drink vending machine example explanation
- HML-style event sequences
- Reduction strategies (uniformity, regularity, axiom-based)
- Links to documentation and source code

### 2. satel-io-marking.mp4
**Duration**: ~1-2 minutes  
**Content**: Marking places and transitions as inputs/outputs in an APN

**Shows**:
- Opening an APN example (drink vending machine)
- Identifying input elements (coinSlot, selection places; insertCoin, selectDrink transitions)
- Identifying output elements (dispensed, change, errorMsg places; dispense* transitions)
- Programmatic I/O marking via API
- Interface extraction and validation

### 3. satel-test-generation.mp4
**Duration**: ~2-3 minutes  
**Content**: Writing and running test intentions, viewing generated tests and oracles

**Shows**:
- Test intention structure (path pattern, constraints, expectations, reduction)
- Running test generation for drink vending machine
- Generated test cases with HML formulas
- Oracles (positive/negative, expected outputs, invariants)
- Test execution results (pass/fail)
- Reduction statistics (e.g., 12 cases → 6 after uniformity/regularity)

## Technical Notes

Videos were created using browser-based screen recording to demonstrate the live SATEL demo page and programmatic API usage via browser console.

## Alternative Hosting

If videos are too large for git, they can be:
1. Hosted on GitHub Releases
2. Uploaded to YouTube (unlisted)
3. Stored in cloud storage with public links

For this implementation, videos are committed directly to the repository under docs/videos/.
