/** HML over actual checkpointed calls, not the APN's transition relation.
 * Completeness is conditional on faithful restore + all binary entropy choices.
 * This evaluator supports public finite HML only. Resource limits stay unknown.
 */
import assert from 'node:assert/strict';
import {control} from './adapters.mjs';
import {editorImport} from './runtime.mjs';
const {checkObservation} = await editorImport('src/satel/core/Observations.js');
const {validateFormula} = await editorImport('src/satel/core/HmlFormula.js');
export async function evaluateControlled(formula, sut, base, io, options = {}) {
  const maxNodes = options.maxNodes ?? 256, maxCalls = options.maxCalls ?? 256;
  const maxTimeMs = options.maxTimeMs ?? 60000;
  const deadline = Date.now() + maxTimeMs;
  const controls = options.controls || ((action, body) => control(base, action, body));
  const timeGuard = () => {
    if (Date.now() > deadline) { const error = Error('Controlled time budget exceeded'); error.code = 'resource-limit'; throw error; }
  };
  let nodes = 0, calls = 0;
  const log = [];
  const guard = () => {
    if (++nodes > maxNodes || calls >= maxCalls || Date.now() > deadline) {
      const e = Error('Controlled exploration budget exceeded'); e.code = 'resource-limit'; throw e;
    }
  };
  async function visit(node, checkpoint) {
    guard();
    if (node.op === 'true') return true;
    if (node.op === 'false') return false;
    if (node.op === 'not') { const v = await visit(node.child, checkpoint); return v === null ? null : !v; }
    if (node.children) {
      const values = [];
      for (const child of node.children) values.push(await visit(child, checkpoint));
      const decisive = node.op === 'or';
      return values.includes(decisive) ? decisive : values.includes(null) ? null : !decisive;
    }
    if (!['box', 'diamond'].includes(node.op) || node.observation?.markings) throw Error('Unsupported controlled formula');
    const values = [];
    for (const choice of [0, 1]) {
      guard();
      const restored = await controls('restore', {checkpoint: checkpoint.checkpoint});
      assert.equal(restored.digest, checkpoint.digest, 'Checkpoint restoration failed');
      calls++;
      const response = await sut.invoke(node.stimulation, {choice});
      if (!['accepted', 'refused'].includes(response.status)) throw Error('Uncertain response');
      const next = await controls('checkpoint');
      timeGuard();
      const event = {parent: checkpoint.digest, choice, stimulation: node.stimulation, response, successor: next.digest};
      log.push(event);
      if (response.status === 'refused') { event.match = false; continue; }
      const match = !node.observation || checkObservation(node.observation, {}, response.outputs).success;
      event.match = node.excludeObservation ? !match : match;
      if (event.match) { event.childValue = await visit(node.child, next); values.push(event.childValue); }
    }
    if (node.op === 'diamond') return values.includes(true) ? true : values.includes(null) ? null : false;
    return values.includes(false) ? false : values.includes(null) ? null : true;
  }
  try {
    if (![maxNodes, maxCalls, maxTimeMs].every(n => Number.isInteger(n) && n > 0)) throw Error('Budgets must be positive integers');
    validateFormula(formula);
    await sut.reset({seed: 1});
    const start = await controls('checkpoint');
    const value = await visit(formula, start);
    return {value, verdict: value === null ? 'inconclusive' : value ? 'satisfied-under-controls' : 'violated-under-controls', complete: true, nodes, calls, log};
  } catch (error) {
    return {value: null, verdict: error.code === 'resource-limit' ? 'inconclusive' : 'error', complete: false, reason: error.message, nodes, calls, log};
  }
}
