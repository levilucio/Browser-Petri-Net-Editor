// Sufficient disjointness certificate, not a satisfiability or coverage checker.
// Equal inputs have equal values at the same free-constructor field path. Two
// different required scalar values at that path therefore cannot both hold.
const scalar = x => ['number','boolean','string'].includes(typeof x) &&
  (typeof x !== 'number' || Number.isSafeInteger(x));
const key = x => `${typeof x}:${JSON.stringify(x)}`;
export function literalRegionFields(region, algebra) {
  const required = new Map(), fields = new Map();
  const conjunct = t => {
    if (t?.op === 'and') { conjunct(t.left); conjunct(t.right); return; }
    if (t?.op !== '==') return;
    for (const [variable,value] of [[t.left,t.right],[t.right,t.left]])
      if (variable?.var && Object.keys(variable).length === 1 && scalar(value)) required.set(variable.var,key(value));
  };
  (region.conditions || []).forEach(conjunct);
  const walk = (term,path) => {
    if (scalar(term)) { fields.set(JSON.stringify(path),key(term)); return; }
    if (term?.var && Object.keys(term).length === 1) {
      if (required.has(term.var)) fields.set(JSON.stringify(path),required.get(term.var));
      return;
    }
    if (!term || typeof term !== 'object' || Array.isArray(term) ||
      Object.keys(term).some(k=>k!=='ctor'&&k!=='args') || !Array.isArray(term.args)) return;
    const definition=typeof term.ctor==='string' && Object.hasOwn(algebra.constructors || {},term.ctor) ? algebra.constructors[term.ctor] : null;
    if (!definition || definition.parameters.length!==term.args.length) return;
    term.args.forEach((arg,i)=>walk(arg,[...path,term.ctor,i]));
  };
  (region.patterns || []).forEach((p,i)=>walk(p,[i]));
  return fields;
}
export function literalFieldsDisjoint(left,right) {
  for (const [path,value] of left) if(right.has(path)&&right.get(path)!==value)return true;
  return false;
}
