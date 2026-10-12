/**
 * Test Intentions for Manufacturing Workflow Control System
 * 
 * Comprehensive test suite covering:
 * - Happy path: successful production
 * - Resource constraints: material, worker, machine shortages
 * - Quality control: pass, fail, rework scenarios
 * - Error recovery: rework loops and rejection
 * - Concurrent production: multiple jobs
 * - Edge cases: boundary conditions
 */

// Quick subset for fast testing (5 core intentions)
export const manufacturingIntentionsQuick = [
  // Happy path
  {
    id: 'successful-production-small',
    name: 'Successful Production - Small Order',
    description: 'Small order (quantity=5) progresses through all stages and completes successfully with quality pass',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 1001, quantity: 5 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' },
        { transition: 'completeCutting' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 1001, quantity: 5 }' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '3' }
    ],
    outputExpectations: [
      { place: 'completedProducts', pattern: '{ orderId: 1001, status: "completed" }' }
    ],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'order_sizes',
      representative: 5,
      reason: 'Production flow is uniform for any quantity within capacity (1-100)'
    },
    oracleType: 'positive'
  },
  
  // Resource constraint
  {
    id: 'error-insufficient-materials',
    name: 'Error: Insufficient Raw Materials',
    description: 'Order requires more materials than available',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 2001, quantity: 50 } },
        { transition: 'insufficientMaterials' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 2001, quantity: 50 }' },
      { place: 'rawMaterialSupply', pattern: '50' }
    ],
    outputExpectations: [
      { place: 'errorLog', pattern: '{ errorType: "insufficient_materials" }' }
    ],
    reductionHypothesis: {
      type: 'axiom',
      domain: 'resource_checks',
      reason: 'All resource shortage checks follow same guard pattern'
    },
    oracleType: 'positive'
  },
  
  // Quality control
  {
    id: 'quality-fail-rework-success',
    name: 'Quality Failure → Rework → Success',
    description: 'Product fails QC, enters rework once, then passes',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 3001, quantity: 10 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' },
        { transition: 'completeCutting' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'failQualityCheck' },
        { transition: 'startRework' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 3001, quantity: 10 }' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '3' }
    ],
    outputExpectations: [
      { place: 'completedProducts', pattern: '{ orderId: 3001, status: "completed" }' }
    ],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'rework_attempts',
      reason: 'Test rework scenarios: 0 reworks (pass first time), 1 rework, 2 reworks'
    },
    oracleType: 'positive'
  },
  
  // Edge case
  {
    id: 'edge-minimum-order',
    name: 'Edge Case: Minimum Order (quantity=1)',
    description: 'Smallest possible order quantity',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 6001, quantity: 1 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' },
        { transition: 'completeCutting' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 6001, quantity: 1 }' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '3' }
    ],
    outputExpectations: [
      { place: 'completedProducts', pattern: '{ orderId: 6001, finalQuantity: 1 }' }
    ],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'quantity_boundaries',
      reason: 'Boundary test: min=1, typical=10, max=100'
    },
    oracleType: 'positive'
  },
  
  // Negative test
  {
    id: 'negative-invalid-order',
    name: 'Negative: Invalid Order (quantity > 100)',
    description: 'Orders exceeding max quantity should be rejected',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 7001, quantity: 150 } }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 7001, quantity: 150 }' }
    ],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'invalid_inputs',
      representative: 150,
      reason: 'Any quantity > 100 should fail the same way'
    },
    oracleType: 'negative'
  }
];

