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

  // Primitive types - use existing partitions
  if (sortName === 'Int') {
    return [-1, 0, 1]; // Sign partition
  }

  if (sortName === 'Bool') {
    return [false, true]; // Exhaustive
  }

  // Try to get ADT definition from registry
  const adt = adtRegistry?.getType(sortName);
  
  // If ADT has explicit constructors, use general constructor partitioning
  if (adt && adt.constructors && adt.constructors.length > 0) {
    return generateConstructorRepresentatives(adt, adtRegistry, maxDepth);
  }

  // Fallback for built-in ADTs without explicit constructors (literal-based)
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

  // Unknown ADT or no constructors - use default value
  if (adt) {
    console.warn(`ADT ${sortName} has no constructors; using default representative`);
  }
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
