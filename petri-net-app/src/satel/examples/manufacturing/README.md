

# Manufacturing Workflow Control System

A production-grade algebraic Petri net example modeling a realistic manufacturing line with resource management, quality control, and error handling.

## Overview

This example demonstrates how algebraic Petri nets can model complex industrial control systems with:

- **Multi-stage production pipeline** (Cutting → Assembly → Quality Check)
- **Dynamic resource allocation** (materials, workers, machines)
- **Quality control with rework loops**
- **Comprehensive error handling**
- **Concurrent job execution**
- **Resource lifecycle management**
- **Production and error logging**

Unlike the simpler drink vending machine example, this system exhibits:
- Multiple concurrent resource dependencies
- State-dependent transitions
- Feedback loops (rework)
- Complex guard expressions
- Rich typed token structures

## System Architecture

### Resources

#### Raw Materials
- Initial supply: 100 units
- Consumption rate: 2 units per product
- Dynamically allocated when jobs are scheduled
- Tracked via `inventoryUpdate` output

#### Workers
- Pool size: 5 workers
- Assignment: 1 worker per job
- Released after job completion/rejection
- Contention handled via scheduling logic

#### Machines
- Available: 3 machines
- Limit: Max 3 concurrent jobs
- Jobs queue when all machines busy
- Resources released after completion

### Production Stages

#### Stage 1: Cutting
- **Input**: Scheduled job with allocated resources
- **Process**: Raw materials cut to specification
- **Output**: Semi-finished parts ready for assembly
- **Duration**: Modeled by single transition firing

#### Stage 2: Assembly
- **Input**: Cut parts from stage 1 OR reworked items
- **Process**: Components assembled into products
- **Output**: Finished products ready for inspection
- **Note**: Re-entrant for rework loop

#### Stage 3: Quality Check
- **Input**: Assembled products
- **Process**: Quality score computed (simulated: 95)
- **Outcomes**:
  - **Pass** (score ≥ 90): → Completed products
  - **Fail** (score < 90): → Rework queue
- **Rework Policy**:
  - Max 2 rework attempts allowed
  - After 2nd failure: → Rejection

### State Flow

```
┌─────────────┐
│ Order Queue │
└──────┬──────┘
       │ receiveOrder
       ↓
┌─────────────────┐      Resources Available?
│ Scheduled Jobs  │────────→ YES: scheduleJob
└────────┬────────┘         NO: → Error (insufficient_X)
         │
         ↓ startCutting
   ┌────────────┐
   │ Stage 1:   │
   │  Cutting   │
   └─────┬──────┘
         │ completeCutting
         ↓ startAssembly
   ┌────────────┐
   │ Stage 2:   │◄─────┐
   │ Assembly   │      │ startRework (if reworkCount ≤ 2)
   └─────┬──────┘      │
         │ completeAssembly
         ↓ qualityCheck
   ┌────────────┐      │
   │ Stage 3:   │      │
   │  Quality   │      │
   │   Check    │      │
   └─────┬──────┘      │
         │             │
    ┌────┴─────┐       │
    │          │       │
    ↓          ↓       │
  PASS       FAIL      │
    │          │       │
    │          ├───────┘ (reworkCount ≤ 2)
    │          │
    │          └────────→ REJECT (reworkCount > 2)
    │                         │
    ↓                         ↓
┌──────────────┐      ┌─────────────┐
│ Completed    │      │ Error Log   │
│ Products     │      │ (rejected)  │
└──────┬───────┘      └──────┬──────┘
       │                     │
       └─────────┬───────────┘
                 ↓
         releaseResources
```

### Token Types

#### Order Token
```javascript
{
  orderId: number,      // Unique order identifier
  quantity: number      // Number of units to produce
}
```

#### Job Token
```javascript
{
  orderId: number,
  scheduledQuantity: number,
  stage: number,            // 1=cutting, 2=assembly, 3=QC
  progress: number,         // 0-100 completion percentage
  status: string           // "in_progress" | "completed" | "rework" | "rejected"
}
```

