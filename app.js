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

const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

const todayStr = () => new Date().toISOString().split('T')[0];

// ==========================================
// AUTHENTICATION LOGIC
// ==========================================
export async function loginUser(email, password) {
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        // Purane 'employees' collection se role check karein
        const userDoc = await getDoc(doc(db, "employees", cred.user.uid));
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            if (role === "admin") window.location.href = "admin.html";
            else window.location.href = "employee.html";
        } else {
            // Agar employee collection me role field nahi hai, to default employee dashboard par bhejein
            window.location.href = "employee.html";
        }
    } catch (err) { alert("Error logging in: " + err.message); }
}

export function logoutUser() {
    signOut(auth).then(() => { window.location.href = "index.html"; });
}

// ==========================================
// ADMIN DASHBOARD LOGIC (Aapke Existing Data Ke Liye)
// ==========================================
export async function registerEmployee(name, email, password) {
    try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        // Naye registration ko bhi aapke purane 'employees' collection me add karega
        await setDoc(doc(db, "employees", cred.user.uid), {
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
    // Aapke purane 'employees' collection se live data fetch karega
    onSnapshot(collection(db, "employees"), (snapshot) => {
        select.innerHTML = '<option value="">Choose Employee...</option>';
        snapshot.forEach((doc) => {
            const data = doc.data();
            if(data.role !== 'admin') {
                // Agar field ka naam 'name' ya 'empName' kuch bhi ho, backup handler laga diya hai
                const empName = data.name || data.empName || data.email;
                select.innerHTML += `<option value="${doc.id}">${empName}</option>`;
            }
        });
    });
}

export function listenToAttendanceLive(containerId) {
    const container = document.getElementById(containerId);
    onSnapshot(collection(db, "attendance"), (snapshot) => {
        container.innerHTML = "";
        if (snapshot.empty) { container.innerHTML = "<p>No logs recorded today.</p>"; return; }
        
        snapshot.forEach(async (attendanceDoc) => {
            const log = attendanceDoc.data();
            // Aapke data structure ke mutabik 'empId' check karega
            const employeeId = log.empId || log.employee_id;
            
            if (!employeeId) return;

            const userSnap = await getDoc(doc(db, "employees", employeeId));
            const name = userSnap.exists() ? (userSnap.data().name || userSnap.data().email) : "Employee (" + employeeId.substring(0,5) + ")";
            
            const formatTime = (timeVal) => {
                if (!timeVal) return "--:--";
                // Agar date string format me save hai to direct slice, agar Firebase Timestamp hai to convert karega
                if (typeof timeVal === 'string') return timeVal.includes('T') ? timeVal.split('T')[1].substring(0,5) : timeVal;
                return new Date(timeVal.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            };
            
            container.innerHTML += `
                <div style="padding:10px; border-bottom:1px solid #eee;">
                    <strong>${name}</strong> (${log.date || todayStr()}) <br>
                    <span style="color:green;">In: ${formatTime(log.entry || log.check_in)}</span> | 
                    <span style="color:orange;">Break: ${formatTime(log.breaks ? log.breaks.createdAt : log.break_start)}</span> | 
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
        
        const docRef = doc(db, "employees", user.uid);
        const userSnap = await getDoc(docRef);
        if(userSnap.exists()) document.getElementById('welcomeText').innerText = `Welcome, ${userSnap.data().name || userSnap.data().email}`;

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
            const hasCheckedIn = data.entry || data.check_in;
            const hasCheckedOut = data.check_out;

            if (hasCheckedIn && !data.breaks && !hasCheckedOut) {
                statusText.innerText = "Status: Working active";
                cInBtn.disabled = true; bStartBtn.disabled = false; bEndBtn.style.display="none"; bStartBtn.style.display="block"; cOutBtn.disabled = false;
            } else if (data.breaks && (!data.breaks.end && !data.break_end)) {
                statusText.innerText = "Status: On Break";
                bStartBtn.style.display = "none"; bEndBtn.style.display = "block"; cOutBtn.disabled = true;
            } else if (hasCheckedOut) {
                statusText.innerText = "Status: Shift Completed (Checked Out)";
                cInBtn.disabled = true; bStartBtn.disabled = true; bEndBtn.disabled = true; cOutBtn.disabled = true;
            }
        });

        document.getElementById('btnCheckIn').onclick = () => setDoc(attRef, { empId: user.uid, date: todayStr(), entry: new Date().toISOString() }, { merge: true });
        document.getElementById('btnBreakStart').onclick = () => updateDoc(attRef, { "breaks.createdAt": new Date().toISOString() });
        document.getElementById('btnBreakEnd').onclick = () => updateDoc(attRef, { "breaks.end": new Date().toISOString() });
        document.getElementById('btnCheckOut').onclick = () => updateDoc(attRef, { check_out: new Date().toISOString() });
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
                        <p>${task.description || ''}</p>
                        <p><strong>Due:</strong> ${task.due_date || task.dueDate || ''}</p>
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

window.moveTask = async (taskId, newStatus) => {
    await updateDoc(doc(db, "tasks", taskId), { status: newStatus });
};
