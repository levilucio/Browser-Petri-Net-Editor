/**
 * Oracle Generator
 * Generates test oracles (expected results) from test intentions and traces
 */

import { getTokensForPlace } from '../../utils/token-utils.js';

/**
 * Generate oracle for a test case
 * @param {Object} testIntention - Test intention specification
 * @param {Object} trace - Execution trace
 * @param {Object} finalMarking - Final marking after trace
 * @param {Object} petriNet - Petri net
 * @returns {Object} Test oracle
 */
export function generateOracle(testIntention, trace, finalMarking, petriNet) {
  const oracle = {
    type: testIntention.oracleType || 'positive',
    expectedOutputs: {},
    invariants: [],
    forbiddenEvents: []
  };
  
  // Extract expected outputs from output expectations
  if (testIntention.outputExpectations) {
    for (const expectation of testIntention.outputExpectations) {
      if (expectation.place) {
        // Expected tokens in output place
        oracle.expectedOutputs[expectation.place] = parsePattern(expectation.pattern);
      }
    }
  }
  
  // For positive oracles, expect the trace to complete successfully
  if (testIntention.oracleType === 'positive') {
    // Add invariants that all output expectations are met
    if (testIntention.outputExpectations) {
      for (const expectation of testIntention.outputExpectations) {
        if (expectation.place && expectation.pattern) {
          oracle.invariants.push(
            `place('${expectation.place}').contains(${expectation.pattern})`
          );
        }
      }
    }
  } else {
    // Negative oracle: expect the trace to fail or violate constraints
    oracle.forbiddenEvents = testIntention.pathPattern.events.map(e => e.transition);
  }
  
  return oracle;
}

/**
 * Parse a pattern string to expected tokens
 * @param {string} pattern - Pattern like "water" or "5" or "[water, beer]"
 * @returns {Array} Expected tokens
 */
function parsePattern(pattern) {
  try {
    // Try parsing as JSON array
    if (pattern.startsWith('[')) {
      return JSON.parse(pattern).map(v => ({ value: v }));
    }
    // Try parsing as number
    const num = Number(pattern);
    if (!isNaN(num)) {
      return [{ value: num }];
    }
    // Treat as string value
    return [{ value: pattern }];
  } catch (err) {
    // Fallback: treat as single string token
    return [{ value: pattern }];
  }
}

/**
 * Check if a marking satisfies an oracle
 * @param {Object} marking - Actual marking
 * @param {Object} oracle - Test oracle
 * @param {Object} petriNet - Petri net
 * @returns {Object} Validation result
 */
export function validateOracle(marking, oracle, petriNet) {
  const errors = [];
  const warnings = [];
  
  // Check expected outputs
  for (const [placeId, expectedTokens] of Object.entries(oracle.expectedOutputs || {})) {
    const actualTokens = marking[placeId] || [];
    
    if (!tokensMatch(actualTokens, expectedTokens)) {
      errors.push(
        `Place '${placeId}': expected ${JSON.stringify(expectedTokens)}, ` +
        `got ${JSON.stringify(actualTokens)}`
      );
    }
  }
  
  // Check invariants (simplified evaluation)
  for (const invariant of oracle.invariants || []) {
    try {
      const result = evaluateInvariant(invariant, marking, petriNet);
      if (!result) {
        errors.push(`Invariant violated: ${invariant}`);
      }
    } catch (err) {
      warnings.push(`Could not evaluate invariant '${invariant}': ${err.message}`);
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if two token arrays match
 * @param {Array} actual - Actual tokens
 * @param {Array} expected - Expected tokens
 * @returns {boolean}
 */
function tokensMatch(actual, expected) {
  if (actual.length !== expected.length) {
    return false;
  }
  
  // Sort both arrays by value for comparison
  const sortedActual = [...actual].sort((a, b) => 
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  );
  const sortedExpected = [...expected].sort((a, b) => 
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  );
  
  for (let i = 0; i < sortedActual.length; i++) {
    if (JSON.stringify(sortedActual[i]) !== JSON.stringify(sortedExpected[i])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Evaluate an invariant expression (simplified)
 * @param {string} invariant - Invariant expression
 * @param {Object} marking - Current marking
 * @param {Object} petriNet - Petri net
 * @returns {boolean} Whether invariant holds
 */
function evaluateInvariant(invariant, marking, petriNet) {
  // Simple pattern matching for common invariants
  
  // Pattern: place('id').contains(value)
  const containsMatch = invariant.match(/place\('([^']+)'\)\.contains\((.+)\)/);
  if (containsMatch) {
    const placeId = containsMatch[1];
    const expectedValue = containsMatch[2].replace(/['"]/g, '');
    const tokens = marking[placeId] || [];
    return tokens.some(t => String(t.value) === expectedValue);
  }
  
  // Pattern: place('id').length == n
  const lengthMatch = invariant.match(/place\('([^']+)'\)\.length\s*(==|>=|<=|>|<)\s*(\d+)/);
  if (lengthMatch) {
    const placeId = lengthMatch[1];
    const operator = lengthMatch[2];
    const expected = parseInt(lengthMatch[3]);
    const actual = (marking[placeId] || []).length;
    
    switch (operator) {
      case '==': return actual === expected;
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '>': return actual > expected;
      case '<': return actual < expected;
      default: return false;
    }
  }
  
  // Pattern: place('id') >= n (checking token count)
  const tokenCountMatch = invariant.match(/place\('([^']+)'\)\s*(>=|<=|>|<|==)\s*(\d+)/);
  if (tokenCountMatch) {
    const placeId = tokenCountMatch[1];
    const operator = tokenCountMatch[2];
    const expected = parseInt(tokenCountMatch[3]);
    const actual = (marking[placeId] || []).length;
    
    switch (operator) {
      case '==': return actual === expected;
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '>': return actual > expected;
      case '<': return actual < expected;
      default: return false;
    }
  }
  
  // If no pattern matched, return true (assume satisfied)
  console.warn(`Unknown invariant pattern: ${invariant}`);
  return true;
}

/**
 * Generate HML formula from path pattern
 * @param {Object} pathPattern - Path pattern
 * @param {boolean} [includeResult=true] - Include expected result
 * @returns {string} HML formula string
 */
export function generateHMLFormula(pathPattern, includeResult = true) {
  if (pathPattern.type === 'sequence') {
    const events = pathPattern.events.map(e => {
      if (e.binding && Object.keys(e.binding).length > 0) {
        const bindings = Object.entries(e.binding)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(', ');
        return `<${e.transition}(${bindings})>`;
      }
      return `<${e.transition}>`;
    });
    
    const formula = events.join('');
    return includeResult ? `${formula} => true` : formula;
  }
  
  if (pathPattern.type === 'choice') {
    const alternatives = pathPattern.events.map(e => `<${e.transition}>`);
    return `(${alternatives.join(' OR ')})`;
  }
  
  if (pathPattern.type === 'parallel') {
    const parallel = pathPattern.events.map(e => `<${e.transition}>`);
    return `(${parallel.join(' AND ')})`;
  }
  
  if (pathPattern.type === 'loop') {
    const event = pathPattern.events[0];
    if (event) {
      return `<${event.transition}>*`;
    }
  }
  
  return '???';
}
