// Independently declared external contract; no APN or reference results imported.
const P=(...names)=>names.map(name=>({name,sort:name==='approve'?'Bool':'Nat'}));
export const hrInterface={
 methods:[
  {name:'logTime',parameters:P('actor','employee','record','kind','minutes')},
  {name:'decideTime',parameters:P('actor','employee','record','approve')},
  {name:'correctTime',parameters:P('actor','employee','record','kind','minutes','status')},
  {name:'readTime',parameters:P('actor','employee','record')},
  {name:'requestVacation',parameters:P('actor','employee','record','days')},
  {name:'decideVacation',parameters:P('actor','employee','record','approve')},
  {name:'takeVacation',parameters:P('actor','employee','record')},
  {name:'correctVacation',parameters:P('actor','employee','record','days','status')},
  {name:'readVacation',parameters:P('actor','employee','record')},
  {name:'balance',parameters:P('actor','employee')},{name:'totals',parameters:P('actor','employee')},{name:'auditCount',parameters:P('actor','employee')}
 ],gates:[['ack','Bool'],['timeRecord','Pair'],['vacationRecord','Pair'],['remaining','Nat'],['approvedMinutes','Nat'],['changes','Nat']].map(([name,sort])=>({name,parameters:[{name:'arg1',sort}]})),
 outputs:['ack','timeRecord','vacationRecord','remaining','approvedMinutes','changes'],outputSorts:{ack:'Bool',timeRecord:'Pair',vacationRecord:'Pair',remaining:'Nat',approvedMinutes:'Nat',changes:'Nat'}
};
const pair=(fst,snd)=>({__pair__:true,fst,snd});
export function observed(method,data){
 if(!data||!['accepted','refused'].includes(data.status))throw Error('Malformed HTTP/UI response: '+JSON.stringify(data));
 const outputs=Object.fromEntries(hrInterface.outputs.map(k=>[k,[]]));
 if(data.status==='accepted'){
  const r=data.result;if(!r||typeof r!=='object')throw Error('Missing result');
  if(method==='readTime')outputs.timeRecord=[pair(r.kind,pair(r.minutes,r.status))];
  else if(method==='readVacation')outputs.vacationRecord=[pair(r.days,r.status)];
  else if(method==='balance')outputs.remaining=[r.remaining];
  else if(method==='totals')outputs.approvedMinutes=[r.minutes];
  else if(method==='auditCount')outputs.changes=[r.count];
  else outputs.ack=[true];
 }
 return {status:data.status,outputs};
}
async function json(base,path,method='GET',body,token,signal,headers={}){
 const r=await fetch(base+path,{method,signal,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok&&data.status!=='refused')throw Error(`${r.status}: ${JSON.stringify(data)}`);return data;
}
const reset=(base,signal)=>json(base,'/api/testing/reset','POST',{},null,signal,{'X-Test-Key':process.env.HR_TEST_KEY||'local-experiment'});
export function route(method,args){
 const {actor,...body}=args;body.date='2026-11-01';body.reason='SATEL generated correction';
 if(['balance','totals','auditCount'].includes(method))return [`/api/employees/${args.employee}/${{balance:'balance',totals:'totals',auditCount:'audit-count'}[method]}?period=2026-11`,'GET'];
 const path='/api/'+(method.endsWith('Time')?'time-entries':'vacations');
 if(['logTime','requestVacation'].includes(method))return [path,'POST',body];
 if(method.startsWith('decide'))return [path+`/${args.record}/decision`,'POST',body];
 if(method==='takeVacation')return [path+`/${args.record}/take`,'POST',body];
 if(method.startsWith('correct'))return [path+`/${args.record}`,'PATCH',body];
 return [path+`/${args.record}?employee=${args.employee}`,'GET'];
}
export function apiAdapter(base){
 const tokens=new Map();return {interface:structuredClone(hrInterface),
 async reset({signal}={}){tokens.clear();await reset(base,signal)},
 async invoke({method,arguments:args},{signal}={}){
  if(!tokens.has(args.actor)){const login=await json(base,'/api/login','POST',{employee:args.actor,password:'research-demo'},null,signal);tokens.set(args.actor,login.token)}
  const [path,verb,body]=route(method,args);return observed(method,await json(base,path,verb,body,tokens.get(args.actor),signal));
 }};
}
export function browserAdapter(base,page){
 let actor=null,busy=false;
 return {interface:structuredClone(hrInterface),
 async reset({signal}={}){await reset(base,signal);await page.goto(base);await page.evaluate(()=>sessionStorage.clear());await page.reload();actor=null},
 async invoke({method,arguments:args},{signal}={}){
  if(busy)throw Error('Overlapping UI calls');if(signal?.aborted)throw Error('Aborted');busy=true;
  const abort=()=>{page.close().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
  try{
   if(actor!==args.actor){await page.locator('#login-id').fill(String(args.actor));await page.locator('#login-password').fill('research-demo');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForFunction(id=>document.documentElement.dataset.actor===String(id),args.actor);actor=args.actor;}
   await page.locator('#target-employee').fill(String(args.employee));
   const tab=['balance','readVacation','requestVacation','decideVacation','takeVacation','correctVacation'].includes(method)?'vacation':method==='auditCount'?'audit':'time';
   await page.locator(`[data-tab="${tab}"]`).click();
   if(args.record){const prefix=method.endsWith('Time')?'time':'vacation';await page.locator(`#${prefix}-record`).fill(String(args.record));await page.locator(`#${prefix}-date`).fill('2026-11-01');
    for(const key of ['kind','minutes','days','status'])if(args[key]!==undefined){const locator=page.locator(`#${prefix}-${key}`);if(['kind','status'].includes(key))await locator.selectOption(String(args[key]));else await locator.fill(String(args[key]));}
    if(args.approve!==undefined)await page.locator(`#${prefix}-decision`).selectOption(String(args.approve));
    if(method.startsWith('correct'))await page.locator(`#${prefix}-reason`).fill('SATEL generated correction');
   }
   const before=Number(await page.locator('#response').getAttribute('data-request'));
   await page.locator(`button[data-command="${method}"]`).click();
   await page.waitForFunction(({before,method})=>{const r=document.getElementById('response');return Number(r.dataset.request)>before&&r.dataset.command===method&&['accepted','refused','error'].includes(r.dataset.state)},{before,method});
   const data=JSON.parse(await page.locator('#response').innerText());
   // Wait for the full UI operation (including table refresh) before switching actor.
   await page.locator(`button[data-command="${method}"]`).waitFor({state:'visible'});
   await page.waitForFunction(method=>!document.querySelector(`button[data-command="${method}"]`).disabled,method);
   return observed(method,data);
  }finally{busy=false;signal?.removeEventListener('abort',abort)}
 }};
}
