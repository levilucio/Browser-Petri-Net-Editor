export const postRefusalMutants = ['refusal-time-write', 'refusal-vacation-write', 'refusal-balance-charge', 'refusal-audit-write'];

// Declared before looking at mutant outcomes. Arguments are a finite selection
// policy; enabledness, marking preservation and all expected outputs come from APN.
export function probeCalls(test) {
  const { employee, record } = test.pairs.at(-1).stimulation.arguments;
  const time = test.pairs.at(-1).stimulation.method.endsWith('Time');
  return [
    { method: time ? 'readTime' : 'readVacation', arguments: { actor: employee, employee, record } },
    { method: time ? 'totals' : 'balance', arguments: { actor: employee, employee } },
    { method: 'auditCount', arguments: { actor: employee, employee } }
  ];
}

export function freezeProbeSuite(base, plans) {
  const tests = [];
  for (const source of base.tests) {
    const common = { sourceTestId: source.id, target: source.target, browser: source.browser, sourcePairs: source.pairs };
    const calls = source.pairs.map(p => p.stimulation);
    if (source.kind === 'positive-control') {
      tests.push({ ...common, id: `${source.id}::control`, kind: 'positive-control', calls });
      continue;
    }
    const plan = plans.find(p => p.sourceTestId === source.id);
    if (!plan?.complete) throw Error(`Missing complete probe plan for ${source.id}`);
    if (JSON.stringify(calls) !== JSON.stringify(plan.prefixCalls)) throw Error('Frozen prefix differs from source');
    tests.push({ ...common, id: `${source.id}::terminal`, kind: 'terminal-refusal', refusalStep: plan.refusalStep, calls });
    for (const probe of plan.probes) tests.push({ ...common, id: `${source.id}::probe-${probe.index}`,
      kind: 'post-refusal-probe', refusalStep: plan.refusalStep, probe: probe.stimulation.method,
      calls: [...calls, probe.stimulation], expectedProbe: probe.expected });
  }
  return { schemaVersion: 1, kind: 'post-refusal-trace-experiments', referenceNet: base.referenceNet, interface: base.interface, tests };
}
