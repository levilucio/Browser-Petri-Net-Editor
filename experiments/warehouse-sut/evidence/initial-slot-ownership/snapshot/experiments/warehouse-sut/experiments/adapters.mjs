// Public transport contract, independently declared; no APN/model or DB imports.
const signatures={openOrder:'order',addLine:'order line product warehouse quantity',amendLine:'order line quantity',removeLine:'order line',submitOrder:'order',approveOrder:'order',rejectOrder:'order',cancelOrder:'order',reserveLine:'order line quantity',reservePair:'order line line2 warehouse quantity quantity2',releaseLine:'order line quantity',shipLine:'order line quantity',returnLine:'order line quantity',cancelLine:'order line',closeOrder:'order',reopenOrder:'order',readOrder:'order',readLine:'order line',readTotals:'order',auditCount:'order',readStock:'product warehouse',receiveStock:'product warehouse quantity',adjustStock:'product warehouse quantity',transferStock:'product warehouse destination quantity',readProduct:'product',setProduct:'product enabled',readWarehouse:'warehouse',setWarehouse:'warehouse enabled'};
const sorts={ack:'Bool',orderRecord:'Pair',lineRecord:'Pair',stockRecord:'Pair',productState:'Bool',warehouseState:'Bool',changes:'Nat',totals:'Pair'};
export const warehouseInterface={methods:Object.entries(signatures).map(([name,args])=>({name,parameters:('actor '+args).split(' ').map(name=>({name,sort:name==='enabled'?'Bool':'Nat'}))})),gates:Object.entries(sorts).map(([name,sort])=>({name,parameters:[{name:'arg1',sort}]})),outputs:Object.keys(sorts),outputSorts:sorts};
const pair=(...xs)=>({__pair__:true,fst:xs[0],snd:xs.length===2?xs[1]:pair(...xs.slice(1))});
export function observed(method,data){
 if(!data||!['accepted','refused'].includes(data.status))throw Error('Malformed response '+JSON.stringify(data));
 const outputs=Object.fromEntries(Object.keys(sorts).map(n=>[n,[]]));
 if(data.status==='accepted'){
  const r=data.result;if(!r||typeof r!=='object')throw Error('Missing result');
  if(method==='readOrder')outputs.orderRecord=[pair(r.state,r.count,r.pending,r.reserved,r.shipped,r.returned)];
  else if(method==='readLine')outputs.lineRecord=[pair(r.product,r.warehouse,r.quantity,r.reserved,r.shipped,r.returned,r.state)];
  else if(method==='readStock')outputs.stockRecord=[pair(r.on_hand,r.reserved)];
  else if(method==='readProduct')outputs.productState=[r.enabled];
  else if(method==='readWarehouse')outputs.warehouseState=[r.enabled];
  else if(method==='readTotals')outputs.totals=[pair(r.shipped,r.returned)];
  else if(method==='auditCount')outputs.changes=[r.count];
  else outputs.ack=[true];
 }
 return {status:data.status,outputs};
}
export function route(method,args){
 const {actor,...data}=args;
 if(method==='openOrder')return ['/api/orders','POST',data];
 if(data.order!==undefined){
  const base=`/api/orders/${data.order}`;delete data.order;
  if(method==='readOrder')return [base,'GET'];
  if(method==='addLine')return [base+'/lines','POST',data];
  if(['readLine','amendLine','removeLine','reserveLine','releaseLine','shipLine','returnLine','cancelLine'].includes(method)){
   const p=base+`/lines/${data.line}`;delete data.line;
   const verbs={readLine:'GET',amendLine:'PATCH',removeLine:'DELETE'};
   return [p+(verbs[method]?'':'/'+method.slice(0,-4)),verbs[method]||'POST',Object.keys(data).length?data:undefined];
  }
  const paths={submitOrder:'submit',approveOrder:'approve',rejectOrder:'reject',cancelOrder:'cancel',closeOrder:'close',reopenOrder:'reopen',reservePair:'reserve-pair',readTotals:'totals',auditCount:'audit-count'};
  return [base+'/'+paths[method],['readTotals','auditCount'].includes(method)?'GET':'POST',Object.keys(data).length?data:undefined];
 }
 if(method.endsWith('Product')||method.endsWith('Warehouse')){const k=method.endsWith('Product')?'product':'warehouse',id=data[k];delete data[k];return [`/api/${k==='product'?'products':'warehouses'}/${id}`,method.startsWith('read')?'GET':'PATCH',Object.keys(data).length?data:undefined]}
 const p=`/api/stock/${data.product}/${data.warehouse}`;delete data.product;delete data.warehouse;return [p+(method==='readStock'?'':'/'+method.slice(0,-5)),method==='readStock'?'GET':'POST',Object.keys(data).length?data:undefined];
}
async function request(base,path,method='GET',body,token,signal,headers={}){const r=await fetch(base+path,{method,signal,headers:{'Content-Type':'application/json',...token?{Authorization:`Bearer ${token}`}:{},...headers},...body?{body:JSON.stringify(body)}:{}});const data=await r.json();if(!r.ok&&data.status!=='refused')throw Error(`HTTP ${r.status}: ${JSON.stringify(data)}`);return data}
const reset=(base,signal)=>request(base,'/api/testing/reset','POST',{},null,signal,{'X-Test-Key':process.env.WAREHOUSE_TEST_KEY||'local-experiment'});
export function apiAdapter(base){const tokens=new Map();return {interface:structuredClone(warehouseInterface),async reset({signal}={}){tokens.clear();await reset(base,signal)},async invoke({method,arguments:args},{signal}={}){if(!tokens.has(args.actor)){const d=await request(base,'/api/login','POST',{actor:args.actor,password:'research-demo'},null,signal);tokens.set(args.actor,d.token)}const [path,verb,body]=route(method,args);return observed(method,await request(base,path,verb,body,tokens.get(args.actor),signal))}}}
export function browserAdapter(base,page){let actor=null;return {interface:structuredClone(warehouseInterface),async reset({signal}={}){await reset(base,signal);await page.goto(base);actor=null},async invoke({method,arguments:args},{signal}={}){if(signal?.aborted)throw Error('Aborted');const abort=()=>page.close().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});try{
 if(actor!==args.actor){await page.locator('#login-id').selectOption(String(args.actor));await page.locator('#login-password').fill('research-demo');await page.locator('#login').click();await page.waitForFunction(a=>document.documentElement.dataset.actor===String(a),args.actor);actor=args.actor}
 const view=['readStock','receiveStock','adjustStock','transferStock'].includes(method)?'inventory':['readProduct','setProduct','readWarehouse','setWarehouse'].includes(method)?'catalog':'orders';
 await page.locator(`[data-view="${view}"]`).click();await page.locator('#command').selectOption(method);
 for(const [k,v]of Object.entries(args)){if(k==='actor')continue;const input=page.locator('#arg-'+k);if(k==='enabled')await input.selectOption(String(v));else await input.fill(String(v))}
 const before=Number(await page.locator('#response').getAttribute('data-request'));await page.locator('#execute').click();await page.waitForFunction(({before,method})=>{const r=document.getElementById('response');return Number(r.dataset.request)>before&&r.dataset.command===method&&!document.getElementById('execute').disabled},{before,method});return observed(method,JSON.parse(await page.locator('#response').innerText()));
 }finally{signal?.removeEventListener('abort',abort)}}}}
