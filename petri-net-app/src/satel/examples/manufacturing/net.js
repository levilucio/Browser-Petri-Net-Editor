/**
 * Manufacturing Workflow with Real ADT Guards and Token Flow
 * 
 * Flow: Order + Material --[guard: sufficient qty]--> Job --> Stage1 --> Stage2 --> Stage3 --> Product
 * Guards check material quantity and priority
 * Output arcs produce Job and Product ADTs
 */

import { manufacturingADTs } from './adt.js';

export const manufacturingNet = {
  mode: 'algebraic',
  adtDefinitions: manufacturingADTs,
  
  places: [
    {
      id: 'orderQueue',
      label: 'Order Queue',
      x: 100,
      y: 150,
      tokens: 1,
      valueTokens: [
        { __adt__: true, constructor: 'Order', args: [
          1, 
          { __adt__: true, constructor: 'Normal', args: [] }
        ]}
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
      // Guard: material quantity must be >= 50
      guard: 'quantity(mat) >= 50',
      // Action: construct Job ADT from order and material
      action: 'job = Job(ord, mat)',
      io_type: 'input'
    },
    {
      id: 'startStage1',
      label: 'Start Stage 1',
      x: 400,
      y: 150,
      guard: '',
      // Pass job through unchanged
      action: 'outJob = j',
      io_type: 'internal'
    },
    {
      id: 'completeStage1',
      label: 'Complete Stage 1',
      x: 600,
      y: 150,
      guard: '',
      action: 'outJob = j',
      io_type: 'internal'
    },
    {
      id: 'completeStage2',
      label: 'Complete Stage 2',
      x: 800,
      y: 150,
      guard: '',
      action: 'outJob = j',
      io_type: 'internal'
    },
    {
      id: 'qualityCheckPass',
      label: 'QC Pass',
      x: 1000,
      y: 100,
      // Guard: check if priority is High (pass high priority orders)
      guard: 'priority(order(j)) == High()',
      // Produce Product ADT with order ID and Pass quality
      action: 'prod = Product(id(order(j)), Pass())',
      io_type: 'output'
    },
    {
      id: 'qualityCheckFail',
      label: 'QC Fail',
      x: 1000,
      y: 200,
      // Guard: Normal priority goes to rework
      guard: 'priority(order(j)) == Normal()',
      action: 'reworkJob = j',
      io_type: 'output'
    }
  ],
  
  arcs: [
    // Schedule job: consume order and material, produce Job ADT
    { 
      id: 'arc1', 
      source: 'orderQueue', 
      target: 'scheduleJob', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'ord' 
    },
    { 
      id: 'arc2', 
      source: 'rawMaterialSupply', 
      target: 'scheduleJob', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'mat' 
    },
    { 
      id: 'arc3', 
      source: 'scheduleJob', 
      target: 'scheduledJobs', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'job'  // Output from action
    },
    
    // Start Stage 1: consume job, produce to stage1
    { 
      id: 'arc4', 
      source: 'scheduledJobs', 
      target: 'startStage1', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'j' 
    },
    { 
      id: 'arc5', 
      source: 'startStage1', 
      target: 'stage1InProgress', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'outJob' 
    },
    
    // Complete Stage 1: move to stage 2
    { 
      id: 'arc6', 
      source: 'stage1InProgress', 
      target: 'completeStage1', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'j' 
    },
    { 
      id: 'arc7', 
      source: 'completeStage1', 
      target: 'stage2InProgress', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'outJob' 
    },
    
    // Complete Stage 2: move to stage 3
    { 
      id: 'arc8', 
      source: 'stage2InProgress', 
      target: 'completeStage2', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'j' 
    },
    { 
      id: 'arc9', 
      source: 'completeStage2', 
      target: 'stage3InProgress', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'outJob' 
    },
    
    // Quality Check Pass: produce Product
    { 
      id: 'arc10', 
      source: 'stage3InProgress', 
      target: 'qualityCheckPass', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'j' 
    },
    { 
      id: 'arc11', 
      source: 'qualityCheckPass', 
      target: 'completedProducts', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'prod' 
    },
    
    // Quality Check Fail: send to rework
    { 
      id: 'arc12', 
      source: 'stage3InProgress', 
      target: 'qualityCheckFail', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'j' 
    },
    { 
      id: 'arc13', 
      source: 'qualityCheckFail', 
      target: 'reworkQueue', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'reworkJob' 
    }
  ]
};
