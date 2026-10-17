// Compatibility transport for older direct-transition intentions.
import { isMethodRule } from '../../domain/apn/PublicMethods.js';
import { equalTokenBags } from '../../utils/builtin-values.js';
const unwrap = token => token && typeof token === 'object' && Object.keys(token).length === 1 && 'value' in token ? token.value : token;
export function inputSelector(stimulation, simulator) {
  const rule = simulator.petriNet.transitions.find(t => t.id === stimulation.transition);
  if (!rule) throw new Error('transition_not_found');
  if (isMethodRule(rule)) throw new Error('Public method rules must be invoked through their method');
  const inputs = stimulation.inputs || {};
  for (const [id, tokens] of Object.entries(inputs)) {
    if (!simulator.petriNet.places.some(p => p.id === id)) throw new Error(`place_not_found: ${id}`);
    if (!Array.isArray(tokens)) throw new Error(`Invalid input token multiset: ${id}`);
    if (!simulator.petriNet.arcs.some(a => (a.sourceId || a.source) === id && (a.targetId || a.target) === stimulation.transition)) {
      throw new Error(`Input place ${id} is not consumed by ${stimulation.transition}`);
    }
  }
  return ({
    picks
  }) => Object.entries(inputs).every(([id, tokens]) => equalTokenBags(picks.filter(p => p.srcId === id).map(p => unwrap(p.value)), tokens.map(unwrap)));
}
