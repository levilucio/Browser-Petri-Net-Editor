/**
 * Reduction Engine
 * Applies reduction hypotheses to minimize test sets
 */

/**
 * Apply reduction hypotheses to a test set
 * @param {Array} testCases - Array of test cases
 * @param {Array} testIntentions - Array of test intentions
 * @param {Object} petriNet - Petri net
 * @returns {Array} Reduced test cases
 */
export function applyReduction(testCases, testIntentions, petriNet) {
  let reduced = [...testCases];
  
  // Group test cases by intention
  const casesByIntention = new Map();
  for (const testCase of reduced) {
    if (!casesByIntention.has(testCase.intentionId)) {
      casesByIntention.set(testCase.intentionId, []);
    }
    casesByIntention.get(testCase.intentionId).push(testCase);
  }
  
  // Apply reduction for each intention
  for (const intention of testIntentions) {
    const cases = casesByIntention.get(intention.id) || [];
    
    if (intention.reductionHypothesis && cases.length > 0) {
      const reducedCases = applyReductionHypothesis(
        cases,
        intention.reductionHypothesis,
        petriNet
      );
      casesByIntention.set(intention.id, reducedCases);
    }
  }
  
  // Flatten back to array
  reduced = [];
  for (const cases of casesByIntention.values()) {
    reduced.push(...cases);
  }
  
  return reduced;
}

/**
 * Apply a single reduction hypothesis
 * @param {Array} testCases - Test cases for one intention
 * @param {Object} hypothesis - Reduction hypothesis
 * @param {Object} petriNet - Petri net
 * @returns {Array} Reduced test cases
 */
function applyReductionHypothesis(testCases, hypothesis, petriNet) {
  switch (hypothesis.type) {
    case 'uniformity':
      return applyUniformityReduction(testCases, hypothesis);
    case 'regularity':
      return applyRegularityReduction(testCases, hypothesis);
    case 'axiom-based':
      return applyAxiomBasedReduction(testCases, hypothesis, petriNet);
    default:
      console.warn(`Unknown reduction type: ${hypothesis.type}`);
      return testCases;
  }
}

/**
 * Apply uniformity hypothesis reduction
 * "If behavior is uniform over domain D, test one representative"
 * @param {Array} testCases - Test cases
 * @param {Object} hypothesis - Uniformity hypothesis
 * @returns {Array} Reduced test cases
 */
function applyUniformityReduction(testCases, hypothesis) {
  // Find test cases involving the domain
  const domainCases = testCases.filter(tc => 
    traceTouchesDomain(tc.expectedTrace, hypothesis.domain)
  );
  
  if (domainCases.length === 0) {
    return testCases; // No cases touch this domain
  }
  
  // Keep only one representative case
  const representative = domainCases.find(tc =>
    traceUsesRepresentative(tc.expectedTrace, hypothesis.representative)
  );
  
  if (!representative) {
    // No case uses the representative, keep first one
    return [
      domainCases[0],
      ...testCases.filter(tc => !domainCases.includes(tc))
    ];
  }
  
  return [
    representative,
    ...testCases.filter(tc => !domainCases.includes(tc))
  ];
}

/**
 * Apply regularity hypothesis reduction
 * "If behavior is regular (loops), test boundary cases"
 * @param {Array} testCases - Test cases
 * @param {Object} hypothesis - Regularity hypothesis
 * @returns {Array} Reduced test cases
 */
function applyRegularityReduction(testCases, hypothesis) {
  // Group by trace length
  const byLength = new Map();
  for (const tc of testCases) {
    const len = tc.expectedTrace.length;
    if (!byLength.has(len)) {
      byLength.set(len, []);
    }
    byLength.get(len).push(tc);
  }
  
  // Keep boundary cases: min, max, and maybe one middle
  const lengths = Array.from(byLength.keys()).sort((a, b) => a - b);
  const reduced = [];
  
  if (lengths.length > 0) {
    // Min length
    reduced.push(...byLength.get(lengths[0]));
  }
  
  if (lengths.length > 1) {
    // Max length
    reduced.push(...byLength.get(lengths[lengths.length - 1]));
  }
  
  if (lengths.length > 2) {
    // Middle length
    const midIdx = Math.floor(lengths.length / 2);
    reduced.push(byLength.get(lengths[midIdx])[0]);
  }
  
  return reduced;
}

/**
 * Apply axiom-based equivalence reduction
 * "Two transitions are equivalent if they use the same axioms (guards/bindings)"
 * @param {Array} testCases - Test cases
 * @param {Object} hypothesis - Axiom-based hypothesis
 * @param {Object} petriNet - Petri net
 * @returns {Array} Reduced test cases
 */
