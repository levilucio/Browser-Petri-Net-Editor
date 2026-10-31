import {intention,cases} from '../exercises/builder.js';
export const basketSource=`constructor End(): Basket
constructor Item(Nat, Nat, Basket): Basket
operation fits(Basket, Nat, Nat): Bool
rule empty(x: Nat, y: Nat): fits(End(), x, y) = true
rule first.ok(q: Nat, rest: Basket, x: Nat, y: Nat): fits(Item(101, q, rest), x, y) = fits(rest, x - q, y) if q >= 1 and q <= 100 and q <= x
rule first.no(q: Nat, rest: Basket, x: Nat, y: Nat): fits(Item(101, q, rest), x, y) = false if q >= 1 and q <= 100 and q > x
rule second.ok(q: Nat, rest: Basket, x: Nat, y: Nat): fits(Item(102, q, rest), x, y) = fits(rest, x, y - q) if q >= 1 and q <= 100 and q <= y
rule second.no(q: Nat, rest: Basket, x: Nat, y: Nat): fits(Item(102, q, rest), x, y) = false if q >= 1 and q <= 100 and q > y`;
const tuple=(...xs)=>xs.length===2?`(${xs[0]}, ${xs[1]})`:`(${xs[0]}, ${tuple(...xs.slice(1))})`;
const call=(m,args,out='ack(true)')=>`pair ${m}(${Object.entries(args).map(([k,v])=>`${k}=${v}`).join(', ')}) => ${out}`;
const o=(m,args={},out)=>call(m,{actor:1,order:1001,...args},out);
const l=(m,args={},out)=>o(m,{line:10011,...args},out);
const stock=(h,r,p=101,w=11)=>call('readStock',{actor:4,product:p,warehouse:w},`stockRecord(${tuple(h,r)})`);
const order=(state,count,pending,reserved,shipped,returned)=>o('readOrder',{actor:4},`orderRecord(${tuple(state,count,pending,reserved,shipped,returned)})`);
const line=(q,r,s,t,state=1,p=101,w=11,id=10011)=>l('readLine',{actor:4,line:id},`lineRecord(${tuple(p,w,q,r,s,t,state)})`);
const audit=n=>o('auditCount',{actor:4},`changes(${n})`);
const draft=(q=4)=>[o('openOrder'),l('addLine',{product:101,warehouse:11,quantity:q})];
const approved=(q=4)=>[...draft(q),o('submitOrder'),o('approveOrder',{actor:2})];
const warehouse=(m,args={},out)=>l(m,{actor:3,...args},out);
export function warehouseIntentions(){
 const vars='p0: Nat, q0: Nat, p1: Nat, q1: Nat';const input='Item(p0, q0, Item(p1, q1, End())), 10, 8';
 const prefix=[o('openOrder'),l('addLine',{product:'p0',warehouse:11,quantity:'q0'}),l('addLine',{line:10012,product:'p1',warehouse:11,quantity:'q1'}),o('submitOrder'),o('approveOrder',{actor:2})];
 const protocols=[true,false].map(ok=>cases(vars,input,String(ok),[...prefix,o('reservePair',{actor:3,line:10011,line2:10012,warehouse:11,quantity:'q0',quantity2:'q1'},ok?'ack(true)':'refused'),...(ok?[line('q0','q0',0,0,1,'p0'),line('q1','q1',0,0,1,'p1',11,10012),order(3,2,'q0 + q1','q0 + q1',0,0),audit(6)]:[])],`basket_${ok}`)).join('\n');
 const out=[intention('warehouse-basket','Atomic two-line basket: aggregate availability',basketSource,vars,input,'fits','(p0 == 101 or p0 == 102) and (p1 == 101 or p1 == 102) and q0 >= 1 and q0 <= 12 and q1 >= 1 and q1 <= 12',protocols,4)];
 const histories=[];const add=(name,pairs)=>histories.push({name,pairs});
 add('draft editing and approval',[...draft(),order(1,1,4,0,0,0),l('amendLine',{quantity:6}),l('removeLine'),l('addLine',{product:101,warehouse:11,quantity:4}),o('submitOrder'),order(2,1,4,0,0,0),o('rejectOrder',{actor:2}),o('submitOrder'),o('approveOrder',{actor:2}),order(3,1,4,0,0,0),audit(9)]);
 add('partial reservation release shipment and return',[...approved(),warehouse('reserveLine',{quantity:2}),warehouse('reserveLine',{quantity:2}),stock(10,4),warehouse('releaseLine',{quantity:1}),warehouse('releaseLine',{quantity:3}),warehouse('reserveLine',{quantity:4}),warehouse('shipLine',{quantity:1}),warehouse('shipLine',{quantity:3}),stock(6,0),warehouse('returnLine',{quantity:1}),warehouse('returnLine',{quantity:3}),line(4,0,4,4),stock(10,0),o('readTotals',{actor:4},'totals((4, 4))'),order(3,1,0,0,4,4),o('closeOrder',{actor:3}),order(4,1,0,0,4,4),o('reopenOrder',{actor:2}),o('closeOrder',{actor:3}),audit(16)]);
 for(const reserved of [false,true])add(`cancel line ${reserved?'with':'without'} reservation`,[...approved(),...(reserved?[warehouse('reserveLine',{quantity:4}),warehouse('shipLine',{quantity:1})]:[]),warehouse('cancelLine'),line(4,0,reserved?1:0,0,2),stock(reserved?9:10,0),order(3,1,0,0,reserved?1:0,0),...(reserved?[warehouse('returnLine',{quantity:1}),stock(10,0)]:[]),o('closeOrder',{actor:3}),audit(reserved?9:6)]);
 for(const submitted of [false,true])add(`cancel ${submitted?'submitted':'draft'} order`,[...draft(),...submitted?[o('submitOrder')]:[],o('cancelOrder',{actor:2}),order(5,1,0,0,0,0),line(4,0,0,0),audit(submitted?4:3)]);
 add('inventory receipts counts transfers',[
 stock(10,0),call('receiveStock',{actor:3,product:101,warehouse:11,quantity:5}),stock(15,0),call('adjustStock',{actor:3,product:101,warehouse:11,quantity:12}),stock(12,0),call('adjustStock',{actor:3,product:101,warehouse:11,quantity:18}),call('transferStock',{actor:3,product:101,warehouse:11,destination:12,quantity:6}),stock(12,0),stock(26,0,101,12)]);
 add('availability toggles and retained reservation',[...approved(),warehouse('reserveLine',{quantity:4}),call('setProduct',{actor:2,product:101,enabled:false}),call('readProduct',{actor:4,product:101},'productState(false)'),call('setWarehouse',{actor:2,warehouse:11,enabled:false}),call('readWarehouse',{actor:4,warehouse:11},'warehouseState(false)'),warehouse('releaseLine',{quantity:4}),call('setProduct',{actor:2,product:101,enabled:true}),call('setWarehouse',{actor:2,warehouse:11,enabled:true}),call('readProduct',{actor:4,product:101},'productState(true)'),call('readWarehouse',{actor:4,warehouse:11},'warehouseState(true)'),stock(10,0),audit(6)]);
 add('two orders compete then release',[...approved(8),o('openOrder',{order:1002}),o('addLine',{order:1002,line:10021,product:101,warehouse:11,quantity:8}),o('submitOrder',{order:1002}),o('approveOrder',{actor:2,order:1002}),warehouse('reserveLine',{quantity:8}),warehouse('releaseLine',{quantity:6}),warehouse('reserveLine',{order:1002,line:10021,quantity:8}),stock(10,10),order(3,1,8,2,0,0),o('readOrder',{actor:4,order:1002},'orderRecord((3, (1, (8, (8, (0, 0))))))'),audit(6)]);
 add('second tenant workflow',[o('openOrder',{actor:11,order:2001}),o('addLine',{actor:11,order:2001,line:20011,product:201,warehouse:21,quantity:2}),o('submitOrder',{actor:11,order:2001}),o('approveOrder',{actor:12,order:2001}),warehouse('reserveLine',{actor:13,order:2001,line:20011,quantity:2}),warehouse('shipLine',{actor:13,order:2001,line:20011,quantity:2}),call('readStock',{actor:14,product:201,warehouse:21},'stockRecord((8, 0))'),stock(10,0)]);
 const scenarios='operation scenario(Nat): Nat\n'+histories.map((h,i)=>`rule s${i}(n: Nat): scenario(n) = ${i} if n == ${i}`).join('\n');
 out.push(intention('warehouse-lifecycle','Lifecycle, inventory and multi-order histories',scenarios,'n: Nat','n','scenario','',histories.map((h,i)=>cases('',String(i),String(i),h.pairs,`history_${i}`)).join('\n'),2));
 for(const [method,prefix,extra,allowed]of [['approveOrder',[...draft(),o('submitOrder')],{},2],['reserveLine',approved(),{line:10011,quantity:2},3],['readOrder',draft(),{},null]]){
  const ids=[1,2,3,4,11,12,13,14];const src='operation permitted(Nat): Bool\n'+ids.map(a=>`rule a${a}(a: Nat): permitted(a) = ${allowed?a===allowed:a<10} if a == ${a}`).join('\n');
  const paths=[true,false].map(ok=>cases('actor: Nat','actor',String(ok),[...prefix,o(method,{actor:'actor',...extra},ok?(method==='readOrder'?'orderRecord((1, (1, (4, (0, (0, 0))))))':'ack(true)'):'refused')],`role_${ok}`)).join('\n');
  out.push(intention(`warehouse-role-${method}`,`Roles and tenant scope: ${method}`,src,'actor: Nat','actor','permitted','',paths,2));
 }
 const negatives=[];const deny=(name,prefix,action)=>negatives.push({name,pairs:[...prefix,action]});
 deny('empty submit',[o('openOrder')],o('submitOrder',{},'refused'));
 deny('ship without reservation',approved(),warehouse('shipLine',{quantity:1},'refused'));
 deny('close pending order',approved(),o('closeOrder',{actor:3},'refused'));
 deny('return undelivered units',approved(),warehouse('returnLine',{quantity:1},'refused'));
 deny('reserve inactive product',[...approved(),call('setProduct',{actor:2,product:101,enabled:false})],warehouse('reserveLine',{quantity:1},'refused'));
 deny('ship closed warehouse',[...approved(),warehouse('reserveLine',{quantity:4}),call('setWarehouse',{actor:2,warehouse:11,enabled:false})],warehouse('shipLine',{quantity:1},'refused'));
 deny('adjust below reservation',[...approved(),warehouse('reserveLine',{quantity:4})],call('adjustStock',{actor:3,product:101,warehouse:11,quantity:3},'refused'));
 deny('transfer reserved stock',[...approved(),warehouse('reserveLine',{quantity:4})],call('transferStock',{actor:3,product:101,warehouse:11,destination:12,quantity:7},'refused'));
 deny('double return',[...approved(),warehouse('reserveLine',{quantity:4}),warehouse('shipLine',{quantity:4}),warehouse('returnLine',{quantity:4})],warehouse('returnLine',{quantity:1},'refused'));
 deny('duplicate pair line',approved(),o('reservePair',{actor:3,line:10011,line2:10011,warehouse:11,quantity:1,quantity2:1},'refused'));
 deny('cross order line',[...approved(),o('openOrder',{order:1002}),o('addLine',{order:1002,line:10021,product:101,warehouse:11,quantity:4})],warehouse('reserveLine',{line:10021,quantity:1},'refused'));
 deny('second competing order insufficient',[...approved(8),warehouse('reserveLine',{quantity:8}),o('openOrder',{order:1002}),o('addLine',{order:1002,line:10021,product:101,warehouse:11,quantity:8}),o('submitOrder',{order:1002}),o('approveOrder',{actor:2,order:1002})],warehouse('reserveLine',{order:1002,line:10021,quantity:3},'refused'));
 deny('line quantity above cap',[o('openOrder')],l('addLine',{product:101,warehouse:11,quantity:101},'refused'));
 deny('cross tenant product',[o('openOrder')],l('addLine',{product:201,warehouse:11,quantity:1},'refused'));
 const ns='operation rejected(Nat): Bool\n'+negatives.map((h,i)=>`rule n${i}(n: Nat): rejected(n) = false if n == ${i}`).join('\n');
 out.push(intention('warehouse-negative','Scoped state and atomicity refusals',ns,'n: Nat','n','rejected','',negatives.map((h,i)=>cases('',String(i),'false',h.pairs,`negative_${i}`)).join('\n'),2));
 return out;
}
