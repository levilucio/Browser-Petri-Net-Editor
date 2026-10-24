/** @jest-environment node */
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3';
import { getContext } from '../../utils/z3/context';
import { createOwnedSolver } from '../../utils/z3/owned-solver';
import { serializeZ3AsyncCalls } from '../../utils/z3/async-runtime';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource';
import { buildHmlConstraints } from '../../satel/core/HmlConstraints';
import { publicInterface } from '../../satel/core/TestCase';
import { instantiateFormula } from '../../satel/core/HmlFormula';
import { evaluateFormula } from '../../satel/core/HmlEvaluator';
import { symbolicToValue } from '../../utils/builtin-values';
import { solverHistoryExamples } from '../../satel/examples/hml-selection/solver-history';
jest.setTimeout(60000);
const algebra = parseSymbolicSource('');
const q = n => ({ terms: [{ var: 'n' }], conditions: [{ op: '==', left: { var: 'n' }, right: n }], variables: { n: 'Int' } });

async function lifetime(run) {
  const { z3: { Z3 } } = await getContext();
  const mk = Z3.mk_context_rc, del = Z3.del_context;
  const active = new Set(); let created = 0, deleted = 0, peak = 0;
  const create = jest.spyOn(Z3, 'mk_context_rc').mockImplementation(config => {
    const ptr = mk(config); created++; active.add(ptr); peak = Math.max(peak, active.size); return ptr;
  });
  const remove = jest.spyOn(Z3, 'del_context').mockImplementation(ptr => {
    expect(active.delete(ptr)).toBe(true); deleted++; return del(ptr);
  });
  try { await run(Z3); expect(active.size).toBe(0); expect(deleted).toBe(created); return { created, deleted, peak }; }
  finally { create.mockRestore(); remove.mockRestore(); }
}