#### Resource Token
```javascript
{
  materials: number,       // Available material units
  workers: number,         // Available worker count
  machines: number        // Available machine count
}
```

#### Quality Token
```javascript
{
  qualityScore: number,    // 0-100 quality rating
  reworkCount: number      // Number of rework attempts
}
```

#### Log Token
```javascript
{
  orderId: number,
  logType: string,         // "production" | "error"
  timestamp: number,       // Unix timestamp
  errorType?: string,      // For error logs
  errorMessage?: string    // Human-readable error
}
```

## Guard Conditions

### Order Validation
```javascript
orderId > 0 && quantity > 0 && quantity <= 100
```
Ensures valid order IDs and quantity within capacity limits.

### Resource Availability
```javascript
quantity > 0 && 
materials >= quantity * 2 &&    // 2 units per product
workers >= 1 &&                 // 1 worker per job
machines >= 1                   // 1 machine per job
```
Checks all resources before scheduling.

### Quality Pass/Fail
```javascript
// Pass
stage == 3 && qualityScore >= 90

// Fail (rework eligible)
stage == 3 && qualityScore < 90

// Fail (reject)
status == "rework" && reworkCount > 2
```

### Rework Eligibility
```javascript
status == "rework" && reworkCount <= 2
```
Limits rework attempts to prevent infinite loops.

## Error Handling

### Insufficient Materials
- **Trigger**: `materials < quantity * 2`
- **Action**: Emit error log
- **Behavior**: Order remains in queue, materials unchanged
- **Recovery**: Wait for material resupply or cancel order

### Insufficient Workers
- **Trigger**: `workers < 1`
- **Action**: Emit error log
- **Behavior**: Order queued, workers unchanged
- **Recovery**: Wait for worker availability

### Insufficient Machines
- **Trigger**: `machines < 1`
- **Action**: Emit error log
- **Behavior**: Order queued
- **Recovery**: Wait for job completion to free machines

### Quality Rejection
- **Trigger**: `reworkCount > 2 && qualityScore < 90`
- **Action**: Move to error log, release resources
- **Behavior**: Terminal state for that order
- **Recovery**: None (order lost)

## Example Scenarios

### Scenario 1: Successful Small Order
**Initial State**:
- Materials: 100
- Workers: 5
- Machines: 3

**Order**: orderId=1001, quantity=5

**Execution**:
1. Order received → Scheduled
2. Resources allocated: -10 materials, -1 worker, -1 machine
3. Cutting stage (stage=1) → Assembly (stage=2) → QC (stage=3)
4. Quality check: score=95 → PASS
5. Resources released: +1 worker, +1 machine
6. Output: Completed product, production log, inventory update (-10 materials)

**Final State**:
- Materials: 90 (consumed 10)
- Workers: 5 (released)
- Machines: 3 (released)
- Completed: 1 order

### Scenario 2: Quality Failure with Rework
**Order**: orderId=2001, quantity=10

**Execution**:
1-3. (Same as Scenario 1)
4. Quality check: score=85 → FAIL (reworkCount=1)
5. → Rework queue
6. Start rework → Assembly (stage=2)
7. Complete assembly → QC (stage=3)
8. Quality check: score=92 → PASS
9. Resources released
10. Output: Completed product (after 1 rework)

### Scenario 3: Maximum Rework Exceeded
**Order**: orderId=3001, quantity=20

**Execution**:
1-4. (Same as Scenario 2)
5-7. First rework → QC: score=88 → FAIL (reworkCount=2)
8-10. Second rework → QC: score=87 → FAIL (reworkCount=3)
11. reworkCount > 2 → REJECT
12. Resources released
13. Output: Error log (status="rejected", errorType="quality_failure")

### Scenario 4: Concurrent Jobs at Capacity
**Orders**: 
- Order A: quantity=10
- Order B: quantity=15
- Order C: quantity=20
- Order D: quantity=5 (4th order)

**Execution**:
1. Orders A, B, C scheduled (3 machines allocated)
2. Order D attempted → ERROR: insufficient_machines
3. Order A completes → machine released
4. Order D scheduled → proceeds

