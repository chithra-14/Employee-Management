/* ================= EMPLOYEE MANAGEMENT FRONTEND ================= */
const API_BASE = "http://localhost:5000/api";
// This must be the _id of the Employee document in MongoDB, not an Attendance _id.
const EMPLOYEE_ID = "6ab23e38842e51464d2a47b3";
const LEAVE_STORAGE_KEY = "empTrackLeaveRequests";
const PROFILE_STORAGE_KEY = "empTrackProfile";

let attendanceRecords = [];

function showPage(pageName, clickedButton) {
    document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
    const selectedPage = document.getElementById(pageName);
    if (selectedPage) selectedPage.classList.remove("hidden");

    const title = pageName.charAt(0).toUpperCase() + pageName.slice(1);
    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle) pageTitle.textContent = title;

    document.querySelectorAll(".menu").forEach(button => button.classList.remove("active"));
    if (clickedButton) clickedButton.classList.add("active");

    if (pageName === "attendance" || pageName === "dashboard" || pageName === "analytics") {
        loadAttendance().catch(() => showNotice("Could not refresh attendance. Check that the backend is running."));
    }
    if (pageName === "leave") renderLeaveRequests();
}

function showNotice(message) {
    // Use a small accessible notice when the page includes the notice region; otherwise use alert.
    let notice = document.getElementById("appNotice");
    if (!notice) {
        notice = document.createElement("div");
        notice.id = "appNotice";
        notice.className = "app-notice";
        notice.setAttribute("role", "status");
        document.querySelector(".main")?.prepend(notice);
    }
    notice.textContent = message;
    notice.classList.add("visible");
    window.clearTimeout(showNotice.timeoutId);
    showNotice.timeoutId = window.setTimeout(() => notice.classList.remove("visible"), 4500);
}

function openLeaveForm() {
    document.getElementById("leaveForm")?.classList.remove("hidden");
    const leaveButton = document.querySelectorAll(".menu")[2];
    showPage("leave", leaveButton);
    document.getElementById("leaveForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeLeaveForm() {
    document.getElementById("leaveForm")?.classList.add("hidden");
}

function getLeaveRequests() {
    try { return JSON.parse(localStorage.getItem(LEAVE_STORAGE_KEY) || "[]"); }
    catch { return []; }
}

function countLeaveDays(from, to) {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    return Math.round((end - start) / 86400000) + 1;
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function renderLeaveRequests() {
    const table = document.getElementById("leaveTable");
    if (!table) return;
    const requests = getLeaveRequests();
    table.replaceChildren();
    if (!requests.length) {
        const row = table.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.className = "empty-state";
        cell.textContent = "No leave requests submitted in this browser yet.";
    } else {
        requests.slice().reverse().forEach(request => {
            const row = table.insertRow();
            [request.type, formatDate(request.from), formatDate(request.to), request.days].forEach(value => {
                row.insertCell().textContent = value;
            });
            const statusCell = row.insertCell();
            const badge = document.createElement("span");
            badge.className = `status ${request.status === "Approved" ? "approved" : "pending"}`;
            badge.textContent = request.status;
            statusCell.appendChild(badge);
        });
    }
    const pending = requests.filter(item => item.status === "Pending").length;
    const pendingCard = [...document.querySelectorAll("#leave .stat-card")].find(card => card.textContent.includes("Pending Requests"));
    if (pendingCard) pendingCard.querySelector("h2").textContent = pending;
}

function submitLeave() {
    const type = document.getElementById("leaveType")?.value || "Casual Leave";
    const from = document.getElementById("fromDate")?.value;
    const to = document.getElementById("toDate")?.value;
    const reason = document.getElementById("reason")?.value.trim();

    if (!from || !to || !reason) return showNotice("Please complete all leave request fields.");
    if (to < from) return showNotice("To Date must be on or after From Date.");
    if (from < new Date().toISOString().slice(0, 10)) return showNotice("Please choose today or a future date.");

    const requests = getLeaveRequests();
    requests.push({ id: Date.now(), type, from, to, days: countLeaveDays(from, to), reason, status: "Pending", createdAt: new Date().toISOString() });
    localStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(requests));
    renderLeaveRequests();
    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";
    document.getElementById("reason").value = "";
    closeLeaveForm();
    showNotice("Leave request saved in this browser and marked Pending.");
}

async function apiRequest(path, options = {}) {
    
const token = sessionStorage.getItem("authToken");

const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(options.headers || {})
    }
});

