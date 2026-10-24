// Test-only instrumentation: never imported by the editor or shipped in dist.
import { getContext } from '../../../../src/utils/z3/context.js';
import { createSymbolicSolver } from '../../../../src/satel/core/SymbolicZ3.js';
import { parseSymbolicSource } from '../../../../src/satel/core/SymbolicSource.js';
import { generateIntention } from '../../../../src/satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../../../src/satel/core/ValidatedSubuniformity.js';
import { createHmlAlgebraicExample } from '../../../../src/satel/examples/hml-selection/algebraic.js';
import { AlgebraicSimulator } from '../../../../src/features/simulation/algebraic-simulator.js';
import { accountNet } from '../../../../src/satel/examples/oracle-account/net.js';

function assert(value, message) { if (!value) throw new Error(message); }
const query = n => ({ terms: [{ var: 'n' }], conditions: [{ op: '==', left: { var: 'n' }, right: n }], variables: { n: 'Int' } });

export async function lifecycleProbe({ projected = true, rounds = 10 } = {}) {
  const { z3: { Z3 }, ctx } = await getContext();
  const create = Z3.mk_context_rc, remove = Z3.del_context, active = new Set();
  const lifetime = { created: 0, deleted: 0, peak: 0 }, rows = [];
  Z3.mk_context_rc = config => { const ptr = create(config); lifetime.created++; active.add(ptr); lifetime.peak = Math.max(lifetime.peak, active.size); return ptr; };
  Z3.del_context = ptr => { assert(active.delete(ptr), 'Unknown query context released'); lifetime.deleted++; return remove(ptr); };
  const options = { smtPreambleProjection: projected, solverContext: projected ? 'query' : 'shared' };
  const started = performance.now();
  try {
    for (let round = 0; round < rounds; round++) {
      for (const kind of (round % 2 ? ['pair', 'list', 'string'] : ['string', 'list', 'pair'])) {
        const net = createHmlAlgebraicExample(`hml-adt-${kind}-reference`), before = performance.now();
        const { report, suite } = await generateIntention(net.testIntentions[round % 2], net, options);
        assert(suite.validation.referencePassed === 1, `${kind}: missing reference witness`);
        const mutants = [];
        for (const mutation of ['missing-finish', 'wrong-value']) {
          const replay = await evaluateOracleSuite(suite.selectedTests, createHmlAlgebraicExample(`hml-adt-${kind}-${mutation}`), suite.interface);
          assert(replay.counts.fail === 1 && replay.counts.error === 0, `${kind}/${mutation}: missing semantic failure`);
          mutants.push({ mutation, counts: replay.counts });
        }
        rows.push({ round, kind, referencePassed: suite.validation.referencePassed, candidates: report.candidates.length, mutants, elapsedMs: performance.now() - before });
        assert(active.size === 0, 'Context survived generation/replay');
      }
    }
    // Real simulator method invocations plus direct SDK checks share the same
    // runtime with a burst of isolated SATEL requests.
    const simulator = new AlgebraicSimulator(); await simulator.initialize(accountNet);
    const solve = await createSymbolicSolver(parseSymbolicSource(''), { ...options, solverQueryCache: false });
    const sdk = new ctx.Solver(); sdk.fromString('(assert true)');
    let concurrent;
    try {
      const [status, simulation, ...results] = await Promise.all([
        sdk.check(),
        (async () => { for (let i = 0; i < 8; i++) await simulator.invokeMethod('deposit', { n: 1 }); return simulator.petriNet.places.find(p => p.id === 'balance').valueTokens; })(),
        ...Array.from({ length: 24 }, (_, n) => solve(query(n)))
      ]);
      assert(status === 'sat', 'SDK check failed');
      assert(simulation.length === 1 && simulation[0] === 8, 'Simulator lost a deposit');
      results.forEach((r, n) => assert(r.status === 'sat' && r.bindings.get('n') === n, 'Concurrent SATEL witness failed'));
      concurrent = { sdk: status, balance: simulation, queries: results.length };
    } finally { sdk.release(); }
    assert(active.size === 0 && lifetime.created === lifetime.deleted, 'Native context imbalance');
    return { projected, rounds, rows, concurrent, lifetime, elapsedMs: performance.now() - started, crossOriginIsolated, userAgent: navigator.userAgent };
  } finally { Z3.mk_context_rc = create; Z3.del_context = remove; }
}

export async function cancellationProbe(signal, notify) {
  const { z3: { Z3 } } = await getContext();
  const check = Z3.solver_check_assumptions, create = Z3.mk_context_rc, remove = Z3.del_context;
  let created = 0, deleted = 0, first = true;
  Z3.mk_context_rc = c => { created++; return create(c); };
  Z3.del_context = c => { deleted++; return remove(c); };
  // Deliberate scheduling barrier, not a timeout benchmark: hold the first
  // completed-or-running native check until the external CANCEL is delivered.
  Z3.solver_check_assumptions = async (...args) => {
    const result = check(...args);
    if (first) {
      first = false;
      await new Promise(resolve => { signal.addEventListener('abort', resolve, { once: true }); notify('NATIVE_STARTED'); });
    }
    return result;
  };
  try {
    const solve = await createSymbolicSolver(parseSymbolicSource(''), { smtPreambleProjection: true, solverQueryCache: false, signal });
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, n) => solve(query(n))));
    assert(results.every(r => r.status === 'rejected' && r.reason.code === 'cancelled'), 'Cancellation became a solver verdict');
    assert(created === 1 && deleted === 1, 'Cancelled waiters allocated contexts or leaked the active one');
    return { cancelled: results.length, created, deleted };
  } finally { Z3.solver_check_assumptions = check; Z3.mk_context_rc = create; Z3.del_context = remove; }
}
