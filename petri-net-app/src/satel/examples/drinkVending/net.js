/**
 * Drink Vending Machine Example
 * Based on Levi Lucio's thesis example
 */

export const drinkVendingNet = {
  mode: 'algebraic',
  places: [
    // Input places (stimulations)
    {
      id: 'coinSlot',
      label: 'Coin Slot',
      x: 100,
      y: 100,
      tokens: 0,
      valueTokens: [],
      io_type: 'input',
      io_description: 'Coins inserted by user'
    },
    {
      id: 'selection',
      label: 'Drink Selection',
      x: 100,
      y: 200,
      tokens: 0,
      valueTokens: [],
      io_type: 'input',
      io_description: 'Drink selected by user'
    },
    
    // Internal places
    {
      id: 'balance',
      label: 'Balance',
      x: 300,
      y: 100,
      tokens: 1,
      valueTokens: [{ value: 0 }],
      io_type: 'internal',
      io_description: 'Current balance of inserted coins'
    },
    {
      id: 'stock_water',
      label: 'Water Stock',
      x: 500,
      y: 50,
      tokens: 1,
      valueTokens: [{ value: 5 }],
      io_type: 'internal'
    },
    {
      id: 'stock_beer',
      label: 'Beer Stock',
      x: 500,
      y: 150,
      tokens: 1,
      valueTokens: [{ value: 3 }],
      io_type: 'internal'
    },
    
    // Output places (observations)
    {
      id: 'dispensed',
      label: 'Dispensed Drink',
      x: 700,
      y: 100,
      tokens: 0,
      valueTokens: [],
      io_type: 'output',
      io_description: 'Drink dispensed to user'
    },
    {
      id: 'change',
      label: 'Change',
      x: 700,
      y: 200,
      tokens: 0,
      valueTokens: [],
      io_type: 'output',
      io_description: 'Change returned to user'
    },
    {
      id: 'errorMsg',
      label: 'Error Message',
      x: 700,
      y: 300,
      tokens: 0,
      valueTokens: [],
      io_type: 'output',
      io_description: 'Error message to user'
    }
  ],
  
  transitions: [
    // Input transitions
    {
      id: 'insertCoin',
      label: 'Insert Coin',
      x: 200,
      y: 100,
      guard: 'c >= 1',
      action: 'newBalance = balance + c',
      io_type: 'input',
      io_description: 'User inserts coin(s)'
    },
    {
      id: 'selectDrink',
      label: 'Select Drink',
      x: 200,
      y: 200,
      guard: 'd == "water" || d == "beer"',
      io_type: 'input',
      io_description: 'User selects a drink'
    },
    
    // Internal transitions
    {
      id: 'checkPayment',
      label: 'Check Payment',
      x: 400,
      y: 150,
      guard: 'balance >= price',
      action: ''
    },
    
    // Output transitions
    {
      id: 'dispenseWater',
      label: 'Dispense Water',
      x: 600,
      y: 50,
      guard: 'd == "water" && stock > 0 && balance >= 2',
      action: 'newStock = stock - 1; changeAmt = balance - 2',
      io_type: 'output',
      io_description: 'Dispense water to user'
    },
    {
      id: 'dispenseBeer',
      label: 'Dispense Beer',
      x: 600,
      y: 150,
      guard: 'd == "beer" && stock > 0 && balance >= 3',
      action: 'newStock = stock - 1; changeAmt = balance - 3',
      io_type: 'output',
      io_description: 'Dispense beer to user'
    },
    {
      id: 'errorInsufficientFunds',
      label: 'Error: Insufficient Funds',
      x: 600,
      y: 250,
      guard: '(d == "water" && balance < 2) || (d == "beer" && balance < 3)',
      io_type: 'output'
    },
    {
      id: 'errorOutOfStock',
      label: 'Error: Out of Stock',
      x: 600,
      y: 350,
      guard: 'stock <= 0',
      io_type: 'output'
    }
  ],
  
  arcs: [
    // Insert coin
    { id: 'arc1', source: 'coinSlot', target: 'insertCoin', sourceType: 'place', targetType: 'transition', binding: 'c' },
    { id: 'arc2', source: 'balance', target: 'insertCoin', sourceType: 'place', targetType: 'transition', binding: 'balance' },
    { id: 'arc3', source: 'insertCoin', target: 'balance', sourceType: 'transition', targetType: 'place', binding: 'newBalance' },
    
    // Select drink
    { id: 'arc4', source: 'selection', target: 'selectDrink', sourceType: 'place', targetType: 'transition', binding: 'd' },
    
    // Dispense water
    { id: 'arc5', source: 'selectDrink', target: 'dispenseWater', sourceType: 'transition', targetType: 'transition' },
    { id: 'arc6', source: 'stock_water', target: 'dispenseWater', sourceType: 'place', targetType: 'transition', binding: 'stock' },
    { id: 'arc7', source: 'balance', target: 'dispenseWater', sourceType: 'place', targetType: 'transition', binding: 'balance' },
    { id: 'arc8', source: 'dispenseWater', target: 'dispensed', sourceType: 'transition', targetType: 'place', binding: '"water"' },
    { id: 'arc9', source: 'dispenseWater', target: 'stock_water', sourceType: 'transition', targetType: 'place', binding: 'newStock' },
    { id: 'arc10', source: 'dispenseWater', target: 'change', sourceType: 'transition', targetType: 'place', binding: 'changeAmt' },
    { id: 'arc11', source: 'dispenseWater', target: 'balance', sourceType: 'transition', targetType: 'place', binding: '0' },
    
    // Dispense beer
    { id: 'arc12', source: 'selectDrink', target: 'dispenseBeer', sourceType: 'transition', targetType: 'transition' },
    { id: 'arc13', source: 'stock_beer', target: 'dispenseBeer', sourceType: 'place', targetType: 'transition', binding: 'stock' },
    { id: 'arc14', source: 'balance', target: 'dispenseBeer', sourceType: 'place', targetType: 'transition', binding: 'balance' },
    { id: 'arc15', source: 'dispenseBeer', target: 'dispensed', sourceType: 'transition', targetType: 'place', binding: '"beer"' },
    { id: 'arc16', source: 'dispenseBeer', target: 'stock_beer', sourceType: 'transition', targetType: 'place', binding: 'newStock' },
    { id: 'arc17', source: 'dispenseBeer', target: 'change', sourceType: 'transition', targetType: 'place', binding: 'changeAmt' },
    { id: 'arc18', source: 'dispenseBeer', target: 'balance', sourceType: 'transition', targetType: 'place', binding: '0' },
    
    // Error: insufficient funds
    { id: 'arc19', source: 'selectDrink', target: 'errorInsufficientFunds', sourceType: 'transition', targetType: 'transition' },
    { id: 'arc20', source: 'balance', target: 'errorInsufficientFunds', sourceType: 'place', targetType: 'transition', binding: 'balance' },
    { id: 'arc21', source: 'errorInsufficientFunds', target: 'errorMsg', sourceType: 'transition', targetType: 'place', binding: '"insufficient_funds"' },
    { id: 'arc22', source: 'errorInsufficientFunds', target: 'balance', sourceType: 'transition', targetType: 'place', binding: 'balance' },
    
    // Error: out of stock
    { id: 'arc23', source: 'selectDrink', target: 'errorOutOfStock', sourceType: 'transition', targetType: 'transition' },
    { id: 'arc24', source: 'stock_water', target: 'errorOutOfStock', sourceType: 'place', targetType: 'transition', binding: 'stock' },
    { id: 'arc25', source: 'errorOutOfStock', target: 'errorMsg', sourceType: 'transition', targetType: 'place', binding: '"out_of_stock"' },
    { id: 'arc26', source: 'errorOutOfStock', target: 'stock_water', sourceType: 'transition', targetType: 'place', binding: 'stock' }
  ]
};