if (response.status === 401) {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("currentUser");
    window.location.replace("login.html");
    throw new Error("Session expired. Please log in again.");
}

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw }; }
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
}

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()) && /T/.test(value)) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return value;
}

async function markAttendance() {
    if (!EMPLOYEE_ID || EMPLOYEE_ID === "YOUR_ACTUAL_EMPLOYEE_ID") {
        return showNotice("Set EMPLOYEE_ID in script.js to the employee document _id from MongoDB.");
    }
    try {
        const existing = await apiRequest("/attendance");
        const today = getLocalDateString();
        const alreadyCheckedIn = existing.find(record => {
            const recordEmployeeId = typeof record.employeeId === "object" ? record.employeeId?._id : record.employeeId;
            return recordEmployeeId === EMPLOYEE_ID && record.date === today;
        });
        if (alreadyCheckedIn) {
            localStorage.setItem("attendanceId", alreadyCheckedIn._id);
            if (alreadyCheckedIn.checkOut) return showNotice("Attendance is already checked in and checked out for today.");
            return showNotice("You have already checked in today. Use Check Out when your workday ends.");
        }
        const data = await apiRequest("/attendance/checkin", { method: "POST", body: JSON.stringify({ employeeId: EMPLOYEE_ID }) });
        localStorage.setItem("attendanceId", data._id);
        showNotice(`Attendance marked successfully. Check-in: ${data.checkIn || "recorded"}`);
        await loadAttendance();
    } catch (error) {
        console.error("Check-in error:", error);
        showNotice(`Check-in failed: ${error.message}. Confirm the backend is running and EMPLOYEE_ID is correct.`);
    }
}

async function checkoutAttendance() {
    let attendanceId = localStorage.getItem("attendanceId");
    try {
        if (!attendanceId) {
            const records = await apiRequest("/attendance");
            const today = getLocalDateString();
            const record = records.find(item => {
                const id = typeof item.employeeId === "object" ? item.employeeId?._id : item.employeeId;
                return id === EMPLOYEE_ID && item.date === today && !item.checkOut;
            });
            attendanceId = record?._id;
        }
        if (!attendanceId) return showNotice("No open check-in was found for today. Please mark attendance first.");
        const data = await apiRequest(`/attendance/checkout/${encodeURIComponent(attendanceId)}`, { method: "PUT" });
        localStorage.removeItem("attendanceId");
        showNotice(`Check-out successful. Check-out: ${data.checkOut || "recorded"}`);
        await loadAttendance();
    } catch (error) {
        console.error("Check-out error:", error);
        showNotice(`Check-out failed: ${error.message}`);
    }
}

async function loadAttendance() {
    try {
        const data = await apiRequest("/attendance");
        attendanceRecords = Array.isArray(data) ? data : [];
        renderAttendanceTable();
        updateAttendanceSummary();
        return attendanceRecords;
    } catch (error) {
        console.error("Attendance load error:", error);
        const body = document.getElementById("attendanceTableBody");
        if (body) {
            body.replaceChildren();
            const row = body.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.textContent = "Attendance data could not be loaded. Start the backend and refresh.";
        }
        throw error;
    }
}

function renderAttendanceTable() {
    const body = document.getElementById("attendanceTableBody");
    if (!body) return;
    body.replaceChildren();
    const records = attendanceRecords.filter(record => {
        const employeeId = typeof record.employeeId === "object" ? record.employeeId?._id : record.employeeId;
        return employeeId === EMPLOYEE_ID;
    }).sort((a, b) => `${b.date}`.localeCompare(`${a.date}`));

    if (!records.length) {
        const row = body.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.className = "empty-state";
        cell.textContent = "No attendance records found for this employee yet.";
        return;
    }
    records.forEach(record => {
        const row = body.insertRow();
        const date = new Date(`${record.date}T00:00:00`);
        row.insertCell().textContent = formatDate(record.date);
        row.insertCell().textContent = date.toLocaleDateString("en-IN", { weekday: "long" });
        row.insertCell().textContent = formatTime(record.checkIn);
        row.insertCell().textContent = formatTime(record.checkOut);
        const cell = row.insertCell();
        const badge = document.createElement("span");
        badge.className = `status ${record.status === "Present" ? "present" : "pending"}`;
        badge.textContent = record.status || "Present";
        cell.appendChild(badge);
    });
}