**Demonstrates**: Machine contention and queueing behavior.

## SATEL Test Intentions

The accompanying test suite (`intentions.js`) provides 15 comprehensive test intentions covering:

### Coverage Categories
1. **Happy Path** (2 tests): Successful production flows
2. **Resource Constraints** (3 tests): Material, worker, machine shortages
3. **Quality Control** (2 tests): Pass, fail, rework, rejection paths
4. **Resource Lifecycle** (1 test): Allocation and release correctness
5. **Concurrency** (2 tests): Multi-job execution and contention
6. **Edge Cases** (4 tests): Min/max quantities, invalid inputs
7. **Invariants** (1 test): Material conservation

### Key Test Intentions

#### `successful-production-small`
- **Path**: receiveOrder → schedule → cut → assemble → QC → pass → complete
- **Verifies**: Complete production flow with all stages
- **Reduction**: Uniformity (any valid quantity behaves the same)

#### `error-insufficient-materials`
- **Path**: receiveOrder → insufficientMaterials
- **Verifies**: Material shortage handled gracefully
- **Reduction**: Axiom-based (all resource checks similar)

#### `quality-fail-rework-success`
- **Path**: (production) → QC fail → rework → QC pass
- **Verifies**: Rework loop correctness
- **Reduction**: Regularity (0, 1, 2 rework attempts)

#### `concurrent-resource-contention`
- **Path**: (3 jobs running) → 4th job → insufficientMachines
- **Verifies**: Concurrency limits enforced
- **Reduction**: Regularity (1, 2, 3 concurrent jobs)

## Integration with SATEL

This example is designed for the integrated SATEL testing panel:

1. **Load the net**: Import `manufacturingNet` into editor
2. **Mark I/O**: Places and transitions already marked (io_type)
3. **Load intentions**: Import `manufacturingIntentions`
4. **Generate tests**: SATEL creates concrete test cases
5. **Execute**: Run tests against the simulator
6. **Verify**: Check all oracles pass (expected: 13 pass, 2 negative verified)

## Comparison to Drink Vending Example

| Aspect | Drink Vending | Manufacturing |
|--------|---------------|---------------|
| **Complexity** | Simple (6 places, 6 transitions) | Complex (16 places, 18 transitions) |
| **Resources** | Single (coin balance) | Multiple (materials, workers, machines) |
| **Stages** | 2 (select, dispense) | 3 (cut, assemble, QC) |
| **Loops** | None | Rework loop (up to 2 iterations) |
| **Concurrency** | Single customer | Multiple jobs (up to 3 concurrent) |
| **Error Handling** | 2 error types | 4 error types + rejection |
| **State Depth** | Shallow (2-3 transitions) | Deep (8-12 transitions) |
| **Realism** | Tutorial | Production-grade |

## Educational Value

This example teaches:

1. **Resource Management**: How to model limited resources in concurrent systems
2. **State Machines**: Multi-stage workflows with stage tracking
3. **Feedback Loops**: Rework patterns with termination conditions
4. **Error Propagation**: Graceful degradation and error recovery
5. **Invariant Checking**: Conservation laws (materials)
6. **Concurrency**: Mutual exclusion, contention, fairness
7. **Quality Assurance**: Inspection points, acceptance criteria
8. **System Integration**: Multiple subsystems (scheduling, production, logging)

## Future Extensions

Possible enhancements:
- **Maintenance**: Machine downtime and repair cycles
- **Priority Scheduling**: Rush orders vs. standard orders
- **Cost Tracking**: Material costs, labor costs
- **Batch Processing**: Multiple products per job
- **Supply Chain**: Multi-tier material sourcing
- **Predictive QC**: Quality scores based on process parameters
- **Performance Metrics**: Throughput, cycle time, utilization

## References

- Petri, C. A. (1962). "Kommunikation mit Automaten"
- Reisig, W. (2013). "Understanding Petri Nets: Modeling Techniques"
- Jensen, K. (1997). "Coloured Petri Nets: Basic Concepts, Analysis Methods"
- This example inspired by real manufacturing execution systems (MES)

## License

MIT (same as parent project)
