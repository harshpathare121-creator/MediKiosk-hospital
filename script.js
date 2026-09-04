// ============================================================
// MediKiosk Frontend
// ============================================================

const API_BASE = '/api';


// ============================================================
// BASIC HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}


function escapeHtml(value) {

    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function escapeAttr(value) {
    return escapeHtml(value);
}


function showToast(message) {

    const toast = $('toast');

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}


function getToken() {
    return localStorage.getItem('medikiosk_token');
}


function getUser() {

    try {
        return JSON.parse(
            localStorage.getItem('medikiosk_user') || 'null'
        );
    } catch {
        return null;
    }
}


function saveLogin(data) {

    localStorage.setItem(
        'medikiosk_token',
        data.token
    );

    localStorage.setItem(
        'medikiosk_user',
        JSON.stringify(data.user)
    );
}


function logout() {

    localStorage.removeItem('medikiosk_token');
    localStorage.removeItem('medikiosk_user');

    location.reload();
}


// ============================================================
// API HELPER
// ============================================================

async function api(path, options = {}) {

    const headers = options.headers || {};

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const token = getToken();

    if (token) {
        headers['Authorization'] =
            'Bearer ' + token;
    }

    const response = await fetch(
        API_BASE + path,
        {
            ...options,
            headers
        }
    );

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {

        throw new Error(
            data.error ||
            'Something went wrong'
        );
    }

    return data;
}


// ============================================================
// APP
// ============================================================

const app = $('app');


// ============================================================
// HOME
// ============================================================

function home() {

    if (!app) return;

    app.innerHTML = `
        <div class="hero">
            <div class="wrap">
                <div class="card">
                    <h1>MediKiosk</h1>

                    <p>
                        Digital patient registration,
                        document management and OPD queue system.
                    </p>

                    <div class="actions">

                        <button onclick="patientRegistration()">
                            Patient Registration
                        </button>

                        <button
                            class="secondary"
                            onclick="openLogin()">
                            Staff Login
                        </button>

                    </div>
                </div>
            </div>
        </div>
    `;
}


// ============================================================
// PATIENT REGISTRATION
// ============================================================

async function patientRegistration() {

    try {

        const departments =
            await api('/departments');

        app.innerHTML = `
            <div class="wrap">

                <div class="card">

                    <button
                        class="secondary"
                        onclick="home()">
                        Back
                    </button>

                    <h2>Patient Registration</h2>

                    <form
                        class="form"
                        id="patientForm">

                        <label>
                            Patient Name
                            <input
                                type="text"
                                name="name"
                                required>
                        </label>

                        <label>
                            Contact Number
                            <input
                                type="tel"
                                name="contact"
                                maxlength="10"
                                pattern="[0-9]{10}"
                                placeholder="10 digit number"
                                required>
                        </label>

                        <label>
                            Email
                            <span class="muted">
                                Optional
                            </span>

                            <input
                                type="email"
                                name="email"
                                placeholder="example@email.com">
                        </label>

                        <label>
                            Department

                            <select
                                name="department"
                                required>

                                <option value="">
                                    Select Department
                                </option>

                                ${departments.map(d => `
                                    <option value="${escapeAttr(d)}">
                                        ${escapeHtml(d)}
                                    </option>
                                `).join('')}

                            </select>
                        </label>

                        <label>
                            Preferred Time

                            <input
                                type="time"
                                name="preferred_time">
                        </label>

                        <label>
                            Medical History
                            <span class="muted">
                                Optional
                            </span>

                            <textarea
                                name="history"
                                rows="5"
                                placeholder="Enter previous medical history, symptoms, medicines, allergies, etc."></textarea>
                        </label>

                        <label>
                            Upload Medical Documents
                            <span class="muted">
                                Optional — max 5 files, 5 MB each
                            </span>

                            <input
                                type="file"
                                name="documents"
                                id="documents"
                                multiple
                                accept=".jpg,.jpeg,.png,.webp,.pdf">
                        </label>

                        <button type="submit">
                            Register Patient
                        </button>

                    </form>

                </div>

            </div>
        `;

        $('patientForm').addEventListener(
            'submit',
            submitPatient
        );

    } catch (err) {

        showToast(err.message);
    }
}


// ============================================================
// SUBMIT PATIENT
// ============================================================

async function submitPatient(event) {

    event.preventDefault();

    const form = event.target;

    const contact =
        form.contact.value.trim();

    if (!/^\d{10}$/.test(contact)) {

        showToast(
            'Contact number must contain exactly 10 digits.'
        );

        return;
    }

    if (
        form.email.value &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            form.email.value.trim()
        )
    ) {

        showToast(
            'Please enter a valid email address.'
        );

        return;
    }

    const files =
        $('documents').files;

    if (files.length > 5) {

        showToast(
            'You can upload a maximum of 5 files.'
        );

        return;
    }

    for (const file of files) {

        if (file.size > 5 * 1024 * 1024) {

            showToast(
                `${file.name} is larger than 5 MB.`
            );

            return;
        }
    }

    const formData =
        new FormData(form);

    try {

        const result =
            await api(
                '/patients',
                {
                    method: 'POST',
                    body: formData
                }
            );

        app.innerHTML = `
            <div class="wrap">

                <div class="card">

                    <h2>Registration Successful</h2>

                    <p>
                        Patient has been added to the OPD queue.
                    </p>

                    <div class="queueNo">
                        ${escapeHtml(result.queueNo)}
                    </div>

                    <p>
                        Department:
                        <strong>
                            ${escapeHtml(result.department)}
                        </strong>
                    </p>

                    <button onclick="home()">
                        Done
                    </button>

                </div>

            </div>
        `;

    } catch (err) {

        showToast(err.message);
    }
}