test('the runtime queue serializes high- and low-level calls and survives rejections', async () => {
  let active = 0, peak = 0, calls = [];
  const em = { async async_call(fn, id) {
    expect(this).toBe(em); active++; peak = Math.max(peak, active); calls.push(id);
    try { await new Promise(resolve => setTimeout(resolve, 1)); return fn(id); }
    finally { active--; }
  } };
  serializeZ3AsyncCalls(em); const once = em.async_call; serializeZ3AsyncCalls(em);
  expect(em.async_call).toBe(once);
  const r = await Promise.allSettled([em.async_call(x => x, 1), em.async_call(() => { throw Error('failed'); }, 2), em.async_call(x => x, 3)]);
  expect(peak).toBe(1); expect(calls).toEqual([1, 2, 3]);
  expect(r.map(x => x.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  expect(r[2].value).toBe(3);
});

test.each([false, true])('mixed HML queries solve and replay with one adapter, projection %s', async smtPreambleProjection => {
  const stats = await lifetime(async () => {
    const solve = await createSymbolicSolver(algebra, { solverContext: 'query', smtPreambleProjection, solverQueryCache: false });
    for (const scenario of [...solverHistoryExamples(), ...solverHistoryExamples().reverse()]) {
      const { sort, net, formula } = scenario;
      const c = await buildHmlConstraints(formula, net, publicInterface(net), { x: { var: 'x' } }, { x: sort }, algebra);
      const r = await solve({ terms: [{ var: 'x' }], conditions: c.conditions, variables: { x: sort } });
      expect({ status: r.status, reason: r.reason }).toEqual({ status: 'sat', reason: undefined });
      const replay = await evaluateFormula(instantiateFormula(formula, { x: symbolicToValue(r.bindings.get('x')) }), net, publicInterface(net));
      expect(replay.value).toBe(true);
    }
  });
  expect(stats).toEqual({ created: 6, deleted: 6, peak: 1 });
});

test('projection opts into query ownership; cache hits need no native context and revalidate witnesses', async () => {
  let solve;
  const stats = await lifetime(async () => {
    solve = await createSymbolicSolver(algebra, { smtPreambleProjection: true, profileSolver: true });
    for (let i = 0; i < 3; i++) expect((await solve(q(3))).bindings.get('n')).toBe(3);
  });
  expect(stats.created).toBe(1); expect(solve.solverProfile.cacheWitnessChecks).toBe(2);
});

test('the same isolated query emits identical SMT text despite intervening queries and adapters', async () => {
  await lifetime(async Z3 => {
    const original = Z3.solver_from_string, scripts = [];
    const spy = jest.spyOn(Z3, 'solver_from_string').mockImplementation((c, s, text) => { scripts.push(text); return original(c, s, text); });
    try {
      const solve = await createSymbolicSolver(algebra, { smtPreambleProjection: true, solverQueryCache: false });
      await solve(q(3)); await solve(q(4)); await solve(q(3));
      await (await createSymbolicSolver(algebra, { smtPreambleProjection: true }))(q(3));
      expect(scripts[0]).toBe(scripts[2]); expect(scripts[0]).toBe(scripts[3]);
    } finally { spy.mockRestore(); }
  });
});

test('concurrent owned queries have at most one native context and coexist with SDK checks', async () => {
  const stats = await lifetime(async () => {
    const { ctx } = await getContext(); const sdk = new ctx.Solver();
    const solve = await createSymbolicSolver(algebra, { smtPreambleProjection: true, solverQueryCache: false });
    try {
      sdk.fromString('(assert true)');
      const results = await Promise.all([sdk.check(), ...Array.from({ length: 12 }, (_, i) => solve(q(i)))]);
      expect(results[0]).toBe('sat');
      results.slice(1).forEach((r, i) => expect(r.bindings.get('n')).toBe(i));
    } finally { sdk.release(); }
  });
  expect(stats).toEqual({ created: 12, deleted: 12, peak: 1 });
});

test.each(['unsat', 'encode', 'parse', 'model', 'setup', 'unknown', 'check-error'])('%s releases its query context', async failure => {
  const stats = await lifetime(async Z3 => {
    let spy;
    if (failure === 'unknown') spy = jest.spyOn(Z3, 'solver_check_assumptions').mockResolvedValueOnce(0);
    if (failure === 'check-error') spy = jest.spyOn(Z3, 'solver_check_assumptions').mockRejectedValueOnce(Error('native failure'));
    const solve = await createSymbolicSolver(algebra, { solverContext: 'query', timeoutMs: failure === 'setup' ? -1 : 3000 });
    try {
      if (failure === 'setup') { await expect(solve(q(2))).rejects.toThrow(/timeout/); return; }
      const query = failure === 'unsat' ? { ...q(2), conditions: [false] } : failure === 'encode' ? { ...q(2), conditions: [{ call: 'missing', args: [] }] } : failure === 'parse' ? { ...q(2), variables: { n: 'Missing' } } : failure === 'model' ? { ...q(2), conditions: [{ op: '==', left: { var: 'n' }, right: { op: '*', left: 2147483647, right: 2147483647 } }] } : q(2);
      expect((await solve(query)).status).toBe(failure === 'unsat' ? 'unsat' : 'unknown');
    } finally { spy?.mockRestore(); }
    // A failed request must not poison the queue or the next context.
    expect((await solve(q(5))).bindings.get('n')).toBe(5);
  });
  expect(stats.created).toBe(failure === 'setup' ? 1 : 2);
});

test.each(['unknown', 'error', 'unsat'])('optional preference %s retains the validated original witness and releases the context', async status => {
  await lifetime(async Z3 => {
    const original = Z3.solver_check_assumptions;
    const spy = jest.spyOn(Z3, 'solver_check_assumptions').mockImplementationOnce(original);
    if (status === 'error') spy.mockRejectedValueOnce(Error('optional failure'));
    else spy.mockResolvedValueOnce(status === 'unsat' ? -1 : 0);
    try {
      const solve = await createSymbolicSolver(algebra, { solverContext: 'query', numericPreferenceRefutation: false });
      expect((await solve(q(3))).bindings.get('n')).toBe(3);
    } finally { spy.mockRestore(); }
  });
});

test('cancellation after checking cleans up; queued cancellation allocates no context', async () => {
  const controller = new AbortController();
  const stats = await lifetime(async Z3 => {
    const original = Z3.solver_check_assumptions;
    const spy = jest.spyOn(Z3, 'solver_check_assumptions').mockImplementationOnce(async (...args) => {
      const result = await original(...args); controller.abort(); return result;
    });
    const solve = await createSymbolicSolver(algebra, { solverContext: 'query', signal: controller.signal, solverQueryCache: false });
    try {
      const results = await Promise.allSettled([solve(q(2)), solve(q(3))]);
      for (const result of results) { expect(result.status).toBe('rejected'); expect(result.reason.code).toBe('cancelled'); }
    } finally { spy.mockRestore(); }
  });
  expect(stats).toEqual({ created: 1, deleted: 1, peak: 1 });
});

test('owned solver rejects mutation/release while checking and supports idempotent cleanup', async () => {
  await lifetime(async Z3 => {
    const solver = createOwnedSolver(Z3); solver.set('timeout', 3000); solver.fromString('(assert true)');
    const checking = solver.check();
    expect(() => solver.release()).toThrow(/during a check/);
    expect(() => solver.push()).toThrow(/being checked/);
    expect(await checking).toBe('sat'); solver.release(); solver.release();
    expect(() => solver.fromString('(assert true)')).toThrow(/released/);
  });
});

test('creation failures release the native context and configuration', async () => {
  await lifetime(async Z3 => {
    const fail = jest.spyOn(Z3, 'mk_solver').mockImplementationOnce(() => { throw Error('creation failure'); });
    const deletedConfig = jest.spyOn(Z3, 'del_config');
    try {
      expect(() => createOwnedSolver(Z3)).toThrow('creation failure');
      expect(deletedConfig).toHaveBeenCalledTimes(1);
    } finally { fail.mockRestore(); deletedConfig.mockRestore(); }
  });
});

test('a vector-release error still releases the owned solver and context', async () => {
  await lifetime(async Z3 => {
    const solve = await createSymbolicSolver(algebra, { solverContext: 'query' });
    const spy = jest.spyOn(Z3, 'ast_vector_dec_ref').mockImplementationOnce(() => { throw Error('vector cleanup failed'); });
    try { await expect(solve(q(3))).rejects.toThrow('vector cleanup failed'); }
    finally { spy.mockRestore(); }
  });
});