function updateAttendanceSummary() {
    const today = getLocalDateString();
    const mine = attendanceRecords.filter(record => {
        const id = typeof record.employeeId === "object" ? record.employeeId?._id : record.employeeId;
        return id === EMPLOYEE_ID;
    });
    const todayRecord = mine.find(record => record.date === today);
    const attendanceSection = document.getElementById("attendance");
    if (attendanceSection) {
        const labels = attendanceSection.querySelectorAll(".attendance-time strong");
        if (labels[0]) labels[0].textContent = todayRecord ? formatTime(todayRecord.checkIn) : "Not checked in";
        if (labels[1]) labels[1].textContent = todayRecord?.checkOut ? formatTime(todayRecord.checkOut) : "—";
    }
    const dashAttendance = document.querySelector("#dashboard .two-column .box .box-header .status");
    if (dashAttendance) {
        dashAttendance.textContent = todayRecord ? (todayRecord.checkOut ? "Completed" : "Present") : "Not marked";
        dashAttendance.className = `status ${todayRecord ? "present" : "pending"}`;
    }
    const analyticsStats = document.querySelectorAll("#analytics .stat-card h2");
    if (analyticsStats[1]) analyticsStats[1].textContent = mine.length ? `${Math.round(mine.filter(r => r.status === "Present").length / mine.length * 100)}%` : "—";
}

function downloadReport() {
    if (!attendanceRecords.length) {
        loadAttendance().then(createAttendanceCsv).catch(() => showNotice("Cannot download report until attendance data loads."));
        return;
    }
    createAttendanceCsv();
}

function createAttendanceCsv() {
    const rows = [["Date", "Day", "Check In", "Check Out", "Status"]];
    attendanceRecords.filter(record => {
        const id = typeof record.employeeId === "object" ? record.employeeId?._id : record.employeeId;
        return id === EMPLOYEE_ID;
    }).forEach(record => {
        const date = new Date(`${record.date}T00:00:00`);
        rows.push([record.date, date.toLocaleDateString("en-IN", { weekday: "long" }), record.checkIn || "", record.checkOut || "", record.status || "Present"]);
    });
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-report-${getLocalDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showNotice("Attendance CSV report downloaded.");
}

function getProfile() {
    const defaults = { name: "Chithra S", qualification: "B.Tech Information Technology", employeeCode: "EMP001", department: "Information Technology", role: "Employee", location: "Chennai", email: "chithra@example.com", joiningDate: "September 2024" };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}") }; }
    catch { return defaults; }
}

function renderProfile() {
    const profile = getProfile();
    const section = document.getElementById("profile");
    if (!section) return;
    const heading = section.querySelector(".profile-card h2");
    if (heading) heading.textContent = profile.name;
    const avatar = section.querySelector(".profile-avatar");
    if (avatar) avatar.textContent = profile.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
    const values = section.querySelectorAll(".profile-details strong");
    [profile.employeeCode, profile.department, profile.role, profile.location, profile.email, profile.joiningDate].forEach((value, index) => {
        if (values[index]) values[index].textContent = value;
    });
}

function editProfile() {
    const profile = getProfile();
    const name = prompt("Enter your name:", profile.name);
    if (name === null) return;
    const email = prompt("Enter your email:", profile.email);
    if (email === null) return;
    const department = prompt("Enter your department:", profile.department);
    if (department === null) return;
    if (!name.trim() || !email.trim() || !email.includes("@") || !department.trim()) {
        return showNotice("Please enter a valid name, email address and department.");
    }
    const updated = { ...profile, name: name.trim(), email: email.trim(), department: department.trim() };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    renderProfile();
    showNotice("Profile updated in this browser.");
}

document.addEventListener("DOMContentLoaded", () => {
    // Remove demo-only rows so the pages show actual records or an honest empty state.
    renderLeaveRequests();
    renderProfile();
    loadAttendance().catch(() => {});

    const fromDate = document.getElementById("fromDate");
    const toDate = document.getElementById("toDate");
    const today = getLocalDateString();
    if (fromDate) fromDate.min = today;
    if (toDate) toDate.min = today;
    fromDate?.addEventListener("change", () => { if (toDate) toDate.min = fromDate.value || today; });
});

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
        sessionStorage.removeItem("authToken");
        sessionStorage.removeItem("currentUser");

        window.location.replace("login.html");
    });
}
