
try{
  Object.keys(localStorage).forEach(k=>{
    if(/^sr_closure_manager_v[123]$/i.test(k)) localStorage.removeItem(k);
  });
}catch(e){}
const KEY='sr_closure_manager_v6_final';
const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
const dataKey=()=>localStorage.getItem(KEY);
let data;

function load(){
  window.aiPlanVisible=false;
  // Start clean if this version has never been initialized.
  // This prevents data from previous app versions from appearing.
  const saved=localStorage.getItem(KEY);
  if(saved){
    try{
      const parsed=JSON.parse(saved);
      data=(parsed && Array.isArray(parsed.requests))
        ? parsed
        : {requests:[],updates:[],closedToday:[]};
    }catch(e){
      localStorage.removeItem(KEY);
      data={requests:[],updates:[],closedToday:[]};
    }
  }else{
    data={requests:[],updates:[],closedToday:[]};
    save(false);
  }
  render();
}
function save(renderNow=true){localStorage.setItem(KEY,JSON.stringify(data));if(renderNow)render()}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function parseDate(s){let d=new Date(s);return isNaN(d)?null:d}
function updatedDate(r){
  // Prefer the machine-readable timestamp saved on each work update.
  // Falls back to parsing the display string for freshly-imported CSV rows
  // that haven't been worked yet (no updatedAt recorded).
  if(r.updatedAt){let d=new Date(r.updatedAt);if(!isNaN(d))return d}
  return parseDate(r.updated);
}
function ageDays(r){let d=parseDate(r.created);return d?Math.max(0,Math.floor((new Date()-d)/86400000)):0}
function updatedDays(r){let d=updatedDate(r);return d?Math.max(0,Math.floor((new Date()-d)/86400000)):999}
function open(r){return r.myStage!=='Closed in Tracker'}
function stale(r){return open(r)&&updatedDays(r)>=3}
function category(r){
 let s=(r.subject+' '+r.category).toLowerCase();
 if(/printer|print/.test(s))return 'Printer';
 if(/cctv|camera|nvr/.test(s))return 'CCTV';
 if(/network|lan|wan|ip |ip address|internet|wifi|wi-fi|switch|router/.test(s))return 'Network';
 if(/oracle|erp|mrn|qms/.test(s))return 'Oracle/ERP';
 if(/payment|invoice|bill|renewal|rental|amc/.test(s))return 'Payment/Vendor';
 if(/laptop|desktop|touchscreen|monitor|keyboard|mouse|ups|hardware/.test(s))return 'Hardware';
 if(/access|password|login|user|account|permission|enable/.test(s))return 'Access/Account';
 if(/data|report|push|transaction/.test(s))return 'Data/Report';
 return r.category||'General';
}
function score(r){
 if(!open(r))return -999;
 let s=0,a=ageDays(r);
 if(a>=180)s+=60;else if(a>=90)s+=45;else if(a>=60)s+=35;else if(a>=30)s+=25;else if(a>=15)s+=14;else s+=6;
 if(stale(r))s+=15;
 if(r.myStage==='Ready to Close')s+=45;
 if(r.myStage==='Waiting Requester')s+=8;
 if(r.myStage==='Waiting Vendor')s+=3;
 if(r.myStage==='Blocked')s-=8;
 if(/password|access|account|enable|printer|configuration|ip address|data push|request for data/i.test(r.subject))s+=8;
 return s;
}
function reason(r){
 if(r.myStage==='Ready to Close')return 'Close-ready: finish closure evidence';
 if(ageDays(r)>=60&&stale(r))return 'Old + stale: high backlog priority';
 if(ageDays(r)>=60)return 'Very old SR: attack backlog';
 if(stale(r))return 'No recent update: follow up now';
 if(/printer|password|access|data push|configuration/i.test(r.subject))return 'Potential quick-win';
 return 'Work next action';
}
function stageClass(s){if(s==='Ready to Close'||s==='Closed in Tracker')return 'Ready';if(s.includes('Waiting'))return 'Waiting';if(s==='Blocked')return 'Blocked';return ''}
function money(n){return '₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0})}


function closedTodayCount(){
  // closedToday is an append-only log of {id,date} entries (kept across days
  // so history isn't lost on import). Only count entries dated today, and
  // dedupe by id in case an SR was reopened and re-closed on the same day.
  const t=today();
  const ids=new Set();
  (data.closedToday||[]).forEach(e=>{
    if(e && typeof e==='object' && e.date===t) ids.add(e.id);
  });
  return ids.size;
}

const CLEANUP_DEADLINE = new Date("2027-01-01T23:59:59");

function updateDeadline(){
  const now=new Date();
  const ms=Math.max(0,CLEANUP_DEADLINE-now);
  const days=Math.ceil(ms/86400000);
  const openCount=data.requests.filter(open).length;
  const daily=days>0?Math.ceil(openCount/days):openCount;
  const d=$("daysRemaining");
  const q=$("dailyRequired");
  if(d)d.textContent=days;
  if(q)q.textContent=daily;
  const ds=$("daysRemainingSide");
  const qs=$("dailyRequiredSide");
  if(ds)ds.textContent=days;
  if(qs)qs.textContent=daily;
}

function render(){
  updateDeadline();
  const req=data.requests;
  const openReq=req.filter(open);
  $('openCount').textContent=openReq.length;
  $('old60').textContent=openReq.filter(r=>ageDays(r)>=60).length;
  $('old30').textContent=openReq.filter(r=>ageDays(r)>=30).length;
  $('stale').textContent=openReq.filter(stale).length;
  $('ready').textContent=openReq.filter(r=>r.myStage==='Ready to Close').length;
  let target=Math.max(1,Number($('targetInput').value||10));
  let ct=closedTodayCount();
  $('closedToday').textContent=ct;
  $('missionBar').style.width=Math.min(100,ct/target*100)+'%';
  $('missionText').textContent=`Target: ${target} · ${Math.max(0,target-ct)} remaining`;
  renderRecommendations();renderQuickWins();renderOldest();renderQueue();renderAll();renderUpdates();renderReports();populateFilters();
  if(!window.aiPlanVisible) $('aiSuggestions').innerHTML=data.requests.length
    ? '<div class="empty">Click <b>Suggest Fast Closures</b> to ask Gemini to rank your fastest legitimate closures.</div>'
    : '<div class="empty">Import your SR CSV, then click <b>Suggest Fast Closures</b> for Gemini analysis.</div>';
}
function openButton(id){return `<button class="ghost action" onclick="work('${id}')">Work SR</button>`}
function row(r){
 let a=ageDays(r), ac=a>=60?'age-old':a>=30?'age-mid':'';
 return `<tr><td><span class="sr-id">${esc(r.id)}</span></td><td title="${esc(r.subject)}">${esc(r.subject).slice(0,62)}${r.subject.length>62?'…':''}</td><td>${esc(r.requester)}</td><td>${esc(r.site)}</td><td>${esc(category(r))}</td><td class="${ac}">${a}d</td><td><span class="stage ${stageClass(r.myStage)}">${esc(r.myStage)}</span></td><td class="score">${score(r)}</td><td>${openButton(r.id)}</td></tr>`
}
function table(list){
 if(!list.length)return '<div class="empty">Nothing here. Good.</div>';
 return `<div class="table-wrap"><table><thead><tr><th>SR</th><th>Subject</th><th>Requester</th><th>Site</th><th>Category</th><th>Age</th><th>Stage</th><th>Score</th><th>Action</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>`
}
function renderRecommendations(){
 let list=data.requests.filter(open).sort((a,b)=>score(b)-score(a)).slice(0,10);
 $('recommendations').innerHTML=list.length?list.map(r=>`<div class="action-row"><div><b>${esc(r.id)} — ${esc(r.subject).slice(0,65)}</b><div class="action-meta">${reason(r)} · ${ageDays(r)} days old · ${esc(r.requester)}</div></div><div class="action-btn">${r.myStage==='Ready to Close'?'<span class="tag green">READY</span>':''}${openButton(r.id)}</div></div>`).join(''):'<div class="empty">All requests are closed in this tracker.</div>';
}
function renderQuickWins(){
 let list=data.requests.filter(open).sort((a,b)=>{
   const q=x=>/password|access|account|enable|printer|configuration|ip address|data push|request for/i.test(x.subject)?1:0;
   return q(b)-q(a) || ageDays(b)-ageDays(a)
 }).slice(0,8);
 $('quickWins').innerHTML=list.length?list.map(r=>`<div class="action-row"><div><b>${esc(r.id)}</b><div class="action-meta">${esc(r.subject).slice(0,58)}</div></div><span class="tag">Quick win</span></div>`).join(''):'<div class="empty">No quick wins.</div>';
}
function renderOldest(){
 let list=data.requests.filter(open).sort((a,b)=>ageDays(b)-ageDays(a)).slice(0,12);
 $('oldestTable').innerHTML=table(list);
}
function renderQueue(){
 let f=$('queueFilter').value,stage=$('stageFilter').value,q=$('queueSearch').value.toLowerCase();
 let list=data.requests.filter(r=>{
   if(stage&&r.myStage!==stage)return false;
   if(q&&!((r.id+' '+r.subject+' '+r.requester+' '+r.site).toLowerCase().includes(q)))return false;
   if(f==='quick'&&!/password|access|account|enable|printer|configuration|ip address|data push|request for/i.test(r.subject))return false;
   if(f==='old'&&ageDays(r)<30)return false;
   if(f==='stale'&&!stale(r))return false;
   if(f==='ready'&&r.myStage!=='Ready to Close')return false;
   if(f==='blocked'&&!['Blocked','Waiting Requester','Waiting Vendor'].includes(r.myStage))return false;
   return true;
 }).sort((a,b)=>score(b)-score(a));
 $('queueTable').innerHTML=table(list);
}
function populateFilters(){
 let cats=[...new Set(data.requests.map(category))].sort(),sites=[...new Set(data.requests.map(r=>r.site).filter(Boolean))].sort();
 const set=(id,vals,label)=>{let el=$(id),old=el.value;el.innerHTML=`<option value="">${label}</option>`+vals.map(v=>`<option>${esc(v)}</option>`).join('');el.value=vals.includes(old)?old:''};
 set('catFilter',cats,'All categories');set('siteFilter',sites,'All sites');
}
function renderAll(){
 let q=$('allSearch').value.toLowerCase(),cat=$('catFilter').value,site=$('siteFilter').value,pri=$('priorityFilter').value;
 let list=data.requests.filter(r=>(!q||(r.id+' '+r.subject+' '+r.requester+' '+r.site).toLowerCase().includes(q))&&(!cat||category(r)===cat)&&(!site||r.site===site)&&(!pri||r.priority===pri));
 $('allTable').innerHTML=table(list);
}
function renderUpdates(){
 let logs=data.requests.filter(r=>r.notes||r.nextAction||r.resolution||r.followupDate||r.myStage!=='New').sort((a,b)=>(updatedDate(b)||0)-(updatedDate(a)||0));
 $('updatesTable').innerHTML=logs.length?`<div class="table-wrap"><table><thead><tr><th>SR</th><th>Last Update</th><th>Stage</th><th>Next Action</th><th>Follow-up</th><th>Notes</th></tr></thead><tbody>${logs.map(r=>`<tr><td><b>${esc(r.id)}</b></td><td>${esc(r.updated)}</td><td><span class="stage ${stageClass(r.myStage)}">${esc(r.myStage)}</span></td><td>${esc(r.nextAction||'-')}</td><td>${esc(r.followupDate||'-')}</td><td>${esc(r.notes||r.resolution||'-')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No work updates recorded yet.</div>';
}
function renderReports(){
 const rs=data.requests;
 $('rOpen').textContent=rs.filter(open).length;$('rClosed').textContent=rs.filter(r=>r.myStage==='Closed in Tracker').length;
 $('rRequester').textContent=rs.filter(r=>r.myStage==='Waiting Requester').length;$('rVendor').textContent=rs.filter(r=>r.myStage==='Waiting Vendor').length;
 let groups={};rs.filter(open).forEach(r=>{let c=category(r);groups[c]=(groups[c]||0)+1});
 let total=Math.max(1,rs.filter(open).length);
 $('categoryReport').innerHTML=Object.entries(groups).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<div class="barrow"><div class="barlabel"><span>${esc(c)}</span><b>${n}</b></div><div class="bar"><span style="width:${n/total*100}%"></span></div></div>`).join('');
}


function work(id){
 let r=data.requests.find(x=>x.id===id);if(!r)return;
 $('srId').value=id;$('modalTitle').textContent=`Work SR #${id}`;$('modalSubtitle').textContent=`${r.requester} · ${r.site}`;
 $('srInfo').innerHTML=`<b>${esc(r.subject)}</b><br>Created: ${esc(r.created)} · Last updated: ${esc(r.updated)} · Age: <b>${ageDays(r)} days</b><br>Category: ${esc(category(r))} · Priority: ${esc(r.priority)}`;
 $('myStage').value=r.myStage||'New';$('followupDate').value=r.followupDate||'';$('nextAction').value=r.nextAction||'';$('resolution').value=r.resolution||'';$('notes').value=r.notes||'';$('closeReady').checked=!!r.closeReady;
 $('srModal').classList.remove('hidden');
}
function closeModal(id){$(id).classList.add('hidden')}

document.querySelectorAll('.nav[data-view]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));$(b.dataset.view+'View').classList.remove('hidden');$('pageTitle').textContent=b.textContent});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$('refreshBtn').onclick=render;
$('targetInput').oninput=render;
$('queueFilter').onchange=renderQueue;$('stageFilter').onchange=renderQueue;$('queueSearch').oninput=renderQueue;
$('allSearch').oninput=renderAll;$('catFilter').onchange=renderAll;$('siteFilter').onchange=renderAll;$('priorityFilter').onchange=renderAll;

$('srForm').onsubmit=e=>{
 e.preventDefault();
 let id=$('srId').value,r=data.requests.find(x=>x.id===id);if(!r)return;
 let oldStage=r.myStage, newStage=$('myStage').value;
 r.myStage=newStage;r.followupDate=$('followupDate').value;r.nextAction=$('nextAction').value.trim();r.resolution=$('resolution').value.trim();r.notes=$('notes').value.trim();r.closeReady=$('closeReady').checked;
 const now=new Date();
 r.updated=now.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
 r.updatedAt=now.toISOString();
 if(newStage==='Closed in Tracker'&&oldStage!=='Closed in Tracker'){
   if(!data.closedToday)data.closedToday=[];
   data.closedToday.push({id,date:today()});
 }
 if(r.closeReady&&newStage!=='Closed in Tracker')r.myStage='Ready to Close';
 save();closeModal('srModal');
};

function parseCSVLine(line){
  const out=[];
  let value="", quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted && line[i+1]==='"'){ value+='"'; i++; }
      else { quoted=!quoted; }
    }else if(ch===',' && !quoted){
      out.push(value.trim());
      value="";
    }else{
      value+=ch;
    }
  }
  out.push(value.trim());
  return out;
}

