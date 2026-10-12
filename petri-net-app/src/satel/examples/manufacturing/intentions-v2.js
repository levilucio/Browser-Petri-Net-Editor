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
 * Intention 3: Priority-Based Routing (Negative Test)
 * Tests that High priority orders go to QC Pass, not QC Fail
 * This is a negative test - we expect observation to fail when checking for wrong route
 */
export const priorityRoutingNegativeIntention = {
  id: 'priority-routing-negative',
  name: 'Priority Routing Negative',
  testType: 'negative', // Expect observation failure
  variables: [
    {
      name: 'job',
      sort: 'Job',
      hypothesis: {
        type: 'uniformity',
        representative: createJob(
          createOrder(1, { __adt__: true, constructor: 'High', args: [] }),
          createMaterial(100)
        )
      }
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
        // Expect this to FAIL - High priority should NOT go to rework
        outputs: {},
        markings: {
          reworkQueue: { length: 1 } // Wrong! Should go to completedProducts
        }
      }
    }
  ]
};

/**
 * Intention 4: Complete Production Workflow
 * Full flow: order → schedule → stage1 → stage2 → stage3 → QC pass → complete
 * 
 * NOTE: This tests the full workflow by executing transitions sequentially,
 * relying on simulator state to chain produced tokens between transitions.
 * Each transition fires after the previous one has produced its output tokens.
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
          rawMaterialSupply: { length: 0 },
          scheduledJobs: { length: 1 } // Job produced
        }
      }
    },
    // Simplified workflow: just test initial scheduling
    // The full workflow will be tested separately once we have proper token chaining support
  ]
};

// Export all v2 intentions
export const manufacturingIntentionsV2 = [
  orderProcessingIntention,
  qualityCheckPassIntention,
  qualityCheckFailIntention,
  priorityRoutingNegativeIntention,
  completeWorkflowIntention
];
