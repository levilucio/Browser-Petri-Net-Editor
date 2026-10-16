/** Ten small, stateful case studies. Equations and expected observations are
 * authored explicitly; mutants change only the APN, never its intention. */
export const clone = x => JSON.parse(JSON.stringify(x));
export const pairValue = (fst, snd) => ({
  __pair__: true,
  fst,
  snd
});
export function builder() {
  const net = {
    mode: 'algebraic',
    places: [],
    transitions: [],
    arcs: []
  };
  const place = (id, sort, values = [], output = false) => {
    const i = net.places.filter(p => p.io_type === (output ? 'output' : 'internal')).length;
    net.places.push({
      id,
      label: id,
      sort,
      io_type: output ? 'output' : 'internal',
      valueTokens: clone(values),
      tokens: values.length,
      x: output ? 1000 : 140,
      y: 100 + i * 140
    });
  };
  const rule = (id, name, parameters, guard, inputs, outputs) => {
    const i = net.transitions.length;
    net.transitions.push({
      id,
      label: id,
      x: 430 + i % 2 * 260,
      y: 130 + Math.floor(i / 2) * 200,
      guard,
      method: {
        name,
        parameters: Object.entries(parameters).map(([name, sort]) => ({
          name,
          sort
        }))
      }
    });
    for (const [input, entries] of [[true, inputs], [false, outputs]]) entries.forEach(([p, binding], j) => net.arcs.push({
      id: `${id}-${input ? 'in' : 'out'}-${p}-${j}`,
      source: input ? p : id,
      target: input ? id : p,
      sourceType: input ? 'place' : 'transition',
      targetType: input ? 'transition' : 'place',
      type: input ? 'place-to-transition' : 'transition-to-place',
      binding,
      weight: 1
    }));
  };
  return {
    net,
    place,
    rule
  };
}
export const changedOutput = (rule, place, binding) => net => {
  const arc = net.arcs.find(a => a.source === rule && a.target === place);
  if (!arc) throw new Error(`Missing mutation site ${rule}/${place}`);
  arc.binding = binding;
};
export const changedMarking = (place, values) => net => {
  const p = net.places.find(p => p.id === place);
  p.valueTokens = clone(values);
  p.tokens = values.length;
};
export const mutation = (id, label, description, apply) => ({
  id,
  label,
  description,
  apply
});
export const intention = (id, name, source, variablesText, argsText, operation, conditionsText, protocolSource, maxDepth = 12) => ({
  id: `exercise-${id}`,
  name,
  kind: 'symbolic',
  symbolic: {
    source,
    variablesText,
    argsText,
    operation,
    conditionsText,
    protocolSource,
    maxDepth
  }
});
export const cases = (declarations, inputs, result, lines, id = 'run') => `case ${id}(${declarations}):\ninputs ${inputs}\nresult ${result}\n${lines.join('\n')}`;
