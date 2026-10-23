#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { cacheModes } from './hml-cache-comparison.js';

const cases = [
  { id: 'inventory-small', family: 'inventory', cycles: 1, mutations: true },
  { id: 'inventory-repeated', family: 'inventory', cycles: 2, permitKinds: 2, copies: 4, rounds: 2 },
  { id: 'inventory-history', family: 'inventory', cycles: 2, permitKinds: 2, copies: 4, rounds: 2, audit: true },
  { id: 'inventory-20', family: 'inventory', sites: 4, cycles: 4, rounds: 2, audit: true, mutations: true },
  { id: 'workers-audit', family: 'workers', workers: 4, rounds: 4, audit: true, mutations: true },
  { id: 'workers-merged', family: 'workers', workers: 8, rounds: 8, audit: false, mutations: true },
];
// Counterbalanced across cases; runs within each process preserve cold/warm
// distinctions. Timed trials have instrumentation disabled in every mode.
const matrix = cases.flatMap((config, i) => {
  const modes = i % 2 ? [...cacheModes].reverse() : cacheModes;
  return modes.map(mode => ({ ...config, cacheMode: mode.name, limits: { hmlCaches: mode.hmlCaches } }));
});
const profiling = cases.map(config => ({ ...config, cacheMode: 'all-profiled', profileQueries: true,
  limits: { profileHmlCaches: true } }));
for (const [file, data] of [['increment-27-cases.json', matrix], ['increment-27-profile-cases.json', profiling]]) {
  writeFileSync(new URL(file, import.meta.url), JSON.stringify(data, null, 2) + '\n');
}
console.log(`Wrote ${matrix.length} timing cases and ${profiling.length} separate profiling cases`);
