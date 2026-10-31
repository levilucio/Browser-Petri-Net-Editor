// Finite independent membership interpreter. No SATEL/Z3/matcher imports.
import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {root} from './runtime.mjs';
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function match(p,v,e){if(p?.var){if(Object.hasOwn(e,p.var))return eq(e[p.var],v);e[p.var]=v;return true}if(p?.ctor)return p.ctor===v?.ctor&&p.args.length===v.args.length&&p.args.every((a,i)=>match(a,v.args[i],e));return eq(p,v)}
class Unknown extends Error{}
function val(t,e){if(t===null||typeof t!=='object')return t;if(t.var){if(!Object.hasOwn(e,t.var))throw new Unknown(t.var);return e[t.var]}if(t.ctor)return {ctor:t.ctor,args:t.args.map(a=>val(a,e))};if(t.op){const a=val(t.left,e);if(t.op==='not')return !a;if(t.op==='and'&&!a)return false;if(t.op==='or'&&a)return true;const b=val(t.right,e);switch(t.op){case 'and':return a&&b;case 'or':return a||b;case '==':return eq(a,b);case '!=':return !eq(a,b);case '<':return a<b;case '<=':return a<=b;case '>':return a>b;case '>=':return a>=b;case '+':return a+b;case '-':return a-b;default:throw Error('Unsupported operator '+t.op)}}throw Error('Unsupported term')}
function member(d,input){const e={};if(!d.patterns.every((p,i)=>match(p,input[i],e)))return null;
 // Resolve fresh arithmetic variables only when an equality gives their exact value.
 let changed=true;while(changed){changed=false;for(const c of d.conditions)if(c.op==='==')for(const [lhs,rhs]of [[c.left,c.right],[c.right,c.left]])if(lhs?.var&&!Object.hasOwn(e,lhs.var)){try{e[lhs.var]=val(rhs,e);changed=true}catch(error){if(!(error instanceof Unknown))throw error}}}
 for(const [name,sort]of Object.entries(d.variables))if(Object.hasOwn(e,name)&&sort==='Nat'&&(!Number.isInteger(e[name])||e[name]<0))return null;
 return d.conditions.every(c=>val(c,e)===true)?e:null;
}
const d=JSON.parse(readFileSync(resolve(root,'results/exercise-warehouse-basket-domains.json')));
const result={scope:'Products 100..103, quantities 0..13, exactly two entries, capacities 10 and 8; intention domain restricts products to 101/102 and quantities to 1..12.',inputs:0,defined:0,accepted:0,rejected:0,missing:0,overlap:0,undefinedCovered:0,wrongResults:0,unsupported:0,witnesses:0,witnessFailures:0,coverageStatus:d.coverage};
for(let p=100;p<=103;p++)for(let q=0;q<=13;q++)for(let p2=100;p2<=103;p2++)for(let q2=0;q2<=13;q2++){
 const input=[{ctor:'Item',args:[p,q,{ctor:'Item',args:[p2,q2,{ctor:'End',args:[]}]}]},10,8];result.inputs++;
 const defined=[101,102].includes(p)&&[101,102].includes(p2)&&q>=1&&q<=12&&q2>=1&&q2<=12;
 const expected=(p===101?q:0)+(p2===101?q2:0)<=10&&(p===102?q:0)+(p2===102?q2:0)<=8;
 if(defined){result.defined++;result[expected?'accepted':'rejected']++}let count=0;
 for(const domain of d.domains){try{const e=member(domain,input);if(e){count++;if(defined&&val(domain.resultPattern,e)!==expected)result.wrongResults++}}catch(error){result.unsupported++;}}
 if(!defined&&count)result.undefinedCovered++;if(defined&&!count)result.missing++;if(defined&&count>1)result.overlap++;
}
for(const domain of d.domains){result.witnesses++;try{const e=member(domain,domain.witnessArgs);if(!e||val(domain.resultPattern,e)!==domain.witnessResult)result.witnessFailures++}catch{result.witnessFailures++}}
writeFileSync(resolve(root,'results/finite-audit.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(['missing','overlap','undefinedCovered','wrongResults','unsupported','witnessFailures'].some(k=>result[k]))process.exitCode=1;
