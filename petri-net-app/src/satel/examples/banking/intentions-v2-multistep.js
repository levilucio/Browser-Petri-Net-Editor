/**
 * Banking Multi-Step V2 Intentions
 * 
 * Multi-step HML-style sequences exercising 3-5 transition banking workflows
 * where balance and operation types drive different paths.
 */

/**
 * Intention: Deposit-Withdraw-Check Cycle
 * 
 * Amount determines success/failure paths:
 * - High balance: login → deposit → withdraw → check (4 transitions)
 * - Low balance: login → deposit → withdraw fails → check (3 transitions, different outcome)
 * - Zero balance: login → deposit → check (3 transitions, no withdraw)
 */
export const depositWithdrawCycle = {
  // Test setup; subsequent pairs only consume tokens already present.
  initialMarking: {
    loginRequest: [{ userId: 'user1', password: 'pass123' }]
  },

  id: 'deposit-withdraw-cycle',
  name: 'Deposit-Withdraw-Check Balance Cycle',
  testType: 'positive',
  variables: [
    {
      name: 'depositAmount',
      sort: 'Nat',
      hypothesis: {
        type: 'uniformity',
        representative: 500
      }
    },
    {
      name: 'withdrawAmount',
      sort: 'Nat',
      hypothesis: {
        type: 'subuniformity',
        source: 'path-conditions',
        bounds: { min: 0, max: 1000 }
      },
      description: 'Withdraw amount determines if operation succeeds based on balance'
    }
  ],
  pairs: [
    // Step 1: Login
    {
      stimulation: {
        transition: 'login',
        inputs: {
          loginRequest: [{ userId: 'user1', password: 'pass123' }]
        }
      },
      observation: {
        outputs: {
          sessionActive: [{ userId: 'user1', sessionId: 'sess1' }],
          loginStatus: [{ success: true }]
        }
      }
    },
    // Step 2: Deposit
    {
      stimulation: {
        transition: 'deposit',
        inputs: {
          operationRequest: [{ operation: 'deposit', amount: '$depositAmount' }]
        }
      },
      observation: {
        outputs: {
          accountBalance: [{ balance: 1500 }],  // 1000 + 500
          operationResult: [{ success: true, newBalance: 1500 }]
        }
      }
    },
    // Step 3: Withdraw (conditional based on amount vs balance)
    {
      stimulation: {
        transition: 'withdraw',
        inputs: {
          operationRequest: [{ operation: 'withdraw', amount: '$withdrawAmount' }]
        },
        guard: 'balance >= withdrawAmount'
      },
      observation: {
        conditional: true,  // May succeed or fail
        outputs: {
          accountBalance: [],  // Balance depends on withdraw amount
          operationResult: [{ success: true }]
        }
      }
    },
    // Step 4: Check balance
    {
      stimulation: {
        transition: 'checkBalance',
        inputs: {}
      },
      observation: {
        outputs: {
          operationResult: [{ operation: 'balance', amount: '$resultBalance' }]
        }
      }
    }
  ]
};

/**
 * Intention: Multiple Deposits with Overdraft Protection
 * 
 * Sequence of deposits followed by large withdraw:
 * - deposit1 → deposit2 → withdraw_large → check (4 transitions)
 * Tests accumulation and guard-protected withdraw
 */
export const multipleDepositsPath = {
  // Test setup; subsequent pairs only consume tokens already present.
  initialMarking: {
    loginRequest: [{ userId: 'user2', password: 'pass456' }]
  },

  id: 'multiple-deposits',
  name: 'Multiple Deposits then Large Withdraw',
  testType: 'positive',
  variables: [],
  pairs: [
    // Login
    {
      stimulation: {
        transition: 'login',
        inputs: {
          loginRequest: [{ userId: 'user2', password: 'pass456' }]
        }
      },
      observation: {
        outputs: {
          sessionActive: [{ userId: 'user2' }],
          loginStatus: [{ success: true }]
        }
      }
    },
    // First deposit
    {
      stimulation: {
        transition: 'deposit',
        inputs: {
          operationRequest: [{ operation: 'deposit', amount: 300 }]
        }
      },
      observation: {
        outputs: {
          accountBalance: [{ balance: 1300 }]
        }
      }
    },
    // Second deposit
    {
      stimulation: {
        transition: 'deposit',
        inputs: {
          operationRequest: [{ operation: 'deposit', amount: 200 }]
        }
      },
      observation: {
        outputs: {
          accountBalance: [{ balance: 1500 }]
        }
      }
    },
    // Large withdraw (tests accumulated balance)
    {
      stimulation: {
        transition: 'withdraw',
        inputs: {
          operationRequest: [{ operation: 'withdraw', amount: 800 }]
        }
      },
      observation: {
        outputs: {
          accountBalance: [{ balance: 700 }],
          operationResult: [{ success: true, newBalance: 700 }]
        }
      }
    },
    // Final balance check
    {
      stimulation: {
        transition: 'checkBalance',
        inputs: {}
      },
      observation: {
        outputs: {
          operationResult: [{ operation: 'balance', amount: 700 }]
        }
      }
    }
  ]
};

