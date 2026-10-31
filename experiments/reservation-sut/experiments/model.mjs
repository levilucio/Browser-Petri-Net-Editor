// Reference and properties authored independently from the procedural SUT.
import {editorImport} from './runtime.mjs';
const {builder} = await editorImport('src/satel/examples/exercises/builder.js');
const {convertOutputPlacesToGates} = await editorImport('src/domain/apn/GateMigration.js');
const top = {op: 'true'}, bottom = {op: 'false'};
const modal = (op, method, outputs, child = top, args = {}) => ({
  op, stimulation: {method, arguments: args},
  ...(outputs === null ? {} : {observation: {outputs}}), child
});
const d = (m, o, c, a) => modal('diamond', m, o, c, a);
const b = (m, o, c, a) => modal('box', m, o, c, a);
const properties = [
  ['possible-a', 'Automatic allocation A is possible', d('open', {ready: [true]}, d('allocate', {allocated: [1]}))],
  ['possible-b', 'Automatic allocation B is possible', d('open', {ready: [true]}, d('allocate', {allocated: [2]}))],
  ['no-99', 'Automatic allocation never reports 99', b('open', {ready: [true]}, b('allocate', {allocated: [99]}, bottom))],
  ['both-choices', 'Every ready state retains both explicit choices', b('open', {ready: [true]}, {
    op: 'and', children: [1, 2].map(warehouse => d('reserve', {allocated: [warehouse]}, top, {warehouse}))
  })],
  ['b-receipt', 'Every automatic B allocation finishes with receipt B', b('open', {ready: [true]}, b('allocate', {allocated: [2]}, {
    ...b('finish', {receipt: [2]}, bottom), excludeObservation: true
  }))]
];
export function reference() {
  const n = builder();
  n.place('state', 'Nat', [0]);
  n.place('ready', 'Bool', [], true);
  n.place('allocated', 'Nat', [], true);
  n.place('receipt', 'Nat', [], true);
  n.rule('open_ready', 'open', {}, 's == 0', [['state', 's']], [['state', '1'], ['ready', 'true']]);
  for (const warehouse of [1, 2]) {
    n.rule('auto_' + warehouse, 'allocate', {}, 's == 1', [['state', 's']], [['state', String(warehouse + 1)], ['allocated', String(warehouse)]]);
    n.rule('reserve_' + warehouse, 'reserve', {warehouse: 'Nat'}, `s == 1 and warehouse == ${warehouse}`, [['state', 's']], [['state', String(warehouse + 1)], ['allocated', 'warehouse']]);
    n.rule('finish_' + warehouse, 'finish', {}, `s == ${warehouse + 1}`, [['state', 's']], [['state', '4'], ['receipt', String(warehouse)]]);
  }
  n.net.testIntentions = properties.map(([id, name, formula]) => ({id, name, formula, expectedTruth: true, variables: [], pairs: [], testType: 'positive'}));
  const net = convertOutputPlacesToGates(n.net);
  net.apnClass = 'ReservationChoices';
  net.satelExample = {id: 'reservation-choices', name: 'Reservation choices — HML reference', role: 'reference'};
  net.places[0].x = 400; net.places[0].y = 180;
  return net;
}