// ============================================================
// LOGIN
// ============================================================

function openLogin() {

    app.innerHTML = `
        <div class="wrap">

            <div class="card">

                <button
                    class="secondary"
                    onclick="home()">
                    Back
                </button>

                <h2>Staff Login</h2>

                <form
                    class="form"
                    id="loginForm">

                    <label>
                        Username

                        <input
                            name="username"
                            required>
                    </label>

                    <label>
                        Password

                        <input
                            type="password"
                            name="password"
                            required>
                    </label>

                    <button type="submit">
                        Login
                    </button>

                </form>

                <p class="small muted">
                    Demo Registration:
                    regdesk / reg123
                </p>

                <p class="small muted">
                    Demo Doctors:
                    bones / brain / opd /
                    emergency / pediatrics
                    <br>
                    Password:
                    doc123
                </p>

            </div>

        </div>
    `;

    $('loginForm').addEventListener(
        'submit',
        submitLogin
    );
}


async function submitLogin(event) {

    event.preventDefault();

    const form = event.target;

    try {

        const result =
            await api(
                '/login',
                {
                    method: 'POST',

                    body: JSON.stringify({
                        username:
                            form.username.value.trim(),

                        password:
                            form.password.value
                    })
                }
            );

        saveLogin(result);

        if (result.user.role === 'doctor') {

            doctorDashboard();

        } else {

            registrationDashboard();
        }

    } catch (err) {

        showToast(err.message);
    }
}


// ============================================================
// REGISTRATION DASHBOARD
// ============================================================

async function registrationDashboard() {

    const user = getUser();

    if (!user || user.role !== 'registration') {
        openLogin();
        return;
    }

    try {

        const result =
            await api('/registration/queue');

        app.innerHTML = `
            <div class="wrap">

                <div class="card">

                    <div class="actions">

                        <h2>
                            Registration Desk
                        </h2>

                        <button
                            class="secondary"
                            onclick="logout()">
                            Logout
                        </button>

                    </div>

                    <div class="tablewrap">

                        <table>

                            <thead>
                                <tr>
                                    <th>Queue</th>
                                    <th>Name</th>
                                    <th>Contact</th>
                                    <th>Department</th>
                                    <th>Status</th>
                                    <th>Time</th>
                                </tr>
                            </thead>

                            <tbody>

                                ${result.queue.map(q => `
                                    <tr>

                                        <td>
                                            ${escapeHtml(q.queue_no)}
                                        </td>

                                        <td>
                                            ${escapeHtml(q.name)}
                                        </td>

                                        <td>
                                            ${escapeHtml(q.contact)}
                                        </td>

                                        <td>
                                            ${escapeHtml(q.department)}
                                        </td>

                                        <td>
                                            ${escapeHtml(q.status)}
                                        </td>

                                        <td>
                                            ${escapeHtml(q.created_at)}
                                        </td>

                                    </tr>
                                `).join('')}

                            </tbody>

                        </table>

                    </div>

                </div>

            </div>
        `;

    } catch (err) {

        showToast(err.message);
    }
}


// ============================================================
// DOCTOR DASHBOARD
// ============================================================

