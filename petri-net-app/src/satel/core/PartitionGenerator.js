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
    includeSign = true,
    sortName = null,  // NEW: ADT sort name
    adtRegistry = null // NEW: ADT registry
  } = options;

  // NEW: ADT constructor partitioning
  if (sortName && adtRegistry) {
    return generateADTRepresentatives(sortName, adtRegistry, options);
  }

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
 * Generate ADT constructor representatives
 * @param {string} sortName - ADT sort name (e.g., "List", "Option")
 * @param {Object} adtRegistry - ADT registry
 * @param {Object} options - Generation options
 * @returns {Array} Array of representative values (one per constructor shape)
 */
export function generateADTRepresentatives(sortName, adtRegistry, options = {}) {
  const { maxDepth = 2 } = options;

  // Handle built-in ADT shapes (literal-based)
  if (sortName === 'List') {
    return [
      [],           // Empty list (Nil equivalent)
      [0]           // Non-empty list with default element (Cons equivalent)
    ];
  }

  if (sortName === 'Pair') {
    return [
      { fst: 0, snd: 0, __pair__: true }  // Pair with default elements
    ];
  }

  if (sortName === 'String') {
    return [
      '',      // Empty string
      'a'      // Non-empty string
    ];
  }

  if (sortName === 'Bool') {
    return [false, true];
  }

  if (sortName === 'Int') {
    return [-1, 0, 1]; // Sign partition
  }

  // Try to get custom ADT definition
  const adt = adtRegistry?.getType(sortName);
  if (!adt) {
    // Unknown ADT - use default value
    return [0];
  }

  // Check if ADT has explicit constructors
  if (adt.constructors && adt.constructors.length > 0) {
    return generateConstructorRepresentatives(adt, adtRegistry, maxDepth);
  }

  // Fallback: treat as opaque type with single representative
  return [0];
}

/**
 * Generate representatives for custom ADT constructors
 * @param {Object} adt - ADT definition
 * @param {Object} adtRegistry - ADT registry
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {Array} Array of witness terms (one per constructor)
 */
function generateConstructorRepresentatives(adt, adtRegistry, maxDepth) {
  const representatives = [];

  for (const ctor of adt.constructors) {
    const witness = generateWitnessTerm(ctor, adtRegistry, 0, maxDepth);
    representatives.push(witness);
  }

  return representatives;
}

/**
 * Generate a witness term for a constructor
 * @param {Object} ctor - Constructor definition
 * @param {Object} adtRegistry - ADT registry
 * @param {number} depth - Current recursion depth
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {Object} Witness term
 */
function generateWitnessTerm(ctor, adtRegistry, depth, maxDepth) {
  if (depth >= maxDepth) {
    // At depth limit: select minimal constructor for result type
    const minimalCtor = selectMinimalConstructor(ctor.result, adtRegistry);
    if (minimalCtor && minimalCtor.arity === 0) {
      return { __adt__: true, constructor: minimalCtor.name, args: [] };
    }
    // Fallback to default value
    return generateDefaultValue(ctor.result, adtRegistry, depth, maxDepth);
  }

  if (ctor.arity === 0) {
    // Nullary constructor
    return { __adt__: true, constructor: ctor.name, args: [] };
  }

  // Generate arguments
  const args = [];
  for (const param of ctor.params || []) {
    const argValue = generateDefaultValue(param.type, adtRegistry, depth + 1, maxDepth);
    args.push(argValue);
  }

  return { __adt__: true, constructor: ctor.name, args };
}

/**
 * Generate a default value for a given sort
 * @param {string} sortName - Sort name
 * @param {Object} adtRegistry - ADT registry
 * @param {number} depth - Current recursion depth
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {*} Default value
 */
