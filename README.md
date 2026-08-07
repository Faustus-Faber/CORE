# CORE — Community Operations & Relief Engine

CORE (Community Operations & Relief Engine) is a production-grade crisis management, emergency intake, volunteer mobilization, and disaster relief governance platform. Designed for high-stakes emergency environments, CORE connects citizens, field responders, crisis commanders, and NGO auditors into a unified operational ecosystem.

**Live Application:** [https://core-frontend-sqgk.onrender.com/](https://core-frontend-sqgk.onrender.com/)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

## Executive Summary

During critical disaster scenarios—such as monsoons, chemical fires, building collapses, or flash floods—information fragmentation delays lifesaving action. CORE solves this by providing:

1. **Intelligent Citizen Emergency Intake**: Multi-step reporting with auto-geolocation, AI duplicate detection, voice-to-text transcription (Groq Whisper), OCR document extraction, and offline draft synchronization (IndexedDB).
2. **Geospatial GIS Command Maps**: Interactive Leaflet maps featuring live incident clusters, emergency shelters, supply drop-off locations, and real-time river flood risk telemetry (FFWC integration).
3. **Emergency AI Copilot & Automated Dispatch**: Tactical AI engine powered by DeepSeek/OpenAI that formulates response plans, creates action drafts with Markdown rationale, and auto-assigns deployment squads (`Active Field Responders Squad`).
4. **Resource Supply Marketplace & Stock Ledgers**: Supply pledge tracking, reservation workflows, fulfillment verification, and stock ledger balance enforcement.
5. **Secure Documentation & OCR Vaults**: Crisis-linked folder archives, OCR text extraction (OCR.space & Gemini Vision), and tokenized guest access with optional password locks.
6. **Immutable Audit & Executive NGO PDF Engine**: Cryptographically secured After-Action Reports (SHA-256 checksums) and 1-click executive multi-page PDF generation via PDFKit with direct streaming delivery.

---

## Comprehensive Role-Based Capability Matrix

CORE enforces strict Role-Based Access Control (RBAC) across three distinct user roles:

```text
               +-------------------------------------------------------+
               |                  PUBLIC / CITIZEN                     |
               | Emergency Filing, GIS Maps, Dashboard, Marketplace    |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |              FIELD RESPONDER / VOLUNTEER              |
               | Shift Timers, Mission Proof-of-Work, Live Crisis Chat |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |         CRISIS OPERATIONS COMMANDER / ADMIN           |
               | AI Copilot, Triage, Verification Queue, NGO Audits    |
               +-------------------------------------------------------+
```

### 1. Public & Citizen User Capabilities

| Feature | Access Route | Functional Description |
| --- | --- | --- |
| **Public Landing Hub** | `/` | Real-time crisis ticker, emergency metrics, quick report filing trigger, and system trust overview. |
| **Authentication System** | `/login`, `/signup`, `/forgot-password`, `/reset-password` | JWT-based auth stored in HTTP-Only cookies with double-submit CSRF cookie protection and password hashing via bcrypt. |
| **Live Crisis Command Dashboard** | `/dashboard` | Real-time crisis feed, severity filter pills (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), map previews, and situation report summaries. |
| **Incident Telemetry Detail** | `/dashboard/incidents/:id` | Full incident telemetry, live maps, timeline updates, linked community reports, resource needs, and responder activity logs. |
| **Emergency Incident Report Wizard** | `/report-incident` | Multi-step reporting wizard with auto-geolocation, image/audio attachments, AI OCR scanning, duplicate detection, and offline IndexedDB queueing. |
| **Community Reports Explorer** | `/reports/explore` & `/reports/:id` | Search and explore citizen reports, upvote corroboration claims, inspect verification flags, and view preliminary credibility scores. |
| **Leaflet GIS Command Map** | `/map` | Clustered incident markers, emergency shelters, supply drop-offs, and live FFWC river flood level risk layers. |
| **Visual Evidence Gallery** | `/gallery` | Verified damage evidence, OCR document scans, trust tier badges, eyewitness statements, comments, and likes. |
| **Resource Supply Marketplace** | `/browse-resources` | Search emergency supply offers (food, water, medicine, boats, generators, shelters) and request allocations. |
| **Pledge Emergency Supplies** | `/resources/add` & `/resources/my` | Offer emergency resources to relief teams, track reservation decisions, and manage fulfillment history. |
| **Volunteer Directory** | `/volunteers` & `/volunteers/:id` | Discover active responders, view skill tags, verified badges, community vouches, and emergency ratings. |
| **Community Leaderboard** | `/leaderboard` | Top responder ranks, mission points, verified service hours, and achievement badges. |
| **Notification Center** | `/notifications` & `/preferences` | Real-time inbox alerts, Web Push notifications, SMS/Email preferences, and severity threshold controls. |
| **User Profile & Trust Progress** | `/profile` | Manage personal details, skill tags, responder opt-in status, vouch count, account settings, and trust tier progress. |
| **Shared Vault Guest View** | `/shared/:token` | Secure guest access to shared documentation folders using tokenized links with optional password protection. |

---

### 2. Field Responder & Volunteer Capabilities

*Volunteers inherit all Citizen capabilities plus dedicated operational field tools:*

| Feature | Access Route | Functional Description |
| --- | --- | --- |
| **Field Shift & Task Console** | `/tasks` | Dedicated volunteer shift manager featuring deployment dispatch alerts, mission check-in/check-out shift timers, and supervisor sign-offs. |
| **Proof-of-Work Uploader** | `/tasks` | Upload field photographs, work notes, and verified service hours to accumulate volunteer leaderboard points and badges. |
| **Squad Dispatch Opt-In** | `/profile` | Opt into the **Active Field Responders Squad** for automated AI copilot emergency dispatch during incident escalations. |
| **Live Incident Chat** | `/operations/:crisisId` | Join scoped incident WebSocket chat rooms, stream voice memos, view pinned announcements, and share field media. |

---

### 3. Crisis Operations Commander & Admin Capabilities

*Commanders inherit all lower-tier capabilities plus full administrative, tactical, and audit controls:*

| Feature | Access Route | Functional Description |
| --- | --- | --- |
| **Crisis Operations Workspace** | `/operations` & `/operations/:crisisId` | Unified command console for incident triage, severity escalation, and lifecycle state management (`REPORTED` → `UNDER_INVESTIGATION` → `RESPONSE_IN_PROGRESS` → `CONTAINED` → `RESOLVED` → `CLOSED`). |
| **Emergency AI Copilot Intelligence** | `/operations` | Interactive AI assistant powered by DeepSeek/OpenAI. Formulates real-time response recommendations, drafts dispatch orders, and auto-assigns deployment squads (`Active Field Responders Squad`). |
| **Action Drafts Console** | `/operations` | Review AI-generated action drafts, expand collapsible execution logs, inspect ReactMarkdown reasoning, and execute actions with 1 click. |
| **Live Command Incident Chat** | `/operations/:crisisId` | Scoped real-time communication channel per crisis featuring voice message playback, file sharing, and commander announcement pinning. |
| **Verification Queue Moderation** | `/verification-queue` | Inspect unpublished citizen reports, evaluate duplicate detection warnings, analyze GPS proximity clusters, credibility scores, and publish or reject reports. |
| **Strategic Response Planner** | `/crises/:crisisId/response-plan` | Define operational milestones, deploy resource packages, assign volunteer squads, and plot supply distribution routes. |
| **After-Action Reports Console** | `/after-action-reports` & `/:crisisId` | Select any crisis incident, compile 1-click After-Action snapshots locked with SHA-256 cryptographic checksums, and publish official audit versions. |
| **NGO PDF Executive Report Engine** | `/after-action-reports` | 1-click executive PDF report compilation using PDFKit, streaming PDF documents directly (`Content-Type: application/pdf`) with timeline logs, resource ledgers, and OCR appendices. |
| **System Administration Panel** | `/admin` | Manage user role elevations (User → Volunteer → Admin), manage user bans, monitor latency SLOs, and inspect audit logs. |

---

## Technical Architecture & Security Model

```text
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|                                                                                   |
|   React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 3.4 + Leaflet GIS            |
|   React Markdown + Remark GFM | Theme SVG Icons (Strict No-Emoji Standard)        |
+------------------------------------------+----------------------------------------+
                                           |
                                           | HTTPS REST API + WebSockets / SSE
                                           | Credentials: HTTP-Only Cookie JWT
                                           v
+-----------------------------------------------------------------------------------+
|                                 BACKEND API LAYER                                 |
|                                                                                   |
|   Express 4 Server + TypeScript + Node.js 20 LTS                                  |
|   Middleware: Security Headers | Rate Limiter | CSRF | Idempotency | SLO Guard    |
+-------------------+----------------------+-------------------+--------------------+
                    |                      |                   |
                    | Prisma Client ORM    | Real-time Engine  | AI & PDF Services
                    v                      v                   v
+-------------------+---+          +-------+-------+   +-------+--------------------+
| MongoDB Atlas Database|          | WebSockets /  |   | Groq / DeepSeek / OpenAI   |
| Incident Telemetry    |          | SSE Server    |   | OCR.space + Gemini Vision  |
| Stock Ledgers         |          | Crisis Chat   |   | PDFKit Streaming Engine    |
+-----------------------+          +---------------+   +----------------------------+
```

### Security & Governance Principles

1. **Authentication & Authorization**: Signed JWT tokens delivered via HTTP-Only, SameSite cookies. Role-Based Access Control (RBAC) enforced via `requireAuth` and `requireRole` middleware.
2. **Double-Submit CSRF Protection**: Synchronizer token protection headers on all state-modifying POST/PUT/PATCH/DELETE endpoints.
3. **Idempotency Safeguards**: Header validation (`Idempotency-Key`) preventing duplicate action draft execution, report creation, or dispatch orders.
4. **Latency SLO Enforcement**: Request latency guard (`latencyGuard`) logging and alerting on p95 performance violations.
5. **Rate Limiting & Security Headers**: Tiered IP rate limiting (`authRateLimiter`, `apiRateLimiter`) and security headers modeled after Helmet patterns.
6. **No-Emoji UI Standard**: All user interface elements strictly utilize vector-rendered inline `<svg>` theme icons for a clean, professional aesthetic.

---

## Repository Structure

```text
CORE/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # MongoDB schema, models, enums, indexes
│   │   └── seed.ts               # Demo dataset seed script
│   ├── src/
│   │   ├── config/               # System thresholds & env configuration
│   │   ├── controllers/          # Express request handlers
│   │   ├── lib/                  # Database connections & stream helpers
│   │   ├── middleware/           # Auth, RBAC, CSRF, Idempotency, SLO, Rate Limit
│   │   ├── routes/               # Express router modules
│   │   ├── services/             # Core business logic, Copilot, NGO Reports, AAR
│   │   └── tests/                # Vitest backend integration test suite
│   └── uploads/                  # Local runtime storage for report PDFs & evidence
├── frontend/
│   ├── public/                   # Static assets, web manifest, service worker
│   └── src/
│       ├── components/           # UI components, CopilotPanel, ActionDraftsPanel
│       ├── contexts/             # Session & auth context
│       ├── pages/                # Route screens (Dashboard, Operations, Reports, etc.)
│       ├── services/             # API client functions & payload helpers
│       ├── types/                # TypeScript domain definitions
│       └── utils/                # Utility helpers & offline storage wrappers
└── README.md
```

---

## Complete Route Mapping

### Public & Guest Routes

- `/` — Public Landing Hub
- `/signup` — Account Registration
- `/login` — Account Sign In
- `/forgot-password` — Password Recovery Request
- `/reset-password` — Password Reset
- `/shared/:token` — Public Guest View for Shared Folders

### Authenticated Citizen Routes

- `/dashboard` — Live Crisis Command Dashboard
- `/dashboard/incidents/:id` — Incident Detail View
- `/report-incident` — Emergency Incident Report Filing Wizard
- `/reports/explore` — Community Incident Reports Explorer
- `/reports/:id` — Incident Report Detail & Corroboration View
- `/map` — Interactive Leaflet GIS Map & Risk Layers
- `/gallery` — Visual Evidence & Photo Gallery
- `/browse-resources` — Emergency Resource Marketplace
- `/resources/add` — Pledge Emergency Supplies
- `/resources/my` — Personal Supply Pledges & Reservations
- `/volunteers` — Volunteer & Responder Directory
- `/volunteers/:volunteerId` — Volunteer Profile & Skill Breakdown
- `/leaderboard` — Community Responder Leaderboard
- `/notifications` — In-App Notification Inbox
- `/notifications/preferences` — Alert Channel Preferences
- `/profile` — Personal User Profile & Squad Opt-In

### Volunteer Routes

- `/tasks` — Volunteer Shift Timer, Task Logs & Proof-of-Work Uploader

### Commander & Admin Routes

- `/operations` — Crisis Operations Workspace & AI Copilot Command Console
- `/operations/:crisisId` — Scoped Incident Operations & Live Chat Room
- `/verification-queue` — Unpublished Incident Report Moderation Queue
- `/crises/:crisisId/response-plan` — Strategic Response Planning Console
- `/after-action-reports` — After-Action Reports & NGO Audit Snapshot Manager
- `/after-action-reports/:crisisId` — Scoped Crisis Audit Report Viewer
- `/admin` — System Administration & User Moderation Panel

---

## Local Development & Setup Guide

### Prerequisites

- **Node.js**: 20 LTS or higher
- **npm**: 10+
- **MongoDB**: Local MongoDB instance or MongoDB Atlas URI
- **Groq API Key**: For AI Copilot & Groq Whisper voice transcription

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Faustus-Faber/CORE.git
cd CORE

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Backend Environment

Create `backend/.env`:

```env
DATABASE_URL="mongodb+srv://<username>:<password>@cluster.mongodb.net/core?retryWrites=true&w=majority"
PORT=5000
CORS_ORIGIN="http://localhost:5173"
JWT_SECRET="super-secret-jwt-key-change-in-production"
GROQ_API_KEY="your-groq-api-key"
```

### 3. Configure Frontend Environment

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Database Setup & Seeding

```bash
cd backend
npm run prisma:generate
npm run prisma:push
npm run seed
```

### 5. Launch Development Servers

**Backend Terminal:**
```bash
cd backend
npm run dev
```

**Frontend Terminal:**
```bash
cd frontend
npm run dev
```

Application will be accessible at `http://localhost:5173`.

---

## Database Seeding & Demo Accounts

The seed script (`npm run seed`) populates a demo disaster dataset:

| Role | Email | Password | Access Capabilities |
| --- | --- | --- | --- |
| **Admin** | `admin@core.local` | `Admin@12345` | Full Command, Copilot, Verification Queue, NGO Reports |
| **Admin** | `mizan@core.local` | `Admin@12345` | Crisis Operations Commander |
| **Volunteer** | `ayesha.vol@core.local` | `Volunteer@12345` | Shift Timers, Task Proof-of-Work, Responder Squad |
| **Citizen** | `farhan@core.local` | `User@12345` | Report Filing, Resource Marketplace, GIS Map |

---

## Quality Gates & Verification

To verify code quality, type safety, and build stability across the codebase:

```bash
# Validate Backend Build & Tests
cd backend
npm test
npm run build

# Validate Frontend Build & Type Check
cd ../frontend
npm run build
```

---

## Deployment Strategy

The application is configured for production deployment on Render:

- **Frontend Application**: Deployed as a static site running Vite build output.
- **Backend Service**: Deployed as a Node.js web service running Node 20 LTS with Express and Prisma Client.
- **Database**: Hosted on MongoDB Atlas.
