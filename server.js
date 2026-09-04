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

const JWT_SECRET =
  process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION';

/*
========================================================
MEDIKIOSK FILE STRUCTURE

Everything is in the GitHub repository root:

MediKiosk/
│
├── server.js
├── db.js
├── package.json
├── index.html
├── style.css
├── script.js
└── uploads/       (created automatically)

There is NO frontend folder.
There is NO backend folder.
========================================================
*/

// Root directory = directory containing server.js
const ROOT = __dirname;

// Upload directory
const UPLOAD_DIR = path.join(ROOT, 'uploads');

fs.mkdirSync(UPLOAD_DIR, {
  recursive: true
});


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());

app.use(
  express.json({
    limit: '2mb'
  })
);

// Serve uploaded documents
app.use(
  '/uploads',
  express.static(UPLOAD_DIR)
);

// Serve frontend files directly from repository root
app.use(
  express.static(ROOT)
);


// ======================================================
// FILE UPLOAD
// ======================================================

const storage = multer.diskStorage({

  destination: (_, __, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (_, file, cb) => {

    const extension =
      path.extname(file.originalname).toLowerCase();

    cb(
      null,
      crypto.randomUUID() + extension
    );
  }

});


const upload = multer({

  storage,

  limits: {
    files: 5,
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (_, file, cb) => {

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    ];

    const valid =
      allowedTypes.includes(file.mimetype);

    if (valid) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Only JPG, PNG, WEBP or PDF files are allowed.'
        )
      );
    }

  }

});


// ======================================================
// HELPER FUNCTIONS
// ======================================================

const today = () =>
  new Date()
    .toISOString()
    .slice(0, 10);


const now = () =>
  new Date()
    .toISOString();


const sign = (user) => {

  return jwt.sign(

    {
      id: user.id,
      role: user.role,
      department: user.department
    },

    JWT_SECRET,

    {
      expiresIn: '8h'
    }

  );

};


function auth(req, res, next) {

  try {

    const header =
      req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      throw new Error();
    }

    const token =
      header.slice(7);

    req.user =
      jwt.verify(
        token,
        JWT_SECRET
      );

    next();

  } catch {

    res.status(401).json({
      error: 'Authentication required'
    });

  }

}


function role(...roles) {

  return (req, res, next) => {

    if (
      roles.includes(
        req.user.role
      )
    ) {

      return next();

    }

    res.status(403).json({
      error: 'Not allowed'
    });

  };

}


function validContact(contact) {

  return /^\d{10}$/.test(
    String(contact || '')
  );

}


function validEmail(email) {

  return (
    !email ||
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  );

}


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  '/api/health',
  (req, res) => {

    res.json({
      ok: true,
      date: today()
    });

  }
);


// ======================================================
// LOGIN
// ======================================================

app.post(
  '/api/login',
  (req, res) => {

    const {
      username,
      password
    } = req.body || {};

    const user =
      db
        .prepare(
          'SELECT * FROM users WHERE username=?'
        )
        .get(
          username || ''
        );

    if (
      !user ||
      !bcrypt.compareSync(
        password || '',
        user.password_hash
      )
    ) {

      return res.status(401).json({
        error:
          'Invalid username or password'
      });

    }

    res.json({

      token: sign(user),

      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        department: user.department
      }

    });

  }
);


// ======================================================
// DEPARTMENTS
// ======================================================

app.get(
  '/api/departments',
  (req, res) => {

    const departments =
      db
        .prepare(
          `
          SELECT
            id,
            name,
            department
          FROM users
          WHERE role='doctor'
          ORDER BY department, name
          `
        )
        .all();

    res.json(

      departments.map(
        x => ({
          id: x.id,
          name: x.department,
          doctor: x.name
        })
      )

    );

  }
);


// ======================================================
// PATIENT REGISTRATION
// ======================================================

