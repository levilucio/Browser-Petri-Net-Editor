/**
 * Path-Condition-Based Subuniformity Partitioner
 * 
 * Partitions variable domains by the conjunction of guards along execution paths.
 * Each equivalence class drives a genuinely different transition sequence.
 */

/**
 * Partition a variable's domain by path conditions from an intention
 * 
 * @param {Object} variable - Variable with path-conditions hypothesis
 * @param {Object} intention - Intention with stimulation/observation pairs
 * @param {Object} petriNet - Petri net definition
 * @param {Object} adtRegistry - ADT registry
 * @returns {Array} Representatives for each path-condition equivalence class
 */
export function partitionByPathConditions(variable, intention, petriNet, adtRegistry) {
  const { name: varName, sort } = variable;
  
  // Extract guards from transitions in the intention's pairs
  const pathGuards = extractPathGuardsForVariable(varName, intention, petriNet);
  
  if (pathGuards.length === 0) {
    // No guards mention this variable - use constructor partitioning as fallback
    return fallbackToConstructorPartition(sort, adtRegistry);
  }
  
  // Partition the domain by guard predicates
  return partitionDomainByGuards(varName, sort, pathGuards, adtRegistry);
}

/**
 * Extract guards from transitions mentioned in intention pairs that involve the variable
 */
function extractPathGuardsForVariable(varName, intention, petriNet) {
  const guards = [];
  const transitionNames = new Set();
  
  // Collect all transitions from stimulation pairs
  for (const pair of intention.pairs) {
    transitionNames.add(pair.stimulation.transition);
  }
  
  // Extract guards from these transitions that mention the variable
  for (const transition of petriNet.transitions || []) {
    if (transitionNames.has(transition.name) && transition.guard) {
      // Check if guard mentions variable (directly or through ADT projections)
      if (guardMentionsVariable(transition.guard, varName)) {
        guards.push({
          transition: transition.name,
          guard: transition.guard,
          ast: parseGuardExpression(transition.guard)
        });
      }
    }
  }
  
  return guards;
}

/**
 * Check if a guard expression mentions a variable
 */
function guardMentionsVariable(guardExpr, varName) {
  // Direct mention
  if (guardExpr.includes(varName)) return true;
  
  // Through job/order projection patterns
  // e.g., "priority(order(job))" when varName is in job's order field
  const patterns = [
    new RegExp(`\\b${varName}\\b`),
    /priority\(order\([^)]+\)\)/,  // Matches priority checks on orders
    /quantity\([^)]+\)/,            // Matches material quantity checks
  ];
  
  return patterns.some(p => p.test(guardExpr));
}

/**
 * Simple guard expression parser (returns AST-like structure)
 */
function parseGuardExpression(guardStr) {
  // Simplified parser for common patterns
  // Returns { type, operator, left, right, ... }
  
  // Equality: priority(order(job)) == High()
  let match = guardStr.match(/(.+)\s*==\s*(.+)/);
  if (match) {
    return {
      type: 'equality',
      left: match[1].trim(),
      right: match[2].trim()
    };
  }
  
  // Comparison: quantity(material) >= 50
  match = guardStr.match(/(.+)\s*([<>]=?)\s*(\d+)/);
  if (match) {
    return {
      type: 'comparison',
      operator: match[2],
      left: match[1].trim(),
      value: parseInt(match[3], 10)
    };
  }
  
  // Fallback
  return { type: 'unknown', expr: guardStr };
}

/**
 * Partition domain by guards to create equivalence classes
 * 
 * For ADT types with equality guards (e.g., priority == High()):
 *   Creates one class per guard-checked constructor
 * 
 * For numeric types with comparison guards (e.g., quantity >= 50):
 *   Creates classes for each region defined by guard boundaries
 */
function partitionDomainByGuards(varName, sort, pathGuards, adtRegistry) {
  // Check if variable is ADT type
  const adt = adtRegistry?.getType(sort);
  
  if (adt && adt.constructors) {
    // ADT type: partition by equality-checked constructors
    return partitionAdtByGuards(adt, pathGuards, adtRegistry);
  } else {
    // Numeric type: partition by comparison boundaries
    return partitionNumericByGuards(sort, pathGuards);
  }
}

