import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC5tFS7Pw4pGoFy7Shl5DShHCanWns9Y4o',
  authDomain: 'office-attendance-system-b7961.firebaseapp.com',
  projectId: 'office-attendance-system-b7961',
  storageBucket: 'office-attendance-system-b7961.firebasestorage.app',
  messagingSenderId: '740619580980',
  appId: '1:740619580980:web:f1099f8a0fef03efd83c61',
  measurementId: 'G-CKTB4S6883'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const today = () => new Date().toISOString().slice(0,10);
const monthKey = (d=today()) => String(d).slice(0,7);
const currentMonth = () => monthKey(today());
const isSundayDate = d => new Date(d+'T00:00:00').getDay()===0;
const nowTime = () => new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
let state = { role:null, employee:null, employees:[], departments:[], tasks:[], attendance:[], activity:[], leaveRequests:[], settings:{} };
let taskFilters = { business:'All', status:'All', employee:'All', search:'' };
let empTaskFilters = { business:'All', status:'All', search:'' };

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }

function closeProfessionalModal(){ const m=document.querySelector('.professional-modal-backdrop'); if(m) m.remove(); }
function modalShell(title, inner, footer=''){
  closeProfessionalModal();
  const modal=document.createElement('div');
  modal.className='professional-modal-backdrop';
  modal.innerHTML=`<div class="professional-modal-card"><button class="professional-modal-x" type="button" aria-label="Close">×</button><div class="professional-modal-head"><span class="modal-icon">✦</span><div><h2>${esc(title)}</h2><p>Update details carefully and save changes.</p></div></div>${inner}${footer}</div>`;
  document.body.appendChild(modal);
  modal.querySelector('.professional-modal-x').onclick=()=>modal.remove();
  modal.onclick=e=>{ if(e.target===modal) modal.remove(); };
  return modal;
}
function modalConfirm({title='Confirm Action', message='Are you sure?', confirmText='Confirm', danger=false}={}){
  return new Promise(resolve=>{
    const modal=modalShell(title, `<p class="modal-message">${esc(message)}</p>`, `<div class="professional-modal-footer"><button class="ghost-btn modal-cancel" type="button">Cancel</button><button class="${danger?'danger-btn':'primary-btn'} modal-confirm" type="button">${esc(confirmText)}</button></div>`);
    modal.querySelector('.modal-cancel').onclick=()=>{modal.remove(); resolve(false)};
    modal.querySelector('.modal-confirm').onclick=()=>{modal.remove(); resolve(true)};
  });
}
function fieldHTML(f){
  const val = f.value == null ? '' : String(f.value);
  const req = f.required ? 'required' : '';
  const label = `<label>${esc(f.label||f.name)}</label>`;
  if(f.type==='select') return `<div class="modal-field">${label}<select name="${esc(f.name)}" ${req}>${(f.options||[]).map(o=>{const v=typeof o==='object'?o.value:o; const text=typeof o==='object'?o.label:o; return `<option value="${esc(v)}" ${String(v)===val?'selected':''}>${esc(text)}</option>`}).join('')}</select></div>`;
  if(f.type==='textarea') return `<div class="modal-field full">${label}<textarea name="${esc(f.name)}" rows="4" ${req} placeholder="${esc(f.placeholder||'')}">${esc(val)}</textarea></div>`;
  return `<div class="modal-field">${label}<input name="${esc(f.name)}" type="${esc(f.type||'text')}" value="${esc(val)}" ${req} placeholder="${esc(f.placeholder||'')}"></div>`;
}
function modalForm({title='Edit', fields=[], submitText='Save Changes'}={}){
  return new Promise(resolve=>{
    const body=`<form class="professional-form" id="professionalModalForm"><div class="professional-form-grid">${fields.map(fieldHTML).join('')}</div><div class="professional-modal-footer"><button class="ghost-btn modal-cancel" type="button">Cancel</button><button class="primary-btn" type="submit">${esc(submitText)}</button></div></form>`;
    const modal=modalShell(title, body);
    modal.querySelector('.modal-cancel').onclick=()=>{modal.remove(); resolve(null)};
    modal.querySelector('form').onsubmit=e=>{ e.preventDefault(); const data=Object.fromEntries(new FormData(e.target)); modal.remove(); resolve(data); };
    setTimeout(()=>modal.querySelector('input,select,textarea')?.focus(),50);
  });
}

