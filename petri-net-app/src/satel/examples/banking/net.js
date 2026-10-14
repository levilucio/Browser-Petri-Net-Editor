/**
 * Banking Server Example
 * Simplified banking operations with account management
 */

export const bankingNet = {
  mode: 'algebraic',
  places: [
    // Input places
    {
      id: 'loginRequest',
      label: 'Login Request',
      x: 100,
      y: 100,
      tokens: 0,
      valueTokens: [],
      io_type: 'input'
    },
    {
      id: 'operationRequest',
      label: 'Operation Request',
      x: 100,
      y: 200,
      tokens: 0,
      valueTokens: [],
      io_type: 'input'
    },
    
    // Internal places
    {
      id: 'sessionActive',
      label: 'Active Session',
      x: 300,
      y: 100,
      tokens: 0,
      valueTokens: [],
      io_type: 'internal'
    },
    {
      id: 'accountBalance',
      label: 'Account Balance',
      x: 300,
      y: 200,
      tokens: 1,
      valueTokens: [{ value: 1000 }],  // Initial balance
      io_type: 'internal'
    },
    
    // Output places
    {
      id: 'loginStatus',
      label: 'Login Status',
      x: 500,
      y: 100,
      tokens: 0,
      valueTokens: [],
      io_type: 'output'
    },
    {
      id: 'operationResult',
      label: 'Operation Result',
      x: 500,
      y: 200,
      tokens: 0,
      valueTokens: [],
      io_type: 'output'
    },
    {
      id: 'currentBalance',
      label: 'Current Balance',
      x: 500,
      y: 300,
      tokens: 0,
      valueTokens: [],
      io_type: 'output'
    }
  ],
  
  transitions: [
    // Input transitions
    {
      id: 'login',
      label: 'Login',
      x: 200,
      y: 100,
      guard: 'user != "" && pin != ""',
      io_type: 'input'
    },
    {
      id: 'deposit',
      label: 'Deposit',
      x: 200,
      y: 200,
      guard: 'amount > 0',
      action: 'newBalance = balance + amount',
      io_type: 'input'
    },
    {
      id: 'withdraw',
      label: 'Withdraw',
      x: 200,
      y: 300,
      guard: 'amount > 0 && balance >= amount',
      action: 'newBalance = balance - amount',
      io_type: 'input'
    },
    {
      id: 'logout',
      label: 'Logout',
      x: 400,
      y: 100,
      io_type: 'input'
    },
    
    // Output transitions
    {
      id: 'loginSuccess',
      label: 'Login Success',
      x: 400,
      y: 150,
      io_type: 'output'
    },
    {
      id: 'depositSuccess',
      label: 'Deposit Success',
      x: 400,
      y: 250,
      io_type: 'output'
    },
    {
      id: 'withdrawSuccess',
      label: 'Withdraw Success',
      x: 400,
      y: 350,
      guard: 'balance >= amount',
      io_type: 'output'
    },
    {
      id: 'withdrawError',
      label: 'Withdraw Error',
      x: 400,
      y: 400,
      guard: 'balance < amount',
      io_type: 'output'
    }
  ],
  
  arcs: [
    // Login
    { id: 'a1', source: 'loginRequest', target: 'login', binding: '{user, pin}' },
    { id: 'a2', source: 'login', target: 'loginSuccess' },
    { id: 'a3', source: 'loginSuccess', target: 'sessionActive', binding: 'user' },
    { id: 'a4', source: 'loginSuccess', target: 'loginStatus', binding: '"success"' },
    
    // Deposit
    { id: 'a5', source: 'operationRequest', target: 'deposit', binding: '{op: "deposit", amount}' },
    { id: 'a6', source: 'sessionActive', target: 'deposit', binding: 'user' },
    { id: 'a7', source: 'accountBalance', target: 'deposit', binding: 'balance' },
    { id: 'a8', source: 'deposit', target: 'depositSuccess' },
    { id: 'a9', source: 'depositSuccess', target: 'sessionActive', binding: 'user' },
    { id: 'a10', source: 'depositSuccess', target: 'accountBalance', binding: 'newBalance' },
    { id: 'a11', source: 'depositSuccess', target: 'operationResult', binding: '"deposit_success"' },
    { id: 'a12', source: 'depositSuccess', target: 'currentBalance', binding: 'newBalance' },
    
    // Withdraw
    { id: 'a13', source: 'operationRequest', target: 'withdraw', binding: '{op: "withdraw", amount}' },
    { id: 'a14', source: 'sessionActive', target: 'withdraw', binding: 'user' },
    { id: 'a15', source: 'accountBalance', target: 'withdraw', binding: 'balance' },
    { id: 'a16', source: 'withdraw', target: 'withdrawSuccess' },
    { id: 'a17', source: 'withdrawSuccess', target: 'sessionActive', binding: 'user' },
    { id: 'a18', source: 'withdrawSuccess', target: 'accountBalance', binding: 'newBalance' },
    { id: 'a19', source: 'withdrawSuccess', target: 'operationResult', binding: '"withdraw_success"' },
    { id: 'a20', source: 'withdrawSuccess', target: 'currentBalance', binding: 'newBalance' },
    { id: 'a21', source: 'withdraw', target: 'withdrawError' },
    { id: 'a22', source: 'withdrawError', target: 'sessionActive', binding: 'user' },
    { id: 'a23', source: 'withdrawError', target: 'accountBalance', binding: 'balance' },
    { id: 'a24', source: 'withdrawError', target: 'operationResult', binding: '"insufficient_funds"' },
    
    // Logout
    { id: 'a25', source: 'sessionActive', target: 'logout', binding: 'user' },
    { id: 'a26', source: 'logout', target: 'loginStatus', binding: '"logged_out"' }
  ]
};
