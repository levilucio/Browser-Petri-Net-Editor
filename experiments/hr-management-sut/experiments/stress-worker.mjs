import {editorImport} from './runtime.mjs';
const config=JSON.parse(process.argv[2]);
const {hrWorkLogSource}=await editorImport('src/satel/examples/hr/editor.js');
const {compileSymbolicIntention}=await editorImport('src/satel/core/SymbolicSource.js');
const {deriveGenericSubdomains}=await editorImport('src/satel/core/GenericSubuniformity.js');
const {getContext}=await editorImport('src/utils/z3/context.js');
let args='log', variables='log: WorkLog';
if(config.length!==undefined){args='End()';const vars=[];for(let i=config.length-1;i>=0;i--){args=`Entry(k${i}, m${i}, ${args})`;vars.unshift(`k${i}: Nat, m${i}: Nat`)}variables=vars.join(', ')}
const {goal}=compileSymbolicIntention({id:'hr-stress',name:'HR recursive log',symbolic:{source:hrWorkLogSource,variablesText:variables,argsText:args,operation:'reviews',maxDepth:config.depth}});
const init=performance.now();await getContext();const initMs=performance.now()-init;
const check=t=>{if(t.ctor==='End')return 0;if(t.ctor!=='Entry')throw Error('Unexpected witness');const[k,m,rest]=t.args;if(!Number.isInteger(k)||k<0||k>4||!Number.isInteger(m)||m<15||m>720)throw Error('Invalid witness values');return Number(k!==0)+check(rest)};
const rows=[];
for(let repeat=0;repeat<2;repeat++){
 const start=performance.now(),d=await deriveGenericSubdomains(goal,{profileUnfolding:true,maxBranches:2048,maxTimeMs:5000});
 const failures=d.domains.filter(x=>check(x.witnessArgs[0])!==x.witnessResult);
 const row={repeat,elapsedMs:performance.now()-start,classes:d.domains.length,unresolved:d.unresolved.length,overlaps:d.overlaps.length,unknownOverlaps:d.overlaps.filter(x=>x.status==='unknown').length,status:d.unresolved.length||d.overlaps.length?'partial':'frontier-resolved',witnessesChecked:d.domains.length,witnessFailures:failures.length,unresolvedReasons:d.unresolved.reduce((a,x)=>(a[x.reason]=(a[x.reason]||0)+1,a),{}),profile:d.unfoldingProfile,rss:process.memoryUsage().rss};rows.push(row);console.log(JSON.stringify({type:'sample',row}));
}
console.log(JSON.stringify({type:'done',initMs}));process.exit();