function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}
function uid(prefix){return prefix + '-' + Date.now().toString(36).slice(-5) + Math.floor(Math.random()*99)}
function empName(empId){return state.employees.find(e=>e.empId===empId)?.name || empId || 'Unknown'}
function depShort(name='GEN'){return String(name).replace(/[^a-zA-Z]/g,'').slice(0,3).toUpperCase() || 'GEN'}
function busShort(b='GEN'){return ({'SBX Media':'SBX','SIA Jewels':'SIA','YOLOX Fashion':'YLX','Personal':'PER'}[b] || String(b).slice(0,3).toUpperCase())}
function dateNice(d){return d ? new Date(d+'T00:00:00').toLocaleDateString() : '-'}
function daysLeft(d){ if(!d) return ''; const diff=Math.ceil((new Date(d+'T23:59:59')-new Date())/86400000); if(diff<0)return `${Math.abs(diff)} day overdue`; if(diff===0)return 'Due today'; return `${diff} day left`; }
function statusLabel(s){return ({todo:'To Do',progress:'In Progress',review:'Review',complete:'Completed'}[s]||s)}
function priorityClass(p){return String(p||'medium').toLowerCase()}
function safeFileName(name='file'){return String(name).replace(/[^a-zA-Z0-9._-]/g,'_')}
function fileKind(name=''){ const ext=String(name).split('.').pop().toLowerCase(); if(['jpg','jpeg','png','webp','gif','svg'].includes(ext))return 'image'; if(['mp4','mov','webm'].includes(ext))return 'video'; if(ext==='pdf')return 'pdf'; if(['zip','rar'].includes(ext))return 'zip'; return 'file'; }
function historyItem(text, by=state.role==='admin'?'Admin':state.employee?.name||'Employee'){return {text,by,date:today(),time:nowTime()}}
function pointsForRating(r){ const n=Math.max(0, Math.min(5, Number(r||0))); return n ? n*20 : 0; }
function ratingHTML(t){ return t.rating ? `<span class="mini rating-pill">⭐ ${esc(t.rating)}/5 • ${pointsForRating(t.rating)} pts</span>` : '<span class="mini">⭐ Not rated</span>'; }
function taskMonth(t){ return monthKey(t.completedDate || t.createdDate || t.dueDate || today()); }
function monthlyTaskPoints(empId, m=currentMonth()){ return state.tasks.filter(t=>t.empId===empId && t.status==='complete' && taskMonth(t)===m).reduce((sum,t)=>sum+Number(t.points||pointsForRating(t.rating)),0); }
function employeePaidLimit(emp){ return Number(emp?.paidLeaves || state.settings.monthlyLeaves || 2); }
function approvedLeaveDays(empId, m=currentMonth(), onlyPaid=false){ return state.attendance.filter(a=>a.empId===empId && monthKey(a.date)===m && (onlyPaid ? a.status==='Leave' : ['Leave','Absent'].includes(a.status) && a.leaveRequestId)).length; }
function daysBetween(from,to){ const out=[]; if(!from)return out; let d=new Date((from)+'T00:00:00'), end=new Date((to||from)+'T00:00:00'); while(d<=end){ out.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); } return out; }
function avatarHTML(emp, small=false){ const initials=String(emp?.name||'U').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(); return emp?.photoUrl ? `<img class="avatar ${small?'small-avatar':''}" src="${esc(emp.photoUrl)}" alt="${esc(emp.name)}">` : `<span class="avatar ${small?'small-avatar':''}">${esc(initials)}</span>`; }
function linkHTML(url){ if(!url) return '<p class="muted-small">No reference link</p>'; const safe=esc(url); return `<a class="ref-link" href="${safe}" target="_blank" rel="noopener">🔗 Open Reference Link</a><p class="muted-small">${safe}</p>`; }
function fileListHTML(files=[]){
  if(!files.length)return '<p class="muted-small">No files uploaded</p>';
  return `<div class="file-list">${files.map(f=>`<a class="file-chip" href="${esc(f.url)}" target="_blank" rel="noopener"><span>${f.kind==='image'?'🖼️':f.kind==='video'?'🎬':f.kind==='pdf'?'📄':f.kind==='zip'?'🗜️':'📎'}</span><b>${esc(f.name)}</b><small>${esc(f.uploadedBy||'')} • ${esc(f.uploadedAt||'')}</small></a>`).join('')}</div>`;
}
function taskHistoryHTML(t){
  const h=t.history||[];
  return h.length ? h.slice().reverse().map(x=>`<div class="timeline-item"><b>${esc(x.time||'')}</b><span>${esc(x.by||'')} — ${esc(x.text||'')} <small>${esc(x.date||'')}</small></span></div>`).join('') : '<p class="muted-small">No timeline yet</p>';
}
function commentsHTML(t){
  const c=[...(t.comments||[]), ...(t.notes||[]).map(n=>({by:n.by,date:n.date,time:n.time,text:n.note}))];
  return c.length ? c.slice().reverse().map(x=>`<div class="comment"><b>${esc(x.by||'User')}</b><small>${esc(x.date||'')} ${esc(x.time||'')}</small><p>${esc(x.text||'')}</p></div>`).join('') : '<p class="muted-small">No comments yet</p>';
}
function workVersionsHTML(t){
  const w=t.workFiles||[];
  if(!w.length)return '<p class="muted-small">No final work uploaded</p>';
  return `<div class="file-list">${w.slice().reverse().map(f=>`<a class="file-chip" href="${esc(f.url)}" target="_blank" rel="noopener"><span>${f.kind==='image'?'🖼️':f.kind==='video'?'🎬':'📎'}</span><b>V${esc(f.version||1)} — ${esc(f.name)}</b><small>${esc(f.uploadedBy||'')} • ${esc(f.uploadedAt||'')}</small></a>`).join('')}</div>`;
}


async function seed(){
  const settingsRef = doc(db,'settings','office');
  const snap = await getDoc(settingsRef);
  if(!snap.exists()) await setDoc(settingsRef,{start:'10:00',end:'19:00',graceMinutes:10,breakMinutes:45,monthlyLeaves:2,weekend:'Sunday',announcement:'Welcome to Office Attendance System'});
  const depSnap = await getDocs(collection(db,'departments'));
  if(depSnap.empty){
    for (const name of ['Design','Social Media','Website','Listing','Marketing','Photoshoot']) await addDoc(collection(db,'departments'),{name});
  }
}
async function loadAll(){
  const [emp,dep,task,att,act,leave,set] = await Promise.all([
    getDocs(collection(db,'employees')), getDocs(collection(db,'departments')), getDocs(collection(db,'tasks')), getDocs(collection(db,'attendance')), getDocs(collection(db,'activity')), getDocs(collection(db,'leave_requests')), getDoc(doc(db,'settings','office'))
  ]);
  state.employees = emp.docs.map(d=>({id:d.id,...d.data()}));
  state.departments = dep.docs.map(d=>({id:d.id,...d.data()}));
  state.tasks = task.docs.map(d=>({id:d.id,...d.data()}));
  state.attendance = att.docs.map(d=>({id:d.id,...d.data()}));
  state.activity = act.docs.map(d=>({id:d.id,...d.data()}));
  state.leaveRequests = leave.docs.map(d=>({id:d.id,...d.data()}));
  state.settings = set.data()||{};
}
async function refresh(){ await loadAll(); drawCurrent(); }

function showApp(role){
  $('#loginPage').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#adminNav').classList.toggle('hidden', role!=='admin'); $('#employeeNav').classList.toggle('hidden', role!=='employee');
  $('#userBadge').innerHTML = role==='admin' ? `${state.settings.logoUrl?`<img class="avatar small-avatar" src="${esc(state.settings.logoUrl)}">`:''} Admin` : `${avatarHTML(state.employee,true)} ${esc(state.employee?.name||'Employee')}`;
  $('#todayText').textContent = new Date().toDateString();
  switchView(role==='admin'?'adminDashboard':'employeeDashboard');
}
function switchView(id){
  $$('.view').forEach(v=>v.classList.add('hidden')); $('#'+id).classList.remove('hidden');
  $$('.nav button').forEach(b=>b.classList.toggle('active', b.dataset.view===id));
  $('#pageTitle').textContent = id.includes('employee') ? `Good morning ${state.employee?.name||''}` : 'Good morning Admin';
  drawCurrent();
}