function parseCSV(text){
  const rows=[];
  let row=[], value="", quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted && text[i+1]==='"'){ value+='"'; i++; }
      else quoted=!quoted;
    }else if(ch===',' && !quoted){
      row.push(value.trim()); value="";
    }else if((ch==='\n' || ch==='\r') && !quoted){
      if(ch==='\r' && text[i+1]==='\n') i++;
      row.push(value.trim()); value="";
      if(row.some(x=>x!=='')) rows.push(row);
      row=[];
    }else{
      value+=ch;
    }
  }
  if(value!=='' || row.length){
    row.push(value.trim());
    if(row.some(x=>x!=='')) rows.push(row);
  }
  return rows;
}

async function importSRFile(file){
  if(!file)return;

  const reader=new FileReader();

  reader.onload=()=>{
    try{
      const text=String(reader.result||"").replace(/^\uFEFF/,"");
      if(!text.trim()) throw new Error("The selected CSV is empty.");

      const rows=parseCSVRobust(text);
      if(rows.length<2) throw new Error("The CSV has no data rows.");

      const headers=rows[0].map(v=>String(v||"").trim());
      const normalize=s=>String(s||"")
        .replace(/^\uFEFF/,"")
        .trim()
        .toLowerCase()
        .replace(/[\s._-]+/g,"")
        .replace(/[^a-z0-9]/g,"");

      const headerMap={};
      headers.forEach((h,i)=>headerMap[normalize(h)]=i);

      const get=(row,names)=>{
        for(const name of names){
          const idx=headerMap[normalize(name)];
          if(idx!==undefined) return String(row[idx]??"").trim();
        }
        return "";
      };

      const imported=[];

      for(let i=1;i<rows.length;i++){
        const row=rows[i];
        const id=get(row,[
          "Request ID","RequestID","Request Id","SR ID","SRID",
          "Service Request ID","ServiceRequestID","Ticket ID","TicketID"
        ]);

        if(!id) continue;

        imported.push({
          id,
          created:get(row,["Created Date","Created","CreatedDate","Date Created"]),
          updated:get(row,["Last Updated Time","Last Updated","Updated","LastUpdatedTime","Updated Date"]),
          technician:get(row,["Technician.Name","Technician","Technician Name","Assigned To"]),
          subject:get(row,["Subject","Description","Title","Request Subject"]),
          requester:get(row,["Requester.Name","Requester","Requester Name","Requested By"]),
          status:get(row,["Status.Name","Status"]) || "Open",
          priority:get(row,["Priority.Name","Priority"]) || "Medium",
          site:get(row,["Site.Name","Site","Location"]),
          category:get(row,["Category.Name","Category"]),
          myStage:"New",
          nextAction:"",
          resolution:"",
          followupDate:"",
          closeReady:false,
          notes:""
        });
      }

      if(!imported.length){
        throw new Error(
          "No SRs found. Your CSV must contain a Request ID column. " +
          "Detected columns: " + headers.slice(0,12).join(", ")
        );
      }

      // Preserve tracker notes/stages when the same SR is re-imported.
      const existing=data.requests||[];
      const previousById=new Map(existing.map(r=>[String(r.id).trim(),r]));

      const merged=imported.map(r=>{
        const old=previousById.get(String(r.id).trim());
        if(!old) return r;

        return {
          ...r,
          myStage:old.myStage||"New",
          nextAction:old.nextAction||"",
          resolution:old.resolution||"",
          followupDate:old.followupDate||"",
          closeReady:!!old.closeReady,
          notes:old.notes||""
        };
      });

      window.aiPlanVisible=false;
      data={
        requests:merged,
        updates:data.updates||[],
        closedToday:data.closedToday||[]
      };

      save();
      render();

      const input=$("csvInput");
      if(input) input.value="";
      const topInput=$("topCsvInput");
      if(topInput) topInput.value="";

      alert(`Successfully imported ${merged.length} SRs.`);
    }catch(err){
      console.error("CSV import error:",err);
      alert("CSV import failed: "+err.message);
    }
  };

  reader.onerror=()=>alert("Could not read the CSV file.");
  reader.readAsText(file,"UTF-8");
}

