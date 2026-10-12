/**
 * Simplified Manufacturing Net with Correct ADT Bindings
 */

import { manufacturingADTs } from './adt.js';

export const manufacturingNet = {
  mode: 'algebraic',
  adtDefinitions: manufacturingADTs,
  
  places: [
    // Input places with ADT tokens
    {
      id: 'orderQueue',
      label: 'Order Queue',
      x: 100,
      y: 150,
      tokens: 1,
      valueTokens: [
        { __adt__: true, constructor: 'Order', args: [1, { __adt__: true, constructor: 'Normal', args: [] }] }
      ],
      sort: 'Order',
      io_type: 'input'
    },
    {
      id: 'rawMaterialSupply',
      label: 'Raw Material',
      x: 100,
      y: 250,
      tokens: 1,
      valueTokens: [
        { __adt__: true, constructor: 'Material', args: [100] }
      ],
      sort: 'Material',
      io_type: 'input'
    },
    
    // Internal places
    {
      id: 'scheduledJobs',
      label: 'Scheduled Jobs',
      x: 300,
      y: 200,
      tokens: 0,
      valueTokens: [],
      sort: 'Job',
      io_type: 'internal'
    },
    {
      id: 'stage1InProgress',
      label: 'Stage 1',
      x: 500,
      y: 150,
      tokens: 0,
      valueTokens: [],
      sort: 'Job',
      io_type: 'internal'
    },
    {
      id: 'stage2InProgress',
      label: 'Stage 2',
      x: 700,
      y: 150,
      tokens: 0,
      valueTokens: [],
      sort: 'Job',
      io_type: 'internal'
    },
    {
      id: 'stage3InProgress',
      label: 'Stage 3',
      x: 900,
      y: 150,
      tokens: 0,
      valueTokens: [],
      sort: 'Job',
      io_type: 'internal'
    },
    {
      id: 'machineStatus',
      label: 'Machines',
      x: 300,
      y: 300,
      tokens: 3,
      valueTokens: [{ value: 1 }, { value: 1 }, { value: 1 }],
      sort: 'Int',
      io_type: 'internal'
    },
    
    // Output places
    {
      id: 'completedProducts',
      label: 'Completed',
      x: 1100,
      y: 100,
      tokens: 0,
      valueTokens: [],
      sort: 'Product',
      io_type: 'output'
    },
    {
      id: 'reworkQueue',
      label: 'Rework',
      x: 1100,
      y: 200,
      tokens: 0,
      valueTokens: [],
      sort: 'Job',
      io_type: 'output'
    }
  ],
  
  transitions: [
    {
      id: 'scheduleJob',
      label: 'Schedule Job',
      x: 200,
      y: 200,
      guard: '',
      action: '',
      io_type: 'input'
    },
    {
      id: 'startStage1',
      label: 'Start Stage 1',
      x: 400,
      y: 150,
      guard: '',
      action: '',
      io_type: 'internal'
    },
    {
      id: 'completeStage1',
      label: 'Complete Stage 1',
      x: 600,
      y: 150,
      guard: '',
      action: '',
      io_type: 'internal'
    },
    {
      id: 'completeStage2',
      label: 'Complete Stage 2',
      x: 800,
      y: 150,
      guard: '',
      action: '',
      io_type: 'internal'
    },
    {
      id: 'qualityCheckPass',
      label: 'QC Pass',
      x: 1000,
      y: 100,
      guard: '',
      action: '',
      io_type: 'output'
    },
    {
      id: 'qualityCheckFail',
      label: 'QC Fail',
      x: 1000,
      y: 200,
      guard: '',
      action: '',
      io_type: 'output'
    }
  ],
  
  arcs: [
    // Schedule job: consume order and material, DO NOT produce (transition just consumes)
    { id: 'arc1', source: 'orderQueue', target: 'scheduleJob', sourceType: 'place', targetType: 'transition', binding: 'ord' },
    { id: 'arc2', source: 'rawMaterialSupply', target: 'scheduleJob', sourceType: 'place', targetType: 'transition', binding: 'mat' },
    
    // Start Stage 1: consume job and machine
    { id: 'arc4', source: 'scheduledJobs', target: 'startStage1', sourceType: 'place', targetType: 'transition', binding: 'j' },
    { id: 'arc5', source: 'machineStatus', target: 'startStage1', sourceType: 'place', targetType: 'transition', binding: 'm' },
    { id: 'arc6', source: 'startStage1', target: 'stage1InProgress', sourceType: 'transition', targetType: 'place', binding: 'j' },
    
    // Complete Stage 1: move job to stage 2
    { id: 'arc7', source: 'stage1InProgress', target: 'completeStage1', sourceType: 'place', targetType: 'transition', binding: 'j' },
    { id: 'arc8', source: 'completeStage1', target: 'stage2InProgress', sourceType: 'transition', targetType: 'place', binding: 'j' },
    
    // Complete Stage 2: move job to stage 3
    { id: 'arc9', source: 'stage2InProgress', target: 'completeStage2', sourceType: 'place', targetType: 'transition', binding: 'j' },
    { id: 'arc10', source: 'completeStage2', target: 'stage3InProgress', sourceType: 'transition', targetType: 'place', binding: 'j' },
    
    // Quality Check Pass: just consume job from stage3
    { id: 'arc11', source: 'stage3InProgress', target: 'qualityCheckPass', sourceType: 'place', targetType: 'transition', binding: 'j' },
    
    // Quality Check Fail: just consume job from stage3
    { id: 'arc14', source: 'stage3InProgress', target: 'qualityCheckFail', sourceType: 'place', targetType: 'transition', binding: 'j' }
  ]
};