$$('.switcher button').forEach(btn=>btn.onclick=()=>{$$('.switcher button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$('#adminLogin').classList.toggle('hidden',btn.dataset.login!=='admin');$('#employeeLogin').classList.toggle('hidden',btn.dataset.login!=='employee')});
$$('.nav button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#logoutBtn').onclick=()=>location.reload();
$('#adminLogin').onsubmit=async e=>{e.preventDefault(); if($('#adminEmail').value.trim()==='admin@office.com' && $('#adminPassword').value.trim()==='admin123'){try{state.role='admin'; await seed(); await loadAll(); showApp('admin')}catch(err){console.error(err);toast('Firebase rules/permission issue')}} else toast('Wrong admin login')};
$('#employeeLogin').onsubmit=async e=>{e.preventDefault(); try{await loadAll(); const emp=state.employees.find(x=>x.empId===$('#employeeLoginId').value.trim() && x.password===$('#employeeLoginPassword').value.trim()); if(emp){state.role='employee'; state.employee=emp; showApp('employee')} else toast('Wrong employee ID or password')}catch(err){console.error(err);toast('Firebase rules/permission issue')}};

function todayRecords(){return state.attendance.filter(a=>a.date===today())}
function currentStatus(empId){ if(isSundayDate(today())) return 'Sunday Leave'; const r=todayRecords().find(a=>a.empId===empId); return r?.status||'Absent'}
function minutes(t){ if(!t) return null; const m=String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i); if(!m) return null; let h=+m[1], min=+m[2]; if(m[3]){ const ap=m[3].toUpperCase(); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0;} return h*60+min; }
function fmtHours(min){ if(!min || min<0) return '--'; const h=Math.floor(min/60), m=min%60; return `${h}h ${m}m`; }
function recWorkHours(r){ const a=minutes(r?.entry), b=minutes(r?.exit); return (a!=null && b!=null) ? fmtHours(b-a) : '--'; }
function isLate(r){ const st=minutes(state.settings.start||'10:00'), en=minutes(r?.entry), g=Number(state.settings.graceMinutes||0); return st!=null && en!=null && en>st+g; }
function overtime(r){ const end=minutes(state.settings.end||'19:00'), ex=minutes(r?.exit); return (end!=null && ex!=null && ex>end) ? fmtHours(ex-end) : '--'; }
async function logActivity(empId, text, type='log'){ await addDoc(collection(db,'activity'),{empId,text,type,date:today(),time:nowTime(),createdAt:serverTimestamp()}); }
function liveStatus(empId){ const r=todayRecords().find(a=>a.empId===empId); const task=state.tasks.find(t=>t.empId===empId && ['progress','review'].includes(t.status)); if(!r) return {label:'Offline', cls:'absent'}; if(r.status==='Break') return {label:'On Break', cls:'break'}; if(r.status==='Exited') return {label:'Offline', cls:'absent'}; if(task) return {label:`Working: ${task.business||task.title}`, cls:'progress'}; return {label:'Working', cls:'present'}; }

function drawCurrent(){ const active=document.querySelector('.view:not(.hidden)'); if(!active) return; ({adminDashboard,employeesView,departmentsView,tasksView,attendanceView,requestsView,settingsView,employeeDashboard,employeeTasksView,employeeSummaryView,employeeMessageView}[active.id]||(()=>{}))(); }
function statCards(){const rec=todayRecords(); const present=rec.filter(r=>['Present','Break','Exited'].includes(r.status)).length; const review=state.tasks.filter(t=>t.status==='review').length; const absent=isSundayDate(today())?0:Math.max(0,state.employees.length-present); return `<div class="grid cards"><div class="card stat"><p>Total Employees</p><h3>${state.employees.length}</h3></div><div class="card stat"><p>Present Today</p><h3>${present}</h3></div><div class="card stat"><p>Absent Today</p><h3>${absent}</h3></div><div class="card stat"><p>Waiting Review</p><h3>${review}</h3></div></div>`}
function adminDashboard(){
  const live = state.employees.map(e=>{const st=liveStatus(e.empId);return `<div class="live-row"><b>${esc(e.name)}</b><span class="status ${st.cls}">${esc(st.label)}</span></div>`}).join('') || '<p>No employees yet</p>';
  const completed = state.tasks.filter(t=>t.status==='complete').length;
  const leaderboard = state.employees.map(e=>({e,pts:monthlyTaskPoints(e.empId)})).sort((a,b)=>b.pts-a.pts).map(x=>`<div class="live-row"><b>${avatarHTML(x.e,true)} ${esc(x.e.name)}</b><span class="status complete">${x.pts} pts</span></div>`).join('') || '<p>No points yet</p>';
  const pendingLeaves = state.leaveRequests.filter(l=>l.status==='pending').length;
  $('#adminDashboard').innerHTML = `${statCards()}<div class="grid two" style="margin-top:18px"><div class="card"><h3>Task Status Graph</h3><div class="chart">${['todo','progress','review','complete'].map(s=>`<div class="bar" title="${s}" style="height:${20+state.tasks.filter(t=>t.status===s).length*28}px"></div>`).join('')}</div></div><div class="card"><h3>Task Report</h3><p class="notice">${esc(state.settings.announcement||'')}</p><h2>${completed}/${state.tasks.length}</h2><p>Tasks completed</p></div></div><div class="grid two" style="margin-top:18px"><div class="card"><h3>Live Team Status</h3>${live}</div><div class="card"><h3>Recent Task Activity</h3><p class="notice">Pending Leave Requests: ${pendingLeaves}</p>${state.activity.filter(a=>a.date===today()).slice(-8).reverse().map(a=>`<div class="timeline-item"><b>${a.time}</b><span>${esc(empName(a.empId))} — ${esc(a.text)}</span></div>`).join('')||'<p>No activity today</p>'}</div></div><div class="card"><h3>This Month Points Leaderboard</h3>${leaderboard}</div>`;
}
function employeesView(){
  const depOpts = state.departments.map(d=>`<option>${esc(d.name)}</option>`).join('');
  $('#employeesView').innerHTML = `<div class="card"><h3>Add Employee</h3><form id="empForm" class="form-grid"><input name="name" placeholder="Employee name" required><input name="empId" placeholder="Employee ID e.g. EMP001" required><input name="password" placeholder="Password" required><select name="department">${depOpts}</select><input name="role" placeholder="Role"><input name="phone" placeholder="Phone"><input name="paidLeaves" type="number" min="0" value="${esc(state.settings.monthlyLeaves||2)}" placeholder="Paid leaves/month"><input name="photoUrl" placeholder="Profile photo URL"><button class="primary-btn">Add Employee</button></form></div><div class="card"><h3>Employees</h3><div class="table-wrap"><table class="table"><tr><th>Employee</th><th>ID</th><th>Department</th><th>Paid Leave</th><th>Used</th><th>This Month Points</th><th>Status</th><th>Live</th><th>Action</th></tr>${state.employees.map(e=>{const st=liveStatus(e.empId);return `<tr><td>${avatarHTML(e,true)} ${esc(e.name)}</td><td>${esc(e.empId)}</td><td>${esc(e.department||'-')}</td><td>${employeePaidLimit(e)}</td><td>${approvedLeaveDays(e.empId)}</td><td>${monthlyTaskPoints(e.empId)}</td><td><span class="status ${currentStatus(e.empId).toLowerCase().replaceAll(' ','-')}">${currentStatus(e.empId)}</span></td><td><span class="status ${st.cls}">${esc(st.label)}</span></td><td><button class="ghost-btn" onclick="window.editEmployee('${e.id}')">Edit</button> <button class="danger-btn" onclick="window.delEmployee('${e.id}')">Delete</button></td></tr>`}).join('')}</table></div></div>`;
  $('#empForm').onsubmit=async ev=>{ev.preventDefault(); const data=Object.fromEntries(new FormData(ev.target)); if(state.employees.some(e=>e.empId===data.empId)) return toast('Employee ID already exists'); await addDoc(collection(db,'employees'),data); toast('Employee added'); await refresh();};
}
window.delEmployee=async id=>{ const ok=await modalConfirm({title:'Delete Employee',message:'Employee delete karne ke baad ye list se remove ho jayega.',confirmText:'Delete Employee',danger:true}); if(ok){await deleteDoc(doc(db,'employees',id)); toast('Employee deleted'); await refresh();} };
window.editEmployee=async id=>{ const e=state.employees.find(x=>x.id===id); if(!e)return; const data=await modalForm({title:'Edit Employee',submitText:'Save Employee',fields:[{name:'name',label:'Employee Name',value:e.name||'',required:true},{name:'empId',label:'Employee ID',value:e.empId||'',required:true},{name:'password',label:'Password',value:e.password||'',required:true},{name:'department',label:'Department',type:'select',value:e.department||'',options:state.departments.map(d=>d.name)},{name:'role',label:'Role',value:e.role||''},{name:'phone',label:'Phone',value:e.phone||''},{name:'paidLeaves',label:'Paid Leaves / Month',type:'number',value:e.paidLeaves||state.settings.monthlyLeaves||2},{name:'photoUrl',label:'Profile Photo URL',type:'url',value:e.photoUrl||'',placeholder:'https://...'}]}); if(!data)return; await updateDoc(doc(db,'employees',id),data); toast('Employee updated'); await refresh(); };
function departmentsView(){
  $('#departmentsView').innerHTML = `<div class="card"><h3>Departments</h3><form id="depForm" class="form-grid"><input name="name" placeholder="Department name" required><button class="primary-btn">Add Department</button></form><table class="table"><tr><th>Name</th><th>Action</th></tr>${state.departments.map(d=>`<tr><td>${esc(d.name)}</td><td><button class="ghost-btn" onclick="window.editDepartment('${d.id}')">Edit</button> <button class="danger-btn" onclick="window.delDepartment('${d.id}')">Delete</button></td></tr>`).join('')}</table></div>`;
  $('#depForm').onsubmit=async ev=>{ev.preventDefault(); const data=Object.fromEntries(new FormData(ev.target)); if(state.departments.some(d=>String(d.name).toLowerCase()===String(data.name).toLowerCase())) return toast('Department already exists'); await addDoc(collection(db,'departments'),data); toast('Department added'); await refresh();};
}
window.delDepartment=async id=>{ const ok=await modalConfirm({title:'Delete Department',message:'Department delete karna hai?',confirmText:'Delete Department',danger:true}); if(ok){await deleteDoc(doc(db,'departments',id)); toast('Department deleted'); await refresh();} };
window.editDepartment=async id=>{ const d=state.departments.find(x=>x.id===id); if(!d)return; const data=await modalForm({title:'Edit Department',submitText:'Update Department',fields:[{name:'name',label:'Department Name',value:d.name||'',required:true}]}); if(!data)return; await updateDoc(doc(db,'departments',id),data); toast('Department updated'); await refresh(); };

function tasksView(){
  const depOpts = state.departments.map(d=>`<option>${esc(d.name)}</option>`).join('');
  const empOpts = state.employees.map(e=>`<option value="${esc(e.empId)}">${esc(e.name)} (${esc(e.empId)})</option>`).join('');
  const fEmp = `<option>All</option>${state.employees.map(e=>`<option value="${esc(e.empId)}" ${taskFilters.employee===e.empId?'selected':''}>${esc(e.name)}</option>`).join('')}`;
  $('#tasksView').innerHTML = `<div class="card"><h3>Version 3 — Task Management</h3><form id="taskForm" class="form-grid"><input name="title" placeholder="Task title" required><input name="taskCode" placeholder="Task code auto / manual"><select name="business"><option>SBX Media</option><option>SIA Jewels</option><option>YOLOX Fashion</option><option>Personal</option></select><select name="department">${depOpts}</select><select name="empId" required><option value="">Assign employee</option>${empOpts}</select><select name="priority"><option>Low</option><option selected>Medium</option><option>High</option><option>Urgent</option></select><input name="dueDate" type="date"><input name="estimatedHours" type="number" min="0" step="0.5" placeholder="Estimated hours"><textarea name="description" placeholder="Task description / instructions"></textarea><input name="referenceLink" type="url" placeholder="Reference Link (Google Drive / Canva / Figma / YouTube)"><button class="primary-btn">Create Task</button></form></div><div class="card"><h3>Task Filters</h3><div class="filter-row"><select id="filterBusiness"><option>All</option><option>SBX Media</option><option>SIA Jewels</option><option>YOLOX Fashion</option><option>Personal</option></select><select id="filterStatus"><option>All</option><option value="todo">To Do</option><option value="progress">In Progress</option><option value="review">Review</option><option value="complete">Completed</option></select><select id="filterEmp">${fEmp}</select><input id="filterSearch" placeholder="Search task/code"><button id="clearFilters" class="ghost-btn">Clear</button></div>${kanbanBoard(filteredTasks(), true)}</div>`;
  $('#filterBusiness').value=taskFilters.business; $('#filterStatus').value=taskFilters.status; $('#filterSearch').value=taskFilters.search;
  $('#taskForm').onsubmit=async ev=>{ev.preventDefault(); const fd=new FormData(ev.target); const data=Object.fromEntries(fd); if(!data.taskCode) data.taskCode=makeTaskCode(data.business,data.department); data.referenceFiles=[]; data.workFiles=[]; data.comments=[]; data.notes=[]; data.history=[historyItem(`Task created and assigned to ${empName(data.empId)}`,'Admin')]; data.status='todo'; data.rating=''; data.points=0; data.createdAt=serverTimestamp(); data.createdDate=today(); data.updatedAt=serverTimestamp(); await addDoc(collection(db,'tasks'),data); await logActivity(data.empId,`New task assigned: ${data.taskCode}`,'task'); toast('Task created'); await refresh();};
  $('#filterBusiness').onchange=e=>{taskFilters.business=e.target.value;tasksView()}; $('#filterStatus').onchange=e=>{taskFilters.status=e.target.value;tasksView()}; $('#filterEmp').onchange=e=>{taskFilters.employee=e.target.value;tasksView()}; $('#filterSearch').oninput=e=>{taskFilters.search=e.target.value;tasksView()}; $('#clearFilters').onclick=()=>{taskFilters={business:'All',status:'All',employee:'All',search:''};tasksView()};
  initKanbanDnd();
}
function makeTaskCode(b,d){ const n=String(state.tasks.length+1).padStart(4,'0'); return `${busShort(b)}-${depShort(d)}-${n}`; }
function filteredTasks(){
  return state.tasks.filter(t=> (taskFilters.business==='All'||t.business===taskFilters.business) && (taskFilters.status==='All'||t.status===taskFilters.status) && (taskFilters.employee==='All'||t.empId===taskFilters.employee) && (!taskFilters.search || String(t.title+t.taskCode+t.description).toLowerCase().includes(taskFilters.search.toLowerCase())) );
}
function kanbanBoard(tasks, admin=false){
  const cols = admin ? ['todo','progress','review','complete'] : ['todo','progress','review'];
  return `<div class="kanban" data-admin="${admin?'1':'0'}">${cols.map(s=>`<div class="kanban-col" data-status="${s}"><div class="kanban-head"><h3>${statusLabel(s)}</h3><span class="count">${tasks.filter(t=>t.status===s).length}</span></div><div class="drop-zone" data-status="${s}">${tasks.filter(t=>t.status===s).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')).map(t=>taskCard(t,admin)).join('') || '<div class="empty">No tasks</div>'}</div></div>`).join('')}</div><p class="drag-hint">Drag task cards between columns. Employee can send only up to Review. Final Complete is admin only.</p>`;
}
function taskCard(t,admin=false){
  const canEmpMove = state.role==='employee' && t.status!=='complete';
  const lock = state.role==='employee' && t.status==='complete';
  const refs=t.referenceLink?1:0, comments=(t.comments||[]).length+(t.notes||[]).length;
  return `<div class="task-card" draggable="${lock?'false':'true'}" data-task-id="${t.id}" data-current-status="${t.status||'todo'}"><div class="task-meta"><span class="mini">${esc(t.taskCode||'NO-CODE')}</span><span class="status ${priorityClass(t.priority)}">${esc(t.priority||'Medium')}</span><span class="mini">${esc(t.business||'-')}</span></div><h4>${esc(t.title)}</h4><p class="task-desc">${esc(t.description||'No description')}</p><div class="task-meta"><span class="mini">👤 ${esc(empName(t.empId))}</span><span class="mini">🏢 ${esc(t.department||'-')}</span><span class="mini">📅 ${dateNice(t.dueDate)} ${daysLeft(t.dueDate)?'• '+daysLeft(t.dueDate):''}</span><span class="mini">⏱ ${esc(t.estimatedHours||'-')}h</span></div><div class="task-meta"><span class="mini">🔗 Ref ${refs}</span><span class="mini">💬 ${comments}</span>${ratingHTML(t)}<span class="mini">⏱ Actual ${esc(t.actualMinutes?fmtHours(Number(t.actualMinutes)):'--')}</span></div>${t.revisionNote?`<p class="revision-note">Revision: ${esc(t.revisionNote)}</p>`:''}<div class="task-actions"><button class="ghost-btn" onclick="window.viewTask('${t.id}')">Details</button>${adminActions(t,admin)}${employeeActions(t,canEmpMove)}</div></div>`;
}
function adminActions(t,admin){ if(!admin)return ''; let html=`<button class="ghost-btn" onclick="window.editTask('${t.id}')">Edit</button><button class="danger-btn" onclick="window.deleteTask('${t.id}')">Delete</button>`; if(t.status==='review') html+=`<button class="ghost-btn" onclick="window.requestRevision('${t.id}')">Need Changes</button><button class="primary-btn" onclick="window.moveTask('${t.id}','complete')">Approve Complete</button>`; if(t.status==='complete') html+=`<button class="ghost-btn" onclick="window.moveTask('${t.id}','review')">Reopen Review</button>`; if(t.status!=='todo' && t.status!=='complete') html+=`<button class="ghost-btn" onclick="window.moveTask('${t.id}','todo')">Back To Do</button>`; return html; }
function employeeActions(t,can){ if(!can)return ''; let timer = t.activeTimerStart ? `<button class="ghost-btn" onclick="window.stopWork('${t.id}')">Stop Timer</button>` : `<button class="ghost-btn" onclick="window.startWork('${t.id}')">Start Timer</button>`; if(t.status==='todo') return `<button class="primary-btn" onclick="window.moveTask('${t.id}','progress')">Start</button>${timer}`; if(t.status==='progress') return `${timer}<button class="primary-btn" onclick="window.moveTask('${t.id}','review')">Send Review</button><button class="ghost-btn" onclick="window.addTaskNote('${t.id}')">Comment</button>`; if(t.status==='review') return `<button class="ghost-btn" onclick="window.addTaskNote('${t.id}')">Comment</button>`; return ''; }
function canMoveTask(t, status){
  if(!t) return {ok:false,msg:'Task not found'};
  if(state.role==='employee'){
    if(t.empId !== state.employee?.empId) return {ok:false,msg:'This task is not assigned to you'};
    if(status==='complete') return {ok:false,msg:'Final Complete only admin karega'};
    if(t.status==='complete') return {ok:false,msg:'Completed task locked hai'};
  }
  if(state.role==='admin' && status==='complete' && t.status!=='review') return {ok:false,msg:'Complete karne se pehle task Review me hona chahiye'};
  return {ok:true};
}
window.moveTask=async (id,status)=>{
  const t=state.tasks.find(x=>x.id===id); const check=canMoveTask(t,status); if(!check.ok) return toast(check.msg);
  const extra={status,updatedAt:serverTimestamp(),lastUpdatedBy:state.role, history:[...(t.history||[]), historyItem(`Status moved to ${statusLabel(status)}`)]};
  if(status==='progress' && !t.startedAt) extra.startedAt=serverTimestamp();
  if(status==='review') extra.reviewAt=serverTimestamp();
  if(status==='complete') { const review=await modalForm({title:'Approve Task & Give Rating',submitText:'Approve Complete',fields:[{name:'rating',label:'Rating 1-5',type:'select',value:'5',options:['5','4','3','2','1']},{name:'reviewComment',label:'Admin Review Comment',type:'textarea',value:'Approved',required:true}]}); if(!review)return; extra.completedAt=serverTimestamp(); extra.completedDate=today(); extra.completedMonth=currentMonth(); extra.completedBy='admin'; const rating=String(Math.max(1,Math.min(5,Number(review.rating)||5))); const reviewComment=review.reviewComment||'Approved'; extra.rating=rating; extra.points=pointsForRating(rating); extra.reviewComment=reviewComment; extra.history.push(historyItem(`Approved with ${rating} star rating (${extra.points} points): ${reviewComment}`,'Admin')); }
  await updateDoc(doc(db,'tasks',id),extra); await logActivity(t.empId,`Task ${t.taskCode} moved to ${statusLabel(status)}`,'task'); toast(status==='complete'?'Task approved and completed':'Task updated'); await refresh();
};
function initKanbanDnd(){
  $$('.task-card[draggable="true"]').forEach(card=>{
    card.ondragstart=e=>{ e.dataTransfer.setData('text/plain', card.dataset.taskId); setTimeout(()=>card.classList.add('dragging'),0); };
    card.ondragend=()=>card.classList.remove('dragging');
  });
  $$('.drop-zone').forEach(zone=>{
    zone.ondragover=e=>{ e.preventDefault(); zone.classList.add('drag-over'); };
    zone.ondragleave=()=>zone.classList.remove('drag-over');
    zone.ondrop=async e=>{ e.preventDefault(); zone.classList.remove('drag-over'); const id=e.dataTransfer.getData('text/plain'); const status=zone.dataset.status; const t=state.tasks.find(x=>x.id===id); if(!t || t.status===status) return; await window.moveTask(id,status); };
  });
}
window.addTaskNote=async id=>{ const t=state.tasks.find(x=>x.id===id); if(!t)return; const data=await modalForm({title:'Add Task Comment',submitText:'Add Comment',fields:[{name:'note',label:'Comment / Update',type:'textarea',required:true,placeholder:'Write your update...'}]}); if(!data?.note)return; const notes=[...(t.notes||[]),{by:state.employee?.name||'Admin',note:data.note,time:nowTime(),date:today()}]; await updateDoc(doc(db,'tasks',id),{notes,updatedAt:serverTimestamp()}); await logActivity(t.empId,`Task note added: ${t.taskCode}`,'task'); toast('Note added'); await refresh(); };
window.editTask=async id=>{ const t=state.tasks.find(x=>x.id===id); if(!t)return; const data=await modalForm({title:'Edit Task',submitText:'Update Task',fields:[{name:'title',label:'Task Title',value:t.title||'',required:true},{name:'business',label:'Business',type:'select',value:t.business||'SBX Media',options:['SBX Media','SIA Jewels','YOLOX Fashion','Personal']},{name:'department',label:'Department',type:'select',value:t.department||'',options:state.departments.map(d=>d.name)},{name:'empId',label:'Assigned Employee',type:'select',value:t.empId||'',options:state.employees.map(e=>({value:e.empId,label:`${e.name} (${e.empId})`}))},{name:'priority',label:'Priority',type:'select',value:t.priority||'Medium',options:['Low','Medium','High','Urgent']},{name:'dueDate',label:'Due Date',type:'date',value:t.dueDate||''},{name:'estimatedHours',label:'Estimated Hours',type:'number',value:t.estimatedHours||''},{name:'referenceLink',label:'Reference Link',type:'url',value:t.referenceLink||'',placeholder:'Google Drive / Canva / Figma link'},{name:'description',label:'Description',type:'textarea',value:t.description||''}]}); if(!data)return; await updateDoc(doc(db,'tasks',id),{...data,updatedAt:serverTimestamp(),history:[...(t.history||[]),historyItem('Task details edited','Admin')]}); await logActivity(data.empId||t.empId,`Task edited: ${t.taskCode}`,'task'); toast('Task edited'); await refresh(); };
window.deleteTask=async id=>{ const t=state.tasks.find(x=>x.id===id); const ok=await modalConfirm({title:'Delete Task',message:`${t?.taskCode||'Task'} delete karna hai?`,confirmText:'Delete Task',danger:true}); if(ok){await deleteDoc(doc(db,'tasks',id)); await logActivity(t.empId,`Task deleted: ${t.taskCode}`,'task'); toast('Task deleted'); await refresh();} };


window.viewTask=(id)=>{ const t=state.tasks.find(x=>x.id===id); if(!t)return; const modal=document.createElement('div'); modal.className='modal-backdrop'; modal.innerHTML=`<div class="modal-card"><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">×</button><h2>${esc(t.taskCode)} — ${esc(t.title)}</h2><div class="task-meta"><span class="status ${priorityClass(t.priority)}">${esc(t.priority)}</span><span class="mini">${esc(t.business)}</span><span class="mini">${esc(t.department)}</span><span class="mini">Assigned: ${esc(empName(t.empId))}</span><span class="mini">Due: ${dateNice(t.dueDate)}</span>${ratingHTML(t)}</div><p class="notice">${esc(t.description||'No description')}</p><div class="modal-grid"><div><h3>Reference Link</h3>${linkHTML(t.referenceLink)}</div><div><h3>Rating & Points</h3>${t.rating?`<div class="score-box"><b>${esc(t.rating)}/5 ⭐</b><span>${pointsForRating(t.rating)} Points</span><p>${esc(t.reviewComment||'')}</p></div>`:'<p class="muted-small">Task complete hone ke baad admin rating dega.</p>'}</div></div><div class="modal-grid"><div><h3>Comments</h3>${commentsHTML(t)}<button class="ghost-btn" onclick="window.addTaskNote('${t.id}')">Add Comment</button></div><div><h3>Timeline</h3>${taskHistoryHTML(t)}</div></div></div>`; document.body.appendChild(modal); };
window.requestRevision=async(id)=>{ const t=state.tasks.find(x=>x.id===id); if(!t)return; const data=await modalForm({title:'Request Revision',submitText:'Send Back To Progress',fields:[{name:'note',label:'Revision Note / Changes Needed',type:'textarea',required:true,placeholder:'Example: logo size increase karo, color change karo...'}]}); if(!data?.note)return; await updateDoc(doc(db,'tasks',id),{status:'progress',revisionNote:data.note,history:[...(t.history||[]),historyItem(`Revision requested: ${data.note}`,'Admin')],updatedAt:serverTimestamp()}); await logActivity(t.empId,`Revision requested: ${t.taskCode}`,'task'); toast('Task sent back to Progress'); await refresh(); };
window.startWork=async(id)=>{ const t=state.tasks.find(x=>x.id===id); await updateDoc(doc(db,'tasks',id),{activeTimerStart:Date.now(),history:[...(t.history||[]),historyItem('Work timer started')],updatedAt:serverTimestamp()}); toast('Timer started'); await refresh(); };
window.stopWork=async(id)=>{ const t=state.tasks.find(x=>x.id===id); if(!t?.activeTimerStart)return; const mins=Math.max(1,Math.round((Date.now()-Number(t.activeTimerStart))/60000)); const logs=[...(t.timeLogs||[]),{start:t.activeTimerStart,end:Date.now(),minutes:mins,by:state.employee?.name||'Employee'}]; await updateDoc(doc(db,'tasks',id),{activeTimerStart:null,timeLogs:logs,actualMinutes:Number(t.actualMinutes||0)+mins,history:[...(t.history||[]),historyItem(`Work timer stopped: ${fmtHours(mins)}`)],updatedAt:serverTimestamp()}); toast(`Timer saved: ${fmtHours(mins)}`); await refresh(); };
function attendanceView(){
  $('#attendanceView').innerHTML = `<div class="card"><h3>Attendance Records</h3><div class="table-wrap"><table class="table"><tr><th>Date</th><th>Employee</th><th>Entry</th><th>Break</th><th>Exit</th><th>Status</th><th>Late</th><th>Work Hours</th><th>OT</th></tr>${state.attendance.slice().reverse().map(r=>`<tr><td>${r.date}</td><td>${esc(empName(r.empId))}</td><td>${r.entry||'-'}</td><td>${r.breakStart||'-'} / ${r.breakEnd||'-'}</td><td>${r.exit||'-'}</td><td><span class="status ${String(r.status).toLowerCase()}">${r.status}</span></td><td>${isLate(r)?'Yes':'No'}</td><td>${recWorkHours(r)}</td><td>${overtime(r)}</td></tr>`).join('')}</table></div></div>`;
}
function leaveTypeText(l){ return l.finalType ? l.finalType : (l.status||'pending'); }
async function setAttendanceForLeave(l, approve=true){
  const emp=state.employees.find(e=>e.empId===l.empId); let paidUsed=approvedLeaveDays(l.empId, monthKey(l.fromDate), true);
  for(const d of daysBetween(l.fromDate,l.toDate)){
    if(isSundayDate(d)) continue;
    const paidLimit=employeePaidLimit(emp); const status = approve ? (paidUsed < paidLimit ? 'Leave' : 'Absent') : 'Rejected';
    if(status==='Leave') paidUsed++;
    const old=state.attendance.find(a=>a.empId===l.empId && a.date===d);
    const data={empId:l.empId,date:d,status,leaveRequestId:l.id,leaveReason:l.reason||'',updatedAt:serverTimestamp()};
    if(old) await updateDoc(doc(db,'attendance',old.id),data); else await addDoc(collection(db,'attendance'),data);
  }
}
function requestsView(){
  const leaves = state.leaveRequests.slice().sort((a,b)=>String(b.createdAt||b.createdDate||'').localeCompare(String(a.createdAt||a.createdDate||'')));
  const messages = state.activity.filter(a=>a.type==='message').slice().reverse();
  $('#requestsView').innerHTML = `<div class="card"><h3>Leave Requests</h3><div class="table-wrap"><table class="table"><tr><th>Employee</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th>Paid Limit</th><th>Used</th><th>Action</th></tr>${leaves.map(l=>{const emp=state.employees.find(e=>e.empId===l.empId);return `<tr><td>${avatarHTML(emp,true)} ${esc(empName(l.empId))}</td><td>${esc(l.fromDate||'-')}</td><td>${esc(l.toDate||l.fromDate||'-')}</td><td>${esc(l.reason||'-')}</td><td><span class="status ${String(l.status||'pending')}">${esc(leaveTypeText(l))}</span></td><td>${employeePaidLimit(emp)}</td><td>${approvedLeaveDays(l.empId, monthKey(l.fromDate||today()))}</td><td>${l.status==='pending'?`<button class="primary-btn" onclick="window.approveLeave('${l.id}')">Approve</button> <button class="danger-btn" onclick="window.rejectLeave('${l.id}')">Reject</button>`:'-'}</td></tr>`}).join('')||'<tr><td colspan="8">No leave requests</td></tr>'}</table></div></div><div class="card"><h3>Messages</h3>${messages.map(a=>`<div class="timeline-item"><b>${a.date}</b><span>${esc(empName(a.empId))}: ${esc(a.text)}</span></div>`).join('')||'<p>No messages yet</p>'}</div>`;
}
window.approveLeave=async id=>{ const l=state.leaveRequests.find(x=>x.id===id); if(!l)return; await setAttendanceForLeave(l,true); await updateDoc(doc(db,'leave_requests',id),{status:'approved',approvedAt:serverTimestamp(),approvedDate:today()}); await logActivity(l.empId,`Leave approved: ${l.fromDate} to ${l.toDate||l.fromDate}`,'leave'); toast('Leave approved'); await refresh(); };
window.rejectLeave=async id=>{ const l=state.leaveRequests.find(x=>x.id===id); if(!l)return; const data=await modalForm({title:'Reject Leave Request',submitText:'Reject Leave',fields:[{name:'note',label:'Reject Reason',type:'textarea',value:'Not approved',required:true}]}); if(!data)return; const note=data.note||'Not approved'; await updateDoc(doc(db,'leave_requests',id),{status:'rejected',adminNote:note,rejectedAt:serverTimestamp()}); await logActivity(l.empId,`Leave rejected: ${note}`,'leave'); toast('Leave rejected'); await refresh(); };
function settingsView(){
  $('#settingsView').innerHTML = `<div class="card"><h3>Office Settings</h3><form id="settingsForm" class="form-grid"><input name="start" value="${esc(state.settings.start||'10:00')}" placeholder="Start time"><input name="end" value="${esc(state.settings.end||'19:00')}" placeholder="End time"><input name="graceMinutes" value="${esc(state.settings.graceMinutes||10)}" placeholder="Grace minutes"><input name="breakMinutes" value="${esc(state.settings.breakMinutes||45)}" placeholder="Break minutes"><input name="monthlyLeaves" value="${esc(state.settings.monthlyLeaves||2)}" placeholder="Monthly leaves"><input name="weekend" value="${esc(state.settings.weekend||'Sunday')}" placeholder="Weekend"><input name="logoUrl" value="${esc(state.settings.logoUrl||'')}" placeholder="Company logo URL"><textarea name="announcement" placeholder="Announcement">${esc(state.settings.announcement||'')}</textarea><button class="primary-btn">Save Settings</button></form></div>`;
  $('#settingsForm').onsubmit=async ev=>{ev.preventDefault(); await setDoc(doc(db,'settings','office'),Object.fromEntries(new FormData(ev.target)),{merge:true}); toast('Settings saved'); await refresh();};
}

function employeeDashboard(){
  const my=state.employee.empId; const rec=todayRecords().find(a=>a.empId===my); const tasks=state.tasks.filter(t=>t.empId===my);
  $('#employeeDashboard').innerHTML = `<div class="grid cards"><div class="card stat"><p>Today Status</p><h3>${rec?.status||'Absent'}</h3></div><div class="card stat"><p>My Tasks</p><h3>${tasks.length}</h3></div><div class="card stat"><p>In Progress</p><h3>${tasks.filter(t=>t.status==='progress').length}</h3></div><div class="card stat"><p>Completed</p><h3>${tasks.filter(t=>t.status==='complete').length}</h3></div><div class="card stat"><p>This Month Points</p><h3>${monthlyTaskPoints(my)}</h3></div></div><div class="grid two" style="margin-top:18px"><div class="card"><h3>Attendance Actions</h3><div class="actions"><button class="primary-btn" onclick="window.markAttendance('entry')">Entry</button><button class="ghost-btn" onclick="window.markAttendance('breakStart')">Break Start</button><button class="ghost-btn" onclick="window.markAttendance('breakEnd')">Break End</button><button class="danger-btn" onclick="window.markAttendance('exit')">Exit</button></div><p class="notice">Entry: ${rec?.entry||'-'} | Break: ${rec?.breakStart||'-'} / ${rec?.breakEnd||'-'} | Exit: ${rec?.exit||'-'}</p></div><div class="card"><h3>Due Today / Review</h3>${tasks.filter(t=>t.dueDate===today()||t.status==='review').map(t=>taskCard(t,false)).join('')||'<p>No due task today</p>'}</div></div>`;
}
window.markAttendance=async type=>{ const emp=state.employee.empId; const rec=state.attendance.find(a=>a.empId===emp && a.date===today()); const data={empId:emp,date:today(),updatedAt:serverTimestamp()}; if(type==='entry'){data.entry=nowTime();data.status='Present'} if(type==='breakStart'){data.breakStart=nowTime();data.status='Break'} if(type==='breakEnd'){data.breakEnd=nowTime();data.status='Present'} if(type==='exit'){data.exit=nowTime();data.status='Exited'} if(rec) await updateDoc(doc(db,'attendance',rec.id),data); else await addDoc(collection(db,'attendance'),data); await logActivity(emp, type.replace(/([A-Z])/g,' $1'),'attendance'); toast('Attendance updated'); await refresh(); };
function employeeTasksView(){
  const tasks=state.tasks.filter(t=>t.empId===state.employee.empId).filter(t=>(empTaskFilters.business==='All'||t.business===empTaskFilters.business) && (empTaskFilters.status==='All'||t.status===empTaskFilters.status) && (!empTaskFilters.search||String(t.title+t.taskCode+t.description).toLowerCase().includes(empTaskFilters.search.toLowerCase())));
  $('#employeeTasksView').innerHTML = `<div class="card"><h3>My Trello Style Task Board</h3><div class="filter-row"><select id="empFilterBusiness"><option>All</option><option>SBX Media</option><option>SIA Jewels</option><option>YOLOX Fashion</option><option>Personal</option></select><select id="empFilterStatus"><option>All</option><option value="todo">To Do</option><option value="progress">In Progress</option><option value="review">Review</option><option value="complete">Completed</option></select><input id="empFilterSearch" placeholder="Search my task"><button id="empClearFilters" class="ghost-btn">Clear</button></div>${kanbanBoard(tasks,false)}</div>`;
  $('#empFilterBusiness').value=empTaskFilters.business; $('#empFilterStatus').value=empTaskFilters.status; $('#empFilterSearch').value=empTaskFilters.search;
  $('#empFilterBusiness').onchange=e=>{empTaskFilters.business=e.target.value;employeeTasksView()}; $('#empFilterStatus').onchange=e=>{empTaskFilters.status=e.target.value;employeeTasksView()}; $('#empFilterSearch').oninput=e=>{empTaskFilters.search=e.target.value;employeeTasksView()}; $('#empClearFilters').onclick=()=>{empTaskFilters={business:'All',status:'All',search:''};employeeTasksView()};
  initKanbanDnd();
}
function employeeSummaryView(){ const my=state.employee.empId; const rows=state.attendance.filter(a=>a.empId===my); const tasks=state.tasks.filter(t=>t.empId===my); const completed=tasks.filter(t=>t.status==='complete'); const points=monthlyTaskPoints(my); const leaveUsed=approvedLeaveDays(my); const paidLimit=employeePaidLimit(state.employee); const avg=completed.length?(completed.reduce((s,t)=>s+Number(t.rating||0),0)/completed.length).toFixed(1):'--'; $('#employeeSummaryView').innerHTML = `<div class="grid cards"><div class="card stat"><p>Total Days</p><h3>${rows.length}</h3></div><div class="card stat"><p>Completed Tasks</p><h3>${completed.length}</h3></div><div class="card stat"><p>This Month Points</p><h3>${points}</h3></div><div class="card stat"><p>Leaves Used</p><h3>${leaveUsed}/${paidLimit}</h3></div><div class="card stat"><p>Average Rating</p><h3>${avg} ⭐</h3></div></div><div class="card"><h3>Completed Task Ratings</h3>${completed.map(t=>`<div class="live-row"><b>${esc(t.taskCode)} — ${esc(t.title)}</b><span class="status complete">${esc(t.rating||'-')}/5 • ${Number(t.points||pointsForRating(t.rating))} pts</span></div>`).join('')||'<p>No rated task yet</p>'}</div><div class="card"><h3>Monthly Graph</h3><div class="chart">${rows.slice(-20).map(r=>`<div class="bar" style="height:${r.exit?120:60}px" title="${r.date}"></div>`).join('')}</div></div>`; }
function employeeMessageView(){
  const myLeaves=state.leaveRequests.filter(l=>l.empId===state.employee.empId).slice().reverse();
  $('#employeeMessageView').innerHTML = `<div class="grid two"><div class="card"><h3>Send Message</h3><form id="msgForm" class="form-grid"><input name="subject" placeholder="Subject"><textarea name="text" placeholder="Write message to admin" required></textarea><button class="primary-btn">Send Message</button></form></div><div class="card"><h3>Leave Request</h3><form id="leaveForm" class="form-grid"><input name="fromDate" type="date" required><input name="toDate" type="date"><textarea name="reason" placeholder="Why do you need leave?" required></textarea><button class="primary-btn">Request Leave</button></form><p class="notice">This month leave used: ${approvedLeaveDays(state.employee.empId)}/${employeePaidLimit(state.employee)} paid leaves. Sunday automatic leave hai, absent count nahi hoga.</p></div></div><div class="card"><h3>My Leave Requests</h3><div class="table-wrap"><table class="table"><tr><th>From</th><th>To</th><th>Reason</th><th>Status</th><th>Admin Note</th></tr>${myLeaves.map(l=>`<tr><td>${esc(l.fromDate)}</td><td>${esc(l.toDate||l.fromDate)}</td><td>${esc(l.reason)}</td><td><span class="status ${String(l.status)}">${esc(l.status)}</span></td><td>${esc(l.adminNote||'-')}</td></tr>`).join('')||'<tr><td colspan="5">No leave request</td></tr>'}</table></div></div>`;
  $('#msgForm').onsubmit=async ev=>{ev.preventDefault(); const d=Object.fromEntries(new FormData(ev.target)); await logActivity(state.employee.empId,`${d.subject?d.subject+': ':''}${d.text}`,'message'); toast('Message sent'); ev.target.reset();};
  $('#leaveForm').onsubmit=async ev=>{ev.preventDefault(); const d=Object.fromEntries(new FormData(ev.target)); if(!d.toDate)d.toDate=d.fromDate; await addDoc(collection(db,'leave_requests'),{empId:state.employee.empId,fromDate:d.fromDate,toDate:d.toDate,reason:d.reason,status:'pending',createdDate:today(),createdTime:nowTime(),createdAt:serverTimestamp()}); await logActivity(state.employee.empId,`Leave requested: ${d.fromDate} to ${d.toDate}`,'leave'); toast('Leave request sent'); ev.target.reset(); await refresh();};
}


setInterval(()=>{ if(!$('#app').classList.contains('hidden')) refresh(); }, 60000);
