# CORE — Community Operations & Relief Engine

CORE is an enterprise-grade crisis management, emergency reporting, and disaster relief coordination platform designed to empower citizens, field responders, and crisis commanders with real-time operational intelligence.

**Live Application:** [https://core-frontend-jx9h.onrender.com/](https://core-frontend-jx9h.onrender.com/)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

## Table of Contents

- [Executive Overview](#executive-overview)
- [Role-Based Capability Matrix](#role-based-capability-matrix)
  - [Public & Citizen Users](#1-public--citizen-users)
  - [Field Responders & Volunteers](#2-field-responders--volunteers)
  - [Crisis Operations Commanders & Admins](#3-crisis-operations-commanders--admins)
- [Platform Architecture](#platform-architecture)
- [Emergency AI Copilot & Automated Dispatch](#emergency-ai-copilot--automated-dispatch)
- [After-Action Reports & NGO Audit Engine](#after-action-reports--ngo-audit-engine)
- [Technology Stack](#technology-stack)
- [Repository Layout](#repository-layout)
- [Complete Route Mapping](#complete-route-mapping)
- [API Architecture & Middleware](#api-architecture--middleware)
- [Local Setup & Development Guide](#local-setup--development-guide)
- [Environment Variables Reference](#environment-variables-reference)
- [Database Seeding & Demo Accounts](#database-seeding--demo-accounts)
- [Quality Gates & Testing](#quality-gates--testing)
- [Deployment Strategy](#deployment-strategy)
- [Security & Governance Compliance](#security--governance-compliance)

---

## Executive Overview

Disaster response requires seamless synchronization between ground eyewitnesses, volunteer dispatch teams, emergency coordinators, and donor agencies. CORE unifies these streams into a single operational picture featuring:

1. **AI-Assisted Emergency Intake**: Citizen incident filing with automated location extraction, duplicate detection, credibility scoring, and offline submission queues.
2. **Interactive GIS Command Maps**: Leaflet-based geospatial maps with active incident clusters, emergency shelters, supply offers, and live FFWC flood risk telemetry.
3. **Emergency AI Copilot Intelligence**: DeepSeek/OpenAI-powered tactical copilot capable of drafting dispatch orders, assigning field responder squads (`Active Field Responders Squad`), and rendering markdown rationale.
4. **Resilience & Resource Sharing**: Resource pledge marketplace tracking emergency supply allocations, delivery statuses, and stock ledgers.
5. **Secure Documentation & OCR**: Crisis-linked document vaults, OCR text extraction, and token-based guest sharing with password controls.
6. **Immutable Audit & NGO PDF Generation**: Cryptographically verified After-Action Reports (SHA-256 checksums) and 1-click executive PDF report generation via PDFKit.

---

## Role-Based Capability Matrix

CORE enforces fine-grained Role-Based Access Control (RBAC) across three distinct user personas:

### 1. Public & Citizen Users

Citizens have immediate access to public awareness, emergency filing, resource browsing, and evidence verification:

| Capability | Access Path | Description |
| --- | --- | --- |
| **Public Landing Hub** | `/` | Live crisis ticker, emergency metrics, quick report filing trigger, and system trust overview. |
| **Emergency Report Filing** | `/report-incident` | Multi-step incident wizard with auto-geolocation, image/audio attachments, AI OCR scanning, duplicate detection, and offline queueing (IndexedDB). |
| **Live Crisis Dashboard** | `/dashboard` | Real-time crisis feed, severity filter pills, location markers, and situation report summaries. |
| **Incident Detail Telemetry** | `/dashboard/incidents/:id` | Detailed incident briefing, timeline updates, linked community reports, resource needs, and responder activity logs. |
| **GIS Crisis & Risk Map** | `/map` | Leaflet GIS interactive map featuring clustered incident markers, shelter locations, resource drop-offs, and live river flood level overlays. |
| **Community Reports Explorer** | `/reports/explore` & `/reports/:id` | Search and explore citizen reports, upvote corroboration claims, inspect verification flags, and view preliminary credibility scores. |
| **Visual Evidence Gallery** | `/gallery` | Inspect verified field photographs, OCR documentation scans, evidence trust tiers, and eyewitness statements. |
| **Resource Marketplace** | `/browse-resources` | Search emergency supply offers (food, water, medicine, boats, generators, shelters) and request allocations. |
| **Pledge Supplies** | `/resources/add` & `/resources/my` | Offer emergency resources to relief teams, track reservation decisions, and manage fulfillment history. |
| **Volunteer Directory** | `/volunteers` & `/volunteers/:id` | Discover active responders, view skill tags, verified badges, community vouches, and emergency ratings. |
| **Community Leaderboard** | `/leaderboard` | View top-ranked field responders, verified mission hours, community points, and achievement badges. |
| **Notification Center** | `/notifications` & `/preferences` | Receive real-time inbox alerts, Web Push notifications, and set severity dispatch thresholds. |
| **Guest Document Access** | `/shared/:token` | Secure guest view for shared crisis document folders with optional password protection. |

---

### 2. Field Responders & Volunteers

*Volunteers inherit all Public & Citizen capabilities plus specialized operational features:*

| Capability | Access Path | Description |
| --- | --- | --- |
| **Field Task & Shift Console** | `/tasks` | Dedicated volunteer shift manager featuring deployment dispatch alerts, mission check-in/check-out shift timers, and supervisor sign-offs. |
| **Mission Proof-of-Work** | `/tasks` | Upload field photos, work notes, and verified service hours to accumulate volunteer leaderboard points and badges. |
| **Squad Dispatch Opt-In** | `/profile` | Opt into the **Active Field Responders Squad** for automated AI copilot assignment during emergency dispatches. |
| **Crisis Chat Access** | `/operations/:crisisId` | Join live scoped WebSocket incident chat rooms, listen to field voice memos, view pinned announcements, and share attachments. |

---

### 3. Crisis Operations Commanders & Admins

*Commanders inherit all lower-tier capabilities plus full administrative, tactical, and audit controls:*

| Capability | Access Path | Description |
| --- | --- | --- |
| **Crisis Operations Workspace** | `/operations` & `/operations/:crisisId` | Central command console for incident triage, severity escalation, and lifecycle state management (`REPORTED` → `UNDER_INVESTIGATION` → `RESPONSE_IN_PROGRESS` → `CONTAINED` → `RESOLVED` → `CLOSED`). |
| **Emergency AI Copilot** | `/operations` | Interactive AI assistant powered by DeepSeek/OpenAI. Provides tactical reasoning, action draft generation, dispatch orders, and volunteer squad auto-assignment. |
| **Action Drafts Console** | `/operations` | Review AI-generated action drafts, expand interactive execution logs, review formatted Markdown rationale, and execute actions in 1 click. |
| **Live Command Incident Chat** | `/operations/:crisisId` | Scoped real-time communication channel per crisis featuring voice message playback, file sharing, and commander announcement pinning. |
| **Verification Queue** | `/verification-queue` | Moderate unpublished citizen reports, review duplicate detection warnings, analyze GPS proximity clusters, and publish or reject reports. |
| **Strategic Response Planner** | `/crises/:crisisId/response-plan` | Define operational milestones, deploy resource packages, assign volunteer squads, and plot supply distribution routes. |
| **After-Action Reports** | `/after-action-reports` & `/:crisisId` | Access concluded incidents (`CONTAINED`, `RESOLVED`, `CLOSED`), generate 1-click After-Action snapshots locked with SHA-256 checksums, and publish audit versions. |
| **NGO PDF Executive Report Engine** | `/after-action-reports` | 1-click executive PDF report compilation using PDFKit, streaming PDF documents directly with timeline logs, resource ledgers, and OCR appendices. |
| **System Administration** | `/admin` | Manage user role elevations (User → Volunteer → Admin), review system health metrics, monitor latency SLOs, and inspect audit logs. |

---

## Platform Architecture

```text
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|                                                                                   |
|   React 19 + TypeScript + Vite 6 + Tailwind CSS + Leaflet GIS + ReactMarkdown    |
|   Role-Based Routing: Public User | Field Responder | Command Admin               |
+------------------------------------------+----------------------------------------+
                                           |
                                           | HTTPS REST API + WebSockets
                                           | Auth: HTTP-Only Cookie JWT + Double-Submit CSRF
                                           v
+-----------------------------------------------------------------------------------+
|                                 BACKEND API LAYER                                 |
|                                                                                   |
|   Express 4 Server + TypeScript + Node.js 20 LTS                                  |
|   Middleware Suite: Security Headers | Rate Limiter | CSRF | Idempotency | SLO    |
+-------------------+----------------------+-------------------+--------------------+
                    |                      |                   |
                    | Prisma ORM           | Real-time Streams | AI & PDF Engines
                    v                      v                   v
+-------------------+---+          +-------+-------+   +-------+--------------------+
| MongoDB Atlas Database|          | WebSockets /  |   | Groq / DeepSeek / OpenAI   |
| Incident Telemetry    |          | SSE Server    |   | OCR.space + Gemini Vision  |
| Resource Ledgers      |          | Live Chat     |   | PDFKit Streaming Engine    |
+-----------------------+          +---------------+   +----------------------------+
```

---

## Emergency AI Copilot & Automated Dispatch

CORE features an Emergency AI Copilot integrated directly into the **Crisis Operations Workspace** (`/operations`):

1. **Tactical Action Drafting**: AI continuously evaluates crisis telemetry, incident reports, resource deficits, and field updates to propose structured action drafts.
2. **Active Responder Squad Assignment**: When dispatching field teams, the Copilot automatically assigns the **Active Field Responders Squad** as default volunteer dispatches.
3. **Interactive Draft Console**: Commanders can view draft reasoning rendered in **ReactMarkdown**, toggle collapsible execution logs, adjust custom payloads, and execute actions with 1 click.
4. **Audit Logging**: Every executed AI action draft is logged into an immutable audit trail (`logAuditEvent`).

---

## After-Action Reports & NGO Audit Engine

Post-disaster auditability is built directly into the platform under `/after-action-reports`:

- **Strict Incident Governance**: Crisis dropdown selector allows switching between all incidents, while restricting executive NGO PDF generation to concluded incidents (`RESOLVED` and `CLOSED`).
- **1-Click Published Snapshots**: Clicking **`Generate After-Action Report`** compiles an immutable JSON snapshot of all crisis events, responder logs, resource ledgers, and evidence posts, transitioning the status to `PUBLISHED` with an official SHA-256 cryptographic checksum.
- **PDFKit Streaming Engine**: Clicking **`Generate NGO PDF Report`** dynamically compiles and streams an executive multi-page PDF containing executive summaries, structured timelines, resource allocation history, and OCR documentation appendices.

---

## Technology Stack

| Layer | Technologies & Libraries |
| --- | --- |
| **Frontend Core** | React 19, TypeScript 5.8, Vite 6, React Router 7, Tailwind CSS 3.4, React Markdown, Remark GFM |
| **GIS & Mapping** | Leaflet, React-Leaflet, FFWC Water Level Layer Integration |
| **Backend API** | Node.js 20 LTS, Express 4, TypeScript, Prisma ORM 6 |
| **Database** | MongoDB Atlas |
| **Authentication & Security** | JWT (HTTP-Only Cookies), bcrypt password hashing, Double-Submit CSRF protection, Idempotency-Key validation, Rate Limiting, Security Headers (Helmet pattern) |
| **AI & Vision** | Groq Chat Completions (Qwen/Llama), Groq Whisper Voice Transcription, OCR.space API, Google Gemini Vision |
| **Reporting & Export** | PDFKit PDF streaming engine |
| **Real-Time Communication** | Server-Sent Events (SSE) & WebSocket crisis chat |
| **Testing & Quality** | Vitest test suite, TypeScript strict type checks |

---

## Repository Layout

```text
CORE/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # MongoDB schema, models, enums, indexes
│   │   └── seed.ts               # Demo dataset seed script
│   ├── src/
│   │   ├── config/               # Environment loading & system thresholds
│   │   ├── controllers/          # Express request controllers
│   │   ├── lib/                  # Database connections & stream helpers
│   │   ├── middleware/           # Auth, RBAC, CSRF, Idempotency, SLO, Rate Limit
│   │   ├── routes/               # API route definitions
│   │   ├── services/             # Core business logic, Copilot, NGO Reports, AAR
│   │   └── tests/                # Vitest backend integration tests
│   └── uploads/                  # Local runtime storage for report PDFs & evidence
├── frontend/
│   ├── public/                   # Static assets, web manifest, service worker
│   └── src/
│       ├── components/           # UI components, CopilotPanel, ActionDraftsPanel
│       ├── contexts/             # Authentication & session context
│       ├── pages/                # Route screens (Dashboard, Operations, Reports, etc.)
│       ├── services/             # API client functions & payload helpers
│       ├── types/                # Domain TypeScript definitions
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

## API Architecture & Middleware

All REST API endpoints are mounted under `/api`.

| Endpoint Group | Key Operations |
| --- | --- |
| `/api/auth` | Login, Register, Logout, Current User, Password Reset |
| `/api/profile` | Profile Updates, Dispatch Opt-in, Password Changes |
| `/api/crises` | Crisis Telemetry, Status Escalation, Live Chat Stream, Updates |
| `/api/reports` | Incident Filing, Verification Queue, Proximity Clustering |
| `/api/copilot` | AI Recommendation Generation, Action Draft Execution |
| `/api/after-action-reports` | AAR Snapshot Generation, Approval/Publishing, JSON Downloads |
| `/api/ngo-reports` | NGO PDF Generation, Direct PDF Streaming (`Content-Type: application/pdf`) |
| `/api/resources` | Supply Listings, Allocations, Reservations, History |
| `/api/volunteers` | Directory Search, Skill Tagging, Rating Breakdown |
| `/api/timesheet` | Volunteer Shift Logging, Hours Verification, Leaderboard Data |
| `/api/evidence` | Evidence Uploads, Eyewitness Posts, Likes, Comments |
| `/api/ocr` | OCR Scans, Text Extraction, Document Attachments |
| `/api/health` | API Liveness & Readiness Endpoints |

---

## Local Setup & Development Guide

### Prerequisites

- **Node.js**: 20 LTS or higher
- **npm**: 10+
- **MongoDB**: Local MongoDB instance or MongoDB Atlas URI
- **Groq API Key**: For AI report analysis & voice transcription

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

Application will be available at: `http://localhost:5173`

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | MongoDB connection string for Prisma |
| `JWT_SECRET` | Yes | Secret key for HTTP-Only authentication cookies |
| `GROQ_API_KEY` | Yes | API key for AI copilot & Groq Whisper voice transcription |
| `PORT` | No | Express port (default: `5000`) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: `http://localhost:5173`) |
| `OCR_SPACE_API_KEY` | Optional | Key for OCR text extraction |
| `GEMINI_API_KEY` | Optional | Key for Google Gemini vision summaries |
| `RESEND_API_KEY` | Optional | Key for dispatch alert emails |

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

## Quality Gates & Testing

To verify code quality and build stability across the codebase:

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

The production system is deployed on Render:

- **Frontend Application**: Deployed as a static site running Vite build output.
- **Backend Service**: Deployed as a Node.js web service running Node 20 LTS with Express and Prisma Client.
- **Database**: Hosted on MongoDB Atlas.

---

## Security & Governance Compliance

- **Authentication**: Signed JWTs delivered in HTTP-Only, SameSite cookies.
- **Double-Submit CSRF**: Synchronizer token protection headers on mutating state.
- **Idempotency Safeguards**: Header checks (`Idempotency-Key`) preventing duplicate dispatch or report execution.
- **Input Sanitation**: Zod schema validation on all incoming payload bodies.
- **No-Emoji Standard**: All user interface elements utilize clean vector `<svg>` theme icons.
