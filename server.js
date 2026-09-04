const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'medikiosk-demo-secret';

const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');

// Create uploads folder automatically
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded documents
app.use('/uploads', express.static(UPLOAD_DIR));

// Serve frontend
app.use(express.static(ROOT));


// ============================================================
// MULTER - DOCUMENT UPLOAD
// ============================================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name =
            Date.now() +
            '-' +
            crypto.randomBytes(8).toString('hex') +
            ext;

        cb(null, name);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5
    },

    fileFilter: (req, file, cb) => {
        const allowed = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf'
        ];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    'Only JPG, PNG, WEBP and PDF files are allowed.'
                )
            );
        }
    }
});


// ============================================================
// DEMO USERS
// ============================================================

const demoUsers = [
    {
        username: 'regdesk',
        password: 'reg123',
        role: 'registration',
        department: null
    },

    {
        username: 'bones',
        password: 'doc123',
        role: 'doctor',
        department: 'Orthopedics'
    },

    {
        username: 'brain',
        password: 'doc123',
        role: 'doctor',
        department: 'Neurology'
    },

    {
        username: 'opd',
        password: 'doc123',
        role: 'doctor',
        department: 'General OPD'
    },

    {
        username: 'emergency',
        password: 'doc123',
        role: 'doctor',
        department: 'Emergency'
    },

    {
        username: 'pediatrics',
        password: 'doc123',
        role: 'doctor',
        department: 'Pediatrics'
    }
];


// ============================================================
// DATABASE INITIALIZATION
// ============================================================

try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT,
            department TEXT
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            contact TEXT NOT NULL,
            email TEXT,
            preferred_time TEXT,
            history TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            department TEXT,
            queue_no INTEGER,
            status TEXT DEFAULT 'waiting',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            called_at TEXT,
            completed_at TEXT
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            original_name TEXT,
            stored_name TEXT,
            mime_type TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS followups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            doctor_username TEXT,
            followup_date TEXT,
            followup_time TEXT,
            mode TEXT,
            meeting_link TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    for (const user of demoUsers) {
        const existing = db
            .prepare('SELECT id FROM users WHERE username = ?')
            .get(user.username);

        if (!existing) {
            const hashed = bcrypt.hashSync(user.password, 10);

            db.prepare(`
                INSERT INTO users
                (username, password, role, department)
                VALUES (?, ?, ?, ?)
            `).run(
                user.username,
                hashed,
                user.role,
                user.department
            );
        }
    }

    console.log('Database initialized.');

} catch (err) {
    console.error('Database initialization error:', err);
}


// ============================================================
// AUTHENTICATION
// ============================================================

function createToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role,
            department: user.department
        },
        JWT_SECRET,
        {
            expiresIn: '12h'
        }
    );
}


function auth(req, res, next) {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }

    const token = header.substring(7);

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();

    } catch (err) {
        return res.status(401).json({
            error: 'Invalid or expired token'
        });
    }
}


function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        next();
    };
}


// ============================================================
// HEALTH
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        message: 'MediKiosk server is running'
    });
});


// ============================================================
// LOGIN
// ============================================================

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        const user = db
            .prepare('SELECT * FROM users WHERE username = ?')
            .get(username);

        if (!user) {
            return res.status(401).json({
                error: 'Invalid username or password'
            });
        }

        const valid = await bcrypt.compare(
            password,
            user.password
        );

        if (!valid) {
            return res.status(401).json({
                error: 'Invalid username or password'
            });
        }

        const token = createToken(user);

        res.json({
            ok: true,
            token,
            user: {
                username: user.username,
                role: user.role,
                department: user.department
            }
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: 'Login failed'
        });
    }
});


// ============================================================
// DEPARTMENTS
// ============================================================

app.get('/api/departments', (req, res) => {
    res.json([
        'Orthopedics',
        'Neurology',
        'Emergency',
        'General OPD',
        'Pediatrics'
    ]);
});


// ============================================================
// PATIENT REGISTRATION
// ============================================================