function generateDefaultValue(sortName, adtRegistry, depth, maxDepth) {
  if (sortName === 'Int') return 0;
  if (sortName === 'Bool') return false;
  if (sortName === 'String') return '';
  if (sortName === 'Any') return 0;
  if (sortName === 'List') return [];
  if (sortName === 'Pair') return { fst: 0, snd: 0, __pair__: true };

  // Recursive ADT
  const adt = adtRegistry?.getType(sortName);
  if (adt && adt.constructors) {
    const minimalCtor = selectMinimalConstructor(sortName, adtRegistry);
    if (minimalCtor) {
      return generateWitnessTerm(minimalCtor, adtRegistry, depth, maxDepth);
    }
  }

  return 0; // Fallback
}

/**
 * Select minimal constructor (prefer nullary)
 * @param {string} sortName - Sort name
 * @param {Object} adtRegistry - ADT registry
 * @returns {Object|null} Minimal constructor
 */
function selectMinimalConstructor(sortName, adtRegistry) {
  const adt = adtRegistry?.getType(sortName);
  if (!adt || !adt.constructors) return null;

  // Prefer nullary constructors (arity 0)
  for (const ctor of adt.constructors) {
    if (ctor.arity === 0) return ctor;
  }

  // Otherwise, pick first constructor
  return adt.constructors[0];
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
    // Check if variable has an ADT sort
    const sortName = conditions.sorts?.get(varName);
    const extendedOptions = { ...options, sortName };
    
    const representatives = generateRepresentatives(varName, constraints, extendedOptions);
    partitions.set(varName, representatives);
  }
  
  // For unbounded variables, use minimal sign partition or ADT representatives
  for (const varName of conditions.unbounded) {
    if (!partitions.has(varName)) {
      const sortName = conditions.sorts?.get(varName);
      if (sortName && options.adtRegistry) {
        // ADT with no guard constraints - use constructor representatives
        const adtReps = generateADTRepresentatives(sortName, options.adtRegistry, options);
        partitions.set(varName, adtReps);
      } else {
        // Default: single representative for unbounded
        partitions.set(varName, [1]);
      }
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
    adt: [], // NEW: ADT partitioning documentation
    summary: ''
  };
  
  for (const [varName, representatives] of partitions.entries()) {
    const constraints = conditions.variables.get(varName) || [];
    const sortName = conditions.sorts?.get(varName);
    
    // Check if this is an ADT partition
    if (sortName && isADTSort(sortName, representatives)) {
      doc.adt.push({
        variable: varName,
        sort: sortName,
        representatives,
        note: `ADT constructor partitioning for ${sortName}`,
        incompleteness: representatives.length > 1 
          ? 'One representative per constructor shape; arguments use default values'
          : 'Single constructor or default value'
      });
    } else if (constraints.length === 0) {
      doc.unbounded.push({
        variable: varName,
        representatives,
        note: sortName 
          ? `Sort ${sortName} with no guard constraints`
          : 'No guard constraints - using sign partition [−1, 0, 1]'
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
  const adtCount = doc.adt.length;
  
  const parts = [];
  if (boundedCount > 0) parts.push(`${boundedCount} bounded`);
  if (unboundedCount > 0) parts.push(`${unboundedCount} unbounded`);
  if (adtCount > 0) parts.push(`${adtCount} ADT`);
  
  if (parts.length > 0) {
    doc.summary = `${parts.join(', ')} variable(s)`;
  } else {
    doc.summary = 'No variables analyzed';
  }
  
  return doc;
}

/**
 * Check if representatives are ADT constructor terms
 * @private
 */
function isADTSort(sortName, representatives) {
  if (sortName === 'Int' || sortName === 'Bool' || sortName === 'String') {
    return false; // Primitive types
  }
  
  // Check for List shape
  if (sortName === 'List' || Array.isArray(representatives[0])) {
    return true;
  }
  
  // Check for constructor terms
  if (representatives.some(r => r && typeof r === 'object' && r.__adt__)) {
    return true;
  }
  
  return sortName && sortName !== 'Any';
}
