import { getPublicMethods } from '../../features/simulation/PublicMethods.js';
import { withInitialMarking, initialMarkingOf } from './InitialMarking.js';
/** V2 candidate generation. Symbolic oracle admission is a separate API. */
import { buildAdtRegistry } from '../../utils/adt-parser.js';
import { instantiateVariables, cartesianProduct, filterByGuards, instantiatePair,
  extractMultiVariableGuards, instantiateTerm } from './VariableInstantiator.js';
import { validateIntention } from './IntentionSchema.js';

export async function generateTestSuite(intentions, petriNet, simulator, options = {}) {
  if (!Array.isArray(intentions) || !intentions.length) throw new Error('At least one test intention is required');
  intentions.forEach(validateIntention);
  const start = Date.now();
  const testCases = [];
  const adtRegistry = options.adtRegistry || buildAdtRegistry(petriNet);
  for (const [i, intention] of intentions.entries()) {
    if (options.signal?.aborted) throw new Error('Generation cancelled');
    options.onProgress?.({ current: i + 1, total: intentions.length,
      message: `Processing: ${intention.name}` });
    const cases = await generateTestCasesFromIntentionV2(intention, petriNet, simulator, { ...options, adtRegistry });
    if (!cases.length) throw new Error(`No candidates generated for ${intention.name}`);
    testCases.push(...cases);
  }
  return {
    id: `suite-${Date.now()}`, name: options.suiteName || 'SATEL Test Suite',
    description: `Generated from ${intentions.length} test intention(s)`,
    testCases, oracleValidated: false,
    statistics: { totalIntentions: intentions.length, intentionsProcessed: intentions.length,
      casesGenerated: testCases.length, casesAfterReduction: testCases.length,
      pairStimulations: testCases.reduce((sum, tc) => sum + tc.pairs.length, 0),
      statesExplored: 0, reductionApplied: false, generationTime: Date.now() - start },
  };
}

async function generateTestCasesFromIntentionV2(intention, petriNet, simulator, options = {}) {
  const adtRegistry = options.adtRegistry || buildAdtRegistry(petriNet);
  
  // Validate schema
  validateIntention(intention);
  
  // 1. Generate representatives per variable per hypothesis
  const instantiations = instantiateVariables(intention, petriNet, adtRegistry);
  
  // 2. Cartesian product
  let combinations = cartesianProduct(instantiations);
  
  if (options.profileMode) {
    console.log(`[V2] Intention '${intention.name}': ${combinations.length} combinations before filtering`);
  }
  
  // 3. Filter by multi-variable guards
  const usesMethods = intention.pairs.some(p => p.stimulation.method);
  if (usesMethods && (intention.initialMarking !== undefined || intention.pairs.some(p => !p.stimulation.method))) throw new Error('Method intentions use the model initial marking and only public method calls');
  // Alternative method guards are not a conjunction over candidate arguments.
  const guards = usesMethods ? [] : extractMultiVariableGuards(intention.variables, petriNet);
  if (guards.length > 0) {
    combinations = await filterByGuards(combinations, guards, petriNet);
    
    if (options.profileMode) {
      console.log(`[V2] Intention '${intention.name}': ${combinations.length} combinations after guard filtering`);
    }
  }
  
  // 4. Generate one test case per combination
  const testCases = [];
  for (const inst of combinations) {
    // Instantiate all pairs
    const instantiatedPairs = intention.pairs.map(pair => 
      instantiatePair(pair, inst)
    );
    
    // Build expectedTrace from pair transitions for UI display
    // Each pair represents one transition firing in sequence
    const expectedTrace = instantiatedPairs.map((pair, idx) => ({
      transition: pair.stimulation.transition,
      binding: pair.stimulation.inputs || {},
      step: idx
    }));
    
    testCases.push({
      id: `${intention.id}-${testCases.length + 1}`,
      intentionId: intention.id,
      intentionName: intention.name,
      testType: intention.testType,
      instantiation: inst,
      ...(usesMethods ? { referenceInitialMarking: initialMarkingOf(petriNet) } : { initialMarking: initialMarkingOf(withInitialMarking(petriNet, instantiateTerm(intention.initialMarking || {}, inst))) }),
      ...(usesMethods ? { interface: { methods: getPublicMethods(petriNet) } } : {}),
      pairs: instantiatedPairs,
      expectedTrace, // Legacy trace metadata; method tests are displayed from their pairs.
      oracle: { type: 'v2', pairs: instantiatedPairs }
    });
  }
  
  return testCases;
}
