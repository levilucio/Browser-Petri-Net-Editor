/*
 Generates docs/unit-test-report.details.md from coverage/test-results.json
*/
const fs = require('fs');
const path = require('path');

function groupFor(filePath) {
  const p = filePath.replace(/\\/g, '/');
  if (p.includes('/utils/pnml/')) return ['PNML IO', 'Parsing/writing PNML nets and normalization'];
  if (p.includes('/utils/z3/')) return ['Z3 evaluation', 'Symbolic arithmetic/boolean evaluation and builders'];
  if (p.includes('/features/simulation/')) return ['Simulation core', 'Simulators, orchestration and state helpers'];
  if (p.includes('/features/history/')) return ['History', 'Undo/redo and state differencing'];
  if (p.includes('/features/selection/')) return ['Selection', 'Selection building, drag/move, clipboard'];
  if (p.includes('/features/keymap/')) return ['Keymap', 'Keyboard shortcuts and thresholds'];
  if (p.includes('/features/net/')) return ['Net ops', 'Create/copy/paste/delete net entities'];
  if (p.includes('/features/')) return ['Features', 'Feature-layer logic'];
  if (p.includes('/components/')) return ['UI Components', 'React components and hooks behavior'];
  if (p.includes('/contexts/')) return ['Contexts', 'React context providers and consumers'];
  if (p.includes('/workers/')) return ['Workers', 'Web worker factory and fallbacks'];
  return ['Misc', 'Miscellaneous tests'];
}

function main() {
  const inputFile = path.join(__dirname, '..', 'coverage', 'test-results.json');
  const outputFile = path.join(__dirname, '..', '..', 'docs', 'unit-test-report.details.md');
  const raw = fs.readFileSync(inputFile, 'utf8');
  const data = JSON.parse(raw);

  const byFile = new Map();
  for (const tr of data.testResults) {
    const rel = (tr.name || '').replace(/\\/g, '/').split('/petri-net-app/')[1] || tr.name;
    byFile.set(rel, tr);
  }

  const lines = [];
  lines.push('## Appendix — Unit Test Details');
  lines.push('');
  lines.push('_Per-suite two-line overviews and one-sentence bullets per test._');
  lines.push('');

  const files = Array.from(byFile.keys()).sort();
  for (const rel of files) {
    const tr = byFile.get(rel);
    const [group, desc] = groupFor(rel);
    const suiteTitles = new Set();
    for (const a of tr.assertionResults || []) {
      for (const t of a.ancestorTitles || []) suiteTitles.add(t);
    }
    lines.push('### ' + rel);
    lines.push('- Group: ' + group + ' — ' + desc + '.');
    const titles = Array.from(suiteTitles);
    const scopePrefix = titles.length ? '“' + titles.join('”, “') + '” ' : '';
    lines.push('- Scope: validates ' + scopePrefix + 'paths across ' + ((tr.assertionResults && tr.assertionResults.length) || 0) + ' tests.');
    lines.push('');
    for (const a of tr.assertionResults || []) {
      const ctx = (a.ancestorTitles || []).join(' › ');
      const title = (a.title || '').replace(/\s+/g, ' ').trim();
      lines.push('- ' + (ctx ? ctx + ': ' : '') + title + '.');
    }
    lines.push('');
  }

  fs.writeFileSync(outputFile, lines.join('\n'));
  console.log('Wrote', outputFile, 'with', files.length, 'suites');
}

main();