/**
 * Intention: Failed Withdraw with Retry
 * 
 * Insufficient balance → withdraw fails → deposit → withdraw succeeds:
 * login → withdraw_fail → deposit → withdraw_success → check (5 transitions)
 */
export const failedWithdrawRetry = {
  // Test setup; subsequent pairs only consume tokens already present.
  initialMarking: {
    loginRequest: [{ userId: 'user3', password: 'pass789' }],
    accountBalance: [{ balance: 100 }]  // Override initial balance
  },

  id: 'failed-withdraw-retry',
  name: 'Failed Withdraw then Retry after Deposit',
  testType: 'positive',
  variables: [],
  pairs: [
    // Login with low initial balance (100)
    {
      stimulation: {
        transition: 'login',
        inputs: {
          loginRequest: [{ userId: 'user3', password: 'pass789' }],
          accountBalance: [{ balance: 100 }]  // Override initial balance
        }
      },
      observation: {
        outputs: {
          sessionActive: [{ userId: 'user3' }]
        }
      }
    },
    // Attempt large withdraw (should fail)
    {
      stimulation: {
        transition: 'withdraw',
        inputs: {
          operationRequest: [{ operation: 'withdraw', amount: 500 }]
        }
      },
      observation: {
        type: 'notEnabled',  // Guard rejects: balance < amount
        outputs: {},
        markings: {}
      }
    },
    // Deposit to increase balance
    {
      stimulation: {
        transition: 'deposit',
        inputs: {
          operationRequest: [{ operation: 'deposit', amount: 600 }]
        }
      },
      observation: {
        outputs: {
          accountBalance: [{ balance: 700 }]
        }
      }
    },
    // Retry withdraw (now succeeds)
    {
      stimulation: {
        transition: 'withdraw',
        inputs: {
          operationRequest: [{ operation: 'withdraw', amount: 500 }]
        }
      },
      observation: {
        outputs: {
          accountBalance: [{ balance: 200 }],
          operationResult: [{ success: true, newBalance: 200 }]
        }
      }
    },
    // Check final balance
    {
      stimulation: {
        transition: 'checkBalance',
        inputs: {}
      },
      observation: {
        outputs: {
          operationResult: [{ operation: 'balance', amount: 200 }]
        }
      }
    }
  ]
};

/**
 * Intention: Concurrent Sessions with Different Outcomes
 * 
 * Two users with different initial balances perform operations:
 * user1 (high balance): deposit → withdraw_large → success
 * user2 (low balance): deposit → withdraw_large → fail
 * 
 * Tests that balance guards partition behavior correctly.
 */
export const concurrentSessionsPaths = {
  // Test setup; subsequent pairs only consume tokens already present.
  initialMarking: {
    loginRequest: [
      { userId: 'user1', password: 'pass1', initialBalance: '$user1Balance' },
      { userId: 'user2', password: 'pass2', initialBalance: '$user2Balance' }
    ]
  },

  id: 'concurrent-sessions',
  name: 'Concurrent User Sessions (Balance-Dependent Paths)',
  testType: 'positive',
  variables: [
    {
      name: 'user1Balance',
      sort: 'Nat',
      hypothesis: {
        type: 'subuniformity',
        source: 'path-conditions'
      }
    },
    {
      name: 'user2Balance',
      sort: 'Nat',
      hypothesis: {
        type: 'subuniformity',
        source: 'path-conditions'
      }
    }
  ],
  pairs: [
    // Login both users
    {
      stimulation: {
        transition: 'login',
        inputs: {
          loginRequest: [
            { userId: 'user1', password: 'pass1', initialBalance: '$user1Balance' },
            { userId: 'user2', password: 'pass2', initialBalance: '$user2Balance' }
          ]
        }
      },
      observation: {
        outputs: {
          sessionActive: [
            { userId: 'user1' },
            { userId: 'user2' }
          ]
        }
      }
    },
    // User1 withdraw
    {
      stimulation: {
        transition: 'withdraw',
        inputs: {
          operationRequest: [{ userId: 'user1', operation: 'withdraw', amount: 800 }]
        }
      },
      observation: {
        conditional: true,
        outputs: {}  // Success depends on user1Balance
      }
    },
    // User2 withdraw
    {
      stimulation: {
        transition: 'withdraw',
        inputs: {
          operationRequest: [{ userId: 'user2', operation: 'withdraw', amount: 800 }]
        }
      },
      observation: {
        conditional: true,
        outputs: {}  // Success depends on user2Balance
      }
    }
  ]
};

// Export all banking multi-step intentions
export const bankingMultiStepIntentions = [
  depositWithdrawCycle,
  multipleDepositsPath,
  failedWithdrawRetry,
  concurrentSessionsPaths
];
