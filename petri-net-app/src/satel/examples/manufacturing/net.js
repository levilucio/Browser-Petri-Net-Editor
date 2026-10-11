/**
 * Manufacturing Workflow Control System
 * 
 * A production-grade example modeling a manufacturing line with:
 * - Order intake and job scheduling
 * - Resource allocation (machines, materials, workers)
 * - Quality control checkpoints
 * - Error handling and rework loops
 * - Multi-stage production pipeline
 * - Inventory management
 * 
 * This demonstrates a realistic control flow system with typed tokens,
 * complex guards, state dependencies, and concurrent resource usage.
 */

export const manufacturingNet = {
  mode: 'algebraic',
  places: [
    // ============ INPUT PLACES (Stimulations) ============
    {
      id: 'orderQueue',
      label: 'Order Queue',
      x: 100,
      y: 150,
      tokens: 0,
      valueTokens: [],
      io_type: 'input',
      io_description: 'Incoming production orders from customers'
    },
    {
      id: 'rawMaterialSupply',
      label: 'Raw Material Supply',
      x: 100,
      y: 300,
      tokens: 1,
      valueTokens: [{ value: 100 }],
      io_type: 'input',
      io_description: 'Available raw material units'
    },
    {
      id: 'workerPool',
      label: 'Worker Pool',
      x: 100,
      y: 450,
      tokens: 1,
      valueTokens: [{ value: 5 }],
      io_type: 'input',
      io_description: 'Available workers for production'
    },

    // ============ INTERNAL PLACES ============
    {
      id: 'scheduledJobs',
      label: 'Scheduled Jobs',
      x: 300,
      y: 150,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal',
      io_description: 'Jobs scheduled for production'
    },
    {
      id: 'machineStatus',
      label: 'Machine Status',
      x: 300,
      y: 300,
      tokens: 1,
      valueTokens: [{ value: 3 }],
      io_type: 'internal',
      io_description: 'Number of available machines (max 3)'
    },
    {
      id: 'stage1InProgress',
      label: 'Stage 1: Cutting',
      x: 500,
      y: 100,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal',
      io_description: 'Jobs in cutting stage'
    },
    {
      id: 'stage2InProgress',
      label: 'Stage 2: Assembly',
      x: 700,
      y: 100,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal',
      io_description: 'Jobs in assembly stage'
    },
    {
      id: 'stage3InProgress',
      label: 'Stage 3: Quality Check',
      x: 900,
      y: 100,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal',
      io_description: 'Jobs in quality inspection'
    },
    {
      id: 'reworkQueue',
      label: 'Rework Queue',
      x: 900,
      y: 250,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal',
      io_description: 'Failed items awaiting rework'
    },
    {
      id: 'materialReserved',
      label: 'Material Reserved',
      x: 300,
      y: 450,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal',
      io_description: 'Materials allocated to jobs'
    },
    {
      id: 'workerAssigned',
      label: 'Workers Assigned',
      x: 500,
      y: 450,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal',
      io_description: 'Workers assigned to jobs'
    },

    // ============ OUTPUT PLACES (Observations) ============
    {
      id: 'completedProducts',
      label: 'Completed Products',
      x: 1100,
      y: 100,
      tokens: 0,
      valueTokens: [],
      io_type: 'output',
      io_description: 'Successfully completed production orders'
    },
    {
      id: 'productionLog',
      label: 'Production Log',
      x: 1100,
      y: 250,
      tokens: 0,
      valueTokens: [],
      io_type: 'output',
      io_description: 'Production event log for tracking'
    },
    {
      id: 'errorLog',
      label: 'Error Log',
      x: 1100,
      y: 400,
      tokens: 0,
      valueTokens: [],
      io_type: 'output',
      io_description: 'Production errors and failures'
    },
    {
      id: 'inventoryUpdate',
      label: 'Inventory Update',
      x: 100,
      y: 600,
      tokens: 0,
      valueTokens: [],
      io_type: 'output',
      io_description: 'Material consumption tracking'
    }
  ],

  transitions: [
    // ============ INPUT TRANSITIONS ============
    {
      id: 'receiveOrder',
      label: 'Receive Order',
      x: 200,
      y: 150,
      guard: 'orderId > 0 && quantity > 0 && quantity <= 100',
      action: '',
      io_type: 'input',
      io_description: 'Customer places production order'
    },

    // ============ JOB SCHEDULING ============
    {
      id: 'scheduleJob',
      label: 'Schedule Job',
      x: 400,
      y: 150,
      guard: 'quantity > 0 && materials >= quantity * 2 && workers >= 1 && machines >= 1',
      action: 'materialsNeeded = quantity * 2; workersNeeded = 1; scheduledQuantity = quantity',
      io_type: 'internal',
      io_description: 'Allocate resources and schedule production'
    },

    // ============ PRODUCTION STAGES ============
    {
      id: 'startCutting',
      label: 'Start Cutting',
      x: 600,
      y: 100,
      guard: 'scheduledQuantity > 0',
      action: 'stage = 1; progress = 0',
      io_type: 'internal',
      io_description: 'Begin cutting raw materials'
    },
    {
      id: 'completeCutting',
      label: 'Complete Cutting',
      x: 600,
      y: 150,
      guard: 'stage == 1',
      action: 'stage = 2',
      io_type: 'internal',
      io_description: 'Finish cutting stage'
    },
    {
      id: 'startAssembly',
      label: 'Start Assembly',
      x: 800,
      y: 100,
      guard: 'stage == 2',
      action: 'stage = 2; progress = 50',
      io_type: 'internal',
      io_description: 'Begin assembly process'
    },
    {
      id: 'completeAssembly',
      label: 'Complete Assembly',
      x: 800,
      y: 150,
      guard: 'stage == 2',
      action: 'stage = 3',
      io_type: 'internal',
      io_description: 'Finish assembly stage'
    },
    {
      id: 'qualityCheck',
      label: 'Quality Check',
      x: 1000,
      y: 100,
      guard: 'stage == 3',
      action: 'qualityScore = 95',
      io_type: 'internal',
      io_description: 'Perform quality inspection'
    },

    // ============ QUALITY OUTCOMES ============
    {
      id: 'passQualityCheck',
      label: 'Pass QC',
      x: 1000,
      y: 50,
      guard: 'stage == 3 && qualityScore >= 90',
      action: 'status = "completed"; finalQuantity = scheduledQuantity',
      io_type: 'output',
      io_description: 'Product passes quality check'
    },
    {
      id: 'failQualityCheck',
      label: 'Fail QC',
      x: 1000,
      y: 200,
      guard: 'stage == 3 && qualityScore < 90',
      action: 'status = "rework"; reworkCount = 1',
      io_type: 'internal',
      io_description: 'Product fails quality check'
    },

    // ============ REWORK FLOW ============
    {
      id: 'startRework',
      label: 'Start Rework',
      x: 800,
      y: 250,
      guard: 'status == "rework" && reworkCount <= 2',
      action: 'stage = 2; status = "in_rework"',
      io_type: 'internal',
      io_description: 'Send failed items for rework'
    },
    {
      id: 'rejectProduct',
      label: 'Reject Product',
      x: 1000,
      y: 300,
      guard: 'status == "rework" && reworkCount > 2',
      action: 'status = "rejected"; errorType = "quality_failure"',
      io_type: 'output',
      io_description: 'Reject product after max rework attempts'
    },

    // ============ RESOURCE RELEASE ============
    {
      id: 'releaseResources',
      label: 'Release Resources',
      x: 400,
      y: 450,
      guard: 'status == "completed" || status == "rejected"',
      action: 'materialsReleased = 0; workersReleased = workersNeeded; machinesReleased = 1',
      io_type: 'internal',
      io_description: 'Return resources to pool'
    },

    // ============ ERROR HANDLING ============
    {
      id: 'insufficientMaterials',
      label: 'Error: No Materials',
      x: 200,
      y: 300,
      guard: 'quantity > 0 && materials < quantity * 2',
      action: 'errorType = "insufficient_materials"; errorMessage = "Not enough raw materials"',
      io_type: 'output',
      io_description: 'Cannot schedule due to material shortage'
    },
    {
      id: 'insufficientWorkers',
      label: 'Error: No Workers',
      x: 200,
      y: 400,
      guard: 'quantity > 0 && workers < 1',
      action: 'errorType = "insufficient_workers"; errorMessage = "No available workers"',
      io_type: 'output',
      io_description: 'Cannot schedule due to worker shortage'
    },
    {
      id: 'insufficientMachines',
      label: 'Error: No Machines',
      x: 200,
      y: 500,
      guard: 'quantity > 0 && machines < 1',
      action: 'errorType = "insufficient_machines"; errorMessage = "All machines busy"',
      io_type: 'output',
      io_description: 'Cannot schedule due to machine unavailability'
    },

    // ============ LOGGING ============
    {
      id: 'logProduction',
      label: 'Log Production',
      x: 1100,
      y: 200,
      guard: 'status == "completed"',
      action: 'logType = "production"; timestamp = 1234567890',
      io_type: 'output',
      io_description: 'Record successful production'
    }
  ],

  arcs: [
    // Order intake
    { id: 'arc1', source: 'orderQueue', target: 'receiveOrder', sourceType: 'place', targetType: 'transition', binding: 'orderId, quantity' },
    { id: 'arc2', source: 'receiveOrder', target: 'scheduledJobs', sourceType: 'transition', targetType: 'place', binding: 'orderId, quantity' },

    // Resource checking for scheduling
    { id: 'arc3', source: 'rawMaterialSupply', target: 'scheduleJob', sourceType: 'place', targetType: 'transition', binding: 'materials' },
    { id: 'arc4', source: 'workerPool', target: 'scheduleJob', sourceType: 'place', targetType: 'transition', binding: 'workers' },
    { id: 'arc5', source: 'machineStatus', target: 'scheduleJob', sourceType: 'place', targetType: 'transition', binding: 'machines' },
    { id: 'arc6', source: 'scheduledJobs', target: 'scheduleJob', sourceType: 'place', targetType: 'transition', binding: 'orderId, quantity' },

    // Resource allocation
    { id: 'arc7', source: 'scheduleJob', target: 'rawMaterialSupply', sourceType: 'transition', targetType: 'place', binding: 'materials - materialsNeeded' },
    { id: 'arc8', source: 'scheduleJob', target: 'workerPool', sourceType: 'transition', targetType: 'place', binding: 'workers - workersNeeded' },
    { id: 'arc9', source: 'scheduleJob', target: 'machineStatus', sourceType: 'transition', targetType: 'place', binding: 'machines - 1' },
    { id: 'arc10', source: 'scheduleJob', target: 'materialReserved', sourceType: 'transition', targetType: 'place', binding: 'orderId, materialsNeeded' },
    { id: 'arc11', source: 'scheduleJob', target: 'workerAssigned', sourceType: 'transition', targetType: 'place', binding: 'orderId, workersNeeded' },

    // Stage 1: Cutting
    { id: 'arc12', source: 'scheduleJob', target: 'startCutting', sourceType: 'transition', targetType: 'transition' },
    { id: 'arc13', source: 'startCutting', target: 'stage1InProgress', sourceType: 'transition', targetType: 'place', binding: 'orderId, scheduledQuantity, stage, progress' },
    { id: 'arc14', source: 'stage1InProgress', target: 'completeCutting', sourceType: 'place', targetType: 'transition', binding: 'orderId, scheduledQuantity, stage' },
    { id: 'arc15', source: 'completeCutting', target: 'stage2InProgress', sourceType: 'transition', targetType: 'place', binding: 'orderId, scheduledQuantity, stage' },

    // Stage 2: Assembly
    { id: 'arc16', source: 'completeCutting', target: 'startAssembly', sourceType: 'transition', targetType: 'transition' },
    { id: 'arc17', source: 'stage2InProgress', target: 'startAssembly', sourceType: 'place', targetType: 'transition', binding: 'orderId, scheduledQuantity, stage' },
    { id: 'arc18', source: 'startAssembly', target: 'stage2InProgress', sourceType: 'transition', targetType: 'place', binding: 'orderId, scheduledQuantity, stage, progress' },
    { id: 'arc19', source: 'stage2InProgress', target: 'completeAssembly', sourceType: 'place', targetType: 'transition', binding: 'orderId, scheduledQuantity, stage' },
    { id: 'arc20', source: 'completeAssembly', target: 'stage3InProgress', sourceType: 'transition', targetType: 'place', binding: 'orderId, scheduledQuantity, stage' },

    // Stage 3: Quality Check
    { id: 'arc21', source: 'completeAssembly', target: 'qualityCheck', sourceType: 'transition', targetType: 'transition' },
    { id: 'arc22', source: 'stage3InProgress', target: 'qualityCheck', sourceType: 'place', targetType: 'transition', binding: 'orderId, scheduledQuantity, stage' },

    // Quality outcomes
    { id: 'arc23', source: 'qualityCheck', target: 'passQualityCheck', sourceType: 'transition', targetType: 'transition' },
    { id: 'arc24', source: 'passQualityCheck', target: 'completedProducts', sourceType: 'transition', targetType: 'place', binding: 'orderId, finalQuantity, status' },

    { id: 'arc25', source: 'qualityCheck', target: 'failQualityCheck', sourceType: 'transition', targetType: 'transition' },
    { id: 'arc26', source: 'failQualityCheck', target: 'reworkQueue', sourceType: 'transition', targetType: 'place', binding: 'orderId, scheduledQuantity, status, reworkCount' },

    // Rework flow
    { id: 'arc27', source: 'reworkQueue', target: 'startRework', sourceType: 'place', targetType: 'transition', binding: 'orderId, scheduledQuantity, status, reworkCount' },
    { id: 'arc28', source: 'startRework', target: 'stage2InProgress', sourceType: 'transition', targetType: 'place', binding: 'orderId, scheduledQuantity, stage, status' },

    { id: 'arc29', source: 'reworkQueue', target: 'rejectProduct', sourceType: 'place', targetType: 'transition', binding: 'orderId, scheduledQuantity, status, reworkCount' },
    { id: 'arc30', source: 'rejectProduct', target: 'errorLog', sourceType: 'transition', targetType: 'place', binding: 'orderId, status, errorType' },

    // Resource release
    { id: 'arc31', source: 'completedProducts', target: 'releaseResources', sourceType: 'place', targetType: 'transition', binding: 'orderId, status' },
    { id: 'arc32', source: 'errorLog', target: 'releaseResources', sourceType: 'place', targetType: 'transition', binding: 'orderId, status' },
    { id: 'arc33', source: 'workerAssigned', target: 'releaseResources', sourceType: 'place', targetType: 'transition', binding: 'orderId, workersNeeded' },
    { id: 'arc34', source: 'releaseResources', target: 'workerPool', sourceType: 'transition', targetType: 'place', binding: 'workersReleased' },
    { id: 'arc35', source: 'releaseResources', target: 'machineStatus', sourceType: 'transition', targetType: 'place', binding: 'machinesReleased' },

    // Error paths
    { id: 'arc36', source: 'orderQueue', target: 'insufficientMaterials', sourceType: 'place', targetType: 'transition', binding: 'orderId, quantity' },
    { id: 'arc37', source: 'rawMaterialSupply', target: 'insufficientMaterials', sourceType: 'place', targetType: 'transition', binding: 'materials' },
    { id: 'arc38', source: 'insufficientMaterials', target: 'errorLog', sourceType: 'transition', targetType: 'place', binding: 'errorType, errorMessage' },
    { id: 'arc39', source: 'insufficientMaterials', target: 'rawMaterialSupply', sourceType: 'transition', targetType: 'place', binding: 'materials' },

    { id: 'arc40', source: 'orderQueue', target: 'insufficientWorkers', sourceType: 'place', targetType: 'transition', binding: 'orderId, quantity' },
    { id: 'arc41', source: 'workerPool', target: 'insufficientWorkers', sourceType: 'place', targetType: 'transition', binding: 'workers' },
    { id: 'arc42', source: 'insufficientWorkers', target: 'errorLog', sourceType: 'transition', targetType: 'place', binding: 'errorType, errorMessage' },
    { id: 'arc43', source: 'insufficientWorkers', target: 'workerPool', sourceType: 'transition', targetType: 'place', binding: 'workers' },

    { id: 'arc44', source: 'orderQueue', target: 'insufficientMachines', sourceType: 'place', targetType: 'transition', binding: 'orderId, quantity' },
    { id: 'arc45', source: 'machineStatus', target: 'insufficientMachines', sourceType: 'place', targetType: 'transition', binding: 'machines' },
    { id: 'arc46', source: 'insufficientMachines', target: 'errorLog', sourceType: 'transition', targetType: 'place', binding: 'errorType, errorMessage' },
    { id: 'arc47', source: 'insufficientMachines', target: 'machineStatus', sourceType: 'transition', targetType: 'place', binding: 'machines' },

    // Production logging
    { id: 'arc48', source: 'completedProducts', target: 'logProduction', sourceType: 'place', targetType: 'transition', binding: 'orderId, status' },
    { id: 'arc49', source: 'logProduction', target: 'productionLog', sourceType: 'transition', targetType: 'place', binding: 'orderId, logType, timestamp' },
    { id: 'arc50', source: 'logProduction', target: 'completedProducts', sourceType: 'transition', targetType: 'place', binding: 'orderId, status' },

    // Inventory tracking
    { id: 'arc51', source: 'materialReserved', target: 'releaseResources', sourceType: 'place', targetType: 'transition', binding: 'orderId, materialsNeeded' },
    { id: 'arc52', source: 'releaseResources', target: 'inventoryUpdate', sourceType: 'transition', targetType: 'place', binding: 'orderId, materialsNeeded' }
  ]
};

