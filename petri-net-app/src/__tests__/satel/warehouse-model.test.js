/** @jest-environment node */
import {createWarehouseExample} from '../../satel/examples/warehouse/editor.js';
import {compilePublicNet,enumerateMethodSuccessors,markingKey} from '../../domain/apn/PublicMethods.js';
import {serializeMethodGateSource,parseMethodGateSource} from '../../domain/apn/MethodGateSyntax.js';
const execute=(net,method,args)=>{const r=enumerateMethodSuccessors(net,method,args,{maxBindings:50000});expect(r.complete).toBe(true);expect(r.successors).toHaveLength(1);return r.successors[0].next};
test('42-rule warehouse source round-trips signatures, guards, marking and gates',()=>{
 const n=createWarehouseExample(),parsed=parseMethodGateSource(serializeMethodGateSource(n),n);expect(n.transitions).toHaveLength(42);expect(n.places).toHaveLength(6);expect(n.gates).toHaveLength(8);
 const semantic=x=>Object.fromEntries(Object.entries(compilePublicNet(x).plans).map(([m,rules])=>[m,rules.map(r=>({id:r.id,guard:r.guard,ins:r.ins.map(({place,variable})=>({place,variable})),outs:r.outs,gates:r.gates.map(({gate,ast,args})=>({gate,ast,args}))}))]));
 expect(semantic(parsed)).toEqual(semantic(n));expect(markingKey(parsed)).toEqual(markingKey(n));
});
test('growing order slots changes token populations without specializing transitions',()=>{const a=createWarehouseExample(),b=createWarehouseExample({orderIds:[1001,1002,1003,1004,2001,2002],slots:8});expect(a.transitions).toEqual(b.transitions);expect(a.arcs).toEqual(b.arcs);expect(b.places.find(p=>p.id==='lines').tokens).toBe(48)});
test('shared-stock atomic reservation aggregates both lines and retains marking on refusal',()=>{
 let n=createWarehouseExample();const call=(m,args)=>n=execute(n,m,args);
 call('openOrder',{actor:1,order:1001});for(const line of [10011,10012])call('addLine',{actor:1,order:1001,line,product:101,warehouse:11,quantity:6});call('submitOrder',{actor:1,order:1001});call('approveOrder',{actor:2,order:1001});
 const before=markingKey(n),bad=enumerateMethodSuccessors(n,'reservePair',{actor:3,order:1001,line:10011,line2:10012,warehouse:11,quantity:6,quantity2:6},{maxBindings:50000});expect(bad.complete).toBe(true);expect(bad.successors).toHaveLength(0);expect(markingKey(n)).toBe(before);
 call('reservePair',{actor:3,order:1001,line:10011,line2:10012,warehouse:11,quantity:6,quantity2:4});const r=enumerateMethodSuccessors(n,'readStock',{actor:4,product:101,warehouse:11});expect(r.successors[0].produced.stockRecord).toEqual([{__pair__:true,fst:10,snd:10}]);
});
test('unused identifiers acquire ownership only at creation and a removed line ID can be reused',()=>{
 let n=createWarehouseExample();const call=(method,args)=>n=execute(n,method,args);
 call('openOrder',{actor:11,order:1001});call('addLine',{actor:11,order:1001,line:10021,product:201,warehouse:21,quantity:2});
 const denied=enumerateMethodSuccessors(n,'readOrder',{actor:1,order:1001});expect(denied.complete).toBe(true);expect(denied.successors).toHaveLength(0);
 call('removeLine',{actor:11,order:1001,line:10021});call('openOrder',{actor:1,order:1002});call('addLine',{actor:1,order:1002,line:10021,product:101,warehouse:11,quantity:3});
 const r=enumerateMethodSuccessors(n,'readLine',{actor:4,order:1002,line:10021});expect(r.complete).toBe(true);expect(r.successors).toHaveLength(1);
});