app.post(
    '/api/patients',
    upload.array('documents', 5),
    (req, res) => {

        try {
            const {
                name,
                contact,
                email,
                preferred_time,
                history,
                department
            } = req.body;

            // Name
            if (!name || !name.trim()) {
                return res.status(400).json({
                    error: 'Patient name is required'
                });
            }

            // Contact must be exactly 10 digits
            if (!/^\d{10}$/.test(contact || '')) {
                return res.status(400).json({
                    error: 'Contact number must contain exactly 10 digits'
                });
            }

            // Optional email validation
            if (
                email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) {
                return res.status(400).json({
                    error: 'Invalid email address'
                });
            }

            if (!department) {
                return res.status(400).json({
                    error: 'Department is required'
                });
            }

            // Create patient
            const patientResult = db.prepare(`
                INSERT INTO patients
                (name, contact, email, preferred_time, history)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                name.trim(),
                contact,
                email || null,
                preferred_time || null,
                history || null
            );

            const patientId = patientResult.lastInsertRowid;

            // Get today's queue number
            const todayCount = db.prepare(`
                SELECT COUNT(*) AS count
                FROM queue
                WHERE department = ?
                AND date(created_at) = date('now')
            `).get(department);

            const queueNo = todayCount.count + 1;

            // Add to queue
            db.prepare(`
                INSERT INTO queue
                (patient_id, department, queue_no, status)
                VALUES (?, ?, ?, 'waiting')
            `).run(
                patientId,
                department,
                queueNo
            );

            // Save documents
            if (req.files && req.files.length > 0) {

                const insertDocument = db.prepare(`
                    INSERT INTO documents
                    (
                        patient_id,
                        original_name,
                        stored_name,
                        mime_type
                    )
                    VALUES (?, ?, ?, ?)
                `);

                for (const file of req.files) {
                    insertDocument.run(
                        patientId,
                        file.originalname,
                        file.filename,
                        file.mimetype
                    );
                }
            }

            res.json({
                ok: true,
                patientId,
                queueNo,
                department
            });

        } catch (err) {

            console.error('Patient registration error:', err);

            // Remove uploaded files if database operation fails
            if (req.files) {
                for (const file of req.files) {
                    try {
                        fs.unlinkSync(file.path);
                    } catch {}
                }
            }

            res.status(500).json({
                error: 'Patient registration failed'
            });
        }
    }
);


// ============================================================
// DOCUMENT URL
// ============================================================

function documentUrl(req, storedName) {

    return (
        req.protocol +
        '://' +
        req.get('host') +
        '/uploads/' +
        encodeURIComponent(storedName)
    );
}


// ============================================================
// PATIENT QUEUE INFORMATION
// ============================================================

app.get('/api/queue/:queueNo', (req, res) => {

    try {

        const queueNo = Number(req.params.queueNo);

        const current = db.prepare(`
            SELECT
                q.*,
                p.name
            FROM queue q
            JOIN patients p
                ON p.id = q.patient_id
            WHERE q.queue_no = ?
            AND date(q.created_at) = date('now')
            ORDER BY q.id DESC
            LIMIT 1
        `).get(queueNo);

        if (!current) {
            return res.status(404).json({
                error: 'Queue number not found'
            });
        }

        const ahead = db.prepare(`
            SELECT COUNT(*) AS count
            FROM queue
            WHERE department = ?
            AND date(created_at) = date('now')
            AND queue_no < ?
            AND status != 'completed'
        `).get(
            current.department,
            current.queue_no
        );

        res.json({
            ok: true,
            queueNo: current.queue_no,
            department: current.department,
            status: current.status,
            peopleAhead: ahead.count
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Unable to fetch queue'
        });
    }
});


// ============================================================
// REGISTRATION DESK QUEUE
// ============================================================

app.get(
    '/api/registration/queue',
    auth,
    requireRole('registration'),
    (req, res) => {

        try {

            const rows = db.prepare(`
                SELECT
                    q.id,
                    q.queue_no,
                    q.department,
                    q.status,
                    q.created_at,
                    p.name,
                    p.contact
                FROM queue q
                JOIN patients p
                    ON p.id = q.patient_id
                WHERE date(q.created_at) = date('now')
                ORDER BY q.department, q.queue_no
            `).all();

            res.json({
                ok: true,
                queue: rows
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: 'Unable to fetch registration queue'
            });
        }
    }
);


// ============================================================
// DOCTOR - PATIENT LIST
// ============================================================

app.get(
    '/api/doctors/me/patients',
    auth,
    requireRole('doctor'),
    (req, res) => {

        try {

            const rows = db.prepare(`
                SELECT
                    q.id AS queue_id,
                    q.queue_no,
                    q.department,
                    q.status,
                    q.created_at,
                    p.id AS patient_id,
                    p.name,
                    p.contact,
                    p.preferred_time
                FROM queue q
                JOIN patients p
                    ON p.id = q.patient_id
                WHERE q.department = ?
                AND date(q.created_at) = date('now')
                ORDER BY
                    CASE
                        WHEN q.status = 'called' THEN 1
                        WHEN q.status = 'waiting' THEN 2
                        WHEN q.status = 'completed' THEN 3
                    END,
                    q.queue_no
            `).all(req.user.department);

            res.json({
                ok: true,
                patients: rows
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: 'Unable to fetch patients'
            });
        }
    }
);


// ============================================================
// DOCTOR - PATIENT DETAILS
// ============================================================

app.get(
    '/api/doctors/me/patient/:id',
    auth,
    requireRole('doctor'),
    (req, res) => {

        try {

            const patientId = Number(req.params.id);

            const patient = db.prepare(`
                SELECT
                    p.*,
                    q.id AS queue_id,
                    q.queue_no,
                    q.department,
                    q.status,
                    q.created_at AS queue_created_at
                FROM patients p
                JOIN queue q
                    ON q.patient_id = p.id
                WHERE p.id = ?
                AND q.department = ?
                ORDER BY q.id DESC
                LIMIT 1
            `).get(
                patientId,
                req.user.department
            );

            if (!patient) {
                return res.status(404).json({
                    error: 'Patient not found or not assigned to you'
                });
            }

            const documents = db.prepare(`
                SELECT
                    id,
                    original_name,
                    stored_name,
                    mime_type,
                    created_at
                FROM documents
                WHERE patient_id = ?
                ORDER BY id DESC
            `).all(patientId);

            // IMPORTANT:
            // Give doctor a real URL for every uploaded document.
            const formattedDocuments = documents.map(d => ({
                id: d.id,
                original_name: d.original_name,
                mime_type: d.mime_type,
                created_at: d.created_at,
                url: documentUrl(req, d.stored_name)
            }));

            res.json({
                ok: true,

                patient: {
                    id: patient.id,
                    name: patient.name,
                    contact: patient.contact,
                    email: patient.email,
                    preferred_time: patient.preferred_time,
                    history: patient.history,

                    queue_no: patient.queue_no,
                    department: patient.department,
                    status: patient.status,
                    queue_created_at: patient.queue_created_at
                },

                documents: formattedDocuments
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: 'Unable to fetch patient details'
            });
        }
    }
);


// ============================================================
// DOCTOR - CALL PATIENT
// ============================================================

app.post(
    '/api/doctors/queue/:id/call',
    auth,
    requireRole('doctor'),
    (req, res) => {

        try {

            const queueId = Number(req.params.id);

            const item = db.prepare(`
                SELECT *
                FROM queue
                WHERE id = ?
                AND department = ?
            `).get(
                queueId,
                req.user.department
            );

            if (!item) {
                return res.status(404).json({
                    error: 'Queue entry not found'
                });
            }

            db.prepare(`
                UPDATE queue
                SET status = 'called',
                    called_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(queueId);

            res.json({
                ok: true,
                message: 'Patient called'
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: 'Unable to call patient'
            });
        }
    }
);


// ============================================================
// DOCTOR - COMPLETE PATIENT
// ============================================================

app.post(
    '/api/doctors/queue/:id/complete',
    auth,
    requireRole('doctor'),
    (req, res) => {

        try {

            const queueId = Number(req.params.id);

            const item = db.prepare(`
                SELECT *
                FROM queue
                WHERE id = ?
                AND department = ?
            `).get(
                queueId,
                req.user.department
            );

            if (!item) {
                return res.status(404).json({
                    error: 'Queue entry not found'
                });
            }

            db.prepare(`
                UPDATE queue
                SET status = 'completed',
                    completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(queueId);

            res.json({
                ok: true,
                message: 'Patient consultation completed'
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: 'Unable to complete patient'
            });
        }
    }
);


// ============================================================
// FOLLOW-UP
// ============================================================

app.post(
    '/api/doctors/followups',
    auth,
    requireRole('doctor'),
    (req, res) => {

        try {

            const {
                patient_id,
                followup_date,
                followup_time,
                mode,
                notes
            } = req.body;

            if (!patient_id || !followup_date || !followup_time) {
                return res.status(400).json({
                    error: 'Patient, date and time are required'
                });
            }

            const patient = db.prepare(`
                SELECT p.id
                FROM patients p
                JOIN queue q
                    ON q.patient_id = p.id
                WHERE p.id = ?
                AND q.department = ?
                LIMIT 1
            `).get(
                patient_id,
                req.user.department
            );

            if (!patient) {
                return res.status(404).json({
                    error: 'Patient not assigned to you'
                });
            }

            let meetingLink = null;

            if (mode === 'online') {
                meetingLink =
                    'https://meet.google.com/medikiosk-demo-' +
                    crypto.randomBytes(4).toString('hex');
            }

            db.prepare(`
                INSERT INTO followups
                (
                    patient_id,
                    doctor_username,
                    followup_date,
                    followup_time,
                    mode,
                    meeting_link,
                    notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                patient_id,
                req.user.username,
                followup_date,
                followup_time,
                mode || 'in-person',
                meetingLink,
                notes || null
            );

            res.json({
                ok: true,
                meetingLink
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: 'Unable to schedule follow-up'
            });
        }
    }
);


// ============================================================
// DOCTOR FOLLOW-UPS
// ============================================================

app.get(
    '/api/doctors/me/followups',
    auth,
    requireRole('doctor'),
    (req, res) => {

        try {

            const rows = db.prepare(`
                SELECT
                    f.*,
                    p.name AS patient_name
                FROM followups f
                JOIN patients p
                    ON p.id = f.patient_id
                WHERE f.doctor_username = ?
                ORDER BY
                    f.followup_date,
                    f.followup_time
            `).all(req.user.username);

            res.json({
                ok: true,
                followups: rows
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: 'Unable to fetch follow-ups'
            });
        }
    }
);


// ============================================================
// MULTER / GENERAL ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {

    console.error(err);

    if (err instanceof multer.MulterError) {

        return res.status(400).json({
            error: err.message
        });
    }

    if (err) {

        return res.status(400).json({
            error: err.message || 'Request failed'
        });
    }

    next();
});


// ============================================================
// FRONTEND FALLBACK
// ============================================================

app.get('*', (req, res) => {

    res.sendFile(
        path.join(ROOT, 'index.html')
    );
});


// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {

    console.log(
        `MediKiosk running on port ${PORT}`
    );
});
