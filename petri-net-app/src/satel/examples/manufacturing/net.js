/**
 * Simplified Manufacturing Net with ADT Tokens
 * 
 * Correctly uses Order/Material/Job ADT terms
 */

import { manufacturingADTs, createOrder, createMaterial, createJob, createProduct } from './adt.js';

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
      valueTokens: [createOrder(1, { __adt__: true, constructor: 'Normal', args: [] })],
      io_type: 'input'
    },
    {
      id: 'rawMaterialSupply',
      label: 'Raw Material',
      x: 100,
      y: 250,
      tokens: 1,
      valueTokens: [createMaterial(100)],
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
      io_type: 'internal'
    },
    {
      id: 'stage1InProgress',
      label: 'Stage 1',
      x: 500,
      y: 150,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal'
    },
    {
      id: 'stage2InProgress',
      label: 'Stage 2',
      x: 700,
      y: 150,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal'
    },
    {
      id: 'stage3InProgress',
      label: 'Stage 3',
      x: 900,
      y: 150,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal'
    },
    {
      id: 'machineStatus',
      label: 'Machines',
      x: 300,
      y: 300,
      tokens: 3,
      valueTokens: [{ value: 1 }, { value: 1 }, { value: 1 }],
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
      io_type: 'output'
    },
    {
      id: 'reworkQueue',
      label: 'Rework',
      x: 1100,
      y: 200,
      tokens: 0,
      valueTokens: [],
      io_type: 'output'
    }
  ],
  
  transitions: [
    {
      id: 'scheduleJob',
      label: 'Schedule Job',
      x: 200,
      y: 200,
      guard: 'quantity(material) >= 50',
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
    // Schedule job
    { id: 'arc1', source: 'orderQueue', target: 'scheduleJob', sourceType: 'place', targetType: 'transition', inscription: 'order' },
    { id: 'arc2', source: 'rawMaterialSupply', target: 'scheduleJob', sourceType: 'place', targetType: 'transition', inscription: 'material' },
    { id: 'arc3', source: 'scheduleJob', target: 'scheduledJobs', sourceType: 'transition', targetType: 'place', inscription: 'Job(order, material)' },
    
    // Start Stage 1
    { id: 'arc4', source: 'scheduledJobs', target: 'startStage1', sourceType: 'place', targetType: 'transition', inscription: 'job' },
    { id: 'arc5', source: 'machineStatus', target: 'startStage1', sourceType: 'place', targetType: 'transition', inscription: 'm' },
    { id: 'arc6', source: 'startStage1', target: 'stage1InProgress', sourceType: 'transition', targetType: 'place', inscription: 'job' },
    
    // Complete Stage 1
    { id: 'arc7', source: 'stage1InProgress', target: 'completeStage1', sourceType: 'place', targetType: 'transition', inscription: 'job' },
    { id: 'arc8', source: 'completeStage1', target: 'stage2InProgress', sourceType: 'transition', targetType: 'place', inscription: 'job' },
    
    // Complete Stage 2
    { id: 'arc9', source: 'stage2InProgress', target: 'completeStage2', sourceType: 'place', targetType: 'transition', inscription: 'job' },
    { id: 'arc10', source: 'completeStage2', target: 'stage3InProgress', sourceType: 'transition', targetType: 'place', inscription: 'job' },
    
    // Quality Check Pass
    { id: 'arc11', source: 'stage3InProgress', target: 'qualityCheckPass', sourceType: 'place', targetType: 'transition', inscription: 'job' },
    { id: 'arc12', source: 'qualityCheckPass', target: 'completedProducts', sourceType: 'transition', targetType: 'place', inscription: 'Product(id(order(job)), Pass())' },
    { id: 'arc13', source: 'qualityCheckPass', target: 'machineStatus', sourceType: 'transition', targetType: 'place', inscription: '1' },
    
    // Quality Check Fail
    { id: 'arc14', source: 'stage3InProgress', target: 'qualityCheckFail', sourceType: 'place', targetType: 'transition', inscription: 'job' },
    { id: 'arc15', source: 'qualityCheckFail', target: 'reworkQueue', sourceType: 'transition', targetType: 'place', inscription: 'job' },
    { id: 'arc16', source: 'qualityCheckFail', target: 'machineStatus', sourceType: 'transition', targetType: 'place', inscription: '1' }
  ]
};
