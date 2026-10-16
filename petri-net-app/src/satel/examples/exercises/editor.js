/** Catalog only. Each scenario owns its reference, intentions and two mutants. */
import thermostat from './thermostat.js';
import door from './door.js';
import tickets from './tickets.js';
import labels from './labels.js';
import coordinates from './coordinates.js';
import queue from './queue.js';
import parcel from './parcel.js';
import quota from './quota.js';
import kits from './kits.js';
import journal from './journal.js';
export const exerciseScenarios = [thermostat, door, tickets, labels, coordinates, queue, parcel, quota, kits, journal];
export const exerciseExamples = exerciseScenarios.flatMap(s => [{
  filename: `exercise-${s.id}-reference`,
  displayName: `${s.name} — Reference (${s.depth} pairs)`,
  description: `${s.types}. ${s.description}`
}, ...s.mutants.map(m => ({
  filename: `exercise-${s.id}-${m.id}`,
  displayName: `${s.name} — Mutant: ${m.label}`,
  description: m.description
}))]);
export function createExerciseExample(filename) {
  const scenario = exerciseScenarios.find(s => filename === `exercise-${s.id}-reference` || s.mutants.some(m => filename === `exercise-${s.id}-${m.id}`));
  if (!scenario) throw new Error(`Unknown SATEL exercise: ${filename}`);
  const mutant = scenario.mutants.find(m => filename === `exercise-${scenario.id}-${m.id}`);
  const net = scenario.build();
  mutant?.apply(net);
  for (const entry of net.testIntentions) entry.description = `${scenario.description} ${scenario.classes} algebraic classes; ${scenario.depth} stimulation/observation pairs per test.`;
  net.satelExample = {
    id: filename,
    name: `${scenario.name} ${mutant ? `mutant — ${mutant.label}` : `reference — ${scenario.depth} pairs`}`,
    role: mutant ? 'mutant' : 'reference',
    description: mutant?.description || scenario.description
  };
  return net;
}
