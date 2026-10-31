// Independent finite oracle: no SATEL matcher, evaluator, solver or unfolding imports.
import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function match(pattern,value,env){
 if(pattern?.var){if(Object.hasOwn(env,pattern.var))return same(env[pattern.var],value);env[pattern.var]=value;return true;}
 if(pattern?.ctor)return pattern.ctor===value?.ctor&&pattern.args.length===value.args.length&&pattern.args.every((p,i)=>match(p,value.args[i],env));
 return same(pattern,value);
}
function evaluate(t,env){
 if(t===null||typeof t!=='object')return t;
 if(t.var){if(!Object.hasOwn(env,t.var))throw Error('Unbound audit variable '+t.var);return env[t.var];}
 if(t.ctor)return {ctor:t.ctor,args:t.args.map(a=>evaluate(a,env))};
 if(t.op){const a=evaluate(t.left,env);if(t.op==='not')return !a;if(t.op==='and'&&!a)return false;if(t.op==='or'&&a)return true;
 const b=evaluate(t.right,env);switch(t.op){case 'and':return a&&b;case 'or':return a||b;case '==':return same(a,b);case '!=':return !same(a,b);case '>=':return a>=b;case '<=':return a<=b;case '>':return a>b;case '<':return a<b;case '+':return a+b;case '-':return a-b;case '*':return a*b;default:throw Error('Unsupported audit operator '+t.op);}}
 throw Error('Unsupported audit term '+JSON.stringify(t));
}
function member(domain,input){const env={};if(!match(domain.patterns[0],input,env))return null;return domain.conditions.every(c=>evaluate(c,env)===true)?env:null;}
export function expectedReviews(log){if(log?.ctor==='End'&&log.args.length===0)return 0;if(log?.ctor!=='Entry'||log.args.length!==3)return null;
 const [kind,minutes,tail]=log.args,rest=expectedReviews(tail);return rest===null||!Number.isInteger(kind)||kind<0||kind>4||!Number.isInteger(minutes)||minutes<15||minutes>720?null:rest+Number(kind!==0);}
export function auditDomains(domains,length,{boundary=true}={}){
 const kinds=boundary?[0,1,2,3,4,5]:[0,1,2,3,4],minutes=boundary?[14,15,720,721]:[15];
 const result={length,kinds,minutes,scope:'Exhaustive Cartesian product of the listed finite values at the fixed list length; no claim about all Nat values or arbitrary lengths.',inputs:0,definedInputs:0,coveredInputs:0,missingInputs:0,multiplyCoveredInputs:0,undefinedCoveredInputs:0,wrongResults:0,witnessesChecked:0,witnessFailures:0,unsupported:0,examples:[]};
 const example=(kind,input)=>{if(result.examples.length<5)result.examples.push({kind,input});};
 function inspect(input){result.inputs++;const expected=expectedReviews(input);if(expected!==null)result.definedInputs++;let count=0;
  for(const d of domains){try{const env=member(d,input);if(!env)continue;count++;if(expected!==null&&evaluate(d.resultPattern,env)!==expected){result.wrongResults++;example('wrong-result',input);}}catch(error){result.unsupported++;if(result.examples.length<5)result.examples.push({kind:'unsupported',reason:error.message});}}
  if(expected===null&&count){result.undefinedCoveredInputs++;example('undefined-covered',input);}
  if(expected!==null){if(count)result.coveredInputs++;else{result.missingInputs++;example('missing',input);}if(count>1){result.multiplyCoveredInputs++;example('overlap',input);}}
 }
 function enumerate(n,entries=[]){if(n===length){let term={ctor:'End',args:[]};for(let i=entries.length-1;i>=0;i--)term={ctor:'Entry',args:[...entries[i],term]};inspect(term);return;}for(const k of kinds)for(const m of minutes)enumerate(n+1,[...entries,[k,m]]);}
 enumerate(0);
 for(const d of domains){result.witnessesChecked++;try{const input=d.witnessArgs[0],expected=expectedReviews(input),env=member(d,input);if(expected===null||!env||d.witnessResult!==expected||evaluate(d.resultPattern,env)!==expected)result.witnessFailures++;}catch{result.witnessFailures++;}}
 result.finiteCoverageComplete=result.missingInputs===0&&result.unsupported===0;
 result.partitionAndWitnessChecksPass=!result.multiplyCoveredInputs&&!result.undefinedCoveredInputs&&!result.wrongResults&&!result.witnessFailures&&!result.unsupported;
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,output,length]=process.argv.slice(2),d=JSON.parse(readFileSync(input)).decomposition;
 const audit=auditDomains(d.domains,Number(length),{boundary:Number(length)<=3});
 writeFileSync(output,JSON.stringify(audit,null,2));console.log(JSON.stringify(audit));
}
