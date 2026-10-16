import { splitTopLevel } from '../../utils/split-terms.js';
import { formatObservationToken, groundNotation } from '../../components/satel/observationTerms.js';

export function pairNotation(pair) {
  const s = pair.stimulation, o = pair.observation;
  const call = s.method ? `${s.method}(${Object.entries(s.arguments || {}).map(([n, v]) => `${n}=${formatObservationToken(v)}`).join(', ')})` : `${s.transition}${Object.keys(s.inputs || {}).length ? ` [${Object.entries(s.inputs).map(([p, v]) => `${p} ↦ ⟦${v.map(formatObservationToken).join(', ')}⟧`).join(', ')}]` : ''}`;
  const outputs = Object.entries(o.outputs || {}).flatMap(([p, values]) => values.length ? values.map(v => `${p}(${formatObservationToken(v)})`) : [`${p}(∅)`]);
  const markings = Object.entries(o.markings || {}).map(([p, c]) => {
    if (c.equals !== undefined) return `${p} = ⟦${c.equals.map(formatObservationToken).join(', ')}⟧`;
    if (c.length !== undefined) return `|${p}| = ${c.length}`;
    if (c.empty !== undefined) return `${p} ${c.empty ? '=' : '≠'} ∅`;
    if (c.contains !== undefined) return `⟦${c.contains.map(formatObservationToken).join(', ')}⟧ ⊆ ${p}`;
    return `${p}: no active constraint`;
  });
  return `{ ${call} with ${o.type === 'notEnabled' ? 'blocked' : outputs.join(' // ') || 'unconstrained'} }${o.type !== 'notEnabled' && markings.length ? ` [marking: ${markings.join('; ')}]` : ''}`;
}
export function intentionNotation(intention) {
  const variables = intention.variables.map(v => `  ${v.name} : ${v.sort}`).join('\n');
  const hypotheses = intention.variables.map(v => v.hypothesis.type === 'finite' ? `values(${v.name}, [${v.hypothesis.values.map(groundNotation).join(', ')}])` : v.hypothesis.type === 'uniformity' ? `uniformity(${v.name}; representative=${v.hypothesis.representative === undefined ? 'default' : groundNotation(v.hypothesis.representative)})` : `${v.hypothesis.type === 'subuniformity' ? 'subUniformity' : v.hypothesis.type}(${v.name})`);
  const conditions = [intention.conditionsText, ...hypotheses].filter(Boolean).join(', ') || 'true';
  return `Variables\n${variables || '  (none)'}\n\nAxioms\n  ${conditions}\n  =>\n  ${intention.pairs.map(pairNotation).join(' .\n  ')}\n  in ${intention.name};`;
}
// Preserve the existing symbolic case bindings exactly; only change pair notation.
export function protocolCases(source) {
  const cases = []; let current;
  for (const line of source.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'))) {
    if (line.startsWith('case ')) { current = { header: [], pairs: [], name: line.match(/^case ([\w.-]+)/)?.[1] || 'Case' }; cases.push(current); }
    if (!current) throw new Error('Protocol must begin with a case.');
    if (line.startsWith('pair ')) {
      const sides = splitTopLevel(line.slice(5), '=>');
      if (sides.length !== 2) throw new Error('Invalid protocol pair.');
      current.pairs.push(`{ ${sides[0]} with ${sides[1] === 'none' ? 'none' : splitTopLevel(sides[1]).join(' // ')} }`);
    } else current.header.push(line);
  }
  return cases;
}
export function replaceProtocolSequence(source, index, sequence) {
  const cases = protocolCases(source);
  if (!cases[index]) throw new Error('Missing sequence case.');
  const pairs = sequence.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const match = line.match(/^\{\s*(.*)\s*\}\s*\.?$/);
    if (!match) throw new Error('Write one { method(...) with place(token) } pair per line.');
    const sides = splitTopLevel(match[1], ' with ');
    if (sides.length !== 2) throw new Error('Each pair needs “with”.');
    return `pair ${sides[0]} => ${splitTopLevel(sides[1], '//').join(', ')}`;
  });
  // Keep other cases, case bindings and comments untouched.
  const lines = source.split('\n');
  const starts = lines.flatMap((line, i) => line.trim().startsWith('case ') ? [i] : []);
  const start = starts[index], end = starts[index + 1] ?? lines.length;
  const section = lines.slice(start, end), replacement = [];
  let inserted = false;
  for (const line of section) {
    if (line.trim().startsWith('pair ')) {
      if (!inserted) replacement.push(...pairs);
      inserted = true;
    } else replacement.push(line);
  }
  if (!inserted) replacement.push(...pairs);
  return [...lines.slice(0, start), ...replacement, ...lines.slice(end)].join('\n');
}
