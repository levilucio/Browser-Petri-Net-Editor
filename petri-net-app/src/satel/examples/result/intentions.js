/**
 * Test Intentions for Result Validation Pipeline
 * Demonstrates constructor-based test partitioning
 */

export const resultIntentions = [
  {
    id: 'accept-ok',
    name: 'Accept Ok Result',
    description: 'Ok results should be accepted',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'acceptValid' }
      ]
    },
    oracle: {
      type: 'constructor',
      constructor: 'Ok',
      reason: 'Ok values satisfy isOk(result) guard'
    },
    oracleType: 'positive'
  },
  {
    id: 'reject-err',
    name: 'Reject Err Result',
    description: 'Err results should be rejected',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'rejectInvalid' }
      ]
    },
    oracle: {
      type: 'constructor',
      constructor: 'Err',
      reason: 'Err values satisfy isErr(result) guard'
    },
    oracleType: 'positive'
  }
];
