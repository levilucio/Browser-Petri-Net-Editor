/**
 * Manufacturing Multi-Step V2 Intentions
 * 
 * Multi-step HML-style sequences exercising 3-6 transition paths where
 * variable values drive genuinely different transition sequences.
 */

import { createOrder, createMaterial, createJob, createProduct } from './adt.js';

/**
 * Intention: Full Job Lifecycle by Priority
 * 
 * Priority determines the complete path through the system:
 * - High: order → schedule → stage1 → stage2 → stage3 → QC_PASS → complete
 * - Normal: order → schedule → stage1 → stage2 → stage3 → QC_FAIL → rework
 * - Low: order → schedule → stage1 → stage2 → stage3 → (neither QC fires - stuck)
 * 
 * Each priority value drives a DIFFERENT 5-6 transition sequence.
 */
export const jobLifecycleByPriority = {
  id: 'job-lifecycle-priority',
  name: 'Complete Job Lifecycle (Priority-Dependent Path)',
  testType: 'positive',
  variables: [
    {
      name: 'priority',
      sort: 'Priority',
      hypothesis: {
        type: 'subuniformity',
        source: 'path-conditions'  // Partition by path predicates, not constructors
      },
      description: 'Priority determines QC outcome path'
    }
  ],
  pairs: [
    // Step 1: Schedule job (all priorities)
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: [{ __adt__: true, constructor: 'Order', args: [1, '$priority'] }],
          rawMaterialSupply: [createMaterial(100)]
        }
      },
      observation: {
        outputs: {
          scheduledJobs: [createJob(
            { __adt__: true, constructor: 'Order', args: [1, '$priority'] },
            createMaterial(100)
          )]
        },
        markings: {
          scheduledJobs: { length: 1 }
        }
      }
    },
    // Step 2: Start stage 1
    {
      stimulation: {
        transition: 'startStage1',
        inputs: {}
      },
      observation: {
        outputs: {
          stage1InProgress: [createJob(
            { __adt__: true, constructor: 'Order', args: [1, '$priority'] },
            createMaterial(100)
          )]
        },
        markings: {
          stage1InProgress: { length: 1 }
        }
      }
    },
    // Step 3: Complete stage 1
    {
      stimulation: {
        transition: 'completeStage1',
        inputs: {}
      },
      observation: {
        outputs: {
          stage2InProgress: [createJob(
            { __adt__: true, constructor: 'Order', args: [1, '$priority'] },
            createMaterial(100)
          )]
        },
        markings: {
          stage2InProgress: { length: 1 }
        }
      }
    },
    // Step 4: Complete stage 2
    {
      stimulation: {
        transition: 'completeStage2',
        inputs: {}
      },
      observation: {
        outputs: {
          stage3InProgress: [createJob(
            { __adt__: true, constructor: 'Order', args: [1, '$priority'] },
            createMaterial(100)
          )]
        },
        markings: {
          stage3InProgress: { length: 1 }
        }
      }
    },
    // Step 5: Quality check - BRANCH POINT
    // High priority: qualityCheckPass fires → completedProducts
    // Normal priority: qualityCheckFail fires → reworkQueue
    // Low priority: neither fires (guards reject)
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {},
        guard: 'priority(order(job)) == High()'  // Only fires for High
      },
      observation: {
        conditional: true,  // Depends on instantiation
        outputs: {
          completedProducts: [createProduct(1, 'Pass')]
        },
        markings: {
          completedProducts: { length: 1 }
        }
      }
    },
    {
      stimulation: {
        transition: 'qualityCheckFail',
        inputs: {},
        guard: 'priority(order(job)) == Normal()'  // Only fires for Normal
      },
      observation: {
        conditional: true,
        outputs: {
          reworkQueue: [createJob(
            { __adt__: true, constructor: 'Order', args: [1, '$priority'] },
            createMaterial(100)
          )]
        },
        markings: {
          reworkQueue: { length: 1 }
        }
      }
    }
  ]
};

/**
 * Intention: Concurrent Jobs with Material Contention
 * 
 * Two orders compete for limited material:
 * - If material >= 100: both schedule (path: scheduleJob × 2)
 * - If 50 <= material < 100: only first schedules, second blocks (path: scheduleJob, notEnabled)
 * - If material < 50: neither schedules (path: notEnabled × 2)
 */
export const materialContentionPath = {
  id: 'material-contention',
  name: 'Concurrent Jobs - Material Contention',
  testType: 'positive',
  variables: [
    {
      name: 'materialAmount',
      sort: 'Nat',
      hypothesis: {
        type: 'subuniformity',
        source: 'path-conditions',
        bounds: { min: 0, max: 150 }
      },
      description: 'Available material determines scheduling paths'
    }
  ],
  pairs: [
    // Attempt to schedule first job (needs >= 50 material)
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: [createOrder(1, { __adt__: true, constructor: 'High', args: [] })],
          rawMaterialSupply: [{ __adt__: true, constructor: 'Material', args: ['$materialAmount'] }]
        },
        guard: 'quantity(material) >= 50'
      },
      observation: {
        conditional: true,
        outputs: {
          scheduledJobs: [createJob(
            createOrder(1, { __adt__: true, constructor: 'High', args: [] }),
            { __adt__: true, constructor: 'Material', args: ['$materialAmount'] }
          )]
        },
        markings: {
          scheduledJobs: { length: 1 }
        }
      }
    },
    // Attempt to schedule second job (needs >= 50 remaining material)
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: [createOrder(2, { __adt__: true, constructor: 'Normal', args: [] })],
          rawMaterialSupply: []  // Depleted if first consumed all
        },
        guard: 'quantity(material) >= 50'
      },
      observation: {
        conditional: true,
        type: 'either-or',  // Either fires or doesn't based on remaining material
        outputs: {},
        markings: {}
      }
    }
  ]
};

