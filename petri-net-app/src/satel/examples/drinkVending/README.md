# Drink Vending Machine Example

This example demonstrates SATEL test intentions for a drink vending machine, inspired by Levi Lucio's PhD thesis (2009).

## System Description

The drink vending machine (DVM) controller:
- Accepts coins from users (stimulation)
- Allows drink selection: water (price=2) or beer (price=3) (stimulation)
- Dispenses drinks if payment is sufficient (observation)
- Returns change if overpayment (observation)
- Shows error messages for insufficient funds or out of stock (observation)

## I/O Interface

### Stimulations (Inputs)
- **coinSlot**: Place where users insert coins
- **selection**: Place where users select drinks
- **insertCoin**: Transition for inserting coins (input transition)
- **selectDrink**: Transition for selecting drinks (input transition)

### Observations (Outputs)
- **dispensed**: Place containing dispensed drink
- **change**: Place containing returned change
- **errorMsg**: Place containing error messages
- **dispenseWater**: Transition for dispensing water (output transition)
- **dispenseBeer**: Transition for dispensing beer (output transition)
- **errorInsufficientFunds**: Transition for insufficient funds error
- **errorOutOfStock**: Transition for out of stock error

### Internal Elements
- **balance**: Current balance of inserted coins
- **stock_water**: Number of water bottles available
- **stock_beer**: Number of beer bottles available

## Test Intentions

### 1. Buy water with exact payment
- **Intention**: User inserts 2 coins, selects water, receives water with no change
- **HML Formula**: `<insertCoin(2)><selectDrink(water)><dispenseWater> => true`
- **Reduction**: Uniformity hypothesis - all drinks behave identically if payment sufficient

### 2. Buy water with overpayment
- **Intention**: User inserts 3 coins, selects water, receives water with 1 coin change
- **HML Formula**: `<insertCoin(3)><selectDrink(water)><dispenseWater> => true`
- **Reduction**: Regularity hypothesis - test boundary cases (exact, +1, +2 overpayment)

### 3. Buy beer with exact payment
- **Intention**: User inserts 3 coins, selects beer, receives beer with no change
- **HML Formula**: `<insertCoin(3)><selectDrink(beer)><dispenseBeer> => true`

### 4. Error: Insufficient funds for water
- **Intention**: User inserts 1 coin, selects water, receives error message
- **HML Formula**: `<insertCoin(1)><selectDrink(water)><errorInsufficientFunds> => true`
- **Reduction**: Uniformity hypothesis - error uniform across drinks

### 5. Error: Out of stock
- **Intention**: User selects drink when stock is 0, receives error message
- **HML Formula**: `<insertCoin(3)><selectDrink(water)><errorOutOfStock> => true`

### 6. Negative: Cannot dispense without payment
- **Intention**: User selects drink without payment, system should NOT dispense
- **HML Formula**: `<selectDrink(water)><dispenseWater> => false`
- **Oracle Type**: Negative (forbidden behavior)

## Test Generation

The test generator will:
1. Build the reachability graph from initial marking
2. Find paths matching each intention's pattern
3. Apply reduction hypotheses (uniformity for drinks)
4. Generate test cases with oracles
5. Reduce from ~10-20 cases to ~6 representative cases

## Expected Coverage

With 6 test intentions and reduction:
- **Positive tests**: 5 (successful operations)
- **Negative tests**: 1 (forbidden behavior)
- **Equivalence classes**: 3 (buy drink, insufficient funds, out of stock)
- **Reduction ratio**: ~50% (from exhaustive to reduced set)

## Running the Example

```javascript
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator.js';
import { generateTestSuite, executeTestSuite } from '../../satel/index.js';
import { drinkVendingNet } from './net.js';
import { drinkVendingIntentions } from './intentions.js';

const simulator = new AlgebraicSimulator();

// Generate test suite
const testSuite = await generateTestSuite(
  drinkVendingIntentions,
  drinkVendingNet,
  simulator
);

console.log(`Generated ${testSuite.testCases.length} test cases`);

// Execute tests
const results = await executeTestSuite(testSuite, drinkVendingNet, simulator);
console.log(`Passed: ${results.passed}/${results.totalTests}`);
```

## Thesis Mapping

This example maps directly to Chapter 1 (Section 1.2.1) of Levi Lucio's thesis:
- **Drink types** → Uniformity hypothesis domain
- **Coin insertion** → Stimulation (input method)
- **Drink dispensing** → Observation (output gate)
- **Price checking** → Internal state/guard evaluation
- **Stock management** → State invariant

## Notes

- The thesis uses CO-OPN object/class modules; we adapt to flat APN
- Gates in CO-OPN map to output transitions in APN
- Method calls in CO-OPN map to input transitions in APN
- Synchronization operators (// in CO-OPN) become arc dependencies in APN
