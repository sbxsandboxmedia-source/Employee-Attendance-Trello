import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZtoOSWol93ptjdQpm4QHQWShcVr7aQXc",
  authDomain: "employee-tracker-988ab.firebaseapp.com",
  projectId: "employee-tracker-988ab",
  storageBucket: "employee-tracker-988ab.firebasestorage.app",
  messagingSenderId: "387191923861",
  appId: "1:387191923861:web:5bf9054516f3328219a79c",
  measurementId: "G-MR53B8T617"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Secondary application instance taaki Admin logged-in reh kar naye employees trigger kar sake
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

const todayStr = () => new Date().toISOString().split('T')[0];

// ==========================================
// AUTHENTICATION LOGIC
// ==========================================
export async function loginUser(email, password) {
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", cred.user.uid));
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role === "admin") window.location.href = "admin.html";
            else window.location.href = "employee.html";
        }
    } catch (err) { alert("Error logging in: " + err.message); }
}

export function logoutUser() {
    signOut(auth).then(() => { window.location.href = "index.html"; });
}

// ==========================================
// ADMIN DASHBOARD LOGIC
// ==========================================
export async function registerEmployee(name, email, password) {
    try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
            name: name,
            email: email,
            role: "employee"
        });
        await signOut(secondaryAuth);
        alert(`Employee ${name} registered successfully!`);
    } catch (err) { alert("Registration error: " + err.message); }
}

export async function loadEmployeesForAdmin(dropdownId) {
    const select = document.getElementById(dropdownId);
    onSnapshot(collection(db, "users"), (snapshot) => {
        select.innerHTML = '<option value="">Choose Employee...</option>';
        snapshot.forEach((doc) => {
            const data = doc.data();
            if(data.role !== 'admin') {
                select.innerHTML += `<option value="${doc.id}">${data.name}</option>`;
            }
        });
    });
}

export function listenToAttendanceLive(containerId) {
    const container = document.getElementById(containerId);
    onSnapshot(collection(db, "attendance"), async (snapshot) => {
        container.innerHTML = "";
        if (snapshot.empty) { container.innerHTML = "<p>No logs recorded today.</p>"; return; }
        
        snapshot.forEach(async (attendanceDoc) => {
            const log = attendanceDoc.data();
            const userSnap = await getDoc(doc(db, "users", log.employee_id));
            const name = userSnap.exists() ? userSnap.data().name : "Unknown Employee";
            
            const formatTime = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleTimeString() : "--:--";
            
            container.innerHTML += `
                <div style="padding:10px; border-bottom:1px solid #eee;">
                    <strong>${name}</strong> (${log.date}) <br>
                    <span style="color:green;">In: ${formatTime(log.check_in)}</span> | 
                    <span style="color:orange;">Break Start: ${formatTime(log.break_start)}</span> | 
                    <span style="color:blue;">Break End: ${formatTime(log.break_end)}</span> | 
                    <span style="color:red;">Out: ${formatTime(log.check_out)}</span>
                </div>`;
        });
    });
}

export async function createTask(title, desc, employeeId, dueDate) {
    try {
        await addDoc(collection(db, "tasks"), {
            title: title,
            description: desc,
            assigned_to: employeeId,
            due_date: dueDate,
            status: "todo"
        });
        alert("Task distributed via Pipeline.");
    } catch(err) { alert(err.message); }
}

// ==========================================
// EMPLOYEE ATTENDANCE & KANBAN LOGIC
// ==========================================
export function setupEmployeeAttendanceUI() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        
        const docRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(docRef);
        if(userSnap.exists()) document.getElementById('welcomeText').innerText = `Welcome, ${userSnap.data().name}`;

        const attRef = doc(db, "attendance", `${user.uid}_${todayStr()}`);
        
        onSnapshot(attRef, (docSnap) => {
            const statusText = document.getElementById('attendanceStatusText');
            const cInBtn = document.getElementById('btnCheckIn');
            const bStartBtn = document.getElementById('btnBreakStart');
            const bEndBtn = document.getElementById('btnBreakEnd');
            const cOutBtn = document.getElementById('btnCheckOut');

            if (!docSnap.exists()) {
                statusText.innerText = "Status: Not Checked In";
                cInBtn.disabled = false; bStartBtn.disabled = true; cOutBtn.disabled = true;
                return;
            }

            const data = docSnap.data();
            if (data.check_in && !data.break_start && !data.check_out) {
                statusText.innerText = "Status: Working active";
                cInBtn.disabled = true; bStartBtn.disabled = false; bEndBtn.style.display="none"; bStartBtn.style.display="block"; cOutBtn.disabled = false;
            } else if (data.break_start && !data.break_end) {
                statusText.innerText = "Status: On Break";
                bStartBtn.style.display = "none"; bEndBtn.style.display = "block"; cOutBtn.disabled = true;
            } else if (data.break_end && !data.check_out) {
                statusText.innerText = "Status: Returned from Break / Working";
                bEndBtn.style.display = "none"; bStartBtn.style.display = "block"; bStartBtn.disabled = false; cOutBtn.disabled = false;
            } else if (data.check_out) {
                statusText.innerText = "Status: Shift Completed (Checked Out)";
                cInBtn.disabled = true; bStartBtn.disabled = true; bEndBtn.disabled = true; cOutBtn.disabled = true;
            }
        });

        // Click Triggers setup
        document.getElementById('btnCheckIn').onclick = () => setDoc(attRef, { employee_id: user.uid, date: todayStr(), check_in: new Date() }, { merge: true });
        document.getElementById('btnBreakStart').onclick = () => updateDoc(attRef, { break_start: new Date() });
        document.getElementById('btnBreakEnd').onclick = () => updateDoc(attRef, { break_end: new Date() });
        document.getElementById('btnCheckOut').onclick = () => updateDoc(attRef, { check_out: new Date() });
    });
}

export function setupEmployeeTasksUI() {
    onAuthStateChanged(auth, (user) => {
        if (!user) return;

        const q = query(collection(db, "tasks"), where("assigned_to", "==", user.uid));
        onSnapshot(q, (snapshot) => {
            document.getElementById('todo-tasks').innerHTML = '';
            document.getElementById('progress-tasks').innerHTML = '';
            document.getElementById('done-tasks').innerHTML = '';

            snapshot.forEach((taskDoc) => {
                const task = taskDoc.data();
                const id = taskDoc.id;
                const html = `
                    <div class="task-card">
                        <h4>${task.title}</h4>
                        <p>${task.description}</p>
                        <p><strong>Due:</strong> ${task.due_date}</p>
                        <div class="task-actions">
                            ${task.status !== 'todo' ? `<button onclick="window.moveTask('${id}', 'todo')">⏮ To Do</button>` : ''}
                            ${task.status !== 'progress' ? `<button onclick="window.moveTask('${id}', 'progress')">⚙ Work</button>` : ''}
                            ${task.status !== 'done' ? `<button onclick="window.moveTask('${id}', 'done')">✅ Done</button>` : ''}
                        </div>
                    </div>`;
                document.getElementById(`${task.status}-tasks`).innerHTML += html;
            });
        });
    });
}

// Global scope injection buttons shift execution ke liye
window.moveTask = async (taskId, newStatus) => {
    await updateDoc(doc(db, "tasks", taskId), { status: newStatus });
};
