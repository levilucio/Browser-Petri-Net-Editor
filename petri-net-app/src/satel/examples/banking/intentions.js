/**
 * Test Intentions for Banking Server
 */

export const bankingIntentions = [
  {
    id: 'successful-login-deposit',
    name: 'Successful login and deposit',
    description: 'User logs in successfully and deposits money',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'login' },
        { transition: 'loginSuccess' },
        { transition: 'deposit' },
        { transition: 'depositSuccess' }
      ]
    },
    inputConstraints: [
      { place: 'loginRequest', pattern: '{user: "alice", pin: "1234"}' },
      { place: 'operationRequest', pattern: '{op: "deposit", amount: 100}' }
    ],
    outputExpectations: [
      { place: 'loginStatus', pattern: '"success"' },
      { place: 'operationResult', pattern: '"deposit_success"' },
      { place: 'currentBalance', pattern: '1100' }  // 1000 + 100
    ],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'users',
      representative: 'alice',
      reason: 'All users behave identically for same operations'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'successful-withdraw',
    name: 'Successful withdrawal',
    description: 'User logs in and withdraws money with sufficient balance',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'login' },
        { transition: 'loginSuccess' },
        { transition: 'withdraw' },
        { transition: 'withdrawSuccess' }
      ]
    },
    inputConstraints: [
      { place: 'loginRequest', pattern: '{user: "bob", pin: "5678"}' },
      { place: 'operationRequest', pattern: '{op: "withdraw", amount: 500}' }
    ],
    outputExpectations: [
      { place: 'loginStatus', pattern: '"success"' },
      { place: 'operationResult', pattern: '"withdraw_success"' },
      { place: 'currentBalance', pattern: '500' }  // 1000 - 500
    ],
    oracleType: 'positive'
  },
  
  {
    id: 'failed-withdraw-insufficient',
    name: 'Failed withdrawal: Insufficient funds',
    description: 'User tries to withdraw more than balance',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'login' },
        { transition: 'loginSuccess' },
        { transition: 'withdraw' },
        { transition: 'withdrawError' }
      ]
    },
    inputConstraints: [
      { place: 'loginRequest', pattern: '{user: "charlie", pin: "9999"}' },
      { place: 'operationRequest', pattern: '{op: "withdraw", amount: 2000}' },
      { place: 'accountBalance', pattern: '1000' }
    ],
    outputExpectations: [
      { place: 'operationResult', pattern: '"insufficient_funds"' }
    ],
    reductionHypothesis: {
      type: 'axiom-based',
      reason: 'Withdrawal error uses same guard/action structure regardless of amount'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'multiple-deposits',
    name: 'Multiple deposits in sequence',
    description: 'User makes multiple deposits',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'login' },
        { transition: 'loginSuccess' },
        { transition: 'deposit' },
        { transition: 'depositSuccess' },
        { transition: 'deposit' },
        { transition: 'depositSuccess' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [
      { place: 'operationResult', pattern: '"deposit_success"' }
    ],
    reductionHypothesis: {
      type: 'regularity',
      reason: 'Test loop boundary: 1, 2, many deposits'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'complete-session',
    name: 'Complete banking session',
    description: 'User logs in, deposits, withdraws, and logs out',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'login' },
        { transition: 'loginSuccess' },
        { transition: 'deposit' },
        { transition: 'depositSuccess' },
        { transition: 'withdraw' },
        { transition: 'withdrawSuccess' },
        { transition: 'logout' }
      ]
    },
    inputConstraints: [],
    outputExpectations: [
      { place: 'loginStatus', pattern: '"logged_out"' }
    ],
    oracleType: 'positive'
  }
];
