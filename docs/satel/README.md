# SATEL for Algebraic Petri Nets

Implementation of SATEL (Semi-Automatic Testing Language) for algebraic Petri nets with ADT-typed tokens.

## 🌐 Live Demo

**Main Editor:** [https://levilucio.github.io/Browser-Petri-Net-Editor/](https://levilucio.github.io/Browser-Petri-Net-Editor/)  
**SATEL Demo:** [https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html](https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html)

## Quick Start

### 1. Load an Example
- Open the editor and switch to **Algebraic mode**
- Click **Examples** → **Manufacturing Workflow (SATEL)**

### 2. Open SATEL Panel
- Click the **SATEL Testing** button in the toolbar
- View the loaded test intentions in the **Intentions** tab

### 3. Generate Tests
- Click **Generate Test Suite**
- View results in the **Results** tab
- See generated test cases with expected traces and execution outcomes

## Key Concepts

### Test Intentions (V2 Format)

Test intentions specify **what to test** rather than **how to test it**. Each intention defines:

**Variables:** Typed parameters with instantiation hypotheses
- **Uniformity:** Single representative value
- **Subuniformity:** One representative per equivalence class (partitioned by path conditions)
- **Regularity:** Bounded enumeration

**Stimulation/Observation Pairs:** HML-style sequences
- **Stimulation:** Transition to fire with input token injection
- **Observation:** Expected outputs and marking assertions

**Example:**
```javascript
{
  id: 'job-lifecycle',
  name: 'Complete Job Lifecycle',
  variables: [
    {
      name: 'priority',
      sort: 'Priority',
      hypothesis: {
        type: 'subuniformity',
        source: 'path-conditions'  // Partition by guards along paths
      }
    }
  ],
  pairs: [
    { stimulation: { transition: 'scheduleJob', ... }, observation: {...} },
    { stimulation: { transition: 'startStage1', ... }, observation: {...} },
    { stimulation: { transition: 'qualityCheckPass', ... }, observation: {...} }
  ]
}
```

### Path-Condition Subuniformity

Partitions variable domains so each equivalence class drives a **different transition sequence**:

**Manufacturing Priority Example:**
- High → qualityCheckPass (complete)
- Normal → qualityCheckFail (rework)
- Low → neither QC fires (stuck)

Guards from intention pairs determine partitions:
- `priority(order(job)) == High()` → High constructor
- `priority(order(job)) == Normal()` → Normal constructor
- Residual → Low constructor

Each subdomain follows a distinct execution path.

### Multi-Step Intentions

Chain multiple stimulations to test workflows:

**Manufacturing:**
- Job Lifecycle (5-6 transitions): order → schedule → stage1 → stage2 → stage3 → QC
- Rework Cycle (9 transitions): full cycle through fail → rework → pass
- Material Contention (2-4 transitions): concurrent jobs competing for resources

**Banking:**
- Deposit-Withdraw-Check (4 transitions): login → deposit → withdraw → check
- Failed Withdraw Retry (5 transitions): withdraw fail → deposit → withdraw success
- Multiple Deposits (5 transitions): accumulation + large withdraw

## Test Generation

**Input:** Intentions + Petri net + ADT definitions  
**Output:** Concrete test cases with expected traces

**Process:**
1. Instantiate variables per hypotheses
2. Cartesian product of instantiations
3. Filter by joint guards
4. Build expected traces from pairs
5. Execute and check oracles

## Examples

**Manufacturing Workflow:**
- 12 V2 intentions (3 multi-step)
- Tests order processing, production stages, quality control, rework
- ADT types: Order, Priority, Material, Job, Product

**Banking Operations:**
- 4 multi-step intentions
- Tests deposits, withdrawals, balance checks, overdraft protection
- Guards ensure account balance constraints

## Technical Details

**Architecture:**
- `TestGenerator.js` — Main generation logic
- `VariableInstantiator.js` — Hypothesis → ground terms
- `PathConditionPartitioner.js` — Path-condition-based subuniformity
- `ObservationChecker.js` — Oracle execution
- `TestExecutor.js` — V2 pair execution with token chaining

**Test Statistics (Manufacturing):**
- 11+ test cases from 12 intentions
- 15 states explored across test suite
- Path lengths: 1-9 transitions per test
- Average 3.5 transitions per multi-step test

**Key Fix (Oct 2026):**
- Bug: All tests showed "Path: 0 transitions"
- Root cause: `maxStates: 0` forced only initial state exploration
- Fix: Use `disableGraphCaching: true` + build traces from pairs
- Result: Correct path lengths and state counts ✓

## Testing

**Run Tests:**
```bash
cd petri-net-app
npm test src/satel
```

**Test Coverage:**
- Unit tests: Variable instantiation, path partitioning, ADT validation
- Integration tests: Full generation for multi-step intentions
- E2E tests: UI Generate button with screenshot verification

**Assertions:**
- Distinct paths per subdomain
- Path lengths ≥ 3 for lifecycle intentions
- Average path length ≥ 4 for multi-step suites
- 50%+ of tests have path length ≥ 3

## Documentation

- **[DESIGN.md](./DESIGN.md)** — Technical design and implementation details
- **[Demo Video](../assets/satel-v2-demo.mp4)** — Visual walkthrough (55s)
- **[Original Thesis](https://archive-ouverte.unige.ch/unige:13068)** — PhD thesis by Levi Lucio (2009)

## References

Levi Lucio. *SATEL — A Test Intention Language for Object-Oriented Specifications of Reactive Systems*. PhD Thesis, University of Geneva, 2009. [UNIGE Archive](https://archive-ouverte.unige.ch/unige:13068)
