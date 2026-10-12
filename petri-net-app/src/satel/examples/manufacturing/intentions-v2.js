/**
 * Manufacturing Test Intentions - V2 Format
 * 
 * SATEL-style stimulation/observation pairs with typed variables.
 * Uses Order, Material, Priority ADTs for structured tokens.
 */

import { createOrder, createMaterial, createJob, createProduct } from './adt.js';

/**
 * Intention 1: Basic Order Processing
 * Tests the complete flow from order intake to scheduled job
 */
export const orderProcessingIntention = {
  id: 'order-processing',
  name: 'Order Processing Workflow',
  testType: 'positive',
  variables: [
    {
      name: 'order',
      sort: 'Order',
      hypothesis: {
        type: 'uniformity',
        representative: createOrder(1, 'Normal')
      },
      description: 'Production order'
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
          orderQueue: ['$order'],
          rawMaterialSupply: ['$material']
        }
      },
      observation: {
        outputs: {},
        markings: {
          orderQueue: { length: 0 },
          rawMaterialSupply: { length: 0 }
        }
      }
    }
  ]
};

/**
 * Intention 2: Quality Check Pass
 * Tests quality control pass outcome
 */
export const qualityCheckPassIntention = {
  id: 'quality-check-pass',
  name: 'Quality Check Pass',
  testType: 'positive',
  variables: [
    {
      name: 'job',
      sort: 'Job',
      hypothesis: {
        type: 'uniformity',
        representative: createJob(
          createOrder(1, 'Normal'),
          createMaterial(50)
        )
      },
      description: 'Job under inspection'
    }
  ],
  pairs: [
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {
          stage3InProgress: ['$job']
        }
      },
      observation: {
        outputs: {},
        markings: {
          stage3InProgress: { length: 0 }
        }
      }
    }
  ]
};

/**
 * Intention 2b: Quality Check Fail
 * Tests quality control fail outcome
 */
export const qualityCheckFailIntention = {
  id: 'quality-check-fail',
  name: 'Quality Check Fail',
  testType: 'positive',
  variables: [
    {
      name: 'job',
      sort: 'Job',
      hypothesis: {
        type: 'uniformity',
        representative: createJob(
          createOrder(1, 'Normal'),
          createMaterial(50)
        )
      }
    }
  ],
  pairs: [
    {
      stimulation: {
        transition: 'qualityCheckFail',
        inputs: {
          stage3InProgress: ['$job']
        }
      },
      observation: {
        outputs: {},
        markings: {
          stage3InProgress: { length: 0 }
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
  name: 'Material Exhaustion',
  testType: 'positive', // notEnabled observation is a valid success
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
 * Intention 5: Priority-Based Quality Check (Subuniformity)
 * Tests that High priority goes through qualityCheckPass, Normal goes to qualityCheckFail
 * Uses subuniformity to generate multiple cases with distinct routing
 */
export const priorityQualityCheckIntention = {
  id: 'priority-quality-check',
  name: 'Priority-Based Quality Check',
  testType: 'positive',
  variables: [
    {
      name: 'pri',
      sort: 'Priority',
      hypothesis: {
        type: 'subuniformity',
        source: 'constructors' // Generates High, Normal, Low
      },
      description: 'Order priority'
    }
  ],
  pairs: [
    // Test qualityCheckPass transition
    // Only High priority should fire this
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {
          stage3InProgress: [
            createJob(
              createOrder(1, '$pri'),
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

// Export all v2 intentions
export const manufacturingIntentionsV2 = [
  orderProcessingIntention,
  qualityCheckPassIntention,
  qualityCheckFailIntention,
  materialExhaustionIntention,
  materialSufficientIntention,
  completeWorkflowIntention,
  priorityQualityCheckIntention
];
