# CORE - Community Organization for Response & Emergency

CORE is a crisis-response web platform for community-led emergency coordination.  
It is based on the SRS in [docs/SRS.md](./docs/SRS.md), with Module 0 implemented as the current working milestone.

## Technology Stack
- Frontend: React + TypeScript + Tailwind CSS + Vite
- Backend: Express + TypeScript
- Database: MongoDB (Atlas/local) via Prisma
- Auth: JWT in httpOnly cookies

## Implemented Right Now (Module 0)

### 0.1 Public Landing Page
- Public, responsive landing page with:
  - Hero + CTA (`Sign Up`, `Login`)
  - Core capabilities section
  - How-it-works summary
  - Impact stats + footer

### 0.2 Registration (User/Volunteer)
- Sign up fields:
  - Full name, email, phone, password + confirm, location, role
- Volunteer-specific fields:
  - Skills, availability, certifications
- Server-side validation:
  - Email/phone format checks
  - Password policy (8+ chars, upper/lower/number/symbol)
  - Duplicate email/phone rejection
- Password hashing with bcrypt

### 0.3 Login & Authentication
- Login with email/phone + password
- JWT issuance with `Remember Me` duration support
- Session cookie stored as httpOnly cookie
- Role-aware redirect behavior on login

### 0.4 Password Recovery
- Forgot password flow
- Reset token generation and expiry (15 minutes)
- Reset password endpoint + UI

### 0.5 Profile Management
- Authenticated profile view/edit
- Update name, phone, location, avatar URL
- Volunteer metadata updates (skills/availability/certifications)
- Change password with current-password verification

### 0.6 Role-Based Access Control (RBAC)
- Auth middleware (`requireAuth`)
- Role middleware (`requireRole`)
- Permission model utility for Module 0 RBAC baseline
- Protected and role-restricted frontend routes

### 0.7 Admin Seed Account
- Prisma seed script creates default admin
- Admin-only endpoints:
  - List users
  - Promote/demote User <-> Volunteer
  - Ban/unban users

### 0.8 Logout
- Logout endpoint clears auth cookie
- Frontend logout action in navigation

### 0.9 Responsive Navigation & Layout Shell
- Navbar adapts by auth state and role:
  - Guest: Home/Login/Sign Up
  - User/Volunteer/Admin: role-specific menu
- Mobile menu support

## Current Non-Module-0 Scope
- Modules 1-3 are not fully implemented yet.
- Placeholder/protected routes are present for later modules.

## Project Structure
- `backend/` - API, auth, profile, admin controls, Prisma schema/seed, tests
- `frontend/` - Landing/auth/profile/admin UI + route protection
- `docs/` - SRS and design notes

## Environment Setup

### 1. Backend env
Create `backend/.env`:

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
```

### 2. Frontend env
Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## How To Run The Project Cleanly (Windows PowerShell)

### Step A: Install deps
```powershell
cd backend
npm install
cd ../frontend
npm install
cd ..
```

### Step B: Prepare database
```powershell
cd backend
npm run prisma:generate
npm run prisma:push
npm run seed
cd ..
```

### Step C: Ensure no old dev servers are running
```powershell
$conn5000 = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($conn5000) { Stop-Process -Id $conn5000.OwningProcess -Force }
$conn5173 = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($conn5173) { Stop-Process -Id $conn5173.OwningProcess -Force }
```

### Step D: Start servers
Terminal 1:
```powershell
cd backend
npm run dev
```

Terminal 2:
```powershell
cd frontend
npm run dev
```

### Step E: Open app
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/api/health`

## Verification Commands
- Backend tests: `cd backend && npm test`
- Backend build: `cd backend && npm run build`
- Frontend build: `cd frontend && npm run build`
