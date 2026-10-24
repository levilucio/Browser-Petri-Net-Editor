/** Independent procedural implementations of three existing example contracts.
 * No APN simulator, oracle, generated test, or reference marking is imported.
 * Their small private states are deliberately inaccessible through the adapter.
 * These are transparent research fixtures, not a blind independent validation. */
function randomSource(seed) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6D2B79F5) >>> 0; let x = Math.imul(state ^ state >>> 15, state | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}
const contract = (methods, place, sort) => ({ methods: methods.map(([name, parameters = []]) => ({ name, parameters })), outputs: [place], outputSorts: { [place]: sort } });
const contracts = {
  bag: contract([['take']], 'picked', 'Int'),
  branch: contract([['open'], ['left'], ['right']], 'reply', 'Int'),
  jobs: contract([['open', [{ name: 'n', sort: 'Nat' }]], ['finish']], 'reply', 'Nat')
};
export const demoSystems = [
  ['bag', 'Bag service', 'bag', 'Randomly removes one occurrence from [1, 1, 2].'],
  ['bag-missing-duplicate', 'Bag fault: missing duplicate', 'bag', 'Starts with [1, 2] instead of [1, 1, 2].'],
  ['bag-wrong-output', 'Bag fault: wrong output', 'bag', 'Reports 99 after removing a token.'],
  ['branch', 'Choice service', 'branch', 'Opening retains both choices or only the left choice.'],
  ['branch-early-choice', 'Choice fault: early commitment', 'branch', 'Same accepted traces, but loses the shared branching state. Explicit refusals can expose this fault.'],
  ['jobs', 'Two-worker job service', 'jobs', 'Worker B can complete only amounts of at least 3.'],
  ['jobs-missing-finish', 'Job fault: failed worker', 'jobs', 'Worker B always refuses completion.'],
  ['jobs-wrong-receipt', 'Job fault: wrong receipt', 'jobs', 'Completion reports 99 rather than 0.'],
].map(([id, name, family, description]) => ({ id, name, family, description, interface: contracts[family] }));

export function createDemoSystem(id) {
  const entry = demoSystems.find(s => s.id === id);
  if (!entry) throw new Error('Unknown demo SUT');
  let random, bag, state, amount;
  const reply = (accepted, values = []) => ({ status: accepted ? 'accepted' : 'refused', outputs: { [entry.interface.outputs[0]]: values } });
  return {
    interface: JSON.parse(JSON.stringify(entry.interface)),
    async reset({ seed }) { random = randomSource(seed); bag = id === 'bag-missing-duplicate' ? [1, 2] : [1, 1, 2]; state = 'idle'; amount = 0; },
    async invoke({ method, arguments: args }) {
      if (!random) throw new Error('Reset the SUT before calling it');
      if (entry.family === 'bag') {
        if (method !== 'take') throw new Error('Unknown bag method');
        if (!bag.length) return reply(false);
        const value = bag.splice(Math.floor(random() * bag.length), 1)[0];
        return reply(true, [id === 'bag-wrong-output' ? 99 : value]);
      }
      if (entry.family === 'branch') {
        if (method === 'open' && state === 'idle') {
          state = random() < 0.5 ? (id === 'branch-early-choice' ? 'right' : 'both') : 'left';
          return reply(true, [0]);
        }
        if (['left', 'right'].includes(method) && (state === 'both' || state === method)) { state = 'done'; return reply(true, [method === 'left' ? 1 : 2]); }
        return reply(false);
      }
      if (method === 'open' && state === 'idle') { state = random() < 0.5 ? 'workerA' : 'workerB'; amount = args.n; return reply(true, [amount]); }
      if (method === 'finish' && (state === 'workerA' || state === 'workerB' && amount >= 3 && id !== 'jobs-missing-finish')) {
        state = 'done'; return reply(true, [id === 'jobs-wrong-receipt' ? 99 : 0]);
      }
      return reply(false);
    }
  };
}