export const manufacturingNetDescription = `
# Manufacturing Workflow Control System

## Overview
This algebraic Petri net models a realistic manufacturing production line with resource management, quality control, and error handling. It demonstrates:

- **Multi-stage production pipeline**: Cutting → Assembly → Quality Check
- **Resource allocation**: Materials, workers, and machines must be available
- **Quality control**: Products are inspected and either pass, require rework, or are rejected
- **Rework loops**: Failed items can be reworked up to 2 times
- **Error handling**: Graceful handling of resource shortages
- **Comprehensive logging**: Production events and errors are tracked

## System Components

### Resources
- **Raw Materials**: Consumed at 2 units per product quantity
- **Workers**: Assigned at 1 per job (pool of 5)
- **Machines**: Limited to 3 concurrent jobs

### Production Stages
1. **Cutting**: Initial processing of raw materials
2. **Assembly**: Combining components into products
3. **Quality Check**: Inspection with pass/fail/rework outcomes

### Quality Control
- Products scoring ≥90 pass immediately
- Products scoring <90 enter rework queue
- Maximum 2 rework attempts before rejection

### Error Scenarios
- Insufficient raw materials
- No available workers
- All machines busy
- Quality failures after max rework

## State Flow
\`\`\`
Order → Schedule (with resources) → Cutting → Assembly → QC
                                                          ↓
                                                    Pass → Complete
                                                    Fail → Rework (max 2) → Assembly
                                                    Fail (>2) → Reject
\`\`\`

## Typed Tokens
- **Orders**: {orderId, quantity}
- **Resources**: {materials, workers, machines}
- **Jobs**: {orderId, quantity, stage, progress, status}
- **Quality**: {qualityScore, reworkCount}
- **Logs**: {logType, timestamp, errorType, errorMessage}

This model is suitable for:
- Testing resource contention scenarios
- Validating quality control policies
- Verifying error recovery mechanisms
- Analyzing production throughput
- Checking resource release correctness
`;