function parseCSVRobust(text){
  // RFC-style CSV parser: handles commas, quoted values, escaped quotes,
  // semicolons and newlines inside quoted fields.
  const rows=[];
  let row=[];
  let value="";
  let quoted=false;

  for(let i=0;i<text.length;i++){
    const ch=text[i];

    if(ch==='"'){
      if(quoted && text[i+1]==='"'){
        value+='"';
        i++;
      }else{
        quoted=!quoted;
      }
      continue;
    }

    if(!quoted && (ch===',' || ch===';')){
      row.push(value.trim());
      value="";
      continue;
    }

    if(!quoted && (ch==='\r' || ch==='\n')){
      if(ch==='\r' && text[i+1]==='\n') i++;
      row.push(value.trim());
      value="";

      if(row.some(v=>String(v).trim()!=="")){
        rows.push(row);
      }
      row=[];
      continue;
    }

    value+=ch;
  }

  if(value!=="" || row.length){
    row.push(value.trim());
    if(row.some(v=>String(v).trim()!=="")){
      rows.push(row);
    }
  }

  // Remove accidental empty columns at the end.
  return rows.map(r=>r.map(v=>String(v??"").trim()));
}


$('csvInput').onchange=e=>{importSRFile(e.target.files[0]);e.target.value=''};
$('topCsvInput').onchange=e=>{importSRFile(e.target.files[0]);e.target.value=''};
$('exportBtn').onclick=()=>{let out=data.requests.map(r=>({RequestID:r.id,Subject:r.subject,Requester:r.requester,Site:r.site,AgeDays:ageDays(r),Stage:r.myStage,NextAction:r.nextAction,FollowupDate:r.followupDate,CloseReady:r.closeReady,Resolution:r.resolution,Notes:r.notes}));let headers=Object.keys(out[0]||{RequestID:''});let lines=[headers.join(',')];out.forEach(r=>lines.push(headers.map(h=>`"${String(r[h]??'').replaceAll('"','""')}"`).join(',')));let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv'}));a.download='SR_Closure_Tracker.csv';a.click()};
$('resetBtn').onclick=()=>{if(confirm('Clear ALL imported SRs and tracker notes? The dashboard will return to 0 until you import a CSV.')){localStorage.removeItem(KEY);load()}};

async function requestAI(path, body){
  const response = await fetch(path,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const result = await response.json().catch(()=>({error:'Server returned an invalid response'}));
  if(!response.ok) throw new Error(result.error || `AI request failed (${response.status})`);
  return result;
}

function renderRealAISuggestions(recommendations){
  window.aiPlanVisible=true;
  if(!Array.isArray(recommendations) || !recommendations.length){
    $('aiSuggestions').innerHTML='<div class="empty">AI did not find suitable quick-closure SRs.</div>';
    return;
  }

  $('aiSuggestions').innerHTML=recommendations.map((r,i)=>{
    const sr=data.requests.find(x=>x.id===r.requestId);
    if(!sr)return '';
    return `<div class="ai-suggestion">
      <div class="ai-rank">${r.rank||i+1}</div>
      <div>
        <h4>${esc(r.requestId)} — ${esc(sr.subject)}</h4>
        <p><b>Next Action:</b> ${esc(r.nextAction||'-')}</p>
        <p><b>Closure Evidence:</b> ${esc(r.closureEvidence||'-')}</p>
        <p><b>Requester Message:</b> ${esc(r.suggestedMessage||'-')}</p>
        <div class="ai-reason">${esc(r.closureChance||'')} closure chance · ${esc(String(r.estimatedMinutes||'-'))} min · ${esc(r.risk||'')} risk · ${esc(r.reason||'')}</div>
      </div>
      <button class="ghost small" onclick="work('${String(r.requestId).replace(/'/g,"\\'")}')">Work SR</button>
    </div>`;
  }).join('');
}

$('aiSuggestBtn').onclick=async()=>{
  const button=$('aiSuggestBtn');
  button.disabled=true;
  button.textContent='🤖 Analyzing...';
  $('aiSuggestions').innerHTML='<div class="ai-loading">AI is analyzing your SR backlog. Please wait...</div>';

  try{
    const requests=data.requests
      .filter(r=>r.myStage!=='Closed in Tracker')
      .sort((a,b)=>score(b)-score(a))
      .slice(0,60)
      .map(r=>({...r,ageDays:ageDays(r)}));

    if(!requests.length) throw new Error('No open SRs available.');

    const result=await requestAI('/api/ai/closure-plan',{requests});
    renderRealAISuggestions(result.recommendations);
  }catch(err){
    console.error(err);
    $('aiSuggestions').innerHTML=`<div class="empty">❌ Gemini could not complete the analysis.<br><br>${esc(err.message)}<br><br><small>Your SR data is still safe locally. Try again in a moment.</small></div>`;
  }finally{
    button.disabled=false;
    button.textContent='Suggest Fast Closures';
  }
};

$('aiWorkBtn').onclick=async()=>{
  const r=data.requests.find(x=>x.id===$('srId').value);
  if(!r)return;

  $('aiWorkSuggestion').innerHTML='<div class="ai-loading">🤖 Analyzing this SR...</div>';

  try{
    const result=await requestAI('/api/ai/next-step',{sr:{...r,ageDays:ageDays(r)}});
    $('aiWorkSuggestion').innerHTML=`
      <b>Closure Chance:</b> ${esc(result.closureChance||'-')}<br><br>
      <b>Estimated Time:</b> ${esc(String(result.estimatedMinutes||'-'))} minutes<br><br>
      <b>Next Action:</b><br>${esc(result.nextAction||'-')}<br><br>
      <b>Requester Message:</b><br>${esc(result.requesterMessage||'-')}<br><br>
      <b>Closure Evidence:</b><br>${esc(result.closureEvidence||'-')}<br><br>
      <b>Resolution Template:</b><br>${esc(result.resolutionTemplate||'-')}<br><br>
      <b>Why:</b> ${esc(result.reason||'-')}
    `;
  }catch(err){
    console.error(err);
    $('aiWorkSuggestion').innerHTML=`❌ ${esc(err.message)}`;
  }
};

load();
