import { checkCancelled } from '../../domain/diagnostics.js';
import { substitute, variablesIn } from './SymbolicTerms.js';

/** Run-local ancestor-region certificates. Regions overapproximate descendants.
 * Only UNSAT proves disjointness. SAT/unknown/error attempts still use leaf SMT.
 */
export function createBranchDisjointness({ solve, deadline, signal, profile, maxProofs = 256 }) {
  if (!Number.isInteger(maxProofs) || maxProofs < 0 || maxProofs > 2048) throw new Error('Branch proof limit must be between 0 and 2048');
  const lineage = new WeakMap(), attempts = new Map();
  let splitSerial = 0;
  return {
    split(parent, children, regionOf) {
      if (children.length < 2) return;
      const split = { id: ++splitSerial, regions: children.map(regionOf), counts: children.map(() => 0) };
      children.forEach((child, choice) => { child.lineage = { parent: parent.lineage, split, choice }; });
    },
    record(domain, branch) {
      lineage.set(domain, branch.lineage);
      for (let node = branch.lineage; node; node = node.parent) node.split.counts[node.choice]++;
    },
    async disjoint(left, right) {
      checkCancelled(signal);
      if (Date.now() >= deadline) return false;
      const path = new Map();
      for (let n = lineage.get(left); n; n = n.parent) path.set(n.split, n.choice);
      for (let n = lineage.get(right); n; n = n.parent) {
        const other = path.get(n.split);
        if (other === undefined || other === n.choice) continue;
        const [i, j] = [other, n.choice].sort((a, b) => a - b), split = n.split;
        // A one-off proof just replaces one leaf query with extra work.
        if (split.counts[i] * split.counts[j] <= 1) return false;
        const key = `${split.id}:${i}:${j}`;
        if (attempts.has(key)) {
          if (profile) profile.branchProofCacheHits++;
          return attempts.get(key);
        }
        if (attempts.size >= maxProofs) return false;
        const a = split.regions[i], original = split.regions[j];
        if (!a || !original) { attempts.set(key, false); return false; }
        const occupied = variablesIn([a.patterns, a.conditions, original.patterns, original.conditions]);
        const rename = new Map();
        let serial = 0;
        for (const name of variablesIn([original.patterns, original.conditions])) {
          let fresh;
          do { fresh = `@branchProof.${++serial}`; } while (occupied.has(fresh));
          occupied.add(fresh); rename.set(name, { var: fresh });
        }
        const b = substitute(original, rename);
        const conditions = [...a.conditions, ...b.conditions, ...a.patterns.map((p, k) => ({ op: '==', left: p, right: b.patterns[k] }))];
        const types = { ...a.variables, ...Object.fromEntries([...rename].map(([name, v]) => [v.var, original.variables[name]])) };
        const variables = Object.fromEntries([...variablesIn([a.patterns, b.patterns, conditions])].map(name => [name, types[name]]));
        const start = profile ? performance.now() : 0;
        let result;
        try {
          if (profile) profile.branchProofQueries++;
          result = await solve({ terms: [a.patterns, b.patterns], conditions, variables, witness: false });
          checkCancelled(signal);
        } catch (error) {
          if (error.code === 'cancelled' || signal?.aborted) throw error;
          result = { status: 'unknown' }; // Optional proof failure never stops leaf checking.
        } finally {
          if (profile) profile.branchProofMs += performance.now() - start;
        }
        if (profile) profile.branchProofStatuses[result.status] = (profile.branchProofStatuses[result.status] || 0) + 1;
        const proved = result.status === 'unsat';
        attempts.set(key, proved);
        return proved;
      }
      return false;
    }
  };
}
