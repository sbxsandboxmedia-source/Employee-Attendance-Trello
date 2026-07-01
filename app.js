/* Office Attendance System - full app.js
   Works with GitHub Pages + Firebase Firestore. No Firebase Storage required.
   Replace only app.js if index.html already loads this file as type="module".
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

const ADMIN_EMAIL = "admin@office.com";
const ADMIN_PASSWORD = "admin123";

const state = {
  role: null,
  userId: null,
  activeView: "dashboard",
  employees: [],
  departments: [],
  tasks: [],
  attendance: [],
  leaves: [],
  settings: {},
  activity: [],
  unsub: []
};

const $ = (sel) => document.querySelector(sel);
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (d = new Date()) => {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
};
const currentMonth = () => monthKey(new Date());
const esc = (v = "") => String(v ?? "").replace(/[&<>'"]/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[s]));
const money = (n = 0) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const uid = () => Math.random().toString(36).slice(2, 10);
const isSunday = (dateStr = todayISO()) => new Date(`${dateStr}T12:00:00`).getDay() === 0;
const empName = (id) => state.employees.find((e) => e.id === id)?.name || "-";
const empById = (id) => state.employees.find((e) => e.id === id);
const getEmployeeDepartments = (e) => Array.isArray(e?.departments) ? e.departments : (e?.department ? [e.department] : []);
const employeeInDepartment = (e, d) => getEmployeeDepartments(e).some((x) => String(x).toLowerCase() === String(d?.name || d?.id || d).toLowerCase());
const employeeDepartmentsText = (e) => getEmployeeDepartments(e).map(deptName).join(", ") || "-";
const deptName = (idOrName) => state.departments.find((d) => d.id === idOrName)?.name || idOrName || "-";
const goodRatingMin = () => Number(state.settings.goodRatingMin || 4);
const bonusMinTasks = () => Number(state.settings.bonusMinTasks || 10);
const bonusAmount = () => Number(state.settings.bonusAmount || 1000);
const eomBonus = () => Number(state.settings.eomBonus || 1000);
const pointsForRating = (rating) => Number(rating || 0) * 20;

function toast(message, type = "success") {
  let wrap = $(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function ensureStyles() {
  if ($("#oas-dynamic-style")) return;
  const css = `
  :root{--bg:#eef7ff;--card:#fff;--text:#111827;--muted:#728098;--line:#dfe8f3;--primary:#5b6cff;--primary2:#7b4dff;--green:#12b981;--blue:#0ea5e9;--orange:#f97316;--red:#ef4444;--purple:#a855f7;--shadow:0 22px 55px rgba(31,42,68,.12);--radius:22px;}
  *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;background:linear-gradient(135deg,#e3f7ff,#f4f5ff);color:var(--text)} button,input,select,textarea{font:inherit} button{cursor:pointer;border:0}.hidden{display:none!important}
  .login-page{min-height:100vh;display:grid;place-items:center;padding:24px}.login-card{width:min(480px,92vw);background:rgba(255,255,255,.9);border:1px solid #edf2f7;border-radius:30px;box-shadow:var(--shadow);padding:30px}.brand{display:flex;gap:16px;align-items:center}.logo{width:54px;height:54px;border-radius:16px;background:linear-gradient(135deg,#5b6cff,#50c9b7);color:#fff;display:grid;place-items:center;font-weight:900}.brand h1{font-size:26px;margin:0}.brand p{margin:4px 0 0;color:var(--muted)}.tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#edf3fb;padding:6px;border-radius:16px;margin:26px 0}.tabs button{padding:14px;border-radius:12px;background:transparent;font-weight:800;color:#718096}.tabs button.active{background:#fff;color:#111827;box-shadow:0 8px 20px rgba(0,0,0,.08)}.field{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}.field label{font-size:13px;font-weight:800;color:#455166}.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);border-radius:14px;padding:13px 14px;background:#fbfdff;outline:none}.field textarea{min-height:100px;resize:vertical}.btn{border-radius:14px;padding:13px 18px;font-weight:900;background:#eef3fb;color:#1f2a44}.btn.primary{background:linear-gradient(135deg,var(--primary),var(--primary2));color:#fff}.btn.danger{background:#fee2e2;color:#991b1b}.btn.success{background:#dcfce7;color:#166534}.btn.warn{background:#ffedd5;color:#9a3412}.full{width:100%}.small{padding:8px 11px;font-size:13px;border-radius:11px}.hint{font-size:13px;color:#475569;margin-top:12px}
  .app{min-height:100vh;display:grid;grid-template-columns:260px 1fr}.sidebar{position:sticky;top:0;height:100vh;background:rgba(255,255,255,.84);backdrop-filter:blur(14px);border-right:1px solid #e6eef7;padding:22px;display:flex;flex-direction:column;gap:20px}.side-brand{display:flex;gap:12px;align-items:center;font-weight:900;font-size:20px}.nav{display:grid;gap:8px}.nav button{text-align:left;padding:14px;border-radius:14px;background:transparent;color:#526177;font-weight:800}.nav button.active,.nav button:hover{background:#e8efff;color:#4f46e5}.logout{margin-top:auto}.main{padding:28px;overflow:auto}.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.breadcrumb{color:#6d7c93;font-size:14px}.topbar h2{font-size:32px;margin:6px 0 0}.pills{display:flex;gap:12px;align-items:center}.pill{background:#fff;border:1px solid #e6eef7;border-radius:999px;padding:12px 16px;font-weight:800;color:#516174}.avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;background:linear-gradient(135deg,#5b6cff,#50c9b7);color:#fff;display:grid;place-items:center;font-weight:900}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.card{background:rgba(255,255,255,.88);border:1px solid #e6eef7;border-radius:var(--radius);box-shadow:0 15px 45px rgba(30,41,59,.07);padding:20px}.kpi-card{color:#fff;min-height:130px;position:relative;overflow:hidden}.kpi-card h3{font-size:34px;margin:8px 0}.kpi-card p{margin:0;font-weight:800}.kpi-card small{opacity:.9}.green{background:linear-gradient(135deg,#06b682,#0fc89b)}.blue{background:linear-gradient(135deg,#0ea5e9,#2563eb)}.purple{background:linear-gradient(135deg,#a855f7,#6d5dfc)}.orange{background:linear-gradient(135deg,#fb923c,#f43f00)}.grid{display:grid;gap:18px}.grid.two{grid-template-columns:1fr 1fr}.grid.three{grid-template-columns:repeat(3,1fr)}.section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.section-title h3{margin:0}.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.form-grid .wide{grid-column:1/-1}.table-wrap{overflow:auto}.table{width:100%;border-collapse:separate;border-spacing:0 10px}.table th{text-align:left;font-size:12px;color:#68778d;padding:8px}.table td{background:#fbfdff;border-top:1px solid #e9eff7;border-bottom:1px solid #e9eff7;padding:12px}.table td:first-child{border-left:1px solid #e9eff7;border-radius:14px 0 0 14px}.table td:last-child{border-right:1px solid #e9eff7;border-radius:0 14px 14px 0}.row-actions{display:flex;gap:8px;flex-wrap:wrap}.badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#eef3fb;font-size:12px;font-weight:900;color:#475569}.badge.green{background:#dcfce7;color:#166534}.badge.blue{background:#dbeafe;color:#1e40af}.badge.orange{background:#ffedd5;color:#9a3412}.badge.red{background:#fee2e2;color:#991b1b}.badge.purple{background:#f3e8ff;color:#6b21a8}.kanban{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.column{background:#f8fbff;border:1px solid #e5edf7;border-radius:22px;padding:14px;min-height:330px}.column h4{margin:0 0 12px;display:flex;justify-content:space-between}.task-card{background:#fff;border:1px solid #e6eef7;border-radius:18px;padding:14px;margin-bottom:12px;box-shadow:0 10px 25px rgba(30,41,59,.06)}.task-card h4{margin:8px 0}.task-meta{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.link{color:#4f46e5;font-weight:900;text-decoration:none}.modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(8px);display:grid;place-items:center;z-index:1000;padding:20px}.modal{width:min(780px,96vw);max-height:92vh;overflow:auto;background:#fff;border:1px solid #eef2f7;border-radius:26px;box-shadow:0 30px 90px rgba(0,0,0,.25);padding:22px}.modal-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eef2f7;padding-bottom:14px;margin-bottom:16px}.modal-head h3{margin:0}.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}.close{background:#f1f5f9;border-radius:12px;padding:8px 12px}.toast-wrap{position:fixed;right:18px;top:18px;display:grid;gap:10px;z-index:2000}.toast{background:#111827;color:#fff;padding:12px 16px;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,.2);font-weight:800}.toast.error{background:#dc2626}.toast.success{background:#16a34a}.progress{height:10px;background:#edf2f7;border-radius:999px;overflow:hidden}.progress span{display:block;height:100%;background:linear-gradient(135deg,#5b6cff,#50c9b7)}.dept-card{display:flex;justify-content:space-between;gap:12px;align-items:center}.emp-mini{display:flex;align-items:center;gap:8px;background:#f8fbff;border:1px solid #e8eef7;border-radius:14px;padding:9px;margin-top:8px}.muted{color:var(--muted)}.profile-row{display:flex;gap:10px;align-items:center}.leader{display:flex;align-items:center;justify-content:space-between;border:1px solid #e7eef8;background:#fbfdff;border-radius:16px;padding:12px;margin-top:10px}
  @media(max-width:1050px){.app{grid-template-columns:1fr}.sidebar{position:relative;height:auto}.nav{grid-template-columns:repeat(3,1fr)}.cards,.grid.three,.grid.two,.kanban,.form-grid,.dept-final-grid{grid-template-columns:1fr}.main{padding:18px}.topbar{align-items:flex-start;gap:12px;flex-direction:column}}
  .dept-final-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:18px}.dept-final-card{background:#fff;border:1px solid #e6eef7;border-radius:22px;padding:18px;box-shadow:0 15px 45px rgba(30,41,59,.07);min-height:132px}.dept-final-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.dept-final-head h3{margin:0 0 4px}.dept-emp-list{display:grid;gap:8px;margin-top:14px}.dept-emp-row{display:flex;align-items:center;gap:9px;background:#f8fbff;border:1px solid #e9eff7;border-radius:14px;padding:9px}.check-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;background:#fbfdff;border:1px solid #e6eef7;border-radius:16px;padding:12px}.check-grid label{display:flex;align-items:center;gap:8px;font-weight:800;color:#526177;font-size:13px}.check-grid input{width:auto!important}.dept-form-card{padding:18px 20px}.dept-form-card form{display:grid;grid-template-columns:1fr 330px;gap:12px;align-items:center}.dept-form-card input{height:46px}.dept-form-card button{height:46px}@media(max-width:760px){.dept-form-card form,.check-grid{grid-template-columns:1fr}}
  `;
  const style = document.createElement("style");
  style.id = "oas-dynamic-style";
  style.textContent = css + `

  .dashboard-analytics{display:grid;grid-template-columns:1.25fr 1fr;gap:18px;margin-top:18px}.dashboard-analytics .wide-chart{grid-column:1/-1}.chart-card{overflow:hidden}.mini-bars{height:210px;display:flex;align-items:flex-end;gap:12px;padding:18px 10px 6px;border:1px solid #e8eef7;border-radius:18px;background:linear-gradient(180deg,#ffffff,#f8fbff)}.mini-bar-item{flex:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px}.mini-bar-track{width:100%;max-width:38px;height:160px;background:#eef3fb;border-radius:999px;display:flex;align-items:flex-end;overflow:hidden}.mini-bar-track span{width:100%;display:block;border-radius:999px 999px 0 0;background:linear-gradient(180deg,#5b6cff,#50c9b7)}.mini-bar-item small{font-size:11px;color:#6b7689}.chart-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px;color:#657287;font-size:13px}.progress-line{margin:14px 0}.progress-line>div:first-child{display:flex;justify-content:space-between;gap:10px;margin-bottom:7px;font-size:13px}.progress-line span{color:#718096}.progress span.green{background:linear-gradient(90deg,#12b981,#34d399)!important}.progress span.blue{background:linear-gradient(90deg,#3b82f6,#60a5fa)!important}.progress span.orange{background:linear-gradient(90deg,#f97316,#fb923c)!important}.progress span.grey{background:linear-gradient(90deg,#cbd5e1,#94a3b8)!important}.performer-row{display:flex;justify-content:space-between;align-items:center;border:1px solid #e8eef7;background:#fbfdff;border-radius:16px;padding:11px 12px;margin:10px 0}.performer-row small{display:block;color:#718096;margin-top:3px}.employee-list-card{padding:20px 18px}.employee-table{font-size:14px;min-width:980px}.employee-table th{font-size:12px;text-transform:uppercase;letter-spacing:.02em}.employee-table td{vertical-align:middle;padding:12px 10px}.employee-cell{display:flex;align-items:center;gap:10px;min-width:150px}.employee-cell .avatar{margin-right:0;flex:0 0 auto}.employee-cell b{font-size:15px}.employee-cell small{display:block;color:#718096;font-size:12px;margin-top:3px}.mono{font-weight:800;color:#334155}.email-text{font-size:13px;color:#475569;word-break:break-word}.dept-chip-wrap{display:flex;gap:6px;flex-wrap:wrap;max-width:220px}.dept-chip{display:inline-flex;align-items:center;border-radius:999px;background:#eef3ff;color:#4f46e5;font-size:12px;font-weight:800;padding:5px 8px}.leave-text{font-weight:900;color:#334155}.block{display:block}.emp-actions{flex-direction:column;gap:6px}.emp-actions .btn{min-width:68px}.settings-save-btn{white-space:nowrap!important;min-width:190px!important;width:auto!important;padding-left:22px!important;padding-right:22px!important;line-height:1.15!important;align-self:end}.settings-save-btn br{display:none}.settingsView .btn.primary{white-space:nowrap}@media(max-width:1050px){.dashboard-analytics{grid-template-columns:1fr}.chart-footer{flex-direction:column;align-items:flex-start}.settings-save-btn{width:100%!important}}

  `;
  document.head.appendChild(style);
}

function modal({ title, body, onSubmit, submitText = "Save", wide = false }) {
  return new Promise((resolve) => {
    const box = document.createElement("div");
    box.className = "modal-backdrop";
    box.innerHTML = `<div class="modal" style="width:${wide ? "min(980px,96vw)" : "min(760px,96vw)"}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="close" type="button">✕</button></div>
      <form class="modal-form">${body}<div class="modal-actions"><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary" type="submit">${esc(submitText)}</button></div></form>
    </div>`;
    document.body.appendChild(box);
    box.querySelector(".close").onclick = () => { box.remove(); resolve(null); };
    box.querySelector("[data-cancel]").onclick = () => { box.remove(); resolve(null); };
    box.querySelector(".modal-form").onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget).entries());
      try {
        if (onSubmit) await onSubmit(data);
        box.remove();
        resolve(data);
      } catch (err) {
        console.error(err);
        toast(err.message || "Something went wrong", "error");
      }
    };
  });
}

function confirmBox(title, text = "Are you sure?") {
  return new Promise((resolve) => {
    const box = document.createElement("div");
    box.className = "modal-backdrop";
    box.innerHTML = `<div class="modal" style="width:min(430px,94vw)"><div class="modal-head"><h3>${esc(title)}</h3><button class="close">✕</button></div><p class="muted">${esc(text)}</p><div class="modal-actions"><button class="btn" data-no>Cancel</button><button class="btn danger" data-yes>Delete</button></div></div>`;
    document.body.appendChild(box);
    box.querySelector(".close").onclick = () => { box.remove(); resolve(false); };
    box.querySelector("[data-no]").onclick = () => { box.remove(); resolve(false); };
    box.querySelector("[data-yes]").onclick = () => { box.remove(); resolve(true); };
  });
}

function renderLogin() {
  ensureStyles();
  document.body.innerHTML = `<main class="login-page"><section class="login-card">
    <div class="brand"><div class="logo">OA</div><div><h1>Office Attendance System</h1><p>Attendance, work tracking & task management</p></div></div>
    <div class="tabs"><button id="adminTab" class="active">Admin Login</button><button id="empTab">Employee Login</button></div>
    <form id="loginForm">
      <div class="field"><label>Email / Employee ID</label><input name="email" id="loginEmail" placeholder="admin@office.com" autocomplete="username"></div>
      <div class="field"><label>Password</label><input name="password" id="loginPass" type="password" placeholder="admin123" autocomplete="current-password"></div>
      <button class="btn primary full" id="loginBtn">Login as Admin</button>
    </form>
    <p class="hint" id="loginHint">Default demo admin: admin@office.com / admin123</p>
  </section></main>`;
  let mode = "admin";
  $("#adminTab").onclick = () => { mode = "admin"; $("#adminTab").classList.add("active"); $("#empTab").classList.remove("active"); $("#loginBtn").textContent = "Login as Admin"; $("#loginHint").textContent = "Default demo admin: admin@office.com / admin123"; };
  $("#empTab").onclick = () => { mode = "employee"; $("#empTab").classList.add("active"); $("#adminTab").classList.remove("active"); $("#loginBtn").textContent = "Login as Employee"; $("#loginHint").textContent = "Use employee email/ID and password created by admin."; };
  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#loginEmail").value.trim();
    const pass = $("#loginPass").value.trim();
    if (mode === "admin") {
      if (email === ADMIN_EMAIL && pass === ADMIN_PASSWORD) {
        state.role = "admin"; state.userId = "admin"; await startApp();
      } else toast("Wrong admin email/password", "error");
    } else {
      await loadOnce();
      const emp = state.employees.find((x) => (x.email === email || x.empId === email) && x.password === pass);
      if (!emp) return toast("Employee login not found", "error");
      state.role = "employee"; state.userId = emp.id; await startApp();
    }
  };
}

async function loadOnce() {
  const [emps, deps, tasks, atts, leaves, acts] = await Promise.all([
    getDocs(collection(db, "employees")), getDocs(collection(db, "departments")), getDocs(collection(db, "tasks")), getDocs(collection(db, "attendance")), getDocs(collection(db, "leave_requests")), getDocs(collection(db, "activity_logs"))
  ]);
  state.employees = emps.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.departments = deps.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.tasks = tasks.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.attendance = atts.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.leaves = leaves.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.activity = acts.docs.map((d) => ({ id: d.id, ...d.data() }));
  const setSnap = await getDocs(collection(db, "settings"));
  setSnap.docs.forEach((d) => { if (d.id === "office") state.settings = d.data(); });
}

function subscribeData() {
  state.unsub.forEach((u) => u()); state.unsub = [];
  const listen = (name, cb) => state.unsub.push(onSnapshot(collection(db, name), (snap) => { cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); renderView(); }));
  listen("employees", (v) => state.employees = v);
  listen("departments", (v) => state.departments = v);
  listen("tasks", (v) => state.tasks = v);
  listen("attendance", (v) => state.attendance = v);
  listen("leave_requests", (v) => state.leaves = v);
  listen("activity_logs", (v) => state.activity = v);
  state.unsub.push(onSnapshot(doc(db, "settings", "office"), (d) => { state.settings = d.exists() ? d.data() : {}; renderView(); }));
}

async function seedDefaults() {
  const deps = await getDocs(collection(db, "departments"));
  if (deps.empty) {
    await addDoc(collection(db, "departments"), { name: "Marketing", createdAt: serverTimestamp() });
    await addDoc(collection(db, "departments"), { name: "Development", createdAt: serverTimestamp() });
    await addDoc(collection(db, "departments"), { name: "Design", createdAt: serverTimestamp() });
  }
  const s = await getDocs(collection(db, "settings"));
  if (s.empty) {
    await setDoc(doc(db, "settings", "office"), {
      officeStart: "10:00", officeEnd: "19:00", graceMinutes: 10, breakMinutes: 45, defaultPaidLeave: 2,
      weeklyOff: "Sunday", announcement: "Welcome to Office Attendance System", companyLogo: "",
      companyName: "Hridhyam Creation", companyTagline: "Office Attendance & Work Management", ownerName: "Boss", companyCode: "HC",
      goodRatingMin: 4, bonusMinTasks: 10, bonusAmount: 1000, eomBonus: 1000, employeeOfMonthId: ""
    });
  }
}

async function startApp() {
  ensureStyles();
  await seedDefaults();
  await loadOnce();
  subscribeData();
  renderShell();
}

function navItems() {
  if (state.role === "employee") return ["dashboard", "tasks", "attendance", "requests", "payroll", "history"];
  return ["dashboard", "employees", "departments", "tasks", "attendance", "requests", "payroll", "settings"];
}

function viewTitle(v) { return ({ dashboard: "Dashboard", employees: "Employees", departments: "Departments", tasks: "Tasks", attendance: "Attendance", requests: "Requests", payroll: "Payroll", settings: "Settings", history: "Completed History" }[v] || v); }

function renderShell() {
  const nav = navItems().map((v) => `<button data-view="${v}" class="${state.activeView === v ? "active" : ""}">${viewTitle(v)}</button>`).join("");
  const companyName = state.settings.companyName || "Hridhyam Creation";
  const companyTagline = state.settings.companyTagline || "Work Management System";
  const ownerName = state.settings.ownerName || "Boss";
  const greetingName = state.role === "admin" ? esc(ownerName) : esc(currentEmployee()?.name || "Employee");
  const roleLabel = state.role === "admin" ? esc(ownerName) : "Employee";
  const logoHtml = state.settings.companyLogo ? `<img src="${esc(state.settings.companyLogo)}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : "OA";
  document.title = `${companyName} | HRMS`;
  document.body.innerHTML = `<div class="app"><aside class="sidebar"><div class="side-brand"><div class="logo">${logoHtml}</div><div><span>${esc(companyName)}</span><small class="muted block" style="font-size:11px;margin-top:2px">${esc(companyTagline)}</small></div></div><nav class="nav">${nav}</nav><button class="btn logout">Logout</button></aside><main class="main"><div class="topbar"><div><div class="breadcrumb">Portal › ${viewTitle(state.activeView)}</div><h2>Good morning ${greetingName} 👋</h2></div><div class="pills"><span class="pill">${new Date().toDateString()}</span><span class="pill">${roleLabel}</span>${profileAvatar()}</div></div><div id="view"></div></main></div>`;
  document.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => { state.activeView = b.dataset.view; renderShell(); });
  $(".logout").onclick = () => { localStorage.removeItem("oas_role"); localStorage.removeItem("oas_userId"); state.unsub.forEach((u) => u()); renderLogin(); };
  renderView();
}

function profileAvatar(emp = currentEmployee()) {
  if (state.role === "admin") return `<div class="avatar">A</div>`;
  if (emp?.photoUrl) return `<img class="avatar" src="${esc(emp.photoUrl)}" alt="profile">`;
  return `<div class="avatar">${esc((emp?.name || "E").slice(0, 1).toUpperCase())}</div>`;
}
function currentEmployee() { return state.employees.find((e) => e.id === state.userId); }
function renderView() {
  if (!$("#view")) return;
  const map = { dashboard: dashboardView, employees: employeesView, departments: departmentsView, tasks: tasksView, attendance: attendanceView, requests: requestsView, payroll: payrollView, settings: settingsView, history: completedHistoryView };
  $("#view").innerHTML = (map[state.activeView] || dashboardView)();
  bindViewActions();
}

function monthlyTasks(empId = null, m = currentMonth()) {
  return state.tasks.filter((t) => (!empId || t.empId === empId) && (monthKey(t.completedDate || t.updatedAt || t.createdAt || todayISO()) === m));
}
function completedTasks(empId = null, m = currentMonth()) {
  return monthlyTasks(empId, m).filter((t) => t.status === "complete");
}
function monthlyTaskPoints(empId = null, m = currentMonth()) {
  return completedTasks(empId, m).reduce((sum, t) => sum + Number(t.points || pointsForRating(t.rating)), 0);
}
function goodRatedTaskCount(empId, m = currentMonth()) {
  return completedTasks(empId, m).filter((t) => Number(t.rating || 0) >= goodRatingMin()).length;
}
function leaveBalance(emp, m = currentMonth()) {
  const paidLimit = Number(emp?.paidLeave ?? state.settings.defaultPaidLeave ?? 2);
  const approved = state.leaves.filter((l) => l.empId === emp?.id && l.status === "approved" && monthKey(l.fromDate || l.date || todayISO()) === m);
  const used = approved.reduce((sum, l) => sum + Number(l.days || dateDays(l.fromDate, l.toDate)), 0);
  const extra = Math.max(0, used - paidLimit);
  return { paidLimit, used, extra, remaining: Math.max(0, paidLimit - used) };
}
function dateDays(from, to) {
  if (!from) return 1;
  const a = new Date(`${from}T12:00:00`); const b = new Date(`${to || from}T12:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
function payrollCalc(emp, m = currentMonth()) {
  const salary = Number(emp.salary || 0);
  const lb = leaveBalance(emp, m);
  const perDay = salary / 30;
  const deduction = Math.round(lb.extra * perDay);
  const good = goodRatedTaskCount(emp.id, m);
  const performanceBonus = good >= bonusMinTasks() ? bonusAmount() : 0;
  const eom = state.settings.employeeOfMonthId === emp.id ? eomBonus() : 0;
  return { salary, good, performanceBonus, eom, deduction, net: salary + performanceBonus + eom - deduction, lb };
}
function employeeOfMonthAuto() {
  let best = null;
  state.employees.forEach((e) => {
    const good = goodRatedTaskCount(e.id);
    const pts = monthlyTaskPoints(e.id);
    if (!best || good > best.good || (good === best.good && pts > best.pts)) best = { emp: e, good, pts };
  });
  return best?.emp || null;
}

function pct(part, total) {
  const t = Number(total || 0);
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(part || 0) / t) * 100)));
}
function monthDates() {
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
}
function miniBars(items, maxValue = null) {
  const max = maxValue || Math.max(1, ...items.map((x) => Number(x.value || 0)));
  return `<div class="mini-bars">${items.map((x) => `<div class="mini-bar-item"><div class="mini-bar-track"><span style="height:${Math.max(4, pct(x.value, max))}%"></span></div><small>${esc(x.label)}</small></div>`).join("")}</div>`;
}
function progressLine(label, value, total, cls = "blue") {
  return `<div class="progress-line"><div><b>${esc(label)}</b><span>${Number(value || 0)} / ${Number(total || 0)}</span></div><div class="progress"><span class="${cls}" style="width:${pct(value, total)}%"></span></div></div>`;
}
function dashboardGraphs() {
  const dates = monthDates();
  const sampled = dates.filter((_, i) => i % Math.ceil(dates.length / 10) === 0 || i === dates.length - 1);
  const attendanceItems = sampled.map((d) => ({ label: String(Number(d.slice(-2))), value: state.attendance.filter((a) => a.date === d && a.status === "present").length }));
  const totalTasks = state.tasks.length;
  const completed = state.tasks.filter((t) => t.status === "complete").length;
  const progress = state.tasks.filter((t) => t.status === "progress").length;
  const review = state.tasks.filter((t) => t.status === "review").length;
  const todo = state.tasks.filter((t) => (t.status || "todo") === "todo").length;
  const topEmployees = state.employees.map((e) => ({ e, value: monthlyTaskPoints(e.id), good: goodRatedTaskCount(e.id) })).sort((a, b) => b.value - a.value).slice(0, 5);
  return `<div class="dashboard-analytics">
    <div class="card chart-card wide-chart">
      <div class="section-title"><h3>Overall Attendance Graph</h3><span class="badge blue">This month</span></div>
      ${miniBars(attendanceItems, Math.max(1, state.employees.length))}
      <div class="chart-footer"><span>Present employees day-wise</span><b>${state.attendance.filter((a)=>monthKey(a.date)===currentMonth() && a.status==='present').length} total present marks</b></div>
    </div>
    <div class="card chart-card">
      <div class="section-title"><h3>Work Progress</h3><span class="badge purple">Tasks</span></div>
      ${progressLine('Completed', completed, Math.max(1,totalTasks), 'green')}
      ${progressLine('In Progress', progress, Math.max(1,totalTasks), 'blue')}
      ${progressLine('In Review', review, Math.max(1,totalTasks), 'orange')}
      ${progressLine('Not Started', todo, Math.max(1,totalTasks), 'grey')}
    </div>
    <div class="card chart-card">
      <div class="section-title"><h3>Employee Work Points</h3><span class="badge green">Top ${topEmployees.length || 0}</span></div>
      ${topEmployees.map((x, i) => `<div class="performer-row"><div class="profile-row">${profileAvatar(x.e)}<div><b>#${i+1} ${esc(x.e.name)}</b><small>${x.good} good tasks</small></div></div><strong>${x.value} pts</strong></div>`).join('') || `<p class="muted">No work points yet.</p>`}
    </div>
  </div>`;
}

function dashboardView() {
  const tdy = todayISO();
  const present = state.attendance.filter((a) => a.date === tdy && a.status === "present").length;
  const onBreak = state.attendance.filter((a) => a.date === tdy && a.breakActive).length;
  const absent = isSunday() ? 0 : Math.max(0, state.employees.length - present - state.leaves.filter((l) => l.status === "approved" && l.fromDate <= tdy && (l.toDate || l.fromDate) >= tdy).length);
  const done = completedTasks().length;
  const review = state.tasks.filter((t) => t.status === "review").length;
  const eom = state.settings.employeeOfMonthId ? empById(state.settings.employeeOfMonthId) : employeeOfMonthAuto();
  if (state.role === "employee") {
    const emp = currentEmployee(); const p = payrollCalc(emp); const eomVisible = eom?.id === emp?.id;
    return `<div class="cards"><div class="card kpi-card green"><p>My Points</p><h3>${monthlyTaskPoints(emp?.id)}</h3><small>This month</small></div><div class="card kpi-card blue"><p>Completed</p><h3>${completedTasks(emp?.id).length}</h3><small>Tasks</small></div><div class="card kpi-card purple"><p>Good Rated</p><h3>${p.good}</h3><small>${goodRatingMin()}★ and above</small></div><div class="card kpi-card orange"><p>Leave Balance</p><h3>${p.lb.remaining}</h3><small>Used ${p.lb.used}, Extra ${p.lb.extra}</small></div></div>${eomVisible ? `<div class="card" style="margin-top:18px"><h3>🏆 Employee of the Month</h3><p>Congratulations ${esc(emp.name)}! Extra bonus ${money(eomBonus())} added in payroll.</p></div>` : ""}<div class="grid two" style="margin-top:18px"><div class="card"><h3>Today Tasks</h3>${taskCards(state.tasks.filter((t) => t.empId === emp?.id && t.status !== "complete").slice(0, 5))}</div><div class="card"><h3>Announcement</h3><p>${esc(state.settings.announcement || "Welcome")}</p></div></div>`;
  }
  return `<div class="cards"><div class="card kpi-card green"><p>Total Employees</p><h3>${state.employees.length}</h3><small>Added in system</small></div><div class="card kpi-card blue"><p>Present Today</p><h3>${present}</h3><small>On break ${onBreak}</small></div><div class="card kpi-card purple"><p>Task Review</p><h3>${review}</h3><small>Need admin approval</small></div><div class="card kpi-card orange"><p>Completed</p><h3>${done}</h3><small>This month</small></div></div><div class="grid two" style="margin-top:18px"><div class="card"><div class="section-title"><h3>🏆 Employee of the Month</h3><button class="btn small primary" data-eom-set>Set</button></div>${eom ? `<div class="profile-row">${profileAvatar(eom)}<div><b>${esc(eom.name)}</b><p class="muted">${goodRatedTaskCount(eom.id)} good tasks • ${monthlyTaskPoints(eom.id)} points • Bonus ${money(eomBonus())}</p></div></div>` : `<p class="muted">No employee selected yet.</p>`}</div><div class="card"><h3>Points Leaderboard</h3>${leaderboard()}</div></div>${dashboardGraphs()}`;
}
function leaderboard() {
  return state.employees.map((e) => ({ e, pts: monthlyTaskPoints(e.id), good: goodRatedTaskCount(e.id) })).sort((a, b) => b.pts - a.pts).map((x, i) => `<div class="leader"><div class="profile-row">${profileAvatar(x.e)}<div><b>#${i + 1} ${esc(x.e.name)}</b><div class="muted">${x.good} good rated tasks</div></div></div><b>${x.pts} pts</b></div>`).join("") || `<p class="muted">No data</p>`;
}
function departmentEmployeeList() {
  return state.departments.map((d) => {
    const emps = state.employees.filter((e) => employeeInDepartment(e, d));
    return `<div class="card" style="margin:10px 0"><div class="dept-card"><h3>${esc(d.name)}</h3><span class="badge blue">${emps.length} employees</span></div>${emps.map((e) => `<div class="emp-mini">${profileAvatar(e)}<b>${esc(e.name)}</b><span class="muted">${esc(e.role || "")}</span></div>`).join("") || `<p class="muted">No employee in this department</p>`}</div>`;
  }).join("");
}

function deptCheckboxes(selected = []) {
  const vals = Array.isArray(selected) ? selected : (selected ? [selected] : []);
  return `<div class="check-grid wide">${state.departments.map((d) => `<label><input type="checkbox" name="departments" value="${esc(d.name)}" ${vals.includes(d.name) || vals.includes(d.id) ? "checked" : ""}> ${esc(d.name)}</label>`).join("") || `<span class="muted">Pehle department add karo.</span>`}</div>`;
}
function departmentsHiddenValue(scope) {
  return Array.from(scope.querySelectorAll('input[name="departments"]:checked')).map((x) => x.value);
}
function employeesView() {
  if (state.role !== "admin") return `<div class="card">Access denied</div>`;
  return `<div class="card"><div class="section-title"><h3>Add Employee</h3></div><form id="empForm" class="form-grid"><input name="name" placeholder="Employee name" required><input name="empId" placeholder="Employee ID" required><input name="email" type="email" placeholder="Email ID"><input name="password" placeholder="Password" required><input name="phone" placeholder="Phone"><input name="emergencyContact" placeholder="Emergency contact"><div class="wide"><label class="muted" style="font-weight:900;margin-bottom:8px;display:block">Departments</label>${deptCheckboxes()}</div><input name="role" placeholder="Role"><input name="salary" type="number" placeholder="Monthly salary ₹"><input name="paidLeave" type="number" placeholder="Paid leave" value="${esc(state.settings.defaultPaidLeave || 2)}"><input name="photoUrl" placeholder="Profile photo URL"><button class="btn primary">Add Employee</button></form></div><div class="card employee-list-card" style="margin-top:18px"><div class="section-title"><h3>Employees</h3><span class="badge blue">${state.employees.length} total</span></div><div class="table-wrap"><table class="table employee-table"><tr><th>Employee</th><th>ID</th><th>Email</th><th>Departments</th><th>Salary</th><th>Leave</th><th>Points</th><th>Status</th><th>Action</th></tr>${state.employees.map((e) => { const lb = leaveBalance(e); return `<tr><td><div class="employee-cell">${profileAvatar(e)}<div><b>${esc(e.name)}</b><small>${esc(e.role || "No role")}</small></div></div></td><td><span class="mono">${esc(e.empId)}</span></td><td><span class="email-text">${esc(e.email || "-")}</span></td><td><div class="dept-chip-wrap">${getEmployeeDepartments(e).map((d)=>`<span class="dept-chip">${esc(deptName(d))}</span>`).join("") || `<span class="muted">-</span>`}</div></td><td><b>${money(e.salary)}</b></td><td><span class="leave-text">${lb.remaining} left</span><small class="muted block">${lb.used} used / ${lb.extra} extra</small></td><td><b>${monthlyTaskPoints(e.id)}</b></td><td><span class="badge green">${esc(e.status || "Active")}</span></td><td><div class="row-actions emp-actions"><button class="btn small" data-edit-emp="${e.id}">Edit</button><button class="btn small danger" data-del-emp="${e.id}">Delete</button></div></td></tr>`; }).join("") || `<tr><td colspan="9"><p class="muted">No employee added yet.</p></td></tr>`}</table></div></div>`;
}
function deptOptions(selected = "") { return state.departments.map((d) => `<option value="${esc(d.name)}" ${selected === d.name || selected === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join(""); }
function empOptions(selected = "") { return state.employees.map((e) => `<option value="${e.id}" ${selected === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join(""); }

function departmentsView() {
  if (state.role !== "admin") return `<div class="card">Access denied</div>`;
  return `<div class="card dept-form-card"><h3>Departments</h3><form id="deptForm"><input name="name" placeholder="Department name" required><button class="btn primary">Add Department</button></form></div><div class="dept-final-grid">${state.departments.map((d) => {
    const emps = state.employees.filter((e) => employeeInDepartment(e, d));
    return `<div class="dept-final-card"><div class="dept-final-head"><div><h3>${esc(d.name)}</h3><p class="muted" style="margin:0">${emps.length} employee working</p></div><div class="row-actions"><button class="btn small" data-edit-dept="${d.id}">Edit</button><button class="btn small danger" data-del-dept="${d.id}">Delete</button></div></div><div class="dept-emp-list">${emps.map((e) => `<div class="dept-emp-row">${profileAvatar(e)}<div><b>${esc(e.name)}</b><div class="muted" style="font-size:12px">${esc(e.role || e.empId || "")}</div></div></div>`).join("") || `<p class="muted">No employee in this department</p>`}</div></div>`;
  }).join("") || `<div class="card"><p class="muted">No department added yet.</p></div>`}</div>`;
}

function tasksView() {
  const tasks = state.role === "employee" ? state.tasks.filter((t) => t.empId === state.userId) : state.tasks;
  const cols = state.role === "admin" ? ["todo", "progress", "review", "complete"] : ["todo", "progress", "review"];
  return `${state.role === "admin" ? `<div class="card"><div class="section-title"><h3>Create Task</h3></div><form id="taskForm" class="form-grid"><input name="title" placeholder="Task title" required><input name="business" placeholder="Company / Business name" required><select name="department">${deptOptions()}</select><select name="empId">${empOptions()}</select><select name="priority"><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select><input name="dueDate" type="date"><input name="estimatedHours" type="number" placeholder="Estimated hours"><input name="referenceLink" placeholder="Reference link"><textarea name="description" class="wide" placeholder="Description"></textarea><button class="btn primary">Create Task</button></form></div>` : ""}<div class="kanban" style="margin-top:18px">${cols.map((c) => `<div class="column"><h4>${statusLabel(c)} <span>${tasks.filter((t) => (t.status || "todo") === c).length}</span></h4>${taskCards(tasks.filter((t) => (t.status || "todo") === c))}</div>`).join("")}</div>`;
}
function statusLabel(s) { return ({ todo: "To Do", progress: "In Progress", review: "Review", complete: "Completed" }[s] || s); }
function taskCards(list) {
  return list.map((t) => `<div class="task-card"><div class="task-meta"><span class="badge">${esc(t.taskCode || "-")}</span><span class="badge ${priorityClass(t.priority)}">${esc(t.priority || "Medium")}</span><span class="badge">${esc(t.business || "-")}</span></div><h4>${esc(t.title)}</h4><p class="muted">${esc(t.description || "")}</p><div class="task-meta"><span class="badge">👤 ${esc(empName(t.empId))}</span><span class="badge">🏢 ${esc(deptName(t.department))}</span><span class="badge">📅 ${esc(t.dueDate || "-")}</span><span class="badge">⭐ ${esc(t.rating || "-")}/5 • ${esc(t.points || 0)} pts</span>${t.referenceLink ? `<a class="badge link" href="${esc(t.referenceLink)}" target="_blank">🔗 Ref</a>` : ""}</div><div class="row-actions">${taskActions(t)}</div></div>`).join("") || `<p class="muted">No tasks</p>`;
}
function priorityClass(p) { return p === "Urgent" ? "red" : p === "High" ? "orange" : p === "Low" ? "green" : "blue"; }
function taskActions(t) {
  const s = t.status || "todo";
  let html = `<button class="btn small" data-view-task="${t.id}">Details</button>`;
  if (state.role === "admin") {
    html += `<button class="btn small" data-edit-task="${t.id}">Edit</button><button class="btn small danger" data-del-task="${t.id}">Delete</button>`;
    if (s === "review") html += `<button class="btn small success" data-complete-task="${t.id}">Approve</button><button class="btn small warn" data-revise-task="${t.id}">Need Changes</button>`;
    if (s === "complete") html += `<button class="btn small" data-reopen-task="${t.id}">Reopen</button>`;
  } else {
    if (s === "todo") html += `<button class="btn small primary" data-task-status="${t.id}:progress">Start</button>`;
    if (s === "progress") html += `<button class="btn small primary" data-task-status="${t.id}:review">Send Review</button>`;
  }
  return html;
}

function attendanceView() {
  const emp = currentEmployee();
  if (state.role === "employee") {
    const rec = state.attendance.find((a) => a.empId === emp?.id && a.date === todayISO());
    return `<div class="cards"><div class="card kpi-card green"><p>Status</p><h3>${isSunday() ? "Sunday" : esc(rec?.status || "Not In")}</h3><small>${isSunday() ? "Auto Leave" : "Today"}</small></div><div class="card kpi-card blue"><p>Entry</p><h3>${esc(rec?.entryTime || "-")}</h3><small>Today</small></div><div class="card kpi-card purple"><p>Break</p><h3>${rec?.breakActive ? "On" : "Off"}</h3><small>${esc(rec?.breakMinutes || 0)} min</small></div><div class="card kpi-card orange"><p>Exit</p><h3>${esc(rec?.exitTime || "-")}</h3><small>Today</small></div></div><div class="card" style="margin-top:18px"><div class="row-actions"><button class="btn primary" data-entry>Entry</button><button class="btn warn" data-break-start>Break Start</button><button class="btn success" data-break-end>Break End</button><button class="btn danger" data-exit>Exit</button></div></div>`;
  }
  return `<div class="card"><h3>Attendance Records</h3><div class="table-wrap"><table class="table"><tr><th>Date</th><th>Employee</th><th>Status</th><th>Entry</th><th>Break</th><th>Exit</th></tr>${state.attendance.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map((a)=>`<tr><td>${esc(a.date)}</td><td>${esc(empName(a.empId))}</td><td>${esc(a.status)}</td><td>${esc(a.entryTime||"-")}</td><td>${esc(a.breakMinutes||0)} min</td><td>${esc(a.exitTime||"-")}</td></tr>`).join("")}</table></div></div>`;
}

function requestsView() {
  if (state.role === "employee") {
    return `<div class="card"><h3>Leave Request</h3><form id="leaveForm" class="form-grid"><input name="fromDate" type="date" required><input name="toDate" type="date" required><textarea class="wide" name="reason" placeholder="Why do you need leave?" required></textarea><button class="btn primary">Submit Leave Request</button></form></div><div class="card" style="margin-top:18px"><h3>My Leave History</h3>${leaveTable(state.leaves.filter((l)=>l.empId===state.userId))}</div>`;
  }
  return `<div class="card"><h3>Leave Requests</h3>${leaveTable(state.leaves)}</div><div class="card" style="margin-top:18px"><h3>Employee Leave Balance</h3>${leaveBalanceTable()}</div>`;
}
function leaveTable(list) {
  return `<div class="table-wrap"><table class="table"><tr><th>Employee</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Action</th></tr>${list.map((l)=>`<tr><td>${esc(empName(l.empId))}</td><td>${esc(l.fromDate)}</td><td>${esc(l.toDate)}</td><td>${esc(l.days||dateDays(l.fromDate,l.toDate))}</td><td>${esc(l.reason)}</td><td><span class="badge ${l.status==="approved"?"green":l.status==="rejected"?"red":"orange"}">${esc(l.status||"pending")}</span></td><td>${state.role==="admin"&&(!l.status||l.status==="pending")?`<button class="btn small success" data-approve-leave="${l.id}">Approve</button> <button class="btn small danger" data-reject-leave="${l.id}">Reject</button>`:"-"}</td></tr>`).join("")}</table></div>`;
}
function leaveBalanceTable() {
  return `<div class="table-wrap"><table class="table"><tr><th>Employee</th><th>Paid Limit</th><th>Used</th><th>Remaining</th><th>Extra</th></tr>${state.employees.map((e)=>{const lb=leaveBalance(e);return `<tr><td>${esc(e.name)}</td><td>${lb.paidLimit}</td><td>${lb.used}</td><td>${lb.remaining}</td><td>${lb.extra}</td></tr>`}).join("")}</table></div>`;
}

function payrollView() {
  const emps = state.role === "employee" ? [currentEmployee()].filter(Boolean) : state.employees;
  return `<div class="cards"><div class="card kpi-card green"><p>Bonus Rule</p><h3>${bonusMinTasks()} tasks</h3><small>${goodRatingMin()}★+ rating</small></div><div class="card kpi-card blue"><p>Bonus Amount</p><h3>${money(bonusAmount())}</h3><small>Performance bonus</small></div><div class="card kpi-card purple"><p>EOM Bonus</p><h3>${money(eomBonus())}</h3><small>Employee of Month</small></div><div class="card kpi-card orange"><p>Month</p><h3>${currentMonth()}</h3><small>Fresh monthly calculation</small></div></div><div class="card" style="margin-top:18px"><div class="section-title"><h3>Payroll Dashboard</h3>${state.role==="admin"?`<button class="btn primary small" data-export-payroll>Export CSV</button>`:""}</div><div class="table-wrap"><table class="table"><tr><th>Employee</th><th>Base Salary</th><th>Good Tasks</th><th>Bonus</th><th>EOM</th><th>Leave Deduction</th><th>Net Salary</th></tr>${emps.map((e)=>{const p=payrollCalc(e);return `<tr><td>${esc(e.name)}</td><td>${money(p.salary)}</td><td>${p.good}</td><td>${money(p.performanceBonus)}</td><td>${money(p.eom)}</td><td>${money(p.deduction)}</td><td><b>${money(p.net)}</b></td></tr>`}).join("")}</table></div></div><div class="card" style="margin-top:18px"><h3>Completed Task History</h3>${completedHistoryTable(emps.map(e=>e.id))}</div>`;
}

function completedHistoryView() {
  const ids = state.role === "employee" ? [state.userId] : state.employees.map((e) => e.id);
  return `<div class="card"><div class="section-title"><h3>Completed Task History - ${currentMonth()}</h3><button class="btn primary small" data-export-completed>Export Excel CSV</button></div>${completedHistoryTable(ids)}</div>`;
}
function completedHistoryTable(empIds) {
  const rows = state.tasks.filter((t) => t.status === "complete" && empIds.includes(t.empId) && monthKey(t.completedDate || todayISO()) === currentMonth()).sort((a,b)=>String(b.completedDate||"").localeCompare(String(a.completedDate||"")));
  return `<div class="table-wrap"><table class="table"><tr><th>Date</th><th>Task Code</th><th>Task</th><th>Employee</th><th>Business</th><th>Department</th><th>Rating</th><th>Points</th><th>Review</th></tr>${rows.map((t)=>`<tr><td>${esc(t.completedDate||"-")}</td><td>${esc(t.taskCode||"-")}</td><td>${esc(t.title)}</td><td>${esc(empName(t.empId))}</td><td>${esc(t.business)}</td><td>${esc(t.department)}</td><td>${esc(t.rating||"-")}/5</td><td>${esc(t.points||pointsForRating(t.rating))}</td><td>${esc(t.reviewComment||"")}</td></tr>`).join("") || `<tr><td colspan="9">No completed tasks this month</td></tr>`}</table></div>`;
}

function settingsView() {
  if (state.role !== "admin") return `<div class="card">Access denied</div>`;
  return `<div class="grid two"><div class="card"><h3>Company & Office Settings</h3><p class="muted">Yaha company branding, office timing aur break rules set karo.</p><form id="settingsForm" class="form-grid">
    <div class="field"><label>Company Name</label><input name="companyName" value="${esc(state.settings.companyName||"Hridhyam Creation")}" placeholder="Hridhyam Creation"></div>
    <div class="field"><label>Owner / Admin Greeting Name</label><input name="ownerName" value="${esc(state.settings.ownerName||"Boss")}" placeholder="Boss"></div>
    <div class="field"><label>Company Code</label><input name="companyCode" value="${esc(state.settings.companyCode||"HC")}" placeholder="HC"></div>
    <div class="field wide"><label>Company Tagline</label><input name="companyTagline" value="${esc(state.settings.companyTagline||"Office Attendance & Work Management")}" placeholder="Office Attendance & Work Management"></div>
    <div class="field"><label>Office Start Time</label><input name="officeStart" type="time" value="${esc(state.settings.officeStart||"10:00")}"></div><div class="field"><label>Office End Time</label><input name="officeEnd" type="time" value="${esc(state.settings.officeEnd||"19:00")}"></div><div class="field"><label>Grace Minutes</label><input name="graceMinutes" type="number" value="${esc(state.settings.graceMinutes||10)}"></div><div class="field"><label>Break Minutes</label><input name="breakMinutes" type="number" value="${esc(state.settings.breakMinutes||45)}"></div><div class="field"><label>Default Paid Leave</label><input name="defaultPaidLeave" type="number" value="${esc(state.settings.defaultPaidLeave||2)}"></div><div class="field"><label>Weekly Off</label><select name="weeklyOff"><option selected>Sunday</option></select></div><div class="field wide"><label>Company Logo URL</label><input name="companyLogo" value="${esc(state.settings.companyLogo||"")}" placeholder="Logo image URL"></div><div class="field wide"><label>Announcement</label><textarea name="announcement">${esc(state.settings.announcement||"")}</textarea></div><button class="btn primary settings-save-btn">Save Office Settings</button></form></div><div class="card"><h3>Payroll Bonus Rules</h3><p class="muted">Bonus good rating aur completed task count ke basis par milega.</p><form id="bonusForm" class="form-grid"><div class="field"><label>Minimum Good Rating</label><input name="goodRatingMin" type="number" min="1" max="5" value="${esc(state.settings.goodRatingMin||4)}"></div><div class="field"><label>Minimum Good Tasks</label><input name="bonusMinTasks" type="number" value="${esc(state.settings.bonusMinTasks||10)}"></div><div class="field"><label>Performance Bonus Amount</label><input name="bonusAmount" type="number" value="${esc(state.settings.bonusAmount||1000)}"></div><div class="field"><label>Employee of Month Bonus</label><input name="eomBonus" type="number" value="${esc(state.settings.eomBonus||1000)}"></div><div class="field wide"><label>Employee of the Month</label><select name="employeeOfMonthId"><option value="">Auto / Not selected</option>${state.employees.map((e)=>`<option value="${e.id}" ${state.settings.employeeOfMonthId===e.id?"selected":""}>${esc(e.name)} - ${goodRatedTaskCount(e.id)} good tasks</option>`).join("")}</select></div><button class="btn primary settings-save-btn">Save Bonus Rules</button></form></div></div>`;
}

function bindViewActions() {
  const empForm = $("#empForm"); if (empForm) empForm.onsubmit = addEmployee;
  const deptForm = $("#deptForm"); if (deptForm) deptForm.onsubmit = addDepartment;
  const taskForm = $("#taskForm"); if (taskForm) taskForm.onsubmit = addTask;
  const leaveForm = $("#leaveForm"); if (leaveForm) leaveForm.onsubmit = addLeave;
  const settingsForm = $("#settingsForm"); if (settingsForm) settingsForm.onsubmit = saveSettings;
  const bonusForm = $("#bonusForm"); if (bonusForm) bonusForm.onsubmit = saveSettings;
  document.querySelectorAll("[data-edit-emp]").forEach((b)=>b.onclick=()=>editEmployee(b.dataset.editEmp));
  document.querySelectorAll("[data-del-emp]").forEach((b)=>b.onclick=()=>delDoc("employees", b.dataset.delEmp, "Delete employee?"));
  document.querySelectorAll("[data-edit-dept]").forEach((b)=>b.onclick=()=>editDepartment(b.dataset.editDept));
  document.querySelectorAll("[data-del-dept]").forEach((b)=>b.onclick=()=>delDoc("departments", b.dataset.delDept, "Delete department?"));
  document.querySelectorAll("[data-edit-task]").forEach((b)=>b.onclick=()=>editTask(b.dataset.editTask));
  document.querySelectorAll("[data-del-task]").forEach((b)=>b.onclick=()=>delDoc("tasks", b.dataset.delTask, "Delete task?"));
  document.querySelectorAll("[data-task-status]").forEach((b)=>b.onclick=()=>{const [id,status]=b.dataset.taskStatus.split(":");updateTaskStatus(id,status);});
  document.querySelectorAll("[data-complete-task]").forEach((b)=>b.onclick=()=>completeTask(b.dataset.completeTask));
  document.querySelectorAll("[data-revise-task]").forEach((b)=>b.onclick=()=>reviseTask(b.dataset.reviseTask));
  document.querySelectorAll("[data-reopen-task]").forEach((b)=>b.onclick=()=>updateTaskStatus(b.dataset.reopenTask,"review"));
  document.querySelectorAll("[data-view-task]").forEach((b)=>b.onclick=()=>viewTask(b.dataset.viewTask));
  document.querySelectorAll("[data-approve-leave]").forEach((b)=>b.onclick=()=>updateDoc(doc(db,"leave_requests",b.dataset.approveLeave),{status:"approved",updatedAt:serverTimestamp()}));
  document.querySelectorAll("[data-reject-leave]").forEach((b)=>b.onclick=()=>updateDoc(doc(db,"leave_requests",b.dataset.rejectLeave),{status:"rejected",updatedAt:serverTimestamp()}));
  document.querySelector("[data-entry]")?.addEventListener("click", markEntry);
  document.querySelector("[data-break-start]")?.addEventListener("click", markBreakStart);
  document.querySelector("[data-break-end]")?.addEventListener("click", markBreakEnd);
  document.querySelector("[data-exit]")?.addEventListener("click", markExit);
  document.querySelector("[data-export-completed]")?.addEventListener("click", exportCompletedTasks);
  document.querySelector("[data-export-payroll]")?.addEventListener("click", exportPayroll);
  document.querySelector("[data-eom-set]")?.addEventListener("click", setEomModal);
}
async function addEmployee(e) { e.preventDefault(); const form=e.target; const data=Object.fromEntries(new FormData(form).entries()); const departments=departmentsHiddenValue(form); if(!departments.length) return toast("Select at least one department","error"); if(state.employees.some(x=>x.empId===data.empId || (data.email && x.email===data.email))) return toast("Employee ID or email already exists","error"); await addDoc(collection(db,"employees"),{...data,departments,department:departments[0],status:"Active",createdAt:serverTimestamp()}); form.reset(); toast("Employee added"); }
async function addDepartment(e) { e.preventDefault(); const name=new FormData(e.target).get("name").trim(); if(state.departments.some(d=>d.name.toLowerCase()===name.toLowerCase())) return toast("Department already exists","error"); await addDoc(collection(db,"departments"),{name,createdAt:serverTimestamp()}); e.target.reset(); toast("Department added"); }
async function addTask(e) { e.preventDefault(); const data=Object.fromEntries(new FormData(e.target).entries()); const prefix=(data.business||"OAS").split(" ")[0].slice(0,3).toUpperCase(); const count=state.tasks.length+1; await addDoc(collection(db,"tasks"),{...data,taskCode:`${prefix}-${String(count).padStart(4,"0")}`,status:"todo",rating:0,points:0,createdAt:todayISO(),updatedAt:todayISO()}); e.target.reset(); toast("Task created"); }
async function addLeave(e) { e.preventDefault(); const data=Object.fromEntries(new FormData(e.target).entries()); await addDoc(collection(db,"leave_requests"),{...data,empId:state.userId,days:dateDays(data.fromDate,data.toDate),status:"pending",createdAt:todayISO()}); e.target.reset(); toast("Leave request sent"); }
async function saveSettings(e) { e.preventDefault(); const data=Object.fromEntries(new FormData(e.target).entries()); await setDoc(doc(db,"settings","office"),{...state.settings,...data},{merge:true}); toast("Settings saved"); }
async function delDoc(col,id,title){ if(await confirmBox(title,"This action cannot be undone.")){ await deleteDoc(doc(db,col,id)); toast("Deleted"); }}
async function editEmployee(id){ const e=empById(id); if(!e) return; await modal({title:"Edit Employee", submitText:"Save Changes", body:`<div class="form-grid"><div class="field"><label>Name</label><input name="name" value="${esc(e.name)}" required></div><div class="field"><label>Employee ID</label><input name="empId" value="${esc(e.empId)}" required></div><div class="field"><label>Email ID</label><input name="email" type="email" value="${esc(e.email||"")}"></div><div class="field"><label>Password</label><input name="password" value="${esc(e.password)}" required></div><div class="field"><label>Role</label><input name="role" value="${esc(e.role||"")}"></div><div class="field"><label>Phone</label><input name="phone" value="${esc(e.phone||"")}"></div><div class="field"><label>Emergency Contact</label><input name="emergencyContact" value="${esc(e.emergencyContact||"")}"></div><div class="field"><label>Salary</label><input name="salary" type="number" value="${esc(e.salary||0)}"></div><div class="field"><label>Paid Leave</label><input name="paidLeave" type="number" value="${esc(e.paidLeave||state.settings.defaultPaidLeave||2)}"></div><div class="field wide"><label>Departments</label>${deptCheckboxes(getEmployeeDepartments(e))}</div><div class="field wide"><label>Profile Photo URL</label><input name="photoUrl" value="${esc(e.photoUrl||"")}"></div></div>`, onSubmit: async(data)=>{ const backdrop=document.querySelector(".modal-backdrop"); const departments=departmentsHiddenValue(backdrop); if(!departments.length) throw new Error("Select at least one department"); await updateDoc(doc(db,"employees",id),{...data,departments,department:departments[0]}); toast("Employee updated");}}); }
async function editDepartment(id){ const d=state.departments.find(x=>x.id===id); if(!d) return; await modal({title:"Edit Department", body:`<div class="field"><label>Department Name</label><input name="name" value="${esc(d.name)}" required></div>`, onSubmit:async(data)=>{await updateDoc(doc(db,"departments",id),data); toast("Department updated");}}); }
async function editTask(id){ const t=state.tasks.find(x=>x.id===id); if(!t)return; await modal({title:"Edit Task", wide:true, body:`<div class="form-grid"><div class="field"><label>Title</label><input name="title" value="${esc(t.title)}" required></div><div class="field"><label>Company / Business</label><input name="business" value="${esc(t.business||"")}" placeholder="Company / Business name" required></div><div class="field"><label>Department</label><select name="department">${deptOptions(t.department)}</select></div><div class="field"><label>Employee</label><select name="empId">${empOptions(t.empId)}</select></div><div class="field"><label>Priority</label><select name="priority"><option ${t.priority==="Low"?"selected":""}>Low</option><option ${t.priority==="Medium"?"selected":""}>Medium</option><option ${t.priority==="High"?"selected":""}>High</option><option ${t.priority==="Urgent"?"selected":""}>Urgent</option></select></div><div class="field"><label>Due Date</label><input name="dueDate" type="date" value="${esc(t.dueDate||"")}"></div><div class="field"><label>Estimated Hours</label><input name="estimatedHours" type="number" value="${esc(t.estimatedHours||"")}"></div><div class="field wide"><label>Reference Link</label><input name="referenceLink" value="${esc(t.referenceLink||"")}"></div><div class="field wide"><label>Description</label><textarea name="description">${esc(t.description||"")}</textarea></div></div>`, onSubmit: async(data)=>{await updateDoc(doc(db,"tasks",id),{...data,updatedAt:todayISO()}); toast("Task updated");}}); }
async function viewTask(id){ const t=state.tasks.find(x=>x.id===id); if(!t)return; await modal({title:`Task Details - ${t.taskCode||""}`, submitText:"Close", body:`<p><b>${esc(t.title)}</b></p><p class="muted">${esc(t.description||"")}</p><div class="task-meta"><span class="badge">${esc(t.business)}</span><span class="badge">${esc(t.department)}</span><span class="badge">${esc(empName(t.empId))}</span><span class="badge">${esc(t.status)}</span><span class="badge">⭐ ${esc(t.rating||"-")}/5</span></div>${t.referenceLink?`<p><a class="link" target="_blank" href="${esc(t.referenceLink)}">Open Reference Link</a></p>`:""}<p><b>Admin Review:</b> ${esc(t.reviewComment||"-")}</p>`, onSubmit: async()=>{} }); }
async function updateTaskStatus(id,status){ await updateDoc(doc(db,"tasks",id),{status,updatedAt:todayISO()}); toast("Task updated"); }
async function completeTask(id){ const t=state.tasks.find(x=>x.id===id); if(!t)return; await modal({title:"Approve Task", submitText:"Approve", body:`<div class="field"><label>Rating 1-5</label><input name="rating" type="number" min="1" max="5" value="5" required></div><div class="field"><label>Review Comment</label><textarea name="reviewComment" placeholder="Good work / changes notes"></textarea></div>`, onSubmit:async(data)=>{const rating=Number(data.rating); await updateDoc(doc(db,"tasks",id),{status:"complete",rating,points:pointsForRating(rating),reviewComment:data.reviewComment||"",completedDate:todayISO(),updatedAt:todayISO()}); toast("Task approved");}}); }
async function reviseTask(id){ await modal({title:"Need Changes", submitText:"Send Revision", body:`<div class="field"><label>Revision Message</label><textarea name="reviewComment" required></textarea></div>`, onSubmit:async(data)=>{await updateDoc(doc(db,"tasks",id),{status:"progress",reviewComment:data.reviewComment,updatedAt:todayISO()}); toast("Revision sent");}}); }
async function setEomModal(){ await modal({title:"Set Employee of the Month", body:`<div class="field"><label>Employee</label><select name="employeeOfMonthId"><option value="">Auto / None</option>${state.employees.map(e=>`<option value="${e.id}" ${state.settings.employeeOfMonthId===e.id?"selected":""}>${esc(e.name)} - ${goodRatedTaskCount(e.id)} good tasks</option>`).join("")}</select></div>`, onSubmit: async(data)=>{await setDoc(doc(db,"settings","office"),{...state.settings,employeeOfMonthId:data.employeeOfMonthId},{merge:true}); toast("Employee of month updated");}}); }
async function markEntry(){ if(isSunday()) return toast("Sunday is auto leave", "error"); const emp=currentEmployee(); const existing=state.attendance.find(a=>a.empId===emp.id&&a.date===todayISO()); if(existing) return toast("Entry already marked", "error"); await addDoc(collection(db,"attendance"),{empId:emp.id,date:todayISO(),status:"present",entryTime:new Date().toLocaleTimeString(),breakMinutes:0,breakActive:false,createdAt:serverTimestamp()}); toast("Entry marked"); }
async function markBreakStart(){ const rec=state.attendance.find(a=>a.empId===state.userId&&a.date===todayISO()); if(!rec) return toast("Mark entry first","error"); await updateDoc(doc(db,"attendance",rec.id),{breakActive:true,breakStart:Date.now()}); toast("Break started"); }
async function markBreakEnd(){ const rec=state.attendance.find(a=>a.empId===state.userId&&a.date===todayISO()); if(!rec||!rec.breakActive) return toast("No active break","error"); const mins=Math.round((Date.now()-Number(rec.breakStart||Date.now()))/60000); await updateDoc(doc(db,"attendance",rec.id),{breakActive:false,breakMinutes:Number(rec.breakMinutes||0)+mins}); toast("Break ended"); }
async function markExit(){ const rec=state.attendance.find(a=>a.empId===state.userId&&a.date===todayISO()); if(!rec) return toast("Mark entry first","error"); await updateDoc(doc(db,"attendance",rec.id),{exitTime:new Date().toLocaleTimeString()}); toast("Exit marked"); }
function exportCompletedTasks(){ const ids=state.role==="employee"?[state.userId]:state.employees.map(e=>e.id); const rows=state.tasks.filter(t=>t.status==="complete"&&ids.includes(t.empId)&&monthKey(t.completedDate||todayISO())===currentMonth()); const header=["Date","Task Code","Task","Employee","Business","Department","Rating","Points","Admin Review"]; const csv=[header, ...rows.map(t=>[t.completedDate||"-",t.taskCode||"-",t.title||"-",empName(t.empId),t.business||"-",t.department||"-",`${t.rating||"-"}/5`,t.points||pointsForRating(t.rating),t.reviewComment||""])].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"); downloadCsv(csv,`completed-tasks-${currentMonth()}.csv`); }
function exportPayroll(){ const header=["Employee","Base Salary","Good Tasks","Performance Bonus","EOM Bonus","Leave Deduction","Net Salary"]; const csv=[header,...state.employees.map(e=>{const p=payrollCalc(e);return [e.name,p.salary,p.good,p.performanceBonus,p.eom,p.deduction,p.net];})].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"); downloadCsv(csv,`payroll-${currentMonth()}.csv`); }
function downloadCsv(csv,name){ const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); toast("CSV exported"); }

window.addEventListener("DOMContentLoaded", async () => { ensureStyles(); state.role = null; state.userId = null; renderLogin(); });