app.post(
  '/api/patients',
  upload.array('documents', 5),
  (req, res) => {

    try {

      const {
        name,
        contact,
        email,
        preferredTime,
        history,
        department,
        privacyHistory
      } = req.body || {};


      if (
        !name?.trim() ||
        !validContact(contact) ||
        !validEmail(email) ||
        !department
      ) {

        return res.status(400).json({

          error:
            'Name, valid 10-digit contact and department are required. Email is optional but must be valid when entered.'

        });

      }


      const date = today();
      const stamp = now();


      const transaction =
        db.transaction(() => {

          // ----------------------------
          // CREATE PATIENT
          // ----------------------------

          const patient =
            db
              .prepare(
                `
                INSERT INTO patients
                (
                  name,
                  contact,
                  email,
                  preferred_time,
                  history,
                  created_at,
                  created_date,
                  privacy_history
                )
                VALUES
                (?,?,?,?,?,?,?,?)
                `
              )
              .run(

                name.trim(),

                contact,

                email?.trim() || null,

                preferredTime || null,

                history?.trim() || null,

                stamp,

                date,

                privacyHistory === '0'
                  ? 0
                  : 1

              );


          // ----------------------------
          // FIND DOCTOR
          // ----------------------------

          const doctor =
            db
              .prepare(
                `
                SELECT
                  id,
                  department
                FROM users
                WHERE role='doctor'
                  AND department=?
                ORDER BY id
                LIMIT 1
                `
              )
              .get(
                department
              );


          // ----------------------------
          // QUEUE NUMBER
          // ----------------------------

          const count =
            db
              .prepare(
                `
                SELECT COUNT(*) c
                FROM queue
                WHERE queue_date=?
                  AND department=?
                `
              )
              .get(
                date,
                department
              ).c + 1;


          const prefix =
            department
              .split(/\s+/)
              .map(
                x => x[0]
              )
              .join('')
              .slice(0, 3)
              .toUpperCase() ||
            'OPD';


          const queueNumber =
            `${prefix}-${String(count).padStart(3, '0')}`;


          // ----------------------------
          // CREATE QUEUE
          // ----------------------------

          const queue =
            db
              .prepare(
                `
                INSERT INTO queue
                (
                  patient_id,
                  queue_no,
                  department,
                  assigned_doctor_id,
                  status,
                  created_at,
                  queue_date
                )
                VALUES
                (?,?,?,?,?,?,?)
                `
              )
              .run(

                patient.lastInsertRowid,

                queueNumber,

                department,

                doctor?.id || null,

                'Waiting',

                stamp,

                date

              );


          // ----------------------------
          // SAVE DOCUMENTS
          // ----------------------------

          if (req.files) {

            for (
              const file of req.files
            ) {

              db
                .prepare(
                  `
                  INSERT INTO documents
                  (
                    patient_id,
                    original_name,
                    stored_name,
                    created_at
                  )
                  VALUES
                  (?,?,?,?)
                  `
                )
                .run(

                  patient.lastInsertRowid,

                  file.originalname,

                  file.filename,

                  stamp

                );

            }

          }


          return {

            id:
              patient.lastInsertRowid,

            queueId:
              queue.lastInsertRowid,

            queueNo:
              queueNumber

          };

        });


      res.status(201).json(
        transaction()
      );

    } catch (error) {

      console.error(error);

      res.status(400).json({
        error:
          error.message ||
          'Patient registration failed'
      });

    }

  }
);


// ======================================================
// QUEUE STATUS
// ======================================================

app.get(
  '/api/queue/:queueNo',
  (req, res) => {

    const queue =
      db
        .prepare(
          `
          SELECT
            q.*,
            p.name,
            p.contact,
            p.email,
            p.preferred_time
          FROM queue q
          JOIN patients p
            ON p.id=q.patient_id
          WHERE q.queue_no=?
            AND q.queue_date=?
          `
        )
        .get(
          req.params.queueNo,
          today()
        );


    if (!queue) {

      return res.status(404).json({

        error:
          'Queue number not found for today'

      });

    }


    const ahead =
      db
        .prepare(
          `
          SELECT COUNT(*) c
          FROM queue
          WHERE queue_date=?
            AND department=?
            AND status IN
              ('Waiting','Called')
            AND id<?
          `
        )
        .get(
          today(),
          queue.department,
          queue.id
        ).c;


    res.json({

      queueNo:
        queue.queue_no,

      name:
        queue.name,

      department:
        queue.department,

      status:
        queue.status,

      ahead,

      estimatedMinutes:
        ahead * 5

    });

  }
);


// ======================================================
// REGISTRATION QUEUE
// ======================================================

app.get(
  '/api/registration/queue',
  auth,
  role('registration'),
  (req, res) => {

    res.json(

      db
        .prepare(
          `
          SELECT
            q.id,
            q.queue_no,
            q.status,
            q.department,
            q.created_at,
            p.name,
            p.contact,
            p.email
          FROM queue q
          JOIN patients p
            ON p.id=q.patient_id
          WHERE q.queue_date=?
          ORDER BY q.id
          `
        )
        .all(
          today()
        )

    );

  }
);


// ======================================================
// DOCTOR PATIENTS
// ======================================================

app.get(
  '/api/doctors/me/patients',
  auth,
  role('doctor'),
  (req, res) => {

    res.json(

      db
        .prepare(
          `
          SELECT
            q.id,
            q.queue_no,
            q.status,
            q.department,
            q.created_at,
            p.id patient_id,
            p.name,
            p.contact,
            p.email,
            p.preferred_time,
            p.history
          FROM queue q
          JOIN patients p
            ON p.id=q.patient_id
          WHERE q.queue_date=?
            AND q.assigned_doctor_id=?
            AND q.status IN
              ('Waiting','Called')
          ORDER BY q.id
          `
        )
        .all(
          today(),
          req.user.id
        )

    );

  }
);


// ======================================================
// DOCTOR PATIENT DETAILS
// ======================================================

