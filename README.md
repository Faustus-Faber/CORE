# CORE - Community Organization for Response & Emergency

CORE is a crisis-response web platform for community-led emergency coordination.
The full product scope is defined in [docs/SRS.md](./docs/SRS.md).

## Current Implementation Status

### Module 0 (Foundation)
- Public landing page
- Authentication (signup/login/logout)
- Forgot/reset password
- Profile management
- RBAC with protected frontend/backend routes
- Admin user-management basics (list users, role update, ban/unban)
- Responsive app shell/navigation

### Module 1, Feature 1 (Emergency Reporting)
- Incident submission form with:
  - Title, description, incident type, location
  - Optional media upload (images/videos)
  - Voice note via:
    - in-browser recording (`MediaRecorder`)
    - direct audio file upload (`.mp3`, `.wav`, `.webm`)
- External AI pipeline integration:
  - Voice transcription/translation API
  - Text analysis/classification API (credibility, severity, type, title, spam flag)
- Report persistence in MongoDB via Prisma
- Reporter redirect to Reports Explorer after submit
- Reports Explorer:
  - `Community Reports` and `My Submissions`
  - Search, severity filter, sort (time/severity/credibility)
- Admin moderation for unpublished reports:
  - Review unpublished (`UNDER_REVIEW`) reports
  - Publish report from admin moderation page

## Technology Stack
- Frontend: React + TypeScript + Tailwind CSS + Vite
- Backend: Express + TypeScript
- Database: MongoDB via Prisma
- Auth: JWT in httpOnly cookies
- Testing: Vitest + Supertest

## Newly Added Packages (Module 1 Feature 1)

### Backend runtime dependencies
- `multer` (multipart file upload handling)
- `supertest` (HTTP route testing support)

### Backend dev dependencies
- `@types/multer`
- `@types/supertest`

## Project Structure
- `backend/` - API, services, Prisma schema/seed, tests
- `frontend/` - UI pages/components/services
- `docs/` - SRS and implementation plans

## Requirements
- Node.js 22+
- npm 10+
- MongoDB Atlas/local instance

## Environment Setup

### 1. Backend env (`backend/.env`)

```env
DATABASE_URL="mongodb+srv://<user>:<pass>@<cluster>/core?retryWrites=true&w=majority"
PORT=5000
CORS_ORIGIN="http://localhost:5173"
JWT_SECRET="replace-with-strong-random-secret"

ADMIN_EMAIL="admin@core.local"
ADMIN_PHONE="+8801700000000"
ADMIN_PASSWORD="Admin@12345"
ADMIN_NAME="CORE Admin"
ADMIN_LOCATION="Dhaka"

VOICE_API_BASE_URL="https://dervishlike-nilda-hiply.ngrok-free.dev"
TEXT_ANALYSIS_API_BASE_URL="https://lintiest-alissa-brigandishly.ngrok-free.dev"
AI_REQUEST_TIMEOUT_MS=15000
```

### 2. Frontend env (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000/api
```

## Install Dependencies

### First-time setup

```powershell
cd backend
npm install
cd ../frontend
npm install
cd ..
```

### After pulling latest changes

Run this every time after `git pull` if package files changed:

```powershell
cd backend
npm install
cd ../frontend
npm install
cd ..
```

## Database Setup

```powershell
cd backend
npm run prisma:generate
npm run prisma:push
npm run seed
cd ..
```

## Run the App (Windows PowerShell)

### Stop old processes (recommended)

```powershell
$conn5000 = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($conn5000) { Stop-Process -Id $conn5000.OwningProcess -Force }
$conn5173 = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($conn5173) { Stop-Process -Id $conn5173.OwningProcess -Force }
```

### Start backend (Terminal 1)

```powershell
cd backend
npm run dev
```

### Start frontend (Terminal 2)

```powershell
cd frontend
npm run dev
```

### Open
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/api/health`

## Admin Login
- Admin is seeded from `backend/.env`.
- Login identifier: `ADMIN_EMAIL` or `ADMIN_PHONE`
- Password: `ADMIN_PASSWORD`

## Verification Commands
- Backend tests: `cd backend && npm test`
- Backend build: `cd backend && npm run build`
- Frontend build: `cd frontend && npm run build`
