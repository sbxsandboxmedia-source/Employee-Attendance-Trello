import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

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
const today = () => new Date().toISOString().slice(0,10);
const nowTime = () => new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
let state = { role:null, employee:null, employees:[], departments:[], tasks:[], attendance:[], activity:[], settings:{} };

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }
function id(prefix){ return prefix + Math.floor(1000 + Math.random()*9000); }
function titleCase(x){return (x||'').replace(/([A-Z])/g,' $1').replace(/^./,m=>m.toUpperCase())}

async function seed(){
  const settingsRef = doc(db,'settings','office');
  const snap = await getDoc(settingsRef);
  if(!snap.exists()) await setDoc(settingsRef,{start:'10:00',end:'19:00',graceMinutes:10,breakMinutes:45,monthlyLeaves:2,weekend:'Sunday',announcement:'Welcome to Office Attendance System'});
  const depSnap = await getDocs(collection(db,'departments'));
  if(depSnap.empty){ await addDoc(collection(db,'departments'),{name:'Design'}); await addDoc(collection(db,'departments'),{name:'Marketing'}); await addDoc(collection(db,'departments'),{name:'Development'}); }
}
async function loadAll(){
  const [emp,dep,task,att,act,set] = await Promise.all([
    getDocs(collection(db,'employees')), getDocs(collection(db,'departments')), getDocs(collection(db,'tasks')), getDocs(collection(db,'attendance')), getDocs(collection(db,'activity')), getDoc(doc(db,'settings','office'))
  ]);
  state.employees = emp.docs.map(d=>({id:d.id,...d.data()}));
  state.departments = dep.docs.map(d=>({id:d.id,...d.data()}));
  state.tasks = task.docs.map(d=>({id:d.id,...d.data()}));
  state.attendance = att.docs.map(d=>({id:d.id,...d.data()}));
  state.activity = act.docs.map(d=>({id:d.id,...d.data()}));
  state.settings = set.data()||{};
}

function showApp(role){
  $('#loginPage').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#adminNav').classList.toggle('hidden', role!=='admin'); $('#employeeNav').classList.toggle('hidden', role!=='employee');
  $('#userBadge').textContent = role==='admin'?'Admin':state.employee?.name;
  $('#todayText').textContent = new Date().toDateString();
  switchView(role==='admin'?'adminDashboard':'employeeDashboard');
}
function switchView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden')); $('#'+id).classList.remove('hidden');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active', b.dataset.view===id));
  $('#pageTitle').textContent = id.includes('employee') ? `Good morning ${state.employee?.name||''}` : 'Good morning Admin';
  render();
}

document.querySelectorAll('.switcher button').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.switcher button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$('#adminLogin').classList.toggle('hidden',btn.dataset.login!=='admin');$('#employeeLogin').classList.toggle('hidden',btn.dataset.login!=='employee')});
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#logoutBtn').onclick=()=>location.reload();
$('#adminLogin').onsubmit=async e=>{
  e.preventDefault();
  const email=$('#adminEmail').value.trim();
  const pass=$('#adminPassword').value.trim();
  if(email==='admin@office.com' && pass==='admin123'){
    try{
      state.role='admin';
      await seed();
      await loadAll();
      showApp('admin');
    }catch(err){
      console.error(err);
      toast('Firebase permission/rules issue. Firestore test mode ON karo.');
    }
  } else toast('Wrong admin login');
};
$('#employeeLogin').onsubmit=async e=>{
  e.preventDefault();
  try{
    await loadAll();
    const emp=state.employees.find(x=>x.empId===$('#employeeLoginId').value.trim() && x.password===$('#employeeLoginPassword').value.trim());
    if(emp){state.role='employee'; state.employee=emp; showApp('employee')} else toast('Wrong employee ID or password');
  }catch(err){
    console.error(err);
    toast('Firebase permission/rules issue. Firestore test mode ON karo.');
  }
};

function todayRecords(){return state.attendance.filter(a=>a.date===today())}
function currentStatus(empId){const r=todayRecords().find(a=>a.empId===empId); return r?.status||'Absent'}

