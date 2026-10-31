import {editorImport} from './runtime.mjs';
const {hrWorkLogSource,createHrExample,timeId}=await editorImport('src/satel/examples/hr/editor.js');
export function depthFixture(length){
 if(!Number.isInteger(length)||length<1||length>5)throw Error('Length must be 1–5');
 let log='End()';const declarations=[];
 for(let i=length-1;i>=0;i--){log=`Entry(k${i}, m${i}, ${log})`;declarations.unshift(`k${i}: Nat, m${i}: Nat`);}
 const vars=declarations.join(', '),lines=[];
 for(let i=0;i<length;i++)lines.push(`pair logTime(actor=1001, employee=1001, record=${timeId(1001,i)}, kind=k${i}, minutes=m${i}) => ack(true)`);
 lines.push(`pair auditCount(actor=11, employee=1001) => changes(${length})`);
 const intention={id:`hr-depth-${length}`,name:`WorkLog length ${length}`,kind:'symbolic',symbolic:{source:hrWorkLogSource,variablesText:vars,argsText:log,operation:'reviews',maxDepth:length+1,protocolSource:`case log(${vars}, r: Nat):\ninputs ${log}\nresult r\n${lines.join('\n')}`}};
 // Identical roster, marking and transition logic in every measured length.
 return {net:createHrExample({slots:5}),intention};
}
