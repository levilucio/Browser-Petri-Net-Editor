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
          createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }),
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
        outputs: {
          completedProducts: [
            createProduct(1, { __adt__: true, constructor: 'Pass', args: [] })
          ],
          machineStatus: [{ value: 1 }]
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
          createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }),
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
        outputs: {
          reworkQueue: ['$job'],
          machineStatus: [{ value: 1 }]
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
  testType: 'negative', // Expect observation failure
  variables: [
    {
      name: 'order',
      sort: 'Order',
      hypothesis: {
        type: 'uniformity',
        representative: createOrder(1, { __adt__: true, constructor: 'High', args: [] })
      }
    }
  ],
  pairs: [
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: ['$order'],
          rawMaterialSupply: [createMaterial(10)] // Insufficient (needs 50)
        }
      },
      observation: {
        // Expect observation to fail - transition fires but produces unexpected output
        outputs: {
          scheduledJobs: [] // Expect empty (guard should fail)
        },
        markings: {
          orderQueue: { length: 0 }, // Should be consumed even if guard fails
          rawMaterialSupply: { length: 0 }
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
        representative: createOrder(1, { __adt__: true, constructor: 'Normal', args: [] })
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
          scheduledJobs: [{
            __adt__: true,
            constructor: 'Job',
            args: ['$order', '$material']
          }]
        }
      }
    },
    {
      stimulation: {
        transition: 'startStage1',
        inputs: {
          scheduledJobs: [{
            __adt__: true,
            constructor: 'Job',
            args: ['$order', '$material']
          }],
          machineStatus: [{ value: 1 }]
        }
      },
      observation: {
        outputs: {
          stage1InProgress: [{
            __adt__: true,
            constructor: 'Job',
            args: ['$order', '$material']
          }]
        }
      }
    },
    {
      stimulation: {
        transition: 'completeStage1',
        inputs: {
          stage1InProgress: [{
            __adt__: true,
            constructor: 'Job',
            args: ['$order', '$material']
          }]
        }
      },
      observation: {
        outputs: {
          stage2InProgress: [{
            __adt__: true,
            constructor: 'Job',
            args: ['$order', '$material']
          }]
        }
      }
    },
    {
      stimulation: {
        transition: 'completeStage2',
        inputs: {
          stage2InProgress: [{
            __adt__: true,
            constructor: 'Job',
            args: ['$order', '$material']
          }]
        }
      },
      observation: {
        outputs: {
          stage3InProgress: [{
            __adt__: true,
            constructor: 'Job',
            args: ['$order', '$material']
          }]
        }
      }
    },
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {
          stage3InProgress: [{
            __adt__: true,
            constructor: 'Job',
            args: ['$order', '$material']
          }]
        }
      },
      observation: {
        outputs: {
          completedProducts: [
            createProduct(1, { __adt__: true, constructor: 'Pass', args: [] })
          ],
          machineStatus: [{ value: 1 }]
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
  completeWorkflowIntention
];
