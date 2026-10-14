/**
 * Test Intentions for Option Request Handler
 * Demonstrates constructor-based test partitioning
 */

export const optionIntentions = [
  {
    id: 'process-some',
    name: 'Process Some Request',
    description: 'Some requests should be processed',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'processRequest' }
      ]
    },
    oracle: {
      type: 'constructor',
      constructor: 'Some',
      reason: 'Some values satisfy isSome(req) guard'
    },
    oracleType: 'positive'
  },
  {
    id: 'reject-none',
    name: 'Reject None Request',
    description: 'None requests should be rejected',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'rejectNone' }
      ]
    },
    oracle: {
      type: 'constructor',
      constructor: 'None',
      reason: 'None values satisfy isNone(req) guard'
    },
    oracleType: 'positive'
  }
];