app.get(
  '/api/doctors/me/patient/:id',
  auth,
  role('doctor'),
  (req, res) => {

    const patient =
      db
        .prepare(
          `
          SELECT
            p.*,
            q.queue_no,
            q.department,
            q.status
          FROM patients p
          JOIN queue q
            ON q.patient_id=p.id
          WHERE p.id=?
            AND q.assigned_doctor_id=?
          ORDER BY q.id DESC
          LIMIT 1
          `
        )
        .get(
          req.params.id,
          req.user.id
        );


    if (!patient) {

      return res.status(404).json({

        error:
          'Patient not assigned to you'

      });

    }


    const documents =
      db
        .prepare(
          `
          SELECT
            id,
            original_name,
            created_at
          FROM documents
          WHERE patient_id=?
          ORDER BY id DESC
          `
        )
        .all(
          patient.id
        );


    const followups =
      db
        .prepare(
          `
          SELECT
            f.*,
            u.name doctor_name
          FROM followups f
          JOIN users u
            ON u.id=f.doctor_id
          WHERE f.patient_id=?
          ORDER BY f.followup_at DESC
          `
        )
        .all(
          patient.id
        );


    res.json({

      ...patient,

      documents,

      followups

    });

  }
);


// ======================================================
// CALL PATIENT
// ======================================================

app.post(
  '/api/doctors/queue/:id/call',
  auth,
  role('doctor'),
  (req, res) => {

    const result =
      db
        .prepare(
          `
          UPDATE queue
          SET status='Called'
          WHERE id=?
            AND assigned_doctor_id=?
            AND status='Waiting'
          `
        )
        .run(
          req.params.id,
          req.user.id
        );


    if (!result.changes) {

      return res.status(400).json({

        error:
          'Patient cannot be called'

      });

    }


    res.json({
      ok: true
    });

  }
);


// ======================================================
// COMPLETE PATIENT
// ======================================================

app.post(
  '/api/doctors/queue/:id/complete',
  auth,
  role('doctor'),
  (req, res) => {

    const result =
      db
        .prepare(
          `
          UPDATE queue
          SET status='Completed'
          WHERE id=?
            AND assigned_doctor_id=?
            AND status IN
              ('Waiting','Called')
          `
        )
        .run(
          req.params.id,
          req.user.id
        );


    if (!result.changes) {

      return res.status(400).json({

        error:
          'Patient cannot be completed'

      });

    }


    res.json({
      ok: true
    });

  }
);


// ======================================================
// CREATE FOLLOW-UP
// ======================================================

app.post(
  '/api/doctors/followups',
  auth,
  role('doctor'),
  (req, res) => {

    const {
      patientId,
      followupAt,
      mode,
      reminderMinutes
    } = req.body || {};


    const patient =
      db
        .prepare(
          `
          SELECT p.id
          FROM patients p
          JOIN queue q
            ON q.patient_id=p.id
          WHERE p.id=?
            AND q.assigned_doctor_id=?
          LIMIT 1
          `
        )
        .get(
          patientId,
          req.user.id
        );


    if (
      !patient ||
      !followupAt ||
      ![
        'Online',
        'In-person'
      ].includes(mode)
    ) {

      return res.status(400).json({

        error:
          'Invalid follow-up'

      });

    }


    const meetingLink =
      mode === 'Online'
        ? `https://meet.google.com/medikiosk-${crypto
            .randomBytes(4)
            .toString('hex')}`
        : null;


    const result =
      db
        .prepare(
          `
          INSERT INTO followups
          (
            patient_id,
            doctor_id,
            followup_at,
            mode,
            meeting_link,
            reminder_minutes
          )
          VALUES
          (?,?,?,?,?,?)
          `
        )
        .run(

          patientId,

          req.user.id,

          followupAt,

          mode,

          meetingLink,

          Number(
            reminderMinutes
          ) || 30

        );


    res.status(201).json({

      id:
        result.lastInsertRowid,

      meetingLink

    });

  }
);


// ======================================================
// DOCTOR FOLLOW-UPS
// ======================================================

app.get(
  '/api/doctors/me/followups',
  auth,
  role('doctor'),
  (req, res) => {

    res.json(

      db
        .prepare(
          `
          SELECT
            f.*,
            p.name patient_name
          FROM followups f
          JOIN patients p
            ON p.id=f.patient_id
          WHERE f.doctor_id=?
            AND f.status='Scheduled'
          ORDER BY f.followup_at
          `
        )
        .all(
          req.user.id
        )

    );

  }
);


// ======================================================
// FRONTEND FALLBACK
// ======================================================

/*
IMPORTANT:

There is NO frontend folder.

index.html is directly in the same
directory as server.js.

Therefore:

ROOT = __dirname

and:

index.html = ROOT/index.html
*/

app.get(
  '*',
  (req, res) => {

    res.sendFile(
      path.join(
        ROOT,
        'index.html'
      )
    );

  }
);


// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
  (err, req, res, next) => {

    console.error(err);

    res.status(400).json({

      error:
        err.message ||
        'Request failed'

    });

  }
);


// ======================================================
// START SERVER
// ======================================================

app.listen(
  PORT,
  () => {

    console.log(
      `MediKiosk running on port ${PORT}`
    );

  }
);
