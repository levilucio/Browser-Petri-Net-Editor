import { instantiateFormula } from './HmlFormula.js';
import { checkCancelled } from '../../domain/diagnostics.js';
import { compileMethodTerm, evaluateMethodTerm } from '../../domain/apn/MethodTerms.js';
import { getPublicMethods } from '../../domain/apn/PublicMethods.js';
import { withInitialMarking, initialMarkingOf } from './InitialMarking.js';
/** Finite selection policy. Fixed values are enumerated, never repaired by a solver. */
import { buildAdtRegistry } from '../../utils/adt-parser.js';
import { instantiateVariables, cartesianProduct, filterByGuards, instantiatePair, extractMultiVariableGuards, instantiateTerm } from './VariableInstantiator.js';
import { validateIntention } from './IntentionSchema.js';
export async function selectExplicitIntention(intention, petriNet, options = {}) {
  const adtRegistry = options.adtRegistry || buildAdtRegistry(petriNet);

  // Validate schema
  validateIntention(intention);

  // 1. Generate representatives per variable per hypothesis
  const instantiations = instantiateVariables(intention, petriNet, adtRegistry);

  // 2. Cartesian product
  const size = Object.values(instantiations).reduce((n, values) => n * values.length, 1);
  if (size > 10000) throw new Error('Candidate combination limit is 10,000; narrow the explicit variable domains.');
  let combinations = cartesianProduct(instantiations);
  if (intention.conditionsText?.trim()) {
    const condition = compileMethodTerm(intention.conditionsText, Object.fromEntries(intention.variables.map(v => [v.name, v.sort])), 'Bool');
    combinations = combinations.filter(values => evaluateMethodTerm(condition, values) === true);
  }

  // 3. Filter by multi-variable guards
  const usesMethods = !!intention.formula || intention.pairs.some(p => p.stimulation.method);
  if (usesMethods && (intention.initialMarking !== undefined || intention.pairs.some(p => !p.stimulation.method))) throw new Error('Method intentions use the model initial marking and only public method calls');
  // Alternative method guards are not a conjunction over candidate arguments.
  const guards = usesMethods ? [] : extractMultiVariableGuards(intention.variables, petriNet);
  if (guards.length > 0) {
    combinations = await filterByGuards(combinations, guards, petriNet);
  }

  // 4. Generate one test case per combination
  const testCases = [];
  for (const inst of combinations) {
    checkCancelled(options.signal);
    // Instantiate all pairs
    const instantiatedPairs = intention.pairs.map(pair => instantiatePair(pair, inst));

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
      ...(usesMethods ? {
        referenceInitialMarking: initialMarkingOf(petriNet)
      } : {
        initialMarking: initialMarkingOf(withInitialMarking(petriNet, instantiateTerm(intention.initialMarking || {}, inst)))
      }),
      ...(usesMethods ? {
        interface: {
          methods: getPublicMethods(petriNet)
        }
      } : {}),
      pairs: instantiatedPairs,
      ...(intention.formula ? { formula: instantiateFormula(intention.formula, inst), expectedTruth: intention.expectedTruth ?? true } : {}),
      expectedTrace,
      // Legacy trace metadata; method tests are displayed from their pairs.
      oracle: {
        type: 'v2',
        pairs: instantiatedPairs
      }
    });
  }
  if (!testCases.length) throw new Error(`No candidates generated for ${intention.name}`);
  return testCases;
}
