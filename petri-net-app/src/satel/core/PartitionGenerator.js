/**
 * Partition Generator - Generate equivalence classes from guard conditions
 * 
 * Creates semantic partitions based on guard constraints:
 * - Interval partitioning for numeric inequalities
 * - Boundary value selection
 * - Sign partitioning for unbounded domains
 */

/**
 * Generate equivalence class representatives for a variable
 * @param {string} varName - Variable name
 * @param {Array} constraints - Constraints on this variable
 * @param {Object} options - Generation options
 * @returns {Array} Array of representative values
 */
export function generateRepresentatives(varName, constraints, options = {}) {
  const {
    maxRepresentatives = 10,
    includeBoundaries = true,
    includeSign = true
  } = options;

  if (constraints.length === 0) {
    // Unbounded variable - use sign partition
    return includeSign ? [-1, 0, 1] : [1];
  }

  // Extract numeric comparisons
  const comparisons = constraints.filter(c => c.type === 'comparison');
  
  if (comparisons.length === 0) {
    // Boolean variable or no numeric constraints
    const boolConstraints = constraints.filter(c => c.type === 'boolean');
    if (boolConstraints.length > 0) {
      return [true, false];
    }
    return [1]; // Default
  }

  // Collect all constants from constraints
  const constants = comparisons.map(c => c.value).sort((a, b) => a - b);
  
  // Generate boundary representatives
  const representatives = new Set();
  
  for (const c of constants) {
    // Add boundary values around each constant
    if (includeBoundaries) {
      representatives.add(c - 1);
      representatives.add(c);
      representatives.add(c + 1);
    } else {
      representatives.add(c);
    }
  }
  
  // If still empty, add sign partition
  if (representatives.size === 0 && includeSign) {
    representatives.add(-1);
    representatives.add(0);
    representatives.add(1);
  }
  
  // Convert to sorted array and limit size
  const result = Array.from(representatives)
    .sort((a, b) => a - b)
    .slice(0, maxRepresentatives);
  
  return result.length > 0 ? result : [1]; // Ensure at least one representative
}

/**
 * Generate partitions for all variables based on guard conditions
 * @param {Object} conditions - Conditions from GuardAnalyzer
 * @param {Object} options - Partition options
 * @returns {Map} Variable name -> array of representatives
 */
export function generatePartitions(conditions, options = {}) {
  const partitions = new Map();
  
  for (const [varName, constraints] of conditions.variables.entries()) {
    const representatives = generateRepresentatives(varName, constraints, options);
    partitions.set(varName, representatives);
  }
  
  // For unbounded variables, use minimal sign partition
  for (const varName of conditions.unbounded) {
    if (!partitions.has(varName)) {
      partitions.set(varName, [1]); // Single representative for unbounded
    }
  }
  
  return partitions;
}

/**
 * Compute interval partitioning for a set of constants
 * @param {Array} constants - Sorted array of constants
 * @returns {Array} Array of intervals with representatives
 */
export function computeIntervals(constants) {
  if (constants.length === 0) {
    return [
      { min: -Infinity, max: Infinity, representative: 0, type: 'unbounded' }
    ];
  }
  
  const intervals = [];
  
  // Interval before first constant
  intervals.push({
    min: -Infinity,
    max: constants[0],
    representative: constants[0] - 1,
    type: 'below'
  });
  
  // Intervals between constants
  for (let i = 0; i < constants.length - 1; i++) {
    intervals.push({
      min: constants[i],
      max: constants[i + 1],
      representative: constants[i],
      type: 'between'
    });
  }
  
  // Interval after last constant
  const last = constants[constants.length - 1];
  intervals.push({
    min: last,
    max: Infinity,
    representative: last,
    type: 'above'
  });
  
  return intervals;
}

/**
 * Determine which equivalence class a value belongs to
 * @param {number} value - Test value
 * @param {Array} intervals - Interval partitions
 * @returns {Object} Interval containing the value
 */
export function classifyValue(value, intervals) {
  for (const interval of intervals) {
    if (value >= interval.min && value < interval.max) {
      return interval;
    }
    // Handle inclusive upper bound for last interval
    if (value === interval.max && interval.type === 'above') {
      return interval;
    }
  }
  return intervals[intervals.length - 1]; // Default to last interval
}

/**
 * Check if two values are in the same equivalence class
 * @param {number} value1 - First value
 * @param {number} value2 - Second value
 * @param {Array} constraints - Guard constraints
 * @returns {boolean} True if values are equivalent under the constraints
 */
export function areEquivalent(value1, value2, constraints) {
  // Two values are equivalent if they satisfy the same subset of constraints
  for (const constraint of constraints) {
    const sat1 = satisfiesConstraint(value1, constraint);
    const sat2 = satisfiesConstraint(value2, constraint);
    if (sat1 !== sat2) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a value satisfies a constraint
 * @private
 */
function satisfiesConstraint(value, constraint) {
  if (constraint.type === 'comparison') {
    switch (constraint.op) {
      case '>': return value > constraint.value;
      case '<': return value < constraint.value;
      case '>=': return value >= constraint.value;
      case '<=': return value <= constraint.value;
      case '==': return value === constraint.value;
      case '!=': return value !== constraint.value;
      default: return true;
    }
  }
  if (constraint.type === 'boolean') {
    return value === constraint.value;
  }
  return true;
}

/**
 * Generate abstraction documentation for partitions
 * @param {Object} conditions - Conditions from GuardAnalyzer
 * @param {Map} partitions - Generated partitions
 * @returns {Object} Documentation object
 */
export function generateAbstractionDoc(conditions, partitions) {
  const doc = {
    bounded: [],
    unbounded: [],
    summary: ''
  };
  
  for (const [varName, representatives] of partitions.entries()) {
    const constraints = conditions.variables.get(varName) || [];
    
    if (constraints.length === 0) {
      doc.unbounded.push({
        variable: varName,
        representatives,
        note: 'No guard constraints - using sign partition [−1, 0, 1]'
      });
    } else {
      const constants = constraints
        .filter(c => c.type === 'comparison')
        .map(c => `${c.op} ${c.value}`)
        .join(', ');
      
      doc.bounded.push({
        variable: varName,
        representatives,
        constraints: constants,
        note: `Boundary values around ${constants}`
      });
    }
  }
  
  const boundedCount = doc.bounded.length;
  const unboundedCount = doc.unbounded.length;
  
  if (boundedCount > 0 && unboundedCount === 0) {
    doc.summary = `All ${boundedCount} variable(s) bounded by guard constraints`;
  } else if (boundedCount === 0 && unboundedCount > 0) {
    doc.summary = `${unboundedCount} unbounded variable(s) - using sign partition`;
  } else if (boundedCount > 0 && unboundedCount > 0) {
    doc.summary = `${boundedCount} bounded, ${unboundedCount} unbounded variable(s)`;
  } else {
    doc.summary = 'No variables analyzed';
  }
  
  return doc;
}
