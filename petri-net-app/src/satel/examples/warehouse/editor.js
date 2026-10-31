import {builder,pairValue} from '../exercises/builder.js';
import {convertOutputPlacesToGates} from '../../../domain/apn/GateMigration.js';
import {warehouseIntentions} from './intentions.js';
export const tuple=(...xs)=>xs.length===2?pairValue(...xs):pairValue(xs[0],tuple(...xs.slice(1)));
const expr=(...xs)=>xs.length===2?`(${xs[0]}, ${xs[1]})`:`(${xs[0]}, ${expr(...xs.slice(1))})`;
const fields=(v,n)=>Array.from({length:n},(_,i)=>{let t=v;for(let j=0;j<Math.min(i,n-2);j++)t=`asPair(snd(${t}))`;return `asInt(${i===n-1?'snd':'fst'}(${t}))`});
export const lineId=(order,slot)=>order*10+slot;
export function createWarehouseExample({orderIds=[1001,1002,2001],slots=3}={}){
 if(!Number.isInteger(slots)||slots<2||slots>8||new Set(orderIds).size!==orderIds.length||orderIds.some(id=>!Number.isSafeInteger(id)||id<1000||id>=3000))throw Error('Use unique order IDs 1000..2999 and 2..8 slots');
 const b=builder();
 b.place('principals','Pair',[1,2].flatMap(t=>[1,2,3,4].map(r=>tuple((t-1)*10+r,t,r))));
 b.place('products','Pair',[[101,1,1],[102,1,1],[103,1,1],[201,2,1]].map(x=>tuple(...x)));
 b.place('warehouses','Pair',[[11,1,1],[12,1,1],[21,2,1]].map(x=>tuple(...x)));
 b.place('stocks','Pair',[[101,11,10,0],[102,11,8,0],[103,11,12,0],[101,12,20,0],[102,12,20,0],[103,12,20,0],[201,21,10,0]].map(x=>tuple(...x)));
 b.place('orders','Pair',orderIds.map(id=>tuple(id,0,0,0,0,0,0,0,0,0)));
 b.place('lines','Pair',orderIds.flatMap(id=>Array.from({length:slots},(_,i)=>tuple(lineId(id,i+1),0,0,0,0,0,0,0,0))));
 for(const [name,sort]of [['ack','Bool'],['orderRecord','Pair'],['lineRecord','Pair'],['stockRecord','Pair'],['productState','Bool'],['warehouseState','Bool'],['changes','Nat'],['totals','Pair']])b.place(name,sort,[],true);
 const [aid,tenant,role]=fields('a',3),[oid,ot,owner,state,count,pending,reserved,shipped,returned,audit]=fields('o',10);
 const [lid,lo,lp,lw,lq,lr,ls,lt,lstate]=fields('l',9),[mid,mo,mp,mw,mq,mr,ms,mt,mstate]=fields('m',9);
 const [pid,pt,active]=fields('p',3),[wid,wt,opened]=fields('w',3),[sp,sw,hand,sr]=fields('s',4);
 const [zp,zw,zh,zr]=fields('z',4),[pid2,pt2,active2]=fields('p2',3);
 const [wid2,wt2,open2]=fields('w2',3);
 const params=(...names)=>Object.fromEntries(['actor',...names].map(x=>[x,x==='enabled'?'Bool':'Nat']));
 const order=(x={})=>expr(oid,x.tenant??ot,x.owner??owner,x.state??state,x.count??count,x.pending??pending,x.reserved??reserved,x.shipped??shipped,x.returned??returned,x.audit??`${audit} + 1`);
 const line=(x={})=>expr(lid,x.order??lo,x.product??lp,x.warehouse??lw,x.quantity??lq,x.reserved??lr,x.shipped??ls,x.returned??lt,x.state??lstate);
 const other=(r)=>expr(mid,mo,mp,mw,mq,r,ms,mt,mstate);
 const stock=(h=hand,r=sr)=>expr(sp,sw,h,r);
 const raw=(id,method,names,guard,ins,outs)=>b.rule(id,method,params(...names),`actor == ${aid} and (${guard})`,[['principals','a'],...ins],[['principals','a'],...outs]);
 const rule=(id,method,names,guard,ins,outs,update={})=>raw(id,method,['order',...names],`order == ${oid} and ${tenant} == ${ot} and (${guard})`,[['orders','o'],...ins],[['orders',order(update)],...outs,['ack','true']]);
 const bind=`line == ${lid} and order == ${lo}`;
 const own=`${role} == 1 and actor == ${owner}`,manager=`${role} == 2`,operator=`${role} == 3`;
 const catalog=`product == ${pid} and ${pt} == ${tenant} and ${active} == 1 and warehouse == ${wid} and ${wt} == ${tenant} and ${opened} == 1`;
 const stockBind=`${sp} == ${lp} and ${sw} == ${lw}`;
 const live=`${pid} == ${lp} and ${active} == 1 and ${wid} == ${lw} and ${opened} == 1`;
 const closed=`${wid} == ${lw} and ${opened} == 1`;
 const qty='quantity >= 1',bounded=`${qty} and quantity <= 100`;
 raw('open','openOrder',['order'],`order == ${oid} and ${role} == 1 and ${state} == 0`,[['orders','o']],[['orders',order({tenant,owner:'actor',state:1})],['ack','true']]);
 rule('add','addLine',['line','product','warehouse','quantity'],`${own} and ${state} == 1 and line == ${lid} and ${lstate} == 0 and ${catalog} and ${bounded}`,[['lines','l'],['products','p'],['warehouses','w']],[['lines',line({order:'order',product:'product',warehouse:'warehouse',quantity:'quantity',state:1})],['products','p'],['warehouses','w']],{count:`${count} + 1`,pending:`${pending} + quantity`});
 rule('amend','amendLine',['line','quantity'],`${own} and ${state} == 1 and ${bind} and ${lstate} == 1 and ${bounded} and ${live}`,[['lines','l'],['products','p'],['warehouses','w']],[['lines',line({quantity:'quantity'})],['products','p'],['warehouses','w']],{pending:`${pending} - ${lq} + quantity`});
 rule('remove','removeLine',['line'],`${own} and ${state} == 1 and ${bind} and ${lstate} == 1`,[['lines','l']],[['lines',line({order:0,product:0,warehouse:0,quantity:0,state:0})]],{count:`${count} - 1`,pending:`${pending} - ${lq}`});
 rule('submit','submitOrder',[],`${own} and ${state} == 1 and ${count} > 0`,[],[],{state:2});
 rule('approve','approveOrder',[],`${manager} and ${state} == 2`,[],[],{state:3});
 rule('reject','rejectOrder',[],`${manager} and ${state} == 2`,[],[],{state:1});
 for(const st of [1,2])rule(`cancel_order_${st}`,'cancelOrder',[],`(${own} or ${manager}) and ${state} == ${st}`,[],[],{state:5,pending:0});
 for(const full of [false,true]){
  rule(`reserve_${full}`,'reserveLine',['line','quantity'],`${operator} and ${state} == 3 and ${bind} and ${lstate} == 1 and ${stockBind} and ${live} and ${qty} and quantity ${full?'==':'<'} ${lq} - ${ls} - ${lr} and ${hand} - ${sr} >= quantity`,[['lines','l'],['stocks','s'],['products','p'],['warehouses','w']],[['lines',line({reserved:`${lr} + quantity`})],['stocks',stock(hand,`${sr} + quantity`)],['products','p'],['warehouses','w']],{reserved:`${reserved} + quantity`});
  rule(`release_${full}`,'releaseLine',['line','quantity'],`${operator} and ${state} == 3 and ${bind} and ${lstate} == 1 and ${stockBind} and ${qty} and quantity ${full?'==':'<'} ${lr}`,[['lines','l'],['stocks','s']],[['lines',line({reserved:`${lr} - quantity`})],['stocks',stock(hand,`${sr} - quantity`)]],{reserved:`${reserved} - quantity`});
  rule(`ship_${full}`,'shipLine',['line','quantity'],`${operator} and ${state} == 3 and ${bind} and ${lstate} == 1 and ${stockBind} and ${closed} and ${qty} and quantity <= ${lr} and quantity ${full?'==':'<'} ${lq} - ${ls}`,[['lines','l'],['stocks','s'],['warehouses','w']],[['lines',line({reserved:`${lr} - quantity`,shipped:`${ls} + quantity`})],['stocks',stock(`${hand} - quantity`,`${sr} - quantity`)],['warehouses','w']],{reserved:`${reserved} - quantity`,pending:`${pending} - quantity`,shipped:`${shipped} + quantity`});
  rule(`return_${full}`,'returnLine',['line','quantity'],`${operator} and ${state} == 3 and ${bind} and ${lstate} >= 1 and ${stockBind} and ${closed} and ${qty} and quantity ${full?'==':'<'} ${ls} - ${lt}`,[['lines','l'],['stocks','s'],['warehouses','w']],[['lines',line({returned:`${lt} + quantity`})],['stocks',stock(`${hand} + quantity`)],['warehouses','w']],{returned:`${returned} + quantity`});
  rule(`cancel_line_${full}`,'cancelLine',['line'],`${operator} and ${state} == 3 and ${bind} and ${lstate} == 1 and ${stockBind} and ${lq} > ${ls} and ${lr} ${full?'>':'=='} 0`,[['lines','l'],['stocks','s']],[['lines',line({reserved:0,state:2})],['stocks',stock(hand,`${sr} - ${lr}`)]],{pending:`${pending} - (${lq} - ${ls})`,reserved:`${reserved} - ${lr}`});
 }
 for(const same of [true,false]){
  const g=`${operator} and ${state} == 3 and ${bind} and line2 == ${mid} and order == ${mo} and line != line2 and ${lstate} == 1 and ${mstate} == 1 and warehouse == ${lw} and warehouse == ${mw} and ${stockBind} and ${live} and ${lp} ${same?'==':'!='} ${mp} and quantity >= 1 and quantity2 >= 1 and quantity <= ${lq} - ${ls} - ${lr} and quantity2 <= ${mq} - ${ms} - ${mr}`;
  rule(`reserve_pair_${same?'shared':'distinct'}`,'reservePair',['line','line2','warehouse','quantity','quantity2'],g+(same?` and ${hand} - ${sr} >= quantity + quantity2`:` and ${zp} == ${mp} and ${zw} == warehouse and ${pid2} == ${mp} and ${active2} == 1 and ${hand} - ${sr} >= quantity and ${zh} - ${zr} >= quantity2`),[['lines','l'],['lines','m'],['stocks','s'],['products','p'],['warehouses','w'],...same?[]:[['stocks','z'],['products','p2']]],[['lines',line({reserved:`${lr} + quantity`})],['lines',other(`${mr} + quantity2`)],['stocks',stock(hand,`${sr} + quantity${same?' + quantity2':''}`)],['products','p'],['warehouses','w'],...same?[]:[['stocks',expr(zp,zw,zh,`${zr} + quantity2`)],['products','p2']]],{reserved:`${reserved} + quantity + quantity2`});
 }
 rule('close','closeOrder',[],`${operator} and ${state} == 3 and ${pending} == 0 and ${reserved} == 0`,[],[],{state:4});
 rule('reopen','reopenOrder',[],`${manager} and ${state} == 4`,[],[],{state:3});
 for(const enabled of [true,false]){
  raw(`warehouse_${enabled}`,'setWarehouse',['warehouse','enabled'],`${manager} and warehouse == ${wid} and ${wt} == ${tenant} and enabled == ${enabled} and ${opened} == ${enabled?0:1}`,[['warehouses','w']],[['warehouses',expr(wid,wt,enabled?1:0)],['ack','true']]);
  raw(`product_${enabled}`,'setProduct',['product','enabled'],`${manager} and product == ${pid} and ${pt} == ${tenant} and enabled == ${enabled} and ${active} == ${enabled?0:1}`,[['products','p']],[['products',expr(pid,pt,enabled?1:0)],['ack','true']]);
 }
 const stockContext=`product == ${sp} and warehouse == ${sw} and product == ${pid} and ${pt} == ${tenant} and warehouse == ${wid} and ${wt} == ${tenant}`;
 const si=[['stocks','s'],['products','p'],['warehouses','w']];
 const so=(h)=>[['stocks',stock(h)],['products','p'],['warehouses','w'],['ack','true']];
 raw('receive','receiveStock',['product','warehouse','quantity'],`${operator} and ${stockContext} and ${opened} == 1 and ${qty}`,si,so(`${hand} + quantity`));
 raw('adjust','adjustStock',['product','warehouse','quantity'],`${operator} and ${stockContext} and ${opened} == 1 and quantity >= ${sr}`,si,so('quantity'));
 raw('transfer','transferStock',['product','warehouse','destination','quantity'],`${operator} and ${stockContext} and ${opened} == 1 and destination != warehouse and destination == ${wid2} and ${wt2} == ${tenant} and ${open2} == 1 and ${zp} == product and ${zw} == destination and ${qty} and ${hand} - ${sr} >= quantity`,[...si,['stocks','z'],['warehouses','w2']],[['stocks',stock(`${hand} - quantity`)],['stocks',expr(zp,zw,`${zh} + quantity`,zr)],['products','p'],['warehouses','w'],['warehouses','w2'],['ack','true']]);
 for(const st of [1,2,3,4,5])raw(`read_order_${st}`,'readOrder',['order'],`order == ${oid} and ${tenant} == ${ot} and ${state} == ${st}`,[['orders','o']],[['orders','o'],['orderRecord',expr(state,count,pending,reserved,shipped,returned)]]);
 for(const st of [1,2])raw(`read_line_${st}`,'readLine',['order','line'],`order == ${oid} and ${tenant} == ${ot} and ${state} >= 1 and ${bind} and ${lstate} == ${st}`,[['orders','o'],['lines','l']],[['orders','o'],['lines','l'],['lineRecord',expr(lp,lw,lq,lr,ls,lt,lstate)]]);
 raw('read_stock','readStock',['product','warehouse'],stockContext,si,[...si,['stockRecord',expr(hand,sr)]]);
 raw('read_product','readProduct',['product'],`product == ${pid} and ${pt} == ${tenant}`,[['products','p']],[['products','p'],['productState',`${active} == 1`]]);
 raw('read_warehouse','readWarehouse',['warehouse'],`warehouse == ${wid} and ${wt} == ${tenant}`,[['warehouses','w']],[['warehouses','w'],['warehouseState',`${opened} == 1`]]);
 for(const [method,gate,value]of [['auditCount','changes',audit],['readTotals','totals',expr(shipped,returned)]])raw(`read_${method}`,method,['order'],`order == ${oid} and ${tenant} == ${ot} and ${state} >= 1`,[['orders','o']],[['orders','o'],[gate,value]]);
 b.net.testIntentions=warehouseIntentions();
 b.net.satelExample={id:'warehouse-reference',name:'Warehouse orders — Reference',role:'reference',description:'42 generic transitions; atomic baskets, competing orders, inventory and partial fulfilment.'};
 const net=convertOutputPlacesToGates(b.net);net.apnClass='WarehouseOrders';
 net.places.forEach((p,i)=>{p.x=180+i*330;p.y=180});net.transitions.forEach((t,i)=>{t.x=200+i%7*300;t.y=500+Math.floor(i/7)*250});return net;
}
export const warehouseExamples=[{filename:'warehouse-reference',displayName:'Warehouse orders — Reference',description:'Order lifecycle and stock conservation across products and warehouses; REST/SQLite/browser SUT.'}];
