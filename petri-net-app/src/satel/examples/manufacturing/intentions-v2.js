/**
 * Manufacturing Test Intentions - V2 Format
 * 
 * SATEL-style stimulation/observation pairs with typed variables.
 * Uses Order, Material, Priority ADTs for structured tokens.
 */

import { createOrder, createMaterial, createJob, createProduct } from './adt.js';

/**
 * Intention 1: Basic Order Processing (Single Step)
 * Tests single scheduleJob transition - kept for basic validation
 * Note: All priorities take same 1-transition path (scheduleJob)
 */
export const orderProcessingIntention = {
  id: 'order-processing',
  name: 'Order Processing (Single Step)',
  testType: 'positive',
  variables: [
    {
      name: 'priority',
      sort: 'Priority',
      hypothesis: {
        type: 'subuniformity',
        source: 'constructors'  // Simple constructor split for basic test
      },
      description: 'Order priority level'
    },
    {
      name: 'material',
      sort: 'Material',
      hypothesis: {
        type: 'uniformity',
        representative: createMaterial(100) // Sufficient material (>= 50 required by guard)
      },
      description: 'Required material'
    }
  ],
  pairs: [
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: [{ __adt__: true, constructor: 'Order', args: [1, '$priority'] }],
          rawMaterialSupply: ['$material']
        }
      },
      observation: {
        outputs: {
          scheduledJobs: [{ __adt__: true, constructor: 'Job', args: [
            { __adt__: true, constructor: 'Order', args: [1, '$priority'] },
            '$material'
          ]}]
        },
        markings: {
          orderQueue: { length: 0 },
          rawMaterialSupply: { length: 0 },
          scheduledJobs: { length: 1 }
        }
      }
    }
  ]
};

/**
 * Intention 2: Quality Check Pass
 * Tests quality control pass outcome with High priority job
 */
export const qualityCheckPassIntention = {
  id: 'quality-check-pass',
  name: 'Quality Check Pass',
  testType: 'positive',
  variables: [],
  pairs: [
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {
          stage3InProgress: [
            createJob(
              createOrder(1, { __adt__: true, constructor: 'High', args: [] }),
              createMaterial(100)
            )
          ]
        }
      },
      observation: {
        outputs: {
          completedProducts: [createProduct(1, 'Pass')]
        },
        markings: {
          stage3InProgress: { length: 0 },
          completedProducts: { length: 1 }
        }
      }
    }
  ]
};

/**
 * Intention 2b: Quality Check Fail
 * Tests quality control fail outcome with Normal priority job
 */
export const qualityCheckFailIntention = {
  id: 'quality-check-fail',
  name: 'Quality Check Fail',
  testType: 'positive',
  variables: [],
  pairs: [
    {
      stimulation: {
        transition: 'qualityCheckFail',
        inputs: {
          stage3InProgress: [
            createJob(
              createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }),
              createMaterial(100)
            )
          ]
        }
      },
      observation: {
        outputs: {
          reworkQueue: [
            createJob(
              createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }),
              createMaterial(100)
            )
          ]
        },
        markings: {
          stage3InProgress: { length: 0 },
          reworkQueue: { length: 1 }
        }
      }
    }
  ]
};

/**
 * Intention 3: Material Exhaustion (Negative Test with notEnabled)
 * Tests that production correctly rejects insufficient material via guard
 */
export const materialExhaustionIntention = {
  id: 'material-exhaustion',
  name: 'Material Exhaustion (Guard Rejects)',
  testType: 'positive', // FIX #5: notEnabled is success - guard correctly rejects
  variables: [
    {
      name: 'order',
      sort: 'Order',
      hypothesis: {
        type: 'uniformity',
        representative: createOrder(1, { __adt__: true, constructor: 'Normal', args: [] })
      }
    }
  ],
  pairs: [
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: ['$order'],
          rawMaterialSupply: [createMaterial(30)] // Insufficient (needs >= 50)
        }
      },
      observation: {
        type: 'notEnabled', // Expect transition NOT to fire due to guard
        outputs: {},
        markings: {}
      }
    }
  ]
};

/**
 * Intention 3b: Material Sufficient (Positive Variant)
 * Tests that production works with sufficient material
 */
export const materialSufficientIntention = {
  id: 'material-sufficient',
  name: 'Material Sufficient',
  testType: 'positive',
  variables: [
    {
      name: 'order',
      sort: 'Order',
      hypothesis: {
        type: 'uniformity',
        representative: createOrder(2, { __adt__: true, constructor: 'Normal', args: [] })
      }
    }
  ],
  pairs: [
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: ['$order'],
          rawMaterialSupply: [createMaterial(100)] // Sufficient
        }
      },
      observation: {
        outputs: {
          scheduledJobs: [createJob('$order', createMaterial(100))]
        },
        markings: {
          orderQueue: { length: 0 },
          rawMaterialSupply: { length: 0 },
          scheduledJobs: { length: 1 }
        }
      }
    }
  ]
};

/**
 * Intention 4: Complete Production Workflow
 * Full flow: order → schedule → stage1 → stage2 → stage3 → QC pass → complete
 * 
 * Tokens stay in marking between pairs. Only initial injection at start.
 * Each subsequent stimulation fires on tokens produced by previous step.
 */
