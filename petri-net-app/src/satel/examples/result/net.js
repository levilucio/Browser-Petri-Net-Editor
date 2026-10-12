/**
 * Result-Based Validation Pipeline
 * Demonstrates ADT constructor partitioning with Result type
 * 
 * Result<Int, String> = Ok(value: Int) | Err(error: String)
 */

export const resultNet = {
  mode: 'algebraic',
  places: [
    {
      id: 'inputs',
      label: 'Inputs',
      x: 100,
      y: 200,
      tokens: 3,
      valueTokens: [
        { __adt__: true, constructor: 'Ok', args: [100] },
        { __adt__: true, constructor: 'Ok', args: [200] },
        { __adt__: true, constructor: 'Err', args: ['Invalid input'] }
      ],
      sort: 'Result',
      io_type: 'input',
      io_description: 'Validation results (Ok or Err)'
    },
    {
      id: 'validated',
      label: 'Validated',
      x: 400,
      y: 150,
      tokens: 0,
      valueTokens: [],
      sort: 'Int',
      io_type: 'output',
      io_description: 'Successfully validated values'
    },
    {
      id: 'errors',
      label: 'Errors',
      x: 400,
      y: 250,
      tokens: 0,
      valueTokens: [],
      sort: 'String',
      io_type: 'output',
      io_description: 'Error messages'
    }
  ],
  transitions: [
    {
      id: 'acceptValid',
      label: 'Accept Valid',
      x: 250,
      y: 150,
      guard: 'isOk(result)',
      action: 'value = unwrap(result)',
      io_type: 'internal',
      io_description: 'Accept Ok results'
    },
    {
      id: 'rejectInvalid',
      label: 'Reject Invalid',
      x: 250,
      y: 250,
      guard: 'isErr(result)',
      action: 'error = unwrapErr(result)',
      io_type: 'internal',
      io_description: 'Reject Err results'
    }
  ],
  arcs: [
    // Accept Ok
    { 
      id: 'arc1', 
      source: 'inputs', 
      target: 'acceptValid', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'result' 
    },
    { 
      id: 'arc2', 
      source: 'acceptValid', 
      target: 'validated', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'value' 
    },
    
    // Reject Err
    { 
      id: 'arc3', 
      source: 'inputs', 
      target: 'rejectInvalid', 
      sourceType: 'place', 
      targetType: 'transition', 
      binding: 'result' 
    },
    { 
      id: 'arc4', 
      source: 'rejectInvalid', 
      target: 'errors', 
      sourceType: 'transition', 
      targetType: 'place', 
      binding: 'error' 
    }
  ]
};
