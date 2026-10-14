/**
 * Option Request Handler Example
 * Demonstrates ADT constructor partitioning with Option type
 * 
 * Option<Int> = None | Some(value: Int)
 */

export const optionNet = {
  mode: 'algebraic',
  places: [
    {
      id: 'requests',
      label: 'Requests',
      x: 100,
      y: 200,
      tokens: 2,
      valueTokens: [
        { __adt__: true, constructor: 'Some', args: [42] },
        { __adt__: true, constructor: 'None', args: [] }
      ],
      sort: 'Option',
      io_type: 'input',
      io_description: 'Incoming requests (Some with value or None)'
    },
    {
      id: 'processed',
      label: 'Processed',
      x: 400,
      y: 150,
      tokens: 0,
      valueTokens: [],
      sort: 'Int',
      io_type: 'output',
      io_description: 'Successfully processed values'
    },
    {
      id: 'rejected',
      label: 'Rejected',
      x: 400,
      y: 250,
      tokens: 0,
      valueTokens: [],
      sort: 'Option',
      io_type: 'output',
      io_description: 'Rejected None requests'
    }
  ],
  transitions: [
    {
      id: 'processRequest',
      label: 'Process Request',
      x: 250,
      y: 150,
      guard: 'isSome(req)',
      action: 'value = unwrap(req)',
      io_type: 'internal',
      io_description: 'Process Some requests'
    },
    {
      id: 'rejectNone',
      label: 'Reject None',
      x: 250,
      y: 250,
      guard: 'isNone(req)',
      action: '',
      io_type: 'internal',
      io_description: 'Reject None requests'
    }
  ],
  arcs: [
    // Process Some
    { 
      id: 'arc1', 
      source: 'requests', 
      target: 'processRequest', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'req' 
    },
    { 
      id: 'arc2', 
      source: 'processRequest', 
      target: 'processed', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'value' 
    },
    
    // Reject None
    { 
      id: 'arc3', 
      source: 'requests', 
      target: 'rejectNone', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'req' 
    },
    { 
      id: 'arc4', 
      source: 'rejectNone', 
      target: 'rejected', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'req' 
    }
  ]
};
