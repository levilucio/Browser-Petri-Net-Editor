import { variablesIn } from './SymbolicTerms.js';

/** Match the solver's two contracts: satisfiability uses only conditions;
 * witness extraction additionally uses terms. Keep order, names and sorts.
 * No condition simplification or inference from ancestor feasibility occurs.
 */
export function projectFeasibilityQuery(query) {
  const terms = query.witness === false ? [] : query.terms;
  const used = variablesIn([terms, query.conditions]);
  return {
    ...query,
    terms,
    variables: Object.fromEntries([...used].map(name => [name, query.variables[name]]))
  };
}
