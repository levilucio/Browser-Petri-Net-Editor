/**
 * Test Intentions for Drink Vending Machine
 */

export const drinkVendingIntentions = [
  {
    id: 'buy-water-exact',
    name: 'Buy water with exact payment',
    description: 'User inserts 2 coins and selects water (price=2). Water is dispensed with no change.',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'insertCoin', binding: { c: 2 } },
        { transition: 'selectDrink', binding: { d: 'water' } },
        { transition: 'dispenseWater' }
      ]
    },
    inputConstraints: [
      { place: 'coinSlot', pattern: '2' },
      { place: 'selection', pattern: '"water"' }
    ],
    outputExpectations: [
      { place: 'dispensed', pattern: '"water"' },
      { place: 'change', pattern: '0' }
    ],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'drinks',
      representative: 'water',
      reason: 'All drinks behave identically if payment >= price'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'buy-water-overpayment',
    name: 'Buy water with overpayment',
    description: 'User inserts 3 coins and selects water (price=2). Water is dispensed with 1 coin change.',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'insertCoin', binding: { c: 3 } },
        { transition: 'selectDrink', binding: { d: 'water' } },
        { transition: 'dispenseWater' }
      ]
    },
    inputConstraints: [
      { place: 'coinSlot', pattern: '3' },
      { place: 'selection', pattern: '"water"' }
    ],
    outputExpectations: [
      { place: 'dispensed', pattern: '"water"' },
      { place: 'change', pattern: '1' }
    ],
    reductionHypothesis: {
      type: 'regularity',
      domain: 'overpayment',
      reason: 'Test boundary: exact, +1, +2 overpayment'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'buy-beer-exact',
    name: 'Buy beer with exact payment',
    description: 'User inserts 3 coins and selects beer (price=3). Beer is dispensed with no change.',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'insertCoin', binding: { c: 3 } },
        { transition: 'selectDrink', binding: { d: 'beer' } },
        { transition: 'dispenseBeer' }
      ]
    },
    inputConstraints: [
      { place: 'coinSlot', pattern: '3' },
      { place: 'selection', pattern: '"beer"' }
    ],
    outputExpectations: [
      { place: 'dispensed', pattern: '"beer"' },
      { place: 'change', pattern: '0' }
    ],
    oracleType: 'positive'
  },
  
  {
    id: 'error-insufficient-funds-water',
    name: 'Error: Insufficient funds for water',
    description: 'User inserts 1 coin and selects water (price=2). Error message is displayed.',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'insertCoin', binding: { c: 1 } },
        { transition: 'selectDrink', binding: { d: 'water' } },
        { transition: 'errorInsufficientFunds' }
      ]
    },
    inputConstraints: [
      { place: 'coinSlot', pattern: '1' },
      { place: 'selection', pattern: '"water"' }
    ],
    outputExpectations: [
      { place: 'errorMsg', pattern: '"insufficient_funds"' }
    ],
    reductionHypothesis: {
      type: 'uniformity',
      domain: 'drinks',
      representative: 'water',
      reason: 'Insufficient funds error uniform across drinks'
    },
    oracleType: 'positive'
  },
  
  {
    id: 'error-out-of-stock',
    name: 'Error: Out of stock',
    description: 'User selects a drink when stock is 0. Error message is displayed.',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'insertCoin', binding: { c: 3 } },
        { transition: 'selectDrink', binding: { d: 'water' } },
        { transition: 'errorOutOfStock' }
      ]
    },
    inputConstraints: [
      { place: 'coinSlot', pattern: '3' },
      { place: 'selection', pattern: '"water"' },
      { place: 'stock_water', pattern: '0' }  // Override: no stock
    ],
    outputExpectations: [
      { place: 'errorMsg', pattern: '"out_of_stock"' }
    ],
    oracleType: 'positive'
  },
  
  {
    id: 'negative-dispense-without-payment',
    name: 'Negative: Cannot dispense without payment',
    description: 'User tries to select drink without inserting coins. Should not dispense.',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'selectDrink', binding: { d: 'water' } },
        { transition: 'dispenseWater' }
      ]
    },
    inputConstraints: [
      { place: 'selection', pattern: '"water"' },
      { place: 'balance', pattern: '0' }
    ],
    outputExpectations: [],
    oracleType: 'negative'  // This behavior should be forbidden
  }
];