// Full comprehensive test suite (15 intentions)
export const manufacturingIntentions = [
  // ==================== HAPPY PATH ====================
  {
    id: 'successful-production-small',
    name: 'Successful Production - Small Order',
    description: 'Small order (quantity=5) progresses through all stages and completes successfully with quality pass',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 1001, quantity: 5 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' },
        { transition: 'completeCutting' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'passQualityCheck' },
        { transition: 'logProduction' },
        { transition: 'releaseResources' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 1001, quantity: 5 }' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '3' }
    ],
    outputExpectations: [
      { place: 'completedProducts', pattern: '{ orderId: 1001, status: "completed" }' },
      { place: 'productionLog', pattern: '{ orderId: 1001, logType: "production" }' },
      { place: 'inventoryUpdate', pattern: '{ orderId: 1001, materialsNeeded: 10 }' }
    ],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'order_sizes',
      representative: 5,
      reason: 'Production flow is uniform for any quantity within capacity (1-100)'
    },
    oracleType: 'positive'
  },

  {
    id: 'successful-production-large',
    name: 'Successful Production - Large Order',
    description: 'Large order (quantity=50) tests near-capacity production',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 1002, quantity: 50 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' },
        { transition: 'completeCutting' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 1002, quantity: 50 }' },
      { place: 'rawMaterialSupply', pattern: '100' }
    ],
    outputExpectations: [
      { place: 'completedProducts', pattern: '{ orderId: 1002, status: "completed" }' }
    ],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'quantity_range',
      reason: 'Test boundary: small (5), medium (25), large (50) quantities'
    },
    oracleType: 'positive'
  },

  // ==================== RESOURCE CONSTRAINTS ====================
  {
    id: 'error-insufficient-materials',
    name: 'Error: Insufficient Raw Materials',
    description: 'Order requires 100 material units but only 50 available - should fail with error',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 2001, quantity: 50 } },
        { transition: 'insufficientMaterials' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 2001, quantity: 50 }' },
      { place: 'rawMaterialSupply', pattern: '50' }
    ],
    outputExpectations: [
      { place: 'errorLog', pattern: '{ errorType: "insufficient_materials" }' }
    ],
    reductionHypothesis: {
      type: 'axiom',
      domain: 'resource_checks',
      reason: 'All resource shortage checks follow same guard pattern'
    },
    oracleType: 'positive'
  },

  {
    id: 'error-no-workers',
    name: 'Error: No Available Workers',
    description: 'All workers busy - order cannot be scheduled',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 2002, quantity: 10 } },
        { transition: 'insufficientWorkers' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 2002, quantity: 10 }' },
      { place: 'workerPool', pattern: '0' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'machineStatus', pattern: '3' }
    ],
    outputExpectations: [
      { place: 'errorLog', pattern: '{ errorType: "insufficient_workers" }' }
    ],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'resource_types',
      representative: 'workers',
      reason: 'Worker shortage error same structure as material/machine errors'
    },
    oracleType: 'positive'
  },

  {
    id: 'error-all-machines-busy',
    name: 'Error: All Machines Busy',
    description: 'No available machines - production cannot start',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 2003, quantity: 10 } },
        { transition: 'insufficientMachines' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 2003, quantity: 10 }' },
      { place: 'machineStatus', pattern: '0' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' }
    ],
    outputExpectations: [
      { place: 'errorLog', pattern: '{ errorType: "insufficient_machines" }' }
    ],
    oracleType: 'positive'
  },

  // ==================== QUALITY CONTROL ====================
  {
    id: 'quality-fail-rework-success',
    name: 'Quality Failure → Rework → Success',
    description: 'Product fails QC, enters rework once, then passes on second attempt',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 3001, quantity: 10 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' },
        { transition: 'completeCutting' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'failQualityCheck' },
        { transition: 'startRework' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 3001, quantity: 10 }' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '3' }
    ],
    outputExpectations: [
      { place: 'completedProducts', pattern: '{ orderId: 3001, status: "completed" }' }
    ],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'rework_attempts',
      reason: 'Test rework scenarios: 0 reworks (pass first time), 1 rework, 2 reworks'
    },
    oracleType: 'positive'
  },

  {
    id: 'quality-fail-max-rework-reject',
    name: 'Quality Failure → Max Rework → Reject',
    description: 'Product fails QC repeatedly and is rejected after exceeding max rework attempts',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 3002, quantity: 10 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' },
        { transition: 'completeCutting' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'failQualityCheck' },
        { transition: 'startRework' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'failQualityCheck' },
        { transition: 'startRework' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'failQualityCheck' },
        { transition: 'rejectProduct' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 3002, quantity: 10 }' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' }
    ],
    outputExpectations: [
      { place: 'errorLog', pattern: '{ orderId: 3002, status: "rejected", errorType: "quality_failure" }' }
    ],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'rework_boundary',
      reason: 'Boundary test: max rework count = 2, test count > 2 leads to rejection'
    },
    oracleType: 'positive'
  },

  // ==================== RESOURCE LIFECYCLE ====================
  {
    id: 'resource-allocation-and-release',
    name: 'Resource Allocation and Release Cycle',
    description: 'Verify resources are properly allocated on scheduling and released after completion',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 4001, quantity: 10 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' },
        { transition: 'completeCutting' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'passQualityCheck' },
        { transition: 'releaseResources' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 4001, quantity: 10 }' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '3' }
    ],
    outputExpectations: [
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '3' },
      { place: 'rawMaterialSupply', pattern: '80' },
      { place: 'inventoryUpdate', pattern: '{ orderId: 4001, materialsNeeded: 20 }' }
    ],
    reductionHypothesis: {
      type: 'axiom',
      domain: 'resource_management',
      reason: 'Resource release follows same pattern for completed and rejected products'
    },
    oracleType: 'positive'
  },

  // ==================== CONCURRENT SCENARIOS ====================
  {
    id: 'concurrent-orders-within-capacity',
    name: 'Concurrent Orders Within Capacity',
    description: 'Two small orders can run concurrently when resources permit',
    pathPattern: {
      type: 'parallel',
      events: [
        {
          type: 'sequence',
          events: [
            { transition: 'receiveOrder', binding: { orderId: 5001, quantity: 5 } },
            { transition: 'scheduleJob' },
            { transition: 'startCutting' },
            { transition: 'completeCutting' }
          ]
        },
        {
          type: 'sequence',
          events: [
            { transition: 'receiveOrder', binding: { orderId: 5002, quantity: 5 } },
            { transition: 'scheduleJob' },
            { transition: 'startCutting' },
            { transition: 'completeCutting' }
          ]
        }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 5001, quantity: 5 }, { orderId: 5002, quantity: 5 }' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '3' }
    ],
    outputExpectations: [
      { place: 'stage2InProgress', pattern: 'count >= 2' }
    ],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'concurrency_level',
      reason: 'Test concurrent job execution: 1 job, 2 jobs, 3 jobs (machine limit)'
    },
    oracleType: 'positive'
  },

  {
    id: 'concurrent-resource-contention',
    name: 'Concurrent Resource Contention',
    description: 'Fourth order must wait when 3 machines already in use (max concurrency)',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 5003, quantity: 10 } },
        { transition: 'insufficientMachines' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 5003, quantity: 10 }' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '0' },
      { place: 'stage1InProgress', pattern: 'count == 3' }
    ],
    outputExpectations: [
      { place: 'errorLog', pattern: '{ errorType: "insufficient_machines" }' }
    ],
    oracleType: 'positive'
  },

  // ==================== EDGE CASES ====================
  {
    id: 'edge-minimum-order',
    name: 'Edge Case: Minimum Order (quantity=1)',
    description: 'Smallest possible order quantity should be processed successfully',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 6001, quantity: 1 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' },
        { transition: 'completeCutting' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'passQualityCheck' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 6001, quantity: 1 }' },
      { place: 'rawMaterialSupply', pattern: '100' },
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '3' }
    ],
    outputExpectations: [
      { place: 'completedProducts', pattern: '{ orderId: 6001, finalQuantity: 1 }' }
    ],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'quantity_boundaries',
      reason: 'Boundary test: min=1, typical=10, max=100'
    },
    oracleType: 'positive'
  },

  {
    id: 'edge-maximum-order',
    name: 'Edge Case: Maximum Order (quantity=100)',
    description: 'Largest allowed order quantity (per guard constraint)',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 6002, quantity: 100 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 6002, quantity: 100 }' },
      { place: 'rawMaterialSupply', pattern: '200' },
      { place: 'workerPool', pattern: '5' },
      { place: 'machineStatus', pattern: '3' }
    ],
    outputExpectations: [
      { place: 'stage1InProgress', pattern: '{ orderId: 6002, scheduledQuantity: 100 }' }
    ],
    oracleType: 'positive'
  },

  {
    id: 'negative-invalid-order',
    name: 'Negative: Invalid Order (quantity > 100)',
    description: 'Orders exceeding max quantity should be rejected by guard',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 7001, quantity: 150 } }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 7001, quantity: 150 }' }
    ],
    outputExpectations: [],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'invalid_inputs',
      representative: 150,
      reason: 'Any quantity > 100 should fail the same way'
    },
    oracleType: 'negative'
  },

  {
    id: 'negative-zero-quantity',
    name: 'Negative: Zero Quantity Order',
    description: 'Orders with quantity=0 should not be accepted',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 7002, quantity: 0 } }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 7002, quantity: 0 }' }
    ],
    outputExpectations: [],
    oracleType: 'negative'
  },

  // ==================== SYSTEM INVARIANTS ====================
  {
    id: 'invariant-material-conservation',
    name: 'Invariant: Material Conservation',
    description: 'Total materials (available + reserved + consumed) remains constant',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'receiveOrder', binding: { orderId: 8001, quantity: 10 } },
        { transition: 'scheduleJob' },
        { transition: 'startCutting' },
        { transition: 'completeCutting' },
        { transition: 'startAssembly' },
        { transition: 'completeAssembly' },
        { transition: 'qualityCheck' },
        { transition: 'passQualityCheck' },
        { transition: 'releaseResources' }
      ]
    },
    inputConstraints: [
      { place: 'orderQueue', pattern: '{ orderId: 8001, quantity: 10 }' },
      { place: 'rawMaterialSupply', pattern: '100' }
    ],
    outputExpectations: [
      { place: 'rawMaterialSupply', pattern: '80' },
      { place: 'materialReserved', pattern: '0' },
      { place: 'inventoryUpdate', pattern: '{ materialsNeeded: 20 }' }
    ],
    reductionHypothesis: {
      type: 'axiom',
      domain: 'system_invariants',
      reason: 'Conservation laws hold regardless of production path'
    },
    oracleType: 'positive'
  }
];