function minutes(t){ if(!t) return null; const m=String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i); if(!m) return null; let h=+m[1], min=+m[2]; if(m[3]){ const ap=m[3].toUpperCase(); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0;} return h*60+min; }
function fmtHours(min){ if(!min || min<0) return '--'; const h=Math.floor(min/60), m=min%60; return `${h}h ${m}m`; }
function recWorkHours(r){ const a=minutes(r?.entry), b=minutes(r?.exit); return (a!=null && b!=null) ? fmtHours(b-a) : '--'; }
function isLate(r){ const st=minutes(state.settings.start||'10:00'), en=minutes(r?.entry), g=Number(state.settings.graceMinutes||0); return st!=null && en!=null && en>st+g; }
function overtime(r){ const end=minutes(state.settings.end||'19:00'), ex=minutes(r?.exit); return (end!=null && ex!=null && ex>end) ? fmtHours(ex-end) : '--'; }
async function logActivity(empId, text, type='log'){ await addDoc(collection(db,'activity'),{empId,text,type,date:today(),time:nowTime(),createdAt:serverTimestamp()}); }
function liveStatus(empId){ const r=todayRecords().find(a=>a.empId===empId); const task=state.tasks.find(t=>t.empId===empId && ['progress','review'].includes(t.status)); if(!r) return {label:'Offline', cls:'absent'}; if(r.status==='Break') return {label:'On Break', cls:'break'}; if(r.status==='Exited') return {label:'Offline', cls:'absent'}; if(task) return {label:`Working: ${task.business||task.title}`, cls:'progress'}; return {label:'Working', cls:'present'}; }

function statCards(){const rec=todayRecords(); const present=rec.filter(r=>['Present','Break','Exited'].includes(r.status)).length; const br=rec.filter(r=>r.status==='Break').length; return `<div class="grid cards"><div class="card stat"><p>Total Employees</p><h3>${state.employees.length}</h3></div><div class="card stat"><p>Present Today</p><h3>${present}</h3></div><div class="card stat"><p>Absent Today</p><h3>${Math.max(0,state.employees.length-present)}</h3></div><div class="card stat"><p>On Break</p><h3>${br}</h3></div></div>`}
function render(){
  if(!$('#app').classList.contains('hidden')) loadAll().then(()=>{ if(!$('.view:not(.hidden)')) return; drawCurrent(); });
}
function drawCurrent(){ const id=document.querySelector('.view:not(.hidden)').id; ({adminDashboard,employeesView,departmentsView,tasksView,attendanceView,requestsView,settingsView,employeeDashboard,employeeTasksView,employeeSummaryView,employeeMessageView}[id]||(()=>{}))(); }