async function doctorDashboard() {

    const user = getUser();

    if (!user || user.role !== 'doctor') {
        openLogin();
        return;
    }

    try {

        const result =
            await api('/doctors/me/patients');

        app.innerHTML = `
            <div class="wrap">

                <div class="card">

                    <div class="actions">

                        <div>
                            <h2>Doctor Dashboard</h2>

                            <p class="muted">
                                Department:
                                ${escapeHtml(user.department)}
                            </p>
                        </div>

                        <button
                            class="secondary"
                            onclick="logout()">
                            Logout
                        </button>

                    </div>

                    <div class="grid">

                        ${result.patients.map(p => `
                            <div class="card">

                                <div class="pill">
                                    Queue ${escapeHtml(p.queue_no)}
                                </div>

                                <h3>
                                    ${escapeHtml(p.name)}
                                </h3>

                                <p>
                                    Contact:
                                    ${escapeHtml(p.contact)}
                                </p>

                                <p>
                                    Status:
                                    <strong>
                                        ${escapeHtml(p.status)}
                                    </strong>
                                </p>

                                <div class="actions">

                                    <button
                                        onclick="doctorPatient(${Number(p.patient_id)})">
                                        View Patient
                                    </button>

                                    ${
                                        p.status !== 'completed'
                                        ? `
                                            <button
                                                class="secondary"
                                                onclick="callPatient(${Number(p.queue_id)})">
                                                Call
                                            </button>

                                            <button
                                                class="secondary"
                                                onclick="completePatient(${Number(p.queue_id)})">
                                                Complete
                                            </button>
                                        `
                                        : ''
                                    }

                                </div>

                            </div>
                        `).join('')}

                    </div>

                </div>

            </div>
        `;

    } catch (err) {

        showToast(err.message);
    }
}


// ============================================================
// DOCTOR PATIENT DETAILS
// ============================================================

async function doctorPatient(id) {

    try {

        const result =
            await api(
                '/doctors/me/patient/' + id
            );

        const p = result.patient;

        app.innerHTML = `
            <div class="wrap">

                <div class="card">

                    <button
                        class="secondary"
                        onclick="doctorDashboard()">
                        Back to Patients
                    </button>

                    <h2>
                        Patient Details
                    </h2>

                    <div class="card">

                        <h3>
                            ${escapeHtml(p.name)}
                        </h3>

                        <p>
                            <strong>Contact:</strong>
                            ${escapeHtml(p.contact)}
                        </p>

                        ${
                            p.email
                            ? `
                                <p>
                                    <strong>Email:</strong>
                                    ${escapeHtml(p.email)}
                                </p>
                            `
                            : ''
                        }

                        <p>
                            <strong>Department:</strong>
                            ${escapeHtml(p.department)}
                        </p>

                        <p>
                            <strong>Queue Number:</strong>
                            ${escapeHtml(p.queue_no)}
                        </p>

                        <p>
                            <strong>Status:</strong>
                            ${escapeHtml(p.status)}
                        </p>

                        <h3>
                            Medical History
                        </h3>

                        <div class="notice">
                            ${
                                p.history
                                ? escapeHtml(p.history)
                                : 'No medical history provided.'
                            }
                        </div>

                    </div>


                    <!-- =================================================
                         DOCUMENTS
                         ================================================= -->

                    <div class="card">

                        <h3>
                            Uploaded Documents
                        </h3>

                        ${
                            result.documents &&
                            result.documents.length
                            ? result.documents.map(d => `

                                <div class="notice">

                                    <strong>
                                        ${escapeHtml(d.original_name)}
                                    </strong>

                                    <div class="actions">

                                        <!-- OPEN DOCUMENT -->
                                        <a
                                            href="${escapeAttr(d.url)}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="button">
                                            Open / View
                                        </a>

                                        <!-- DOWNLOAD DOCUMENT -->
                                        <a
                                            href="${escapeAttr(d.url)}"
                                            download="${escapeAttr(d.original_name)}"
                                            class="button secondary">
                                            Download
                                        </a>

                                    </div>

                                </div>

                            `).join('')

                            : `
                                <p class="muted">
                                    No documents uploaded.
                                </p>
                            `
                        }

                    </div>

                </div>

            </div>
        `;

    } catch (err) {

        showToast(err.message);
    }
}


// ============================================================
// CALL PATIENT
// ============================================================

async function callPatient(id) {

    try {

        await api(
            '/doctors/queue/' + id + '/call',
            {
                method: 'POST'
            }
        );

        showToast(
            'Patient has been called.'
        );

        doctorDashboard();

    } catch (err) {

        showToast(err.message);
    }
}


// ============================================================
// COMPLETE PATIENT
// ============================================================

async function completePatient(id) {

    try {

        await api(
            '/doctors/queue/' + id + '/complete',
            {
                method: 'POST'
            }
        );

        showToast(
            'Patient consultation completed.'
        );

        doctorDashboard();

    } catch (err) {

        showToast(err.message);
    }
}


// ============================================================
// INITIALIZE
// ============================================================

function initializeApp() {

    const user = getUser();

    if (!user) {

        home();
        return;
    }

    if (user.role === 'doctor') {

        doctorDashboard();

    } else if (
        user.role === 'registration'
    ) {

        registrationDashboard();

    } else {

        home();
    }
}


initializeApp();
