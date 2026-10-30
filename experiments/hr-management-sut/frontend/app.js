const $ = id => document.getElementById(id);
const kinds=['Standard','Business trip','Home office','Training','On call'], statuses=['Empty','Pending','Approved','Declined','Taken'];
let token=sessionStorage.getItem('hr-token'), user=null, busy=false, sequence=0;
async function api(path,method='GET',body) {
  const r=await fetch(path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json();if(!r.ok && data.status!=='refused')throw Error(data.error||'Request failed');return data;
}
function tab(name){document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));for(const t of ['time','vacation','audit'])$(t+'-panel').hidden=t!==name;}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
function table(container,headers,rows,select){
 const t=document.createElement('table'),h=t.createTHead().insertRow();headers.forEach(x=>{const th=document.createElement('th');th.textContent=x;h.append(th)});
 const body=t.createTBody();for(const row of rows){const tr=body.insertRow();row.forEach((v,i)=>{const td=tr.insertCell();if(i===row.length-1&&select){const b=document.createElement('button');b.className='quiet';b.textContent='Select';b.onclick=()=>select(v);td.append(b)}else if(v&&typeof v==='object'&&'status'in v){const span=document.createElement('span');span.className='badge '+statuses[v.status].toLowerCase();span.textContent=statuses[v.status];td.append(span)}else td.textContent=String(v??'—');});}$(container).replaceChildren(t);
}
async function refresh(target) {
 const data=await api('/api/dashboard'+(target?`?employee=${target}`:''));if(data.status==='refused')return;
 user=data.user;$('identity').textContent=`${user.name} · ${user.role.toUpperCase()} · Company ${user.company_id}`;
 const current=target||user.id;$('employee').replaceChildren(...data.employees.map(e=>{const o=document.createElement('option');o.value=e.id;o.textContent=`${e.name} · ${e.id}`;return o}));$('employee').value=current;$('target-employee').value=current;
 $('scope-note').textContent=`${data.employees.length} employees visible in your role`;$('time-count').textContent=data.stats.time_entries.toLocaleString();$('vacation-count').textContent=data.stats.vacations.toLocaleString();$('balance-count').textContent=data.remaining;
 table('time-table',['Reference','Date','Work type','Minutes','Status',''],data.time.map(r=>[r.id,r.work_date,kinds[r.kind],r.minutes,{status:r.status},r]),r=>{for(const [f,v]of Object.entries({record:r.id,date:r.work_date,kind:r.kind,minutes:r.minutes,status:r.status}))$('time-'+f).value=v});
 table('vacation-table',['Reference','Start','Days','Status',''],data.vacations.map(r=>[r.id,r.start_date,r.days,{status:r.status},r]),r=>{for(const[f,v]of Object.entries({record:r.id,date:r.start_date,days:r.days,status:r.status}))$('vacation-'+f).value=v});
 table('audit-table',['When','Actor','Action','Reference','Reason'],data.audit.map(r=>[r.created_at.slice(0,19),r.actor_id,r.action,r.record_id,r.reason]));
}
$('login').onsubmit=async e=>{e.preventDefault();try{const data=await api('/api/login','POST',{employee:Number($('login-id').value),password:$('login-password').value});token=data.token;sessionStorage.setItem('hr-token',token);await refresh();$('response').textContent='Signed in.';$('response').dataset.state='idle';document.documentElement.dataset.actor=String(data.user.id);}catch(e){$('response').textContent=e.message;$('response').dataset.state='error'}};
$('employee').onchange=()=>refresh(Number($('employee').value));
const queryPaths={balance:'balance',totals:'totals',auditCount:'audit-count'};
for(const button of document.querySelectorAll('[data-command]'))button.onclick=async()=>{
 if(busy)return;busy=true;document.querySelectorAll('[data-command]').forEach(b=>b.disabled=true);
 const command=button.dataset.command, response=$('response');response.dataset.request=String(++sequence);response.dataset.command=command;response.dataset.state='pending';response.textContent='Processing…';
 try{
  const employee=Number($('target-employee').value);let path,verb='GET',body;
  if(queryPaths[command])path=`/api/employees/${employee}/${queryPaths[command]}?period=2026-11`;
  else {
   const isTime=command.endsWith('Time'),prefix=isTime?'time':'vacation',record=Number($(prefix+'-record').value);path='/api/'+(isTime?'time-entries':'vacations');
   body={employee,record,date:$(prefix+'-date').value,...(isTime?{kind:Number($('time-kind').value),minutes:Number($('time-minutes').value)}:{days:Number($('vacation-days').value)}),approve:$(prefix+'-decision').value==='true',status:Number($(prefix+'-status').value),reason:$(prefix+'-reason').value};
   if(command==='logTime'||command==='requestVacation')verb='POST';
   else {path+=`/${record}`;if(command.startsWith('decide')){path+='/decision';verb='POST'}else if(command==='takeVacation'){path+='/take';verb='POST'}else if(command.startsWith('correct'))verb='PATCH';else {path+=`?employee=${employee}`;body=undefined;}}
  }
  const data=await api(path,verb,body);response.textContent=JSON.stringify(data,null,2);response.dataset.state=data.status;
  await refresh(employee);
 }catch(e){response.textContent=JSON.stringify({error:e.message});response.dataset.state='error'}finally{busy=false;document.querySelectorAll('[data-command]').forEach(b=>b.disabled=false)}
};
if(token)refresh().catch(()=>{sessionStorage.removeItem('hr-token');token=null});
