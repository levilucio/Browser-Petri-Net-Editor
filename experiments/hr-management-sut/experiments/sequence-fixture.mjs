import { editorImport } from './runtime.mjs';
const { createHrExample, hrWorkLogSource, timeId } = await editorImport('src/satel/examples/hr/editor.js');
export const sequenceLengths = [25, 50, 100];
export const sequenceMutants = ['late-correction-drift'];
export const browserKinds = [[0, 0], [1, 3]];
export const selectionOptions = { maxSequencePairs: 128, maxSequenceTimeMs: 180000, maxSequenceBranches: 500000, profileSelection: true };
export const derivationOptions = { maxBranches: 2048, maxTimeMs: 60000, profileUnfolding: true };
export const workLog = (kinds, minutes) => ({ ctor: 'Entry', args: [kinds[0], minutes[0], { ctor: 'Entry', args: [kinds[1], minutes[1], { ctor: 'End', args: [] }] }] });
export const entries = log => [log.args.slice(0, 2), log.args[2].args.slice(0, 2)];

export function sequenceFixture(length) {
  if (!sequenceLengths.includes(length)) throw Error('Choose 25, 50 or 100 pairs');
  const cases = [];
  for (let k0 = 0; k0 < 5; k0++) for (let k1 = 0; k1 < 5; k1++) {
    const kinds = [k0, k1], lines = [];
    const call = (method, actor, record, args, output) => lines.push(`pair ${method}(actor=${actor}, employee=1001${record === null ? '' : `, record=${record}`}${args ? `, ${args}` : ''}) => ${output}`);
    const read = (i, kind, minutes, status) => call('readTime', 1001, timeId(1001, i), '', `timeRecord((${kind}, (${minutes}, ${status})))`);
    for (let i = 0; i < 2; i++) call('logTime', 1001, timeId(1001, i), `kind=${kinds[i]}, minutes=m${i}`, 'ack(true)');
    for (let i = 0; i < 2; i++) read(i, kinds[i], `m${i}`, kinds[i] === 0 ? 2 : 1);
    for (let i = 0; i < 2; i++) {
      if (kinds[i] === 0) call('correctTime', 11, timeId(1001, i), `kind=0, minutes=m${i}, status=2`, 'ack(true)');
      else call('decideTime', 101, timeId(1001, i), `approve=${kinds[i] !== 3}`, 'ack(true)');
      read(i, kinds[i], `m${i}`, kinds[i] === 3 ? 3 : 2);
    }
    const initialTotal = kinds.flatMap((k, i) => k === 3 ? [] : [`m${i}`]).join(' + ') || '0';
    call('totals', 1001, null, '', `approvedMinutes(${initialTotal})`);
    call('auditCount', 1001, null, '', 'changes(4)');
    for (let cycle = 1; lines.length < length; cycle++) {
      const minutes = cycle % 2 ? 60 : 120, approve = cycle % 3 !== 0;
      call('correctTime', 11, timeId(1001, 0), `kind=2, minutes=${minutes}, status=1`, 'ack(true)');
      call('decideTime', 101, timeId(1001, 0), `approve=${approve}`, 'ack(true)');
      read(0, 2, minutes, approve ? 2 : 3);
      call('totals', 1001, null, '', `approvedMinutes(${approve ? minutes : 0}${k1 === 3 ? '' : ' + m1'})`);
      call('auditCount', 1001, null, '', `changes(${4 + cycle * 2})`);
    }
    if (lines.length !== length) throw Error('Protocol length mismatch');
    cases.push(`case kinds_${k0}_${k1}(m0: Nat, m1: Nat):\ninputs Entry(${k0}, m0, Entry(${k1}, m1, End()))\nresult ${kinds.filter(k => k !== 0).length}\n${lines.join('\n')}`);
  }
  const intention = { id: `hr-sequence-${length}`, name: `HR history with ${length} pairs`, kind: 'symbolic', symbolic: {
    source: hrWorkLogSource, variablesText: 'k0: Nat, m0: Nat, k1: Nat, m1: Nat',
    argsText: 'Entry(k0, m0, Entry(k1, m1, End()))', operation: 'reviews', maxDepth: 3, protocolSource: cases.join('\n')
  } };
  return { net: createHrExample({ slots: 2 }), intention };
}
