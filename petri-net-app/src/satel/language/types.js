/**
 * SATEL Type Definitions
 * Core types for test intentions, test cases, and oracles
 */

/**
 * @typedef {'input' | 'output' | 'internal'} IOType
 */

/**
 * @typedef {'sequence' | 'choice' | 'parallel' | 'loop'} PathPatternType
 */

/**
 * @typedef {'positive' | 'negative'} OracleType
 */

/**
 * @typedef {'uniformity' | 'regularity' | 'axiom-based'} ReductionType
 */

/**
 * Event in a path pattern
 * @typedef {Object} PathEvent
 * @property {string} transition - Transition ID
 * @property {Object} [binding] - Variable bindings for the transition
 * @property {string} [guard] - Additional guard constraint
 */

/**
 * Path pattern specification
 * @typedef {Object} PathPattern
 * @property {PathPatternType} type - Pattern composition type
 * @property {PathEvent[]} events - Events in the pattern
 * @property {number} [minIterations] - For loop patterns
 * @property {number} [maxIterations] - For loop patterns
 */

/**
 * Input constraint on stimulations
 * @typedef {Object} InputConstraint
 * @property {string} [place] - Place ID for input
 * @property {string} [transition] - Transition ID for input
 * @property {string} pattern - Pattern to match (e.g., token value)
 * @property {string} [guard] - Guard expression
 */

/**
 * Output expectation for observations
 * @typedef {Object} OutputExpectation
 * @property {string} [place] - Place ID for output
 * @property {string} [transition] - Transition ID for output
 * @property {string} pattern - Expected pattern
 * @property {string} [guard] - Guard expression
 */

/**
 * Reduction hypothesis for test set minimization
 * @typedef {Object} ReductionHypothesis
 * @property {ReductionType} type - Type of reduction
 * @property {string} [domain] - Domain name for uniformity/regularity
 * @property {*} [representative] - Representative value to test
 * @property {string} [reason] - Explanation of hypothesis
 */

/**
 * Test intention specification
 * @typedef {Object} TestIntention
 * @property {string} id - Unique intention identifier
 * @property {string} name - Human-readable name
 * @property {string} [description] - Detailed description
 * @property {PathPattern} pathPattern - Expected execution path pattern
 * @property {InputConstraint[]} [inputConstraints] - Constraints on stimulations
 * @property {OutputExpectation[]} [outputExpectations] - Expected observations
 * @property {ReductionHypothesis} [reductionHypothesis] - Test set reduction
 * @property {OracleType} oracleType - Positive or negative oracle
 */

/**
 * Marking (state) of places
 * @typedef {Object.<string, Array>} Marking
 */

/**
 * Trace event (transition firing)
 * @typedef {Object} TraceEvent
 * @property {string} transition - Transition ID
 * @property {Object} binding - Variable bindings used
 * @property {number} timestamp - Step number in trace
 */

/**
 * Test oracle (expected result)
 * @typedef {Object} TestOracle
 * @property {OracleType} type - Positive or negative
 * @property {Marking} [expectedOutputs] - Expected output place markings
 * @property {string[]} [invariants] - Invariant expressions to check
 * @property {string[]} [forbiddenEvents] - Events that must not occur
 */

/**
 * Test case generated from an intention
 * @typedef {Object} TestCase
 * @property {string} id - Unique test case identifier
 * @property {string} intentionId - Source intention ID
 * @property {string} [name] - Human-readable name
 * @property {Marking} initialMarking - Starting state
 * @property {TraceEvent[]} expectedTrace - Expected event sequence
 * @property {TestOracle} oracle - Oracle for validation
 * @property {Object} [result] - Test execution result
 * @property {boolean} [result.passed] - Whether test passed
 * @property {TraceEvent[]} [result.actualTrace] - Actual trace observed
 * @property {Marking} [result.actualOutputs] - Actual outputs observed
 * @property {string} [result.error] - Error message if failed
 */

/**
 * Test suite collection
 * @typedef {Object} TestSuite
 * @property {string} id - Suite identifier
 * @property {string} name - Suite name
 * @property {string} [description] - Description
 * @property {TestCase[]} testCases - Test cases in suite
 * @property {Object} [statistics] - Execution statistics
 */

/**
 * State in reachability graph
 * @typedef {Object} ReachabilityState
 * @property {string} id - State identifier
 * @property {Marking} marking - Place marking
 * @property {string[]} enabledTransitions - Enabled transition IDs
 */

/**
 * Transition in reachability graph
 * @typedef {Object} ReachabilityTransition
 * @property {string} sourceStateId - Source state ID
 * @property {string} targetStateId - Target state ID
 * @property {string} transitionId - Transition ID in net
 * @property {Object} binding - Variable bindings
 */

/**
 * Reachability graph
 * @typedef {Object} ReachabilityGraph
 * @property {ReachabilityState[]} states - All reachable states
 * @property {ReachabilityTransition[]} transitions - All transitions between states
 * @property {string} initialStateId - Initial state ID
 */

export {
  // Type re-exports for JSDoc
};
