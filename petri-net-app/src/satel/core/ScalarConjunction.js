// Exact CHECK-ONLY decision procedure for independent scalar equalities and
// integer bounds. Int is unbounded; Nat adds n >= 0. No witness is synthesized.
// Every conjunct must be supported before either SAT or UNSAT can be returned.
const variable=t=>t&&typeof t==='object'&&!Array.isArray(t)&&Object.keys(t).length===1&&typeof t.var==='string'&&t.var.length>0?t.var:null;
const reverse={'<':'>','<=':'>=','>':'<','>=':'<=','==':'=='};
export function checkScalarConjunction({conditions,variables,witness}) {
  if(witness!==false||!Array.isArray(conditions)||!variables)return null;
  const states=new Map();let contradiction=false;
  const visit=t=>{
    if(typeof t==='boolean'){if(!t)contradiction=true;return true;}
    if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).length!==3||!Object.hasOwn(t,'left')||!Object.hasOwn(t,'right'))return false;
    if(t.op==='and')return visit(t.left)&&visit(t.right);
    if(!Object.hasOwn(reverse,t.op))return false;
    let name=variable(t.left),value=t.right,op=t.op;
    if(name===null){name=variable(t.right);value=t.left;op=reverse[op];}
    if(name===null||!Object.hasOwn(variables,name))return false;
    const sort=variables[name],numeric=sort==='Int'||sort==='Nat';
    if(numeric?!Number.isSafeInteger(value):!(['Bool','String'].includes(sort)&&op==='=='&&typeof value===(sort==='Bool'?'boolean':'string')))return false;
    if(!states.has(name))states.set(name,{low:sort==='Nat'?0n:null,high:null,assigned:false});
    const state=states.get(name);
    if(!numeric){if(state.assigned&&state.value!==value)contradiction=true;state.assigned=true;state.value=value;return true;}
    const n=BigInt(value),low=op==='=='||op==='>='?n:op==='>'?n+1n:null,high=op==='=='||op==='<='?n:op==='<'?n-1n:null;
    if(low!==null&&(state.low===null||low>state.low))state.low=low;
    if(high!==null&&(state.high===null||high<state.high))state.high=high;
    if(state.low!==null&&state.high!==null&&state.low>state.high)contradiction=true;
    return true;
  };
  for(const t of conditions)if(!visit(t))return null;
  return {status:contradiction?'unsat':'sat'};
}
