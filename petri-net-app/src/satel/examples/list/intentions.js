/**
 * Test Intentions for List Processing Example
 * Demonstrates ADT constructor partitioning
 */

export const listIntentions = [
  {
    id: 'process-non-empty',
    name: 'Process Non-Empty List',
    description: 'Non-empty lists should be processed',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'processNonEmpty' }
      ]
    },
    oracle: {
      type: 'axiom',
      reason: 'Non-empty lists (Cons) satisfy guard length > 0'
    },
    oracleType: 'positive'
  },
  {
    id: 'reject-empty',
    name: 'Reject Empty List',
    description: 'Empty lists should be rejected',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'rejectEmpty' }
      ]
    },
    oracle: {
      type: 'axiom',
      reason: 'Empty list (Nil) satisfies guard length == 0'
    },
    oracleType: 'positive'
  }
];