function applyAxiomBasedReduction(testCases, hypothesis, petriNet) {
  // Group test cases by equivalence classes
  const equivalenceClasses = new Map();
  
  for (const tc of testCases) {
    const signature = computeTraceSignature(tc.expectedTrace, petriNet);
    
    if (!equivalenceClasses.has(signature)) {
      equivalenceClasses.set(signature, []);
    }
    equivalenceClasses.get(signature).push(tc);
  }
  
  // Keep one representative from each equivalence class
  const reduced = [];
  for (const [signature, cases] of equivalenceClasses.entries()) {
    reduced.push(cases[0]); // Pick first case as representative
  }
  
  return reduced;
}

/**
 * Compute signature of a trace based on transitions used
 * @param {Array} trace - Trace events
 * @param {Object} petriNet - Petri net
 * @returns {string} Signature
 */
function computeTraceSignature(trace, petriNet) {
  // Build signature from sequence of transition IDs and their structural properties
  const parts = [];
  
  for (const event of trace) {
    const transition = (petriNet.transitions || []).find(t => t.id === event.transition);
    if (!transition) {
      parts.push(event.transition);
      continue;
    }
    
    // Include transition structure in signature
    const inputArcs = (petriNet.arcs || []).filter(a => 
      (a.targetId === transition.id || a.target === transition.id) &&
      (a.sourceType === 'place' || !a.sourceType)
    );
    const outputArcs = (petriNet.arcs || []).filter(a =>
      (a.sourceId === transition.id || a.source === transition.id) &&
      (a.targetType === 'place' || !a.targetType)
    );
    
    const sig = [
      transition.id,
      transition.guard || '',
      inputArcs.length,
      outputArcs.length,
      transition.action || ''
    ].join(':');
    
    parts.push(sig);
  }
  
  return parts.join(';');
}

/**
 * Check if trace touches a domain (heuristic: look for domain name in bindings/values)
 * @param {Array} trace - Trace events
 * @param {string} domain - Domain name
 * @returns {boolean}
 */
function traceTouchesDomain(trace, domain) {
  for (const event of trace) {
    const bindingStr = JSON.stringify(event.binding).toLowerCase();
    if (bindingStr.includes(domain.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Check if trace uses a representative value
 * @param {Array} trace - Trace events
 * @param {*} representative - Representative value
 * @returns {boolean}
 */
function traceUsesRepresentative(trace, representative) {
  const repStr = String(representative).toLowerCase();
  for (const event of trace) {
    const bindingStr = JSON.stringify(event.binding).toLowerCase();
    if (bindingStr.includes(repStr)) {
      return true;
    }
  }
  return false;
}

/**
 * Compute equivalence classes for transitions based on structure
 * @param {Object} petriNet - Petri net
 * @returns {Map} Map from signature to transition IDs
 */
export function computeTransitionEquivalenceClasses(petriNet) {
  const classes = new Map();
  
  for (const transition of petriNet.transitions || []) {
    const signature = computeTransitionSignature(transition, petriNet);
    
    if (!classes.has(signature)) {
      classes.set(signature, []);
    }
    classes.get(signature).push(transition.id);
  }
  
  return classes;
}

/**
 * Compute structural signature of a transition
 * @param {Object} transition - Transition object
 * @param {Object} petriNet - Petri net
 * @returns {string} Signature
 */
function computeTransitionSignature(transition, petriNet) {
  const inputArcs = (petriNet.arcs || []).filter(a =>
    (a.targetId === transition.id || a.target === transition.id) &&
    (a.sourceType === 'place' || !a.sourceType)
  );
  const outputArcs = (petriNet.arcs || []).filter(a =>
    (a.sourceId === transition.id || a.source === transition.id) &&
    (a.targetType === 'place' || !a.targetType)
  );
  
  // Signature includes: number of inputs/outputs, guard structure, action structure
  return [
    inputArcs.length,
    outputArcs.length,
    normalizeExpression(transition.guard || ''),
    normalizeExpression(transition.action || '')
  ].join('|');
}

/**
 * Normalize an expression for comparison (strip whitespace, variable names)
 * @param {string} expr - Expression string
 * @returns {string} Normalized expression
 */
function normalizeExpression(expr) {
  // Remove whitespace
  let normalized = expr.replace(/\s+/g, '');
  // Replace variable names with placeholders (very simplistic)
  normalized = normalized.replace(/\b[a-z][a-z0-9]*\b/gi, 'VAR');
  return normalized;
}
