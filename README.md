# CORE - Community Organization for Response & Emergency

> A crisis-response web platform for community-led emergency coordination and resource management.

[![Status](https://img.shields.io/badge/status-active-success)]()
[![Node](https://img.shields.io/badge/node-%3E%3D22-green)]()
[![React](https://img.shields.io/badge/react-19-blue)]()
[![MongoDB](https://img.shields.io/badge/mongodb-atlas-green)]()

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Demo Accounts](#demo-accounts)
- [Testing Features](#testing-features)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Overview

CORE enables communities to coordinate emergency response efforts through real-time incident reporting, resource management, volunteer coordination, and secure evidence documentation. The platform integrates AI-powered credibility assessment and fraud detection to ensure reliable information during crisis situations.

**Full Specification:** [Software Requirements Specification](./docs/SRS.md)

---

## Features

### ✅ Module 0: Foundation (Complete)
- Public landing page with responsive design
- Complete authentication system (signup, login, logout, password reset)
- User profile management
- Role-Based Access Control (RBAC)
- Admin user management dashboard

### ✅ Module 1, Feature 1: Emergency Reporting (Complete)
- Multi-format incident submission (text, images, video, voice notes)
- Map-based location picker with Google Maps integration (pin, drag, search, GPS auto-detect)
- AI-powered analysis via Groq (Whisper + Qwen models)
  - Voice transcription and translation
  - Credibility scoring with GPS coordinate verification
  - Severity classification, spam detection, location-mismatch fraud detection
- Reports Explorer with advanced filtering and sorting
- Admin moderation workflow for unpublished reports

### ✅ Module 1, Feature 2: Resource Registration (Complete)
- Emergency resource cataloging with GPS coordinates
- Interactive crisis map (Google Maps integration)
- Resource status tracking (Available, Reserved, Depleted, etc.)
- Owner-managed resource editing and deactivation

### ✅ Module 1, Feature 3: Volunteer Reviews & Fraud Detection (Complete)
- Volunteer directory with public profiles
- Review system with fraud detection algorithms
  - Account age verification
  - Review velocity monitoring
  - Keyword-based fraud flagging
  - Rating anomaly detection
- Admin moderation for flagged content

### ✅ Module 1, Feature 4: Secure Documentation (Complete)
- Private digital evidence folders
- Secure file upload with GPS/timestamp metadata
- Shareable links with configurable expiration
- Soft-delete with 30-day recovery window
- Operational notes with audit trail

### ✅ Module 2, Feature 1: Real-Time Dashboard (Complete)
- AI-powered duplicate report clustering into Master Incident cards
  - Groq LLM semantic similarity analysis (≥0.80 threshold)
  - Real-time clustering triggered on each new report submission
- Intelligence Briefing dashboard with structured JSON blueprint
  - Dynamic threat level indicator (GREEN → AMBER → RED → CRITICAL)
  - Animated metric counters (Active Incidents, Reports Merged, Critical count)
  - Google Maps-based pulse map with severity-colored markers
  - Incident timeline with severity-coded dots
  - Warning cards for high/critical areas
  - Resource tiles showing available nearby supplies
  - AI-generated safety advisories contextual to active crises
- Dashboard feed with location-based filtering (default 10km radius)
- Advanced filtering by incident type, severity, and time range (1h, 6h, 24h, 7d)
- Sorting by most recent, highest severity, or most reports merged
- Detailed incident view with embedded map, contributing reports, and nearby resources
- Collapsible SitRep panel with auto-refresh every 10 minutes

### ✅ Module 2, Feature 3: Volunteer Directory Search (Complete)
- Searchable, paginated volunteer directory with skill tags
- Filters: text search, proximity radius, availability, minimum rating
- Sorting: nearest first, highest rated, alphabetical
- Detailed volunteer profile with reviews, trust rating, and flag warnings

### ✅ Module 2, Feature 4: Visual Evidence Gallery (Complete)
- Social-media-style evidence feed with images and videos from crisis zones
- Media post creation with title, description, location, and GPS coordinates
- Like, comment, and share functionality with optimistic UI updates
- Admin verification badge for trusted evidence posts
- Flag system for community moderation with reason prompts
- Filter by all/verified posts, sort by newest/oldest
- Responsive modal viewer for full media detail view
- Owner-only post editing and deletion

### ✅ Module 3, Feature 1: Live Crisis Updates (Complete)
- Append-only crisis update timeline with status, severity, affected area, casualty, displacement, and damage fields
- Status progression enforcement (`Reported → Verified → Under Investigation → Response in Progress → Contained → Resolved → Closed`)
- Conflict-resolution check that flags skipped-state transitions for admin review
- Trusted-volunteer bypass (trust rating ≥ 4.0, not flagged) for immediate updates
- AI-regenerated Situation Update via Groq Qwen 3-32B after each change, rendered as structured Markdown on the incident detail page
- Admin override controls: dismiss flagged updates, revert status to any prior state with correction note
- Auto-prompt to admins for NGO Summary Report on `Resolved`/`Closed`

### ✅ Module 3, Feature 2: Resource Status Management (Complete)
- Owner-managed "Update Resource" form with status (`Available → Low Stock → Reserved → Depleted → Unavailable`), remaining quantity, availability window, and notes
- Quantity validation capped at the originally registered amount
- Automatic transition to `Depleted` when remaining quantity reaches 0
- Resource history log capturing every status and quantity change with timestamps
- Live propagation to the Interactive Crisis Map resource markers (greyed-out/removed when `Depleted` or `Unavailable`)

### ✅ Module 3, Feature 5: Targeted Push Notifications (Complete)
- Notification preferences page with multi-select crisis categories, 5–50 km radius slider, and master enable/disable toggle
- Category + radius matching on every new verified incident (Haversine geo-filter)
- AI-generated survival instructions via Groq Qwen 3-32B (`reasoning_effort: "none"` for reliable token budgeting)
- Structured Markdown output rendered with `react-markdown` + `remark-gfm` in the notification inbox
- Paginated notification inbox (20/page) with unread count, mark-as-read, mark-all-read, and clear-handled actions
- Crisis update notifications for subscribers when an incident's status changes
- NGO report prompt notifications to admins when a crisis resolves
- Reservation lifecycle notifications (request / approved / declined) between requester and resource owner

### ✅ Module 3, Feature 6: Resource Reservation (Complete)
- "Reserve" action on the Crisis Map info window and resource detail page (visible only when status is `Available` or `Low Stock`)
- Reservation form with requested quantity (bounded by remaining availability), justification, and preferred pickup time
- Pending-state reservation record with temporary quantity hold
- Owner-managed "Reservations" tab under My Resources with approve/decline workflow
- In-app notifications to owners on new requests, and to requesters on approval/decline

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Vite, React Router |
| **Backend** | Express, TypeScript, Multer |
| **Database** | MongoDB (Atlas), Prisma ORM |
| **Authentication** | JWT (httpOnly cookies), bcryptjs |
| **Maps** | Google Maps API (@react-google-maps/api) |
| **AI Services** | Groq API (Whisper, Qwen) |
| **Testing** | Vitest, Supertest |

### Key Dependencies

**Backend**
```json
{
  "@prisma/client": "^6.5.0",
  "express": "^4.21.2",
  "multer": "^2.1.1",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3",
  "zod": "^3.24.2"
}
```

**Frontend**
```json
{
  "react": "^19.0.0",
  "react-router-dom": "^7.2.0",
  "axios": "^1.7.9",
  "@react-google-maps/api": "^2.20.8",
  "tailwindcss": "^3.4.17"
}
```

---

## Project Structure

```
CORE/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   │   ├── dashboardController.ts    # Dashboard feed, SitRep, incident detail
│   │   │   └── ...
│   │   ├── services/        # Business logic
│   │   │   ├── dashboardService.ts       # AI clustering, SitRep generation
│   │   │   └── ...
│   │   ├── middleware/      # Auth, upload, error handling
│   │   ├── routes/          # API route definitions
│   │   │   ├── dashboardRoutes.ts        # Dashboard API routes
│   │   │   └── ...
│   │   ├── utils/           # Validation, helpers
│   │   └── server.ts        # Entry point
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema (includes CrisisEvent, CrisisEventReport)
│   │   ├── seed.ts          # Test data seeder
│   │   └── seed-additional-clusters.ts   # Additional crisis events for demo
│   ├── uploads/             # Static file storage
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Route components
│   │   │   ├── DashboardPage.tsx         # Real-time dashboard with filters
│   │   │   ├── IncidentDetailPage.tsx    # Detailed incident view
│   │   │   └── ...
│   │   ├── components/      # Reusable UI components
│   │   │   ├── SitRepPanel.tsx           # Intelligence Briefing panel
│   │   │   ├── IncidentCard.tsx          # Clustered incident card
│   │   │   ├── IncidentFeed.tsx          # Scrollable incident list
│   │   │   ├── DashboardFilters.tsx      # Filter controls
│   │   │   └── ...
│   │   ├── services/        # API client
│   │   ├── context/         # React context (Auth)
│   │   ├── types.ts         # TypeScript types
│   │   └── App.tsx          # Root component
│   └── package.json
├── docs/
│   └── SRS.md               # Software Requirements Specification
└── README.md
```

---

## Prerequisites

| Software | Version | Download |
|----------|---------|----------|
| Node.js | 22+ | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Included with Node.js |
| MongoDB | Atlas or Local | [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas) |

---

## Installation

### Quick Start

```powershell
# Navigate to project directory
cd "D:\CSE471 Project\CORE\Test\CORE"

# Install all dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# Initialize database
cd backend
npm run prisma:generate
npm run prisma:push
npm run seed
npm run seed:clusters
cd ..
```

### Detailed Steps

1. **Clone or download** the repository
2. **Install backend dependencies:**
   ```powershell
   cd backend
   npm install
   ```
3. **Install tsx (runtime for TypeScript on Node.js):**
   ```powershell
   cd backend
   npm install -D tsx
   ```
   > **Important:** The `tsx` package is required to run the backend. Without it, `npm run dev` will fail with `'tsx' is not recognized as an internal or external command`.
4. **Install frontend dependencies:**
   ```powershell
   cd ../frontend
   npm install
   cd ..
   ```
5. **Generate Prisma client:**
   ```powershell
   cd backend
   npm run prisma:generate
   ```
6. **Sync database schema:**
   ```powershell
   npm run prisma:push
   ```
7. **Seed test data:**
   ```powershell
   npm run seed
   ```
8. **Seed additional dashboard demo data:**
   ```powershell
   npm run seed:clusters
   ```

---

## Configuration

### Backend Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL="mongodb+srv://<user>:<pass>@<cluster>/core?retryWrites=true&w=majority"

# Server
PORT=5000
CORS_ORIGIN="http://localhost:5173"

# Authentication
JWT_SECRET="generate-a-strong-random-secret-here"

# Admin Account (seeded)
ADMIN_EMAIL="admin@core.local"
ADMIN_PHONE="+8801700000000"
ADMIN_PASSWORD="Admin@12345"
ADMIN_NAME="CORE Admin"
ADMIN_LOCATION="Dhaka"

# Groq AI API
GROQ_API_KEY="your-groq-api-key"
GROQ_BASE_URL="https://api.groq.com/openai/v1"
GROQ_WHISPER_MODEL="whisper-large-v3"
GROQ_QWEN_MODEL="qwen/qwen3-32b"
AI_REQUEST_TIMEOUT_MS=15000
```

### Frontend Environment Variables

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

> **Obtain Google Maps API Key:** [Google Cloud Console](https://console.cloud.google.com/)

---

## Running the Application

### Start Development Servers

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
```
Backend runs on: `http://localhost:4000`

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```
Frontend runs on: `http://localhost:5173`

### Stop Existing Processes

If ports are occupied:

```powershell
$conn4000 = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
if ($conn4000) { Stop-Process -Id $conn4000.OwningProcess -Force }

$conn5173 = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($conn5173) { Stop-Process -Id $conn5173.OwningProcess -Force }
```

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Main application |
| Backend API | http://localhost:4000/api | REST API |
| Health Check | http://localhost:4000/api/health | API status |
| Static Files | http://localhost:4000/uploads/ | Uploaded media |

---

## Demo Accounts

After running `npm run seed`, the following accounts are available:

### Administrators

| Email | Password | Access |
|-------|----------|--------|
| `admin@core.local` | `Admin@12345` | Full admin privileges |
| `mizan@core.local` | `Admin@12345` | Full admin privileges |

### Standard Users (Password: `User@12345`)

| Email | Purpose |
|-------|---------|
| `farhan@core.local` | Demo account (trusted reviewer) |
| `babul@core.local` | New account (<1 day, fraud flag trigger) |
| *(33 additional users)* | Various test scenarios |

### Volunteers (Password: `Volunteer@12345`)

| Email | Status | Description |
|-------|--------|-------------|
| `ayesha.vol@core.local` | ✅ Exemplary | 4.6★ rating, 8 reviews |
| `kamrul.vol@core.local` | ✅ Solid | 4.0★ rating, 6 reviews |
| `rashida.vol@core.local` | ✅ Good | 4.3★ rating, 7 reviews |
| `farzana.vol@core.local` | ✅ Excellent | 4.5★ rating, 6 reviews |
| `masud.vol@core.local` | ✅ Good | 4.2★ rating, 5 reviews |
| `billal.vol@core.local` | ⚠️ Flagged | 1.5★ avg, low-rating flag |
| `sohel.vol@core.local` | ⚠️ Flagged | 67% fraud keywords |
| `alamgir.vol@core.local` | ⚠️ Flagged | Negative trend in 30d |
| `munira.vol@core.local` | 🆕 Fresh | Zero reviews yet |
| *(3 additional volunteers)* | Various test scenarios |

---

## Testing Features

### Emergency Reporting Workflow

1. **Submit Report:**
   - Login: `grace@core.local` / `User@12345`
   - Navigate: Report Incident
   - Complete: Title, description, type
   - **Location**: Pin on the interactive Google Map (auto-fills address + GPS coordinates), or search for an address
   - Optional: Attach media or voice note
   - Submit → Redirects to Reports Explorer

2. **Browse Reports:**
   - Navigate: Reports Explorer (`/reports/explore`)
   - Filter: Severity, credibility, time
   - Toggle: Community Reports / My Submissions

3. **Admin Moderation:**
   - Login: Admin account
   - Navigate: Admin Panel → Moderate Reports
   - Action: Publish or Keep Under Review

### Real-Time Dashboard Workflow

1. **View Intelligence Briefing:**
   - Login: Any user account
   - Navigate: Dashboard (`/dashboard`)
   - View: Threat level indicator, animated metrics, SitRep panel
   - Expand: SitRep to see AI-generated community briefing

2. **Explore Incident Feed:**
   - View: Clustered Master Incident cards with merged report counts
   - Filter: Incident type, severity, time range (1h, 6h, 24h, 7d)
   - Sort: Most recent, highest severity, most reports merged
   - Click: Any incident card to view details

3. **Incident Detail View:**
   - View: Full incident information with embedded Google Map
   - See: All contributing reports from different users
   - Check: Nearby available resources
   - Hover: Map markers to see incident names

4. **Test AI Clustering:**
   - Submit: A new report similar to an existing incident
   - Observe: Report merges into existing Master Incident
   - Verify: Report count increases on dashboard card

### Volunteer Review & Fraud Detection

| Test Case | Steps | Expected |
|-----------|-------|----------|
| New Account Flag | Login as `frank@core.local` → Submit review | Review flagged |
| Short Text Flag | Submit review with text <20 chars | Review flagged |
| Fraud Keywords | Include "scam", "fake", "fraud" | Review flagged |
| Low Rating Flag | View Mike Wilson profile | Volunteer flagged |
| Admin Moderation | Admin Panel → Flagged Reviews | Approve/Delete options |

### Resource Management

1. **Add Resource:**
   - Login: Any user
   - Navigate: Resources → Add Resource
   - Complete: Name, category, quantity, location (map)
   - Optional: Photos (max 3), availability window
   - Submit → My Resources

2. **Interactive Map:**
   - Navigate: Map
   - View: Resource markers
   - Click: Info window with details

### Visual Evidence Gallery

1. **Create Evidence Post:**
   - Login: `admin@core.local` / `Admin@12345` or any volunteer account
   - Navigate: Gallery (`/gallery`)
   - Fill: Title, description, location, media type (IMAGE/VIDEO)
   - Attach: Media files (images or videos)
   - Submit → Post appears in feed (auto-verified for admins)

2. **Interact with Posts:**
   - Like: Click like to toggle (optimistic UI)
   - Comment: Add comments visible in post modal
   - Share: Uses Web Share API or copies link to clipboard
   - Verify: Admin can verify unverified posts
   - Flag: Report inappropriate/fake posts with reason prompt

3. **Filter and Sort:**
   - Filter: All posts / Verified only
   - Sort: Newest first / Oldest first

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reports` | Submit incident report |
| GET | `/api/reports` | List community reports |
| GET | `/api/reports/my` | List user submissions |
| PUT | `/api/reports/:id/status` | Update report status (Admin) |

### Volunteers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/volunteers` | List volunteers |
| GET | `/api/volunteers/:id` | Get volunteer profile |
| POST | `/api/volunteers/:id/reviews` | Submit review |
| GET | `/api/volunteers/:id/reviews` | Get volunteer reviews |

### Resources
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/resources` | Register resource |
| GET | `/api/resources` | List resources |
| GET | `/api/resources/my` | List user resources |
| PUT | `/api/resources/:id` | Update resource |
| DELETE | `/api/resources/:id` | Delete resource |

### Documents (Secure Folders)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/docs` | List user folders |
| POST | `/api/docs` | Create folder |
| GET | `/api/docs/:id` | Get folder details |
| POST | `/api/docs/:id/files` | Upload file |
| POST | `/api/docs/:id/notes` | Add note |
| POST | `/api/docs/:id/share` | Generate share link |
| DELETE | `/api/docs/:id` | Soft-delete folder |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/feed` | Get clustered incident feed with filters |
| GET | `/api/dashboard/sitrep` | Get AI-generated Situation Report |
| GET | `/api/dashboard/incidents/:id` | Get incident detail with contributing reports |

### Crisis Updates (Module 3.1)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dashboard/incidents/:id/updates` | Submit a crisis status/severity update |
| GET | `/api/dashboard/incidents/:id/updates` | List crisis update timeline |
| PATCH | `/api/dashboard/incidents/updates/:updateId/dismiss` | Dismiss a flagged update (Admin) |
| PATCH | `/api/dashboard/incidents/:id/revert` | Revert a crisis to a prior status (Admin) |

### Notifications (Module 3.5)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/preferences` | Get the user's notification subscription |
| PUT | `/api/notifications/preferences` | Update category, radius, and enable flag |
| GET | `/api/notifications/inbox` | Paginated notification inbox with unread count |
| PATCH | `/api/notifications/inbox/:id/read` | Mark a single notification as read |
| POST | `/api/notifications/inbox/read-all` | Mark every notification as read |
| DELETE | `/api/notifications/inbox/clear-handled` | Delete all read notifications |
| POST | `/api/notifications/dispatch` | Manually dispatch a crisis notification (Admin) |

### Resource Reservation & Status (Module 3.2, 3.6)
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/resources/update/:id` | Update status, quantity, window, and notes |
| PATCH | `/api/resources/deactivate/:id` | Deactivate a resource (owner only) |
| GET | `/api/resources/:id/history` | List the resource status/quantity change log |
| POST | `/api/resources/reserve` | Create a reservation with justification |
| GET | `/api/resources/:id/reservations` | List reservations for a resource |
| PATCH | `/api/resources/reservation/:id/approve` | Approve a pending reservation (owner) |
| PATCH | `/api/resources/reservation/:id/decline` | Decline a pending reservation (owner) |

### Evidence Gallery
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/evidence` | List evidence posts (filter: verified, sort: newest/oldest) |
| POST | `/api/evidence` | Create evidence post with media files |
| PATCH | `/api/evidence/:id` | Update post (owner only) |
| DELETE | `/api/evidence/:id` | Delete post (owner only) |
| POST | `/api/evidence/:id/like` | Toggle like |
| POST | `/api/evidence/:id/comment` | Add comment |
| POST | `/api/evidence/:id/verify` | Verify post (Admin only) |
| POST | `/api/evidence/:id/flag` | Flag post for moderation |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/:id/role` | Update user role |
| PUT | `/api/admin/users/:id/ban` | Ban/unban user |
| GET | `/api/admin/flagged-reviews` | Get flagged reviews |
| GET | `/api/admin/flagged-volunteers` | Get flagged volunteers |

---

## Troubleshooting

### Port Conflicts

**Error:** Port 5000 or 5173 already in use

**Solution:**
```powershell
# Kill process on port 5000
$conn = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }

# Kill process on port 5173
$conn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
```

### File Upload Failures

| Issue | Solution |
|-------|----------|
| Upload directory missing | Ensure `backend/uploads` exists |
| File too large | Max size: 20MB (images/video), 10MB (audio) |
| Invalid format | Supported: JPG, PNG, WEBP, MP4, WEBM |
| Images not loading | Backend must be running (serves `/uploads/`) |

### Database Errors

| Issue | Solution |
|-------|----------|
| Connection failed | Verify `DATABASE_URL` in `.env` |
| Schema mismatch | Run `npm run prisma:generate` then `npm run prisma:push` |
| Seed failed | Drop database and re-run `npm run seed` |

### Google Maps Issues

| Issue | Solution |
|-------|----------|
| Blank map | Verify `VITE_GOOGLE_MAPS_API_KEY` |
| API error | Enable Maps JavaScript API in Cloud Console |
| Billing required | Add payment method to Google Cloud project |

### Build Errors

```powershell
# Clear cache and rebuild
cd backend
rm -r node_modules
rm package-lock.json
npm install

cd ../frontend
rm -r node_modules
rm package-lock.json
npm install
```

### Missing tsx Runtime

**Error:** `'tsx' is not recognized as an internal or external command`

**Solution:**
```powershell
cd backend
npm install -D tsx
```
> The `tsx` package is the TypeScript execution engine used by `npm run dev`. It must be installed in the `backend` directory before starting the server.

---

## Verification Commands

```powershell
# Backend tests
cd backend && npm test

# Backend build
cd backend && npm run build

# Frontend build
cd frontend && npm run build
```

---

## Roadmap

### ✅ Completed (Module 1 + Module 2 Features)
- [x] Feature 1: Emergency Reporting
- [x] Feature 2: Resource Registration
- [x] Feature 3: Volunteer Reviews & Fraud Detection
- [x] Feature 4: Secure Documentation

### 📋 Module 2 (In Progress)
- [x] Feature 1: Real-Time Dashboard with AI duplicate clustering
- [ ] Feature 2: Interactive Crisis Map (enhanced)
- [x] Feature 3: Volunteer Directory Search
- [x] Feature 4: Visual Evidence Gallery

### 📋 Module 3 (In Progress)
- [x] Feature 1: Live Crisis Updates
- [x] Feature 2: Resource Status Management
- [ ] Feature 3: Automated Dispatch SMS (Twilio)
- [ ] Feature 4: NGO Summary Reports (PDF)
- [x] Feature 5: Targeted Push Notifications
- [x] Feature 6: Resource Reservation
- [ ] Feature 7: Volunteer Timesheet & Gamification
- [ ] Feature 8: Disaster Damage OCR (Google Vision API)

---

## License

This project is part of CSE471 Coursework. All rights reserved.

## Contributors

Community Organization for Response & Emergency (CORE) Development Team
