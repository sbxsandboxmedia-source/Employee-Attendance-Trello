<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - SBX Portal</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="header">
        <h2>Admin Management Panel</h2>
        <button id="logoutBtn" style="width:auto;">Logout</button>
    </div>

    <div class="grid-container">
        <div>
            <div class="card">
                <h3>Add New Employee</h3>
                <form id="addEmployeeForm">
                    <input type="text" id="empName" placeholder="Full Name" required>
                    <input type="email" id="empEmail" placeholder="Email Address" required>
                    <input type="password" id="empPassword" placeholder="Set Password" required>
                    <button type="submit" class="btn-success">Register Employee</button>
                </form>
            </div>

            <div class="card">
                <h3>Create & Assign Task</h3>
                <form id="createTaskForm">
                    <input type="text" id="taskTitle" placeholder="Task Title" required>
                    <textarea id="taskDesc" placeholder="Task Description" style="width:100%; padding:10px; margin-bottom:10px; border-radius:5px; border:1px solid #ccc;"></textarea>
                    <select id="assignToSelect" required>
                        <option value="">Choose Employee...</option>
                    </select>
                    <input type="date" id="taskDueDate" required>
                    <button type="submit">Assign Task</button>
                </form>
            </div>
        </div>

        <div>
            <div class="card">
                <h3>Live Employee Logs</h3>
                <div id="liveLogsContainer" style="margin-top:15px;">
                    <p style="color:#718096;">Loading tracking logs...</p>
                </div>
            </div>
        </div>
    </div>

    <script type="module" src="app.js"></script>
    <script type="module">
        import { registerEmployee, createTask, loadEmployeesForAdmin, listenToAttendanceLive, logoutUser } from './app.js';
        
        document.getElementById('logoutBtn').addEventListener('click', logoutUser);
        
        document.getElementById('addEmployeeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            registerEmployee(
                document.getElementById('empName').value,
                document.getElementById('empEmail').value,
                document.getElementById('empPassword').value
            );
            e.target.reset();
        });

        document.getElementById('createTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            createTask(
                document.getElementById('taskTitle').value,
                document.getElementById('taskDesc').value,
                document.getElementById('assignToSelect').value,
                document.getElementById('taskDueDate').value
            );
            e.target.reset();
        });

        // Dropdown data array update aur live tracking register karein
        loadEmployeesForAdmin('assignToSelect');
        listenToAttendanceLive('liveLogsContainer');
    </script>
</body>
</html>
