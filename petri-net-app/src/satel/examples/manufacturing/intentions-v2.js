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
        type: 'subuniformity',
        source: 'guards' // Will partition by material availability guards
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
        outputs: {
          scheduledJobs: [{
            __adt__: true,
            constructor: 'Job',
            args: ['$order', '$material']
          }]
        },
        markings: {
          orderQueue: { length: 0 }
        }
      }
    }
  ]
};

/**
 * Intention 2: Quality Check - Pass/Fail
 * Tests quality control with both outcomes (subuniformity over QualityStatus)
 */
export const qualityCheckIntention = {
  id: 'quality-check',
  name: 'Quality Check',
  testType: 'positive',
  variables: [
    {
      name: 'job',
      sort: 'Job',
      hypothesis: {
        type: 'uniformity',
        representative: createJob(createOrder(1, 'Normal'), createMaterial(50))
      },
      description: 'Job under inspection'
    },
    {
      name: 'outcome',
      sort: 'QualityStatus',
      hypothesis: {
        type: 'subuniformity',
        source: 'constructors' // Pass and Fail
      },
      description: 'Quality check outcome'
    }
  ],
  pairs: [
    {
      stimulation: {
        transition: 'qualityCheck',
        inputs: {
          stage3InProgress: ['$job']
        }
      },
      observation: {
        // Outcome depends on $outcome value - oracle checks appropriate place
        // If Pass: completedProducts gets product
        // If Fail: reworkQueue gets job
        // This is handled by oracle checking variable instantiation
        outputs: {
          completedProducts: [], // Will check based on $outcome
          reworkQueue: []
        }
      }
    }
  ]
};

/**
 * Intention 3: Material Exhaustion (Negative Test)
 * Tests that production fails when material is insufficient
 */
export const materialExhaustionIntention = {
  id: 'material-exhaustion',
  name: 'Material Exhaustion',
  testType: 'negative', // Expect failure
  variables: [
    {
      name: 'order',
      sort: 'Order',
      hypothesis: {
        type: 'uniformity',
        representative: createOrder(1, 'High') // High priority but insufficient material
      }
    }
  ],
  pairs: [
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: ['$order'],
          rawMaterialSupply: [createMaterial(0)] // No material available
        }
      },
      observation: {
        // Expect this to fail (transition disabled due to guard)
        outputs: {
          scheduledJobs: [] // Should remain empty
        }
      }
    }
  ]
};

/**
 * Intention 4: Complete Production Workflow
 * Full flow: order → schedule → stage1 → stage2 → stage3 → QC pass → complete
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
        representative: createOrder(1, 'Normal')
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
        }
      }
    },
    {
      stimulation: {
        transition: 'startStage1',
        inputs: {
          scheduledJobs: [createJob('$order', '$material')],
          machineStatus: [{ value: 3 }]
        }
      },
      observation: {
        outputs: {
          stage1InProgress: [createJob('$order', '$material')]
        },
        markings: {
          machineStatus: { length: 1 } // One machine consumed
        }
      }
    },
    {
      stimulation: {
        transition: 'completeStage1',
        inputs: {
          stage1InProgress: [createJob('$order', '$material')]
        }
      },
      observation: {
        outputs: {
          stage2InProgress: [createJob('$order', '$material')]
        }
      }
    },
    {
      stimulation: {
        transition: 'completeStage2',
        inputs: {
          stage2InProgress: [createJob('$order', '$material')]
        }
      },
      observation: {
        outputs: {
          stage3InProgress: [createJob('$order', '$material')]
        }
      }
    },
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {
          stage3InProgress: [createJob('$order', '$material')]
        }
      },
      observation: {
        outputs: {
          completedProducts: [createProduct('$order.id', 'Pass')]
        }
      }
    }
  ]
};

// Export all v2 intentions
export const manufacturingIntentionsV2 = [
  orderProcessingIntention,
  qualityCheckIntention,
  materialExhaustionIntention,
  completeWorkflowIntention
];
