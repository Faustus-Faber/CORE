# CORE - Community Organization for Response & Emergency

CORE is a crisis-response web platform for community-led emergency coordination.
It is based on the SRS in [docs/SRS.md](./docs/SRS.md), with Module 0 and Volunteer Review System implemented.

## Technology Stack
- Frontend: React + TypeScript + Tailwind CSS + Vite
- Backend: Express + TypeScript
- Database: MongoDB (Atlas/local) via Prisma
- Auth: JWT in httpOnly cookies

## Implemented Features

### Module 0 — Foundation (Complete)

#### 0.1 Public Landing Page
- Public, responsive landing page with:
  - Hero + CTA (`Sign Up`, `Login`)
  - Core capabilities section
  - How-it-works summary
  - Impact stats + footer

#### 0.2 Registration (User/Volunteer)
- Sign up fields:
  - Full name, email, phone, password + confirm, location, role
- Volunteer-specific fields:
  - Skills, availability, certifications
- Server-side validation:
  - Email/phone format checks
  - Password policy (8+ chars, upper/lower/number/symbol)
  - Duplicate email/phone rejection
- Password hashing with bcrypt

#### 0.3 Login & Authentication
- Login with email/phone + password
- JWT issuance with `Remember Me` duration support
- Session cookie stored as httpOnly cookie
- Role-aware redirect behavior on login

#### 0.4 Password Recovery
- Forgot password flow
- Reset token generation and expiry (15 minutes)
- Reset password endpoint + UI

#### 0.5 Profile Management
- Authenticated profile view/edit
- Update name, phone, location, avatar URL
- Volunteer metadata updates (skills/availability/certifications)
- Change password with current-password verification

#### 0.6 Role-Based Access Control (RBAC)
- Auth middleware (`requireAuth`)
- Role middleware (`requireRole`)
- Permission model utility for Module 0 RBAC baseline
- Protected and role-restricted frontend routes

#### 0.7 Admin Seed Account
- Prisma seed script creates default admin
- Admin-only endpoints:
  - List users
  - Promote/demote User <-> Volunteer
  - Ban/unban users
  - View and moderate flagged reviews
  - Approve or delete flagged reviews

#### 0.8 Logout
- Logout endpoint clears auth cookie
- Frontend logout action in navigation

#### 0.9 Responsive Navigation & Layout Shell
- Navbar adapts by auth state and role:
  - Guest: Home/Login/Sign Up
  - User/Volunteer/Admin: role-specific menu
- Mobile menu support

### Module 1 — Partial

#### 1.3 Volunteer Reviews & Fraud Detection (Complete - Comprehensive Implementation)
- Users (USER role only) can submit reviews for volunteers with:
  - Star rating (1-5 stars)
  - Interaction context dropdown (Rescue Operation, Medical Aid, Supply Distribution, Shelter Management, Other)
  - Date of interaction picker (cannot be future date)
  - Review text (20-2000 characters)
  - "Would you work again?" Yes/No radio buttons
  - Optional crisis event ID linkage
- Review-level fraud detection automatically flags reviews when:
  - Reviewer's account is less than 24 hours old
  - Review text is shorter than 20 characters
  - Reviewer has submitted 3+ reviews in the last 24 hours
  - Review contains fraud keywords (scam, fake, fraud, not present, took supplies, stole, liar, dishonest, corrupt, bribe)
- Volunteer-level fraud detection automatically flags volunteers when:
  - Average rating below 2.0 stars across 5+ reviews
  - 40%+ of reviews contain fraud keywords
  - 3+ "Would not work again" responses in 30 days
- Flagged reviews are stored with `isFlagged: true` and flag reasons
- Flagged volunteers have `isFlagged: true` and `volunteerFlagReasons` array
- Admin Panel has two tabs for moderation:
  - **Flagged Reviews Tab:** View and moderate flagged reviews
    - Approve: Removes flag and flag reasons from review
    - Delete: Permanently deletes review (auto-recalculates volunteer flag status)
  - **Flagged Volunteers Tab:** View and moderate flagged volunteers
    - Clear Flag: Removes flag and flag reasons from volunteer profile
    - Ban Volunteer: Bans volunteer from platform
- Prevents:
  - Duplicate reviews (one review per user per volunteer)
  - Self-reviews
  - Volunteers reviewing other volunteers
  - Reviews for non-volunteers
- Volunteer profile displays:
  - ⚠️ "Volunteer Under Review" warning badge when flagged (shows flag reasons)
  - Average rating calculated from all reviews
  - Skills badges
- ReviewList component displays for each review:
  - Interaction context badge
  - Interaction date
  - "Would work again" status (✓ or ✗)
  - "⚠ Flagged for review" badge on flagged reviews

## Features Not Yet Implemented

### Module 1 — Remaining
- 1.1 Emergency Reporting (AI credibility scoring, Whisper transcription)
- 1.2 Resource Registration
- 1.4 Secure Documentation

### Module 2 — Remaining
- 2.1 Real-Time Dashboard (AI duplicate clustering, SitRep generation)
- 2.2 Interactive Crisis Map (Google Maps integration)
- 2.3 Volunteer Directory Search (advanced filtering by skills, proximity)
- 2.4 Visual Evidence Gallery

### Module 3 — All Features
- 3.1 Live Crisis Updates
- 3.2 Resource Status Management
- 3.3 Automated Dispatch SMS (Twilio integration)
- 3.4 NGO Summary Reports (PDF generation)
- 3.5 Targeted Push Notifications
- 3.6 Resource Reservation
- 3.7 Volunteer Timesheet & Gamification (leaderboard, badges, points)
- 3.8 Disaster Damage OCR (Google Vision API)

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
