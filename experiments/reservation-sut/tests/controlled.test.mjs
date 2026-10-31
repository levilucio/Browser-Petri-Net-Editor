import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateControlled} from '../experiments/controlled.mjs';
const yes = {op: 'true'}, no = {op: 'false'};
const modal = (op, method, child = yes, outputs = null) => ({op, stimulation: {method, arguments: {}}, ...(outputs ? {observation: {outputs}} : {}), child});
const both = {op: 'and', children: [modal('diamond', 'left'), modal('diamond', 'right')]};
// An independent finite relation, not the application/APN implementation.
function world(split = false) {
  let state = 'initial', id = 0;
  const snapshots = new Map();
  const sut = {async reset() {state = 'initial';}, async invoke(call, {choice}) {
    if (call.method === 'open' && state === 'initial') {state = split ? choice ? 'right' : 'left' : 'both'; return {status: 'accepted', outputs: {reply: [0]}};}
    if ((call.method === 'left' || call.method === 'right') && (state === 'both' || state === call.method)) {state = 'done'; return {status: 'accepted', outputs: {reply: [1]}};}
    return {status: 'refused', outputs: {reply: []}};
  }};
  const controls = async (action, body) => {
    if (action === 'checkpoint') {snapshots.set(++id, state); return {checkpoint: id, digest: state};}
    state = snapshots.get(body.checkpoint); return {digest: state};
  };
  return {sut, controls};
}
const run = (formula, w, options = {}) => evaluateControlled(formula, w.sut, '', {outputs: ['reply']}, {controls: w.controls, ...options});
test('conjunction uses the same restored state for destructive alternatives', async () => {
  const r = await run(modal('box', 'open', both), world()); assert.equal(r.value, true); assert(r.complete);
});
test('separate hidden successors cannot be pooled into one branching witness', async () => {
  for (const op of ['diamond', 'box']) assert.equal((await run(modal(op, 'open', both), world(true))).value, false);
});
test('each separate possible trace exists in the early-commitment relation', async () => {
  for (const method of ['left', 'right']) assert.equal((await run(modal('diamond', 'open', modal('diamond', method)), world(true))).value, true);
});
test('exhaustive refusals establish no accepted edge under the declared controls', async () => {
  assert.equal((await run(modal('diamond', 'left'), world())).value, false);
  assert.equal((await run(modal('box', 'left', no), world())).value, true);
});
test('box with a forbidden matching edge is false', async () => {
  assert.equal((await run(modal('box', 'open', no, {reply: [0]}), world())).value, false);
});
test('observation complement selects unexpected output', async () => {
  assert.equal((await run({...modal('box', 'open', no, {reply: [99]}), excludeObservation: true}, world())).value, false);
});
test('node cutoff cannot establish absence', async () => {
  const r = await run(modal('diamond', 'open', both), world(), {maxNodes: 1});
  assert.equal(r.value, null); assert.equal(r.verdict, 'inconclusive'); assert.equal(r.complete, false);
});
test('bad restore identity is an error, never a property counterexample', async () => {
  const w = world(), original = w.controls;
  w.controls = async (...args) => args[0] === 'restore' ? {digest: 'wrong'} : original(...args);
  const r = await run(modal('box', 'open', no), w); assert.equal(r.value, null); assert.equal(r.verdict, 'error');
});
test('transport failure is an error, never evidence of branch absence', async () => {
  const w = world(); w.sut.invoke = async () => {throw Error('transport failed');};
  const r = await run(modal('diamond', 'open'), w); assert.equal(r.value, null); assert.equal(r.verdict, 'error');
});
test('a late nonmatching response does not establish a vacuous box', async () => {
  const w = world(), invoke = w.sut.invoke;
  w.sut.invoke = async (...args) => {await new Promise(r => setTimeout(r, 30)); return invoke(...args);};
  const r = await run(modal('box', 'open', no, {reply: [99]}), w, {maxTimeMs: 10});
  assert.equal(r.value, null); assert.equal(r.verdict, 'inconclusive');
});
test('invalid formulas and budgets are errors', async () => {
  assert.equal((await run({op: 'invented'}, world())).verdict, 'error');
  assert.equal((await run(yes, world(), {maxNodes: 0})).verdict, 'error');
});