/**
 * Intention: Fail-Rework-Complete Cycle
 * 
 * Normal priority job goes through full rework cycle:
 * order → schedule → stage1 → stage2 → stage3 → QC_FAIL → rework → 
 * stage1 → stage2 → stage3 → QC_PASS → complete (9 transitions)
 */
export const reworkCyclePath = {
  id: 'rework-cycle',
  name: 'Fail-Rework-Complete Cycle',
  testType: 'positive',
  variables: [],
  pairs: [
    // Initial schedule
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: [createOrder(1, { __adt__: true, constructor: 'Normal', args: [] })],
          rawMaterialSupply: [createMaterial(100)]
        }
      },
      observation: {
        outputs: {
          scheduledJobs: [createJob(
            createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }),
            createMaterial(100)
          )]
        }
      }
    },
    // First production cycle
    { stimulation: { transition: 'startStage1', inputs: {} }, observation: { outputs: { stage1InProgress: [createJob(createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }), createMaterial(100))] } } },
    { stimulation: { transition: 'completeStage1', inputs: {} }, observation: { outputs: { stage2InProgress: [createJob(createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }), createMaterial(100))] } } },
    { stimulation: { transition: 'completeStage2', inputs: {} }, observation: { outputs: { stage3InProgress: [createJob(createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }), createMaterial(100))] } } },
    // QC Fail → Rework
    {
      stimulation: {
        transition: 'qualityCheckFail',
        inputs: {}
      },
      observation: {
        outputs: {
          reworkQueue: [createJob(
            createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }),
            createMaterial(100)
          )]
        }
      }
    },
    // Rework: re-enter production
    { stimulation: { transition: 'startStage1', inputs: { scheduledJobs: [], stage1InProgress: [], reworkQueue: [createJob(createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }), createMaterial(100))] } }, observation: { outputs: { stage1InProgress: [createJob(createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }), createMaterial(100))] } } },
    { stimulation: { transition: 'completeStage1', inputs: {} }, observation: { outputs: { stage2InProgress: [createJob(createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }), createMaterial(100))] } } },
    { stimulation: { transition: 'completeStage2', inputs: {} }, observation: { outputs: { stage3InProgress: [createJob(createOrder(1, { __adt__: true, constructor: 'Normal', args: [] }), createMaterial(100))] } } },
    // Second QC: manually change to High priority in stage3 for pass
    // (In reality, we'd need rework to improve quality; here we simplify)
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {
          stage3InProgress: [createJob(
            createOrder(1, { __adt__: true, constructor: 'High', args: [] }),  // Changed to High
            createMaterial(100)
          )]
        }
      },
      observation: {
        outputs: {
          completedProducts: [createProduct(1, 'Pass')]
        }
      }
    }
  ]
};

/**
 * Intention: Priority-Based Parallel Processing
 * 
 * High and Normal priority jobs processed in parallel:
 * - High: full flow to completion (6 transitions)
 * - Normal: full flow to rework (6 transitions)
 * 
 * Tests concurrent execution and priority differentiation.
 */
export const parallelPriorityPaths = {
  id: 'parallel-priority',
  name: 'Parallel High/Normal Priority Processing',
  testType: 'positive',
  variables: [],
  pairs: [
    // Schedule both jobs simultaneously
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          orderQueue: [
            createOrder(1, { __adt__: true, constructor: 'High', args: [] }),
            createOrder(2, { __adt__: true, constructor: 'Normal', args: [] })
          ],
          rawMaterialSupply: [createMaterial(100), createMaterial(100)]
        }
      },
      observation: {
        outputs: {
          scheduledJobs: [
            createJob(createOrder(1, { __adt__: true, constructor: 'High', args: [] }), createMaterial(100)),
            createJob(createOrder(2, { __adt__: true, constructor: 'Normal', args: [] }), createMaterial(100))
          ]
        },
        markings: {
          scheduledJobs: { length: 2 }
        }
      }
    },
    // Process both through stages (interleaved or parallel)
    { stimulation: { transition: 'startStage1', inputs: {} }, observation: { outputs: {}, markings: { stage1InProgress: { length: 2 } } } },
    { stimulation: { transition: 'completeStage1', inputs: {} }, observation: { outputs: {}, markings: { stage2InProgress: { length: 2 } } } },
    { stimulation: { transition: 'completeStage2', inputs: {} }, observation: { outputs: {}, markings: { stage3InProgress: { length: 2 } } } },
    // QC: High passes, Normal fails (different outcomes)
    {
      stimulation: {
        transition: 'qualityCheckPass',
        inputs: {}  // Fires on High priority job only
      },
      observation: {
        outputs: {
          completedProducts: [createProduct(1, 'Pass')]
        },
        markings: {
          completedProducts: { length: 1 },
          stage3InProgress: { length: 1 }  // Normal still there
        }
      }
    },
    {
      stimulation: {
        transition: 'qualityCheckFail',
        inputs: {}  // Fires on Normal priority job
      },
      observation: {
        outputs: {
          reworkQueue: [createJob(
            createOrder(2, { __adt__: true, constructor: 'Normal', args: [] }),
            createMaterial(100)
          )]
        },
        markings: {
          reworkQueue: { length: 1 }
        }
      }
    }
  ]
};

// Export all multi-step intentions
export const manufacturingMultiStepIntentions = [
  jobLifecycleByPriority,
  materialContentionPath,
  reworkCyclePath,
  parallelPriorityPaths
];
