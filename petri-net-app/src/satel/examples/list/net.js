/**
 * List Processing Example - Demonstrates ADT Constructor Partitioning
 * 
 * This example shows how subuniformity partitions by List constructors:
 * - Empty list [] (Nil)
 * - Non-empty list [_|_] (Cons)
 */

export const listNet = {
  mode: 'algebraic',
  places: [
    {
      id: 'inputQueue',
      label: 'Input Queue',
      x: 100,
      y: 150,
      tokens: 3,
      valueTokens: [
        [],           // Empty list
        [1],          // Single element
        [1, 2, 3]     // Multiple elements
      ],
      sort: 'List',
      io_type: 'input',
      io_description: 'Lists to process'
    },
    {
      id: 'processed',
      label: 'Processed',
      x: 400,
      y: 150,
      tokens: 0,
      valueTokens: [],
      io_type: 'output',
      io_description: 'Processed lists'
    },
    {
      id: 'rejected',
      label: 'Rejected',
      x: 400,
      y: 250,
      tokens: 0,
      valueTokens: [],
      io_type: 'output',
      io_description: 'Rejected empty lists'
    }
  ],
  transitions: [
    {
      id: 'processNonEmpty',
      label: 'Process Non-Empty',
      x: 250,
      y: 150,
      guard: 'length(lst) > 0',
      action: '',
      io_type: 'internal',
      io_description: 'Process non-empty lists'
    },
    {
      id: 'rejectEmpty',
      label: 'Reject Empty',
      x: 250,
      y: 250,
      guard: 'length(lst) == 0',
      action: '',
      io_type: 'internal',
      io_description: 'Reject empty lists'
    }
  ],
  arcs: [
    // Process non-empty
    { 
      id: 'arc1', 
      source: 'inputQueue', 
      target: 'processNonEmpty', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'lst' 
    },
    { 
      id: 'arc2', 
      source: 'processNonEmpty', 
      target: 'processed', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'lst' 
    },
    
    // Reject empty
    { 
      id: 'arc3', 
      source: 'inputQueue', 
      target: 'rejectEmpty', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'lst' 
    },
    { 
      id: 'arc4', 
      source: 'rejectEmpty', 
      target: 'rejected', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'lst' 
    }
  ]
};
