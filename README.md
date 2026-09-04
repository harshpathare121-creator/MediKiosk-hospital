# MediKiosk — GitHub + Render Ready

MediKiosk is a full-stack hospital OPD queue prototype.

## Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: SQLite (`better-sqlite3`)
- Authentication: JWT + bcrypt
- File uploads: Multer

## Run locally
```bash
npm install
npm start
```
Then open `http://localhost:3000`.

## Demo accounts
- Registration desk: `regdesk` / `reg123`
- Doctors: `bones`, `brain`, `opd`, `emergency`, `pediatrics` / `doc123`

## Deploy from GitHub to Render
1. Create a GitHub repository named `MediKiosk`.
2. Upload **all files and folders from this project** (not the ZIP file inside the repository).
3. On Render, create a **New Web Service** and connect the GitHub repository.
4. Render will use `render.yaml`, or set:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Deploy and open the Render URL.

### Important demo limitation
The free Render filesystem is not permanent. SQLite data and uploaded files can be lost when the service is rebuilt/restarted. This is fine for a college/hackathon demo. For production medical records, use a managed database and permanent/private file storage.

## Project structure
```
MediKiosk/
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── images/
│       ├── home.jpg
│       ├── registration.jpg
│       ├── queue.jpg
│       └── doctor.jpg
├── backend/
│   ├── server.js
│   └── db.js
├── uploads/
├── package.json
└── render.yaml
```

## Validation
- Contact number must contain exactly 10 digits.
- Email is optional, but if entered it must be valid.
- Queue is separated by date and department.
- Registration staff cannot access medical history/documents through the registration API.
- Doctors can access patients assigned to their department/doctor and manage queue/follow-ups.

## Security note
This is a prototype. Set a strong `JWT_SECRET` for real deployments and do not use this setup for real patient records without proper security, privacy, audit, access-control and compliance work.