/**
 * Partition ADT type by constructor equality guards
 * 
 * Example: Priority with guards "priority == High()" and "priority == Normal()"
 * Creates classes: [High(), Normal(), Low()]  (Low is residual class)
 */
function partitionAdtByGuards(adt, pathGuards, adtRegistry) {
  const checkedConstructors = new Set();
  
  // Extract constructors mentioned in equality guards
  for (const g of pathGuards) {
    if (g.ast.type === 'equality') {
      // Match patterns like "High()", "Normal()", etc.
      const ctorMatch = g.ast.right.match(/(\w+)\(\)/);
      if (ctorMatch) {
        const ctorName = ctorMatch[1];
        if (adt.constructors.find(c => c.name === ctorName)) {
          checkedConstructors.add(ctorName);
        }
      }
    }
  }
  
  // If no constructors explicitly checked, fall back to all constructors
  if (checkedConstructors.size === 0) {
    return adt.constructors.map(c => ({
      __adt__: true,
      constructor: c.name,
      args: []
    }));
  }
  
  // Return one representative per checked constructor, plus residual (unchecked)
  const representatives = [];
  
  for (const c of adt.constructors) {
    if (checkedConstructors.has(c.name) || checkedConstructors.size < adt.constructors.length) {
      if (c.arity === 0) {
        representatives.push({ __adt__: true, constructor: c.name, args: [] });
      } else {
        // Generate minimal args
        const args = c.params?.map(p => generateMinimalValue(p.type, adtRegistry)) || [];
        representatives.push({ __adt__: true, constructor: c.name, args });
      }
    }
  }
  
  return representatives;
}

/**
 * Partition numeric type by comparison guard boundaries
 * 
 * Example: Nat with guard "quantity >= 50"
 * Creates classes: [25, 50, 75]  (below boundary, at boundary, above boundary)
 */
function partitionNumericByGuards(sort, pathGuards) {
  const boundaries = new Set();
  
  for (const g of pathGuards) {
    if (g.ast.type === 'comparison') {
      const { operator, value } = g.ast;
      
      // Add boundary and neighbor values
      boundaries.add(value - 1);  // Just below
      boundaries.add(value);       // At boundary
      boundaries.add(value + 1);   // Just above
      
      // Add characteristic values in each region
      if (operator.includes('>')) {
        boundaries.add(value + 10);  // Well above
      }
      if (operator.includes('<')) {
        boundaries.add(Math.max(0, value - 10));  // Well below
      }
    }
  }
  
  // If no boundaries found, use default partition
  if (boundaries.size === 0) {
    return sort === 'Nat' ? [0, 1, 10] : [-1, 0, 1];
  }
  
  // Return sorted array of boundary representatives
  let values = Array.from(boundaries).sort((a, b) => a - b);
  
  // Filter out negative values for Nat
  if (sort === 'Nat') {
    values = values.filter(v => v >= 0);
  }
  
  // Limit to reasonable number of representatives
  return values.slice(0, 5);
}

/**
 * Generate minimal value for a type
 */
function generateMinimalValue(typeName, adtRegistry) {
  if (typeName === 'Nat' || typeName === 'Int') return 0;
  if (typeName === 'Bool') return false;
  if (typeName === 'String') return '';
  
  const adt = adtRegistry?.getType(typeName);
  if (adt && adt.constructors) {
    const nullary = adt.constructors.find(c => c.arity === 0);
    if (nullary) {
      return { __adt__: true, constructor: nullary.name, args: [] };
    }
  }
  
  return 0;
}

/**
 * Fallback to constructor-based partition when no guards found
 */
function fallbackToConstructorPartition(sort, adtRegistry) {
  const adt = adtRegistry?.getType(sort);
  
  if (adt && adt.constructors) {
    return adt.constructors.map(c => {
      if (c.arity === 0) {
        return { __adt__: true, constructor: c.name, args: [] };
      }
      const args = c.params?.map(p => generateMinimalValue(p.type, adtRegistry)) || [];
      return { __adt__: true, constructor: c.name, args };
    });
  }
  
  // Primitive fallback
  if (sort === 'Nat' || sort === 'Int') return [0, 1, -1];
  if (sort === 'Bool') return [true, false];
  return [0];
}