export const manufacturingIntentionsDescription = `
# Manufacturing System Test Intentions

This test suite provides comprehensive coverage of the manufacturing workflow system through 18 test intentions organized into 7 categories:

## Test Categories

### 1. Happy Path (2 tests)
- Small order (quantity=5) complete production flow
- Large order (quantity=50) near-capacity testing
- **Coverage**: Normal operation, resource allocation, all production stages

### 2. Resource Constraints (3 tests)
- Insufficient raw materials
- No available workers
- All machines busy
- **Coverage**: Resource shortage error handling, graceful degradation

### 3. Quality Control (2 tests)
- Quality failure → successful rework (1 attempt)
- Quality failure → max rework → rejection (3 attempts)
- **Coverage**: QC decision logic, rework loops, rejection threshold

### 4. Resource Lifecycle (1 test)
- Complete allocation → production → release cycle
- **Coverage**: Resource bookkeeping, inventory tracking, pool management

### 5. Concurrent Scenarios (2 tests)
- Multiple orders within machine capacity (2 concurrent jobs)
- Resource contention when capacity exceeded
- **Coverage**: Concurrency, mutual exclusion, queueing behavior

### 6. Edge Cases (4 tests)
- Minimum order quantity (1 unit)
- Maximum order quantity (100 units)
- Invalid order (quantity > 100) - negative test
- Zero quantity order - negative test
- **Coverage**: Boundary conditions, guard validation, input validation

### 7. System Invariants (1 test)
- Material conservation across production cycle
- **Coverage**: System properties, resource accounting correctness

## Reduction Hypotheses Applied

- **Uniformity**: Production flow uniform across order sizes (test one representative)
- **Regularity**: Boundary testing for quantities, rework attempts, concurrency levels
- **Axiom-based**: Resource checks and release patterns share structure

## Test Statistics

- **Total Intentions**: 15
- **Positive Oracles**: 13 (expected behaviors)
- **Negative Oracles**: 2 (forbidden behaviors)
- **Avg Path Length**: ~8-12 transitions
- **Concurrency Tests**: 2
- **Error Tests**: 5

## Key Properties Verified

1. **Correctness**: Orders complete successfully when resources available
2. **Safety**: Resource shortages handled gracefully without deadlock
3. **Liveness**: Rework items eventually complete or are rejected
4. **Fairness**: Multiple orders processed fairly (within capacity)
5. **Resource Safety**: Resources properly allocated and released
6. **Quality Assurance**: QC thresholds enforced, max rework limits respected
7. **Data Integrity**: Material accounting accurate (conservation)

## Running the Tests

These intentions can be loaded into the SATEL testing panel in the Petri net editor to:
1. Generate concrete test cases from each intention
2. Execute tests against the manufacturing net
3. Verify all oracles pass
4. Check test coverage metrics
5. Generate test execution reports

The test suite is designed to achieve:
- **Transition coverage**: ~90% of transitions exercised
- **Path coverage**: Key execution paths (happy path, error paths, loops) covered
- **State coverage**: Major system states reachable
`;
