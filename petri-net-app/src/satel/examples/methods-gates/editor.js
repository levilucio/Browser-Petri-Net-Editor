import { convertOutputPlacesToGates } from '../../../domain/apn/GateMigration.js';
import { oracleAccountExamples, createOracleAccountExample } from '../oracle-account/editor.js';
import { exerciseExamples, createExerciseExample } from '../exercises/editor.js';
import { inventoryExamples, createInventoryExample } from '../inventory/editor.js';
import { refusalExamples, createRefusalExample } from '../refusal/editor.js';
import { nondeterminismExamples, createNondeterminismExample } from '../nondeterminism/editor.js';
import { hmlSelectionExamples, createHmlSelectionExample } from '../hml-selection/editor.js';
import { hmlAlgebraicExamples, createHmlAlgebraicExample } from '../hml-selection/algebraic.js';
import { fulfilmentExamples, createFulfilmentExample } from '../fulfilment/editor.js';
import { createExecutableSequenceExample } from '../executable-sequence/editor.js';
import { createTypedStoreExample } from '../typed-store/editor.js';
import { createCompoundGuardExample } from '../compound-guard/editor.js';
const groups = [[oracleAccountExamples, createOracleAccountExample], [exerciseExamples, createExerciseExample], [inventoryExamples, createInventoryExample], [refusalExamples, createRefusalExample], [nondeterminismExamples, createNondeterminismExample], [hmlSelectionExamples, createHmlSelectionExample], [hmlAlgebraicExamples, createHmlAlgebraicExample], [fulfilmentExamples, createFulfilmentExample]];
const entries = groups.flatMap(([list, build]) => list.map(e => ({ ...e, build: () => build(e.filename) })));
for (const [id, title, build] of [['executable-sequence', 'Whole-sequence selection', createExecutableSequenceExample], ['typed-store', 'Typed store', createTypedStoreExample], ['compound-guard', 'Compound guard', createCompoundGuardExample]]) {
  for (const mutant of [false, true]) entries.push({ filename: `${id}${mutant ? '-mutant' : ''}`, displayName: `${title} — ${mutant ? 'Mutant' : 'Reference'}`, build: () => build(mutant) });
}
export const methodGateExamples = entries.map(({ build, ...e }) => ({ ...e, filename: `gates-${e.filename}`, displayName: `Methods & gates — ${e.displayName}` }));
export function createMethodGateExample(filename) {
  const entry = entries.find(e => `gates-${e.filename}` === filename);
  if (!entry) throw new Error(`Unknown methods/gates example: ${filename}`);
  const net = convertOutputPlacesToGates(entry.build());
  net.satelExample = { ...net.satelExample, id: filename, name: `Methods & gates — ${net.satelExample.name}` };
  return net;
}
export const originalMethodExample = filename => entries.find(e => `gates-${e.filename}` === filename).build();
