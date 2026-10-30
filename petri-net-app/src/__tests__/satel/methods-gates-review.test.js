/** @jest-environment node */
import { parseMethodGateSource, serializeMethodGateSource } from '../../domain/apn/MethodGateSyntax.js';
import { compilePublicNet, enumerateMethodSuccessors } from '../../domain/apn/PublicMethods.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { checkInterface } from '../../satel/core/SequenceRunner.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
import { runBlackBoxExperiment } from '../../satel/blackbox/Campaign.js';

const source = `Class Store;
Interface
  Methods
    set : Int;
    get : ;
  Gates
    reply : Int Bool;
    done : ;
Body
  Places
    stored : Int;
  Initial
    stored (0);
  Axioms
    write: set n With this.done :: stored old -> stored (n);
    read: get With this.reply (v) (true) // this.done :: stored v -> stored (v);
End Store;`;

const clone = x => JSON.parse(JSON.stringify(x));
jest.setTimeout(60000);

test('multiline expressions and lists parse without changing their meaning', () => {
  const net = parseMethodGateSource(source.replace('stored (0)', 'stored (\n  1 +\n  2\n)').replace('this.reply (v)', 'this.reply (\n  v + 1\n)'));
  expect(net.places[0].valueTokens).toEqual([3]);
  expect(enumerateMethodSuccessors(net, 'get').successors[0].produced.reply).toEqual([[4, true]]);
  expect(compilePublicNet(parseMethodGateSource(serializeMethodGateSource(net))).plans).toEqual(compilePublicNet(net).plans);
});

test.each([
  ['missing Interface', s => s.replace('Interface', '')],
  ['missing Body', s => s.replace('Body', '')],
  ['ports in body', s => s.replace('Body\n', 'Body\n  Gates\n')],
  ['repeated section', s => s.replace('  Initial', '  Places\n  Initial')],
  ['missing precondition', s => s.replace('stored old ->', '->')],
  ['missing postcondition', s => s.replace('-> stored (n);', '-> ;')],
  ['unfinished term', s => s.replace('stored (0)', 'stored (0')],
])('source rejects %s', (_, change) => {
  expect(() => parseMethodGateSource(change(source))).toThrow('APN source:');
});

test('gate signatures compare ordered sorts, independently of formal argument names', () => {
  const net = parseMethodGateSource(source), contract = publicInterface(net);
  net.gates[0].parameters[0].name = 'value';
  net.gates[0].parameters[1].name = 'valid';
  expect(() => checkInterface(net, contract)).not.toThrow();
  expect(() => checkInterface(parseMethodGateSource(serializeMethodGateSource(net)), publicInterface(net))).not.toThrow();
  const wrong = clone(contract); wrong.gates[0].parameters.reverse();
  expect(() => checkInterface(net, wrong)).toThrow('Gate signatures');
});

test('ambiguous zero/multiple-argument contracts fail before invoking an adapter', async () => {
  const net = parseMethodGateSource(source), contract = publicInterface(net);
  delete contract.gates;
  const reset = jest.fn(), invoke = jest.fn();
  const result = await runBlackBoxExperiment({ referenceNet: net, calls: [{ method: 'get', arguments: {} }], createSut: () => ({ interface: contract, reset, invoke }) });
  expect(result).toMatchObject({ verdict: 'error', diagnostic: { code: 'interface-mismatch' } });
  expect(reset).not.toHaveBeenCalled(); expect(invoke).not.toHaveBeenCalled();
});

test.each([null, {}, 'reply'])('malformed gate declaration lists are rejected: %p', gates => {
  const net = parseMethodGateSource(source); net.gates = gates;
  expect(() => compilePublicNet(net)).toThrow('Gates must be a list');
  expect(() => checkInterface(parseMethodGateSource(source), { ...publicInterface(parseMethodGateSource(source)), gates })).toThrow('Malformed gate signatures');
});

test('malformed gate calls on an internal transition cannot disappear during validation', () => {
  const net = parseMethodGateSource(source);
  net.transitions.push({ id: 'internal', gates: {} });
  expect(() => compilePublicNet(net)).toThrow('Invalid gate synchronizations');
});

test('symbolic sequence and HML jointly select multi/zero-argument gates, then detect a mutant', async () => {
  const net = parseMethodGateSource(source);
  const intention = {
    id: 'typed-gate-sequence', name: 'Typed gate sequence', kind: 'symbolic',
    symbolic: {
      source: 'operation identity(Int): Int\nrule identity(n: Int): identity(n) = n',
      operation: 'identity', argsText: 'n', variablesText: 'n: Int', maxDepth: 2,
      protocolSource: `case value(n: Int):
inputs n
result n
pair set(n=n) => done([])
pair get() => reply([n, true]), done([])`
    },
    branchingProperty: {
      op: 'diamond', stimulation: { method: 'set', arguments: { n: '$n' } },
      child: { op: 'diamond', stimulation: { method: 'get', arguments: {} }, observation: { outputs: { reply: [[7, true]], done: [[]] }, scope: 'public' }, child: { op: 'true' } }
    }
  };
  const result = await generateIntention(intention, net);
  expect(result.suite.validation.referencePassed).toBe(1);
  expect(result.report.execution.selected[0].witnessArgs).toEqual([7]);
  const mutant = clone(net); mutant.transitions[1].gates[0].arguments[0] = 'v + 1';
  expect((await evaluateOracleSuite(result.suite.selectedTests, mutant, result.suite.interface)).counts.fail).toBe(1);
});

test('a stateless method preserves gate multiplicity without adding state', () => {
  const net = parseMethodGateSource(`Class Stateless;
Interface
  Methods
    tick : ;
  Gates
    done : ;
Body
  Places
  Initial
    empty;
  Axioms
    tick With this.done // this.done :: empty -> empty;
End Stateless;`);
  const edge = enumerateMethodSuccessors(net, 'tick').successors[0];
  expect(edge.produced).toEqual({ done: [[], []] });
  expect(edge.next.places).toEqual([]);
});