export const completeWorkflowIntention = {
  id: 'complete-workflow',
  name: 'Complete Production Workflow',
  testType: 'positive',
  variables: [
    {
      name: 'order',
      sort: 'Order',
      hypothesis: {
        type: 'uniformity',
        representative: createOrder(1, { __adt__: true, constructor: 'High', args: [] })
      }
    },
    {
      name: 'material',
      sort: 'Material',
      hypothesis: {
        type: 'uniformity',
        representative: createMaterial(100)
      }
    }
  ],
  pairs: [
    // Pair 1: Schedule job from order and material
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: ['$order'],
          rawMaterialSupply: ['$material']
        }
      },
      observation: {
        outputs: {
          scheduledJobs: [createJob('$order', '$material')]
        },
        markings: {
          orderQueue: { length: 0 },
          rawMaterialSupply: { length: 0 },
          scheduledJobs: { length: 1 }
        }
      }
    },
    // Pair 2: Start stage 1 (fires on Job from scheduledJobs)
    {
      stimulation: {
        transition: 'startStage1',
        inputs: {} // No injection - use tokens from previous step
      },
      observation: {
        outputs: {
          stage1InProgress: [createJob('$order', '$material')]
        },
        markings: {
          scheduledJobs: { length: 0 },
          stage1InProgress: { length: 1 }
        }
      }
    },
    // Pair 3: Complete stage 1
    {
      stimulation: {
        transition: 'completeStage1',
        inputs: {} // Fires on Job from stage1InProgress
      },
      observation: {
        outputs: {
          stage2InProgress: [createJob('$order', '$material')]
        },
        markings: {
          stage1InProgress: { length: 0 },
          stage2InProgress: { length: 1 }
        }
      }
    },
    // Pair 4: Complete stage 2
    {
      stimulation: {
        transition: 'completeStage2',
        inputs: {} // Fires on Job from stage2InProgress
      },
      observation: {
        outputs: {
          stage3InProgress: [createJob('$order', '$material')]
        },
        markings: {
          stage2InProgress: { length: 0 },
          stage3InProgress: { length: 1 }
        }
      }
    },
    // Pair 5: Quality check pass (High priority)
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {} // Fires on Job from stage3InProgress
      },
      observation: {
        outputs: {
          completedProducts: [createProduct(1, 'Pass')]
        },
        markings: {
          stage3InProgress: { length: 0 },
          completedProducts: { length: 1 }
        }
      }
    }
  ]
};

/**
 * Intention 5: High Priority Quality Check Pass
 * Tests that High priority jobs pass quality check
 */
export const highPriorityQCIntention = {
  id: 'high-priority-qc',
  name: 'High Priority QC Pass',
  testType: 'positive',
  variables: [],
  pairs: [
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {
          stage3InProgress: [
            createJob(
              createOrder(1, { __adt__: true, constructor: 'High', args: [] }),
              createMaterial(100)
            )
          ]
        }
      },
      observation: {
        outputs: {
          completedProducts: [createProduct(1, 'Pass')]
        },
        markings: {
          stage3InProgress: { length: 0 },
          completedProducts: { length: 1 }
        }
      }
    }
  ]
};

/**
 * Intention 6: Normal Priority Quality Check Fail
 * Tests that Normal priority jobs go to rework
 */
export const normalPriorityQCIntention = {
  id: 'normal-priority-qc',
  name: 'Normal Priority QC Fail',
  testType: 'positive',
  variables: [],
  pairs: [
    {
      stimulation: {
        transition: 'qualityCheckFail',
        inputs: {
          stage3InProgress: [
            createJob(
              createOrder(2, { __adt__: true, constructor: 'Normal', args: [] }),
              createMaterial(100)
            )
          ]
        }
      },
      observation: {
        outputs: {
          reworkQueue: [
            createJob(
              createOrder(2, { __adt__: true, constructor: 'Normal', args: [] }),
              createMaterial(100)
            )
          ]
        },
        markings: {
          stage3InProgress: { length: 0 },
          reworkQueue: { length: 1 }
        }
      }
    }
  ]
};

/**
 * Intention 7: Low Priority Not Enabled
 * Tests that Low priority jobs don't pass quality check (no transition for Low)
 */
export const lowPriorityNotEnabledIntention = {
  id: 'low-priority-not-enabled',
  name: 'Low Priority Not Enabled',
  testType: 'positive',
  variables: [],
  pairs: [
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {
          stage3InProgress: [
            createJob(
              createOrder(3, { __adt__: true, constructor: 'Low', args: [] }),
              createMaterial(100)
            )
          ]
        }
      },
      observation: {
        type: 'notEnabled',
        outputs: {},
        markings: {}
      }
    }
  ]
};


// Import multi-step intentions
import {
  jobLifecycleByPriority,
  materialContentionPath,
  reworkCyclePath,
  parallelPriorityPaths
} from './intentions-v2-multistep.js';

// Export all v2 intentions (single-step + multi-step)
export const manufacturingIntentionsV2 = [
  // Multi-step intentions (3-6 transitions per test, path-dependent behavior)
  jobLifecycleByPriority,          // 5-6 transitions, priority determines path
  reworkCyclePath,                  // 9 transitions, fail-rework-pass cycle
  materialContentionPath,           // 2-4 transitions, material contention
  
  // Single-step intentions (kept for validation)
  orderProcessingIntention,         // 1 transition
  completeWorkflowIntention,        // 5 transitions (one test case)
  qualityCheckPassIntention,
  qualityCheckFailIntention,
  materialExhaustionIntention,
  materialSufficientIntention,
  highPriorityQCIntention,
  normalPriorityQCIntention,
  lowPriorityNotEnabledIntention
];