function adminDashboard(){
  const completed = state.tasks.filter(t=>t.status==='complete').length;
  const live = state.employees.map(e=>{const st=liveStatus(e.empId);return `<div class="live-row"><b>${e.name}</b><span class="status ${st.cls}">${st.label}</span></div>`}).join('') || '<p>No employees yet</p>';
  $('#adminDashboard').innerHTML = `${statCards()}<div class="grid two" style="margin-top:18px"><div class="card"><h3>Attendance Graph</h3><div class="chart">${state.employees.map(e=>`<div class="bar" title="${e.name}" style="height:${currentStatus(e.empId)==='Absent'?20:120}px"></div>`).join('')}</div></div><div class="card"><h3>Task Report</h3><p class="notice">${state.settings.announcement||''}</p><h2>${completed}/${state.tasks.length}</h2><p>Tasks completed</p></div></div><div class="grid two" style="margin-top:18px"><div class="card"><h3>Live Team Status</h3>${live}</div><div class="card"><h3>Recent Activity</h3>${state.activity.filter(a=>a.date===today()).slice(-8).reverse().map(a=>`<div class="timeline-item"><b>${a.time}</b><span>${empName(a.empId)} — ${a.text}</span></div>`).join('')||'<p>No activity today</p>'}</div></div>`;
}
function employeesView(){
  const depOpts = state.departments.map(d=>`<option>${d.name}</option>`).join('');
  $('#employeesView').innerHTML = `<div class="card"><h3>Add Employee</h3><form id="empForm" class="form-grid"><input name="name" placeholder="Employee name" required><input name="empId" placeholder="Employee ID e.g. EMP001" required><input name="password" placeholder="Password" required><select name="department">${depOpts}</select><input name="role" placeholder="Role"><input name="phone" placeholder="Phone"><button class="primary-btn">Add Employee</button></form></div><div class="card"><h3>Employees</h3><table class="table"><tr><th>Name</th><th>ID</th><th>Department</th><th>Status</th><th>Live</th><th>Action</th></tr>${state.employees.map(e=>{const st=liveStatus(e.empId);return `<tr><td>${e.name}</td><td>${e.empId}</td><td>${e.department||'-'}</td><td><span class="status ${currentStatus(e.empId).toLowerCase()}">${currentStatus(e.empId)}</span></td><td><span class="status ${st.cls}">${st.label}</span></td><td><button class="ghost-btn" onclick="window.editEmployee('${e.id}')">Edit</button> <button class="danger-btn" onclick="window.delEmployee('${e.id}')">Delete</button></td></tr>`}).join('')}</table></div>`;
  $('#empForm').onsubmit=async ev=>{ev.preventDefault(); const data=Object.fromEntries(new FormData(ev.target)); await addDoc(collection(db,'employees'),data); toast('Employee added'); render();};
}
window.delEmployee=async id=>{ await deleteDoc(doc(db,'employees',id)); toast('Employee deleted'); render(); };
window.editEmployee=async id=>{ const e=state.employees.find(x=>x.id===id); const name=prompt('Employee name',e.name||''); if(!name) return; const department=prompt('Department',e.department||''); const role=prompt('Role',e.role||''); await updateDoc(doc(db,'employees',id),{name,department,role}); toast('Employee updated'); render(); };
function departmentsView(){
  $('#departmentsView').innerHTML = `<div class="card"><h3>Departments</h3><form id="depForm" class="form-grid"><input name="name" placeholder="Department name" required><button class="primary-btn">Add Department</button></form><table class="table"><tr><th>Name</th><th>Action</th></tr>${state.departments.map(d=>`<tr><td>${d.name}</td><td><button class="ghost-btn" onclick="window.editDepartment('${d.id}')">Edit</button> <button class="danger-btn" onclick="window.delDepartment('${d.id}')">Delete</button></td></tr>`).join('')}</table></div>`;
  $('#depForm').onsubmit=async ev=>{ev.preventDefault(); await addDoc(collection(db,'departments'),Object.fromEntries(new FormData(ev.target))); toast('Department added'); render();};
}
window.delDepartment=async id=>{await deleteDoc(doc(db,'departments',id)); toast('Department deleted'); render();};
window.editDepartment=async id=>{const d=state.departments.find(x=>x.id===id); const name=prompt('Department name',d.name||''); if(!name) return; await updateDoc(doc(db,'departments',id),{name}); toast('Department updated'); render();};
function taskForm(){return `<form id="taskForm" class="form-grid"><input name="title" placeholder="Task title" required><select name="empId">${state.employees.map(e=>`<option value="${e.empId}">${e.name} (${e.empId})</option>`).join('')}</select><select name="department">${state.departments.map(d=>`<option>${d.name}</option>`).join('')}</select><input name="business" placeholder="Business / Project"><input name="taskCode" placeholder="Task Code"><select name="priority"><option>High</option><option>Medium</option><option>Low</option></select><input name="dueDate" type="date"><textarea name="details" placeholder="Task details"></textarea><button class="primary-btn">Assign Task</button></form>`}
function board(tasks, admin=false){ const cols=['todo','progress','review','complete']; const names={todo:'Start',progress:'Progress',review:'Review',complete:'Final Complete'}; return `<div class="board">${cols.map(c=>`<div class="col"><h4>${names[c]}</h4>${tasks.filter(t=>(t.status||'todo')===c).map(t=>{const opts=admin?cols:cols.filter(x=>x!=='complete'); return `<div class="task-card"><b>${t.title}</b><small>${t.taskCode||''} • ${t.business||''}<br>${t.department||''} • ${empName(t.empId)}<br>Priority: ${t.priority||'-'} ${t.dueDate?'• Due: '+t.dueDate:''}</small><p>${t.details||''}</p>${admin||c!=='complete'?`<select onchange="window.moveTask('${t.id}',this.value)">${opts.map(x=>`<option value="${x}" ${x===(t.status||'todo')?'selected':''}>${names[x]}</option>`).join('')}</select>`:''}${admin?`<br><button class="danger-btn" onclick="window.delTask('${t.id}')">Delete</button>`:''}</div>`}).join('')}</div>`).join('')}</div>`}
function empName(empId){return state.employees.find(e=>e.empId===empId)?.name||empId}
function tasksView(){ $('#tasksView').innerHTML=`<div class="card"><h3>Assign Work</h3>${taskForm()}</div><div class="card"><h3>Work Board</h3>${board(state.tasks,true)}</div>`; $('#taskForm').onsubmit=async ev=>{ev.preventDefault(); await addDoc(collection(db,'tasks'),{...Object.fromEntries(new FormData(ev.target)),status:'todo',createdAt:serverTimestamp()}); toast('Task assigned'); render();};}
window.moveTask=async(id,status)=>{const t=state.tasks.find(x=>x.id===id); if(!state.role==='admin' && status==='complete') return toast('Final complete admin karega'); await updateDoc(doc(db,'tasks',id),{status}); await logActivity(t?.empId||state.employee?.empId,`Task ${t?.taskCode||t?.title||''} moved to ${status}`,'task'); toast('Task updated'); render();}; window.delTask=async id=>{await deleteDoc(doc(db,'tasks',id)); toast('Task deleted'); render();};
function attendanceView(){ $('#attendanceView').innerHTML=`<div class="card"><h3>Attendance Record</h3><table class="table"><tr><th>Date</th><th>Employee</th><th>Entry</th><th>Break</th><th>Exit</th><th>Work Hrs</th><th>Late</th><th>OT</th><th>Status</th></tr>${state.attendance.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(a=>`<tr><td>${a.date}</td><td>${empName(a.empId)}</td><td>${a.entry||'-'}</td><td>${a.breakStart||'-'} / ${a.breakEnd||'-'}</td><td>${a.exit||'-'}</td><td>${recWorkHours(a)}</td><td>${isLate(a)?'Yes':'No'}</td><td>${overtime(a)}</td><td><span class="status ${String(a.status).toLowerCase()}">${a.status}</span></td></tr>`).join('')}</table></div>`; }
async function getRequests(type){ const s=await getDocs(collection(db,type)); return s.docs.map(d=>({id:d.id,...d.data()})); }
async function requestsView(){ const [leaves,msgs,extras]=await Promise.all([getRequests('leaveRequests'),getRequests('messages'),getRequests('extraWork')]); $('#requestsView').innerHTML=`<div class="grid three"><div class="card"><h3>Leave Requests</h3>${leaves.map(l=>`<div class="task-card"><b>${empName(l.empId)}</b><p>${l.from} to ${l.to}<br>${l.reason}</p><span class="status ${l.status||'review'}">${l.status||'Pending'}</span><div class="actions"><button class="primary-btn" onclick="window.leaveStatus('${l.id}','Approved')">Approve</button><button class="danger-btn" onclick="window.leaveStatus('${l.id}','Rejected')">Reject</button></div></div>`).join('')}</div><div class="card"><h3>Messages</h3>${msgs.map(m=>`<div class="task-card"><b>${empName(m.empId)}</b><p>${m.message}</p><small>${m.date||''}</small></div>`).join('')}</div><div class="card"><h3>Extra Work</h3>${extras.map(x=>`<div class="task-card"><b>${empName(x.empId)}</b><p>${x.work}</p><small>${x.date||''}</small></div>`).join('')}</div></div>`;}
window.leaveStatus=async(id,status)=>{await updateDoc(doc(db,'leaveRequests',id),{status}); toast('Leave updated'); render();}
function settingsView(){ const s=state.settings; $('#settingsView').innerHTML=`<div class="card"><h3>Office Settings</h3><form id="setForm" class="form-grid"><input name="start" type="time" value="${s.start||'10:00'}"><input name="end" type="time" value="${s.end||'19:00'}"><input name="graceMinutes" type="number" value="${s.graceMinutes||10}" placeholder="Grace minutes"><input name="breakMinutes" type="number" value="${s.breakMinutes||45}" placeholder="Break minutes"><input name="monthlyLeaves" type="number" value="${s.monthlyLeaves||2}" placeholder="Monthly leaves"><input name="weekend" value="${s.weekend||'Sunday'}" placeholder="Weekend day"><textarea name="announcement" placeholder="Announcement">${s.announcement||''}</textarea><button class="primary-btn">Save Settings</button></form></div>`; $('#setForm').onsubmit=async ev=>{ev.preventDefault(); await setDoc(doc(db,'settings','office'),Object.fromEntries(new FormData(ev.target))); toast('Settings saved'); render();};}
async function mark(status){ const empId=state.employee.empId; const existing=state.attendance.find(a=>a.date===today()&&a.empId===empId); const data={empId,date:today(),status}; let text='Attendance updated'; if(status==='Present') {data.entry=existing?.entry||nowTime(); text='Entry marked';} if(status==='Break') {data.breakStart=nowTime(); text='Break started';} if(status==='PresentBack') {data.status='Present'; data.breakEnd=nowTime(); text='Break ended';} if(status==='Exited') {data.exit=nowTime(); text='Exit marked';} if(existing) await updateDoc(doc(db,'attendance',existing.id),data); else await addDoc(collection(db,'attendance'),data); await logActivity(empId,text,'attendance'); toast(text); await loadAll(); drawCurrent(); }
function employeeDashboard(){ const rec=state.attendance.find(a=>a.date===today()&&a.empId===state.employee.empId); const myTasks=state.tasks.filter(t=>t.empId===state.employee.empId); const acts=state.activity.filter(a=>a.date===today()&&a.empId===state.employee.empId).slice(-8).reverse(); $('#employeeDashboard').innerHTML=`<div class="notice">${state.settings.announcement||''}</div><div class="grid cards"><div class="card stat"><p>Today Status</p><h3>${rec?.status||'Absent'}</h3></div><div class="card stat"><p>Entry Time</p><h3>${rec?.entry||'--'}</h3></div><div class="card stat"><p>Work Hours</p><h3>${recWorkHours(rec)}</h3></div><div class="card stat"><p>Completed</p><h3>${myTasks.filter(t=>t.status==='complete').length}/${myTasks.length}</h3></div></div><div class="grid two" style="margin-top:18px"><div class="card"><h3>Attendance Actions</h3><p>Late: ${rec&&isLate(rec)?'Yes':'No'} • Overtime: ${overtime(rec)}</p><div class="actions"><button class="primary-btn" onclick="window.mark('Present')">Entry / Present</button><button class="ghost-btn" onclick="window.mark('Break')">Break Start</button><button class="ghost-btn" onclick="window.mark('PresentBack')">Break End</button><button class="danger-btn" onclick="window.mark('Exited')">Exit</button></div></div><div class="card"><h3>My Activity Timeline</h3>${acts.map(a=>`<div class="timeline-item"><b>${a.time}</b><span>${a.text}</span></div>`).join('')||'<p>No activity today</p>'}</div></div>`; }
window.mark=mark;
function employeeTasksView(){ const my=state.tasks.filter(t=>t.empId===state.employee.empId); $('#employeeTasksView').innerHTML=`<div class="card"><h3>My Work Board</h3>${board(my,false)}</div>`; }
function employeeSummaryView(){ const mine=state.attendance.filter(a=>a.empId===state.employee.empId); const present=mine.filter(a=>a.status!=='Absent').length; const myTasks=state.tasks.filter(t=>t.empId===state.employee.empId); $('#employeeSummaryView').innerHTML=`<div class="grid cards"><div class="card stat"><p>Total Present Days</p><h3>${present}</h3></div><div class="card stat"><p>Leaves Allowed</p><h3>${state.settings.monthlyLeaves||2}</h3></div><div class="card stat"><p>Total Tasks</p><h3>${myTasks.length}</h3></div><div class="card stat"><p>Completed</p><h3>${myTasks.filter(t=>t.status==='complete').length}</h3></div></div><div class="card" style="margin-top:18px"><h3>Monthly Graph</h3><div class="chart">${mine.slice(-15).map(a=>`<div class="bar" title="${a.date}" style="height:${a.status==='Exited'?150:(a.status==='Break'?90:120)}px"></div>`).join('')}</div></div>`; }
function employeeMessageView(){ $('#employeeMessageView').innerHTML=`<div class="grid two"><div class="card"><h3>Send Message to Admin</h3><form id="msgForm" class="form-grid"><textarea name="message" placeholder="Write message" required></textarea><button class="primary-btn">Send Message</button></form></div><div class="card"><h3>Leave Request</h3><form id="leaveForm" class="form-grid"><input name="from" type="date" required><input name="to" type="date" required><textarea name="reason" placeholder="Reason" required></textarea><button class="primary-btn">Send Leave Request</button></form></div></div><div class="card" style="margin-top:18px"><h3>Extra Work Update</h3><form id="extraForm" class="form-grid"><textarea name="work" placeholder="Extra work details" required></textarea><button class="primary-btn">Submit Extra Work</button></form></div>`; $('#msgForm').onsubmit=async ev=>{ev.preventDefault(); await addDoc(collection(db,'messages'),{empId:state.employee.empId,date:today(),...Object.fromEntries(new FormData(ev.target))}); toast('Message sent'); ev.target.reset();}; $('#leaveForm').onsubmit=async ev=>{ev.preventDefault(); await addDoc(collection(db,'leaveRequests'),{empId:state.employee.empId,status:'Pending',...Object.fromEntries(new FormData(ev.target))}); toast('Leave request sent'); ev.target.reset();}; $('#extraForm').onsubmit=async ev=>{ev.preventDefault(); await addDoc(collection(db,'extraWork'),{empId:state.employee.empId,date:today(),...Object.fromEntries(new FormData(ev.target))}); toast('Extra work submitted'); ev.target.reset();}; }
