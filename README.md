# CORE

CORE is a full-stack crisis coordination platform for community reporting, volunteer mobilization, resource sharing, secure field documentation, and NGO-grade incident reporting.

**Live application:** [https://core-frontend-jx9h.onrender.com/](https://core-frontend-jx9h.onrender.com/)

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)

## Overview

CORE, the Community Operations and Relief Engine, is built for disaster response workflows where citizens, volunteers, administrators, and NGO coordinators need a shared operational picture. The platform combines authenticated incident reporting, AI-assisted report analysis, map-based crisis awareness, volunteer reputation tracking, resource reservations, secure documentation, OCR extraction, dispatch notifications, and downloadable NGO reports.

The repository is a TypeScript monorepo with a React/Vite frontend and an Express/Prisma backend backed by MongoDB. The backend exposes a role-aware REST API under `/api`, while the frontend provides public, authenticated, volunteer-only, and admin-only workflows.

## Table of Contents

- [Product Capabilities](#product-capabilities)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Application Routes](#application-routes)
- [Backend API Map](#backend-api-map)
- [Data Model](#data-model)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Database and Seed Data](#database-and-seed-data)
- [Scripts](#scripts)
- [Testing and Quality Gates](#testing-and-quality-gates)
- [Deployment Notes](#deployment-notes)
- [Security and Operational Notes](#security-and-operational-notes)
- [Troubleshooting](#troubleshooting)

## Product Capabilities

| Area | What CORE provides |
| --- | --- |
| Incident reporting | Citizens can submit emergency reports with location, severity, incident type, media, and optional voice notes. Reports are analyzed for classification, credibility, translation, and spam risk. |
| Crisis dashboard | Authenticated users can view clustered crisis events, critical incident streams, map context, severity filters, timeline data, and AI-generated situation reports. |
| Map awareness | Google Maps powers incident, resource, and situational map views with location picking and nearby context. |
| Resource coordination | Users can add supplies, browse available resources, reserve quantities, approve or decline reservation requests, and track resource history. |
| Volunteer network | Volunteer profiles include skills, availability, certifications, reviews, proximity search, rating summaries, and automated fraud/quality flags. |
| Secure documentation | Users can create crisis-linked folders, upload field files, write geotagged notes, archive/restore content, and create temporary share links. |
| Evidence gallery | Volunteers and admins can publish field evidence posts with media, comments, likes, verification actions, and flagging workflows. |
| OCR workflow | Users can OCR uploaded images or existing folder files, review extracted items, edit categorized text, and attach scans to folders, crises, or reports. |
| Crisis updates | Volunteers and admins can add crisis updates, change responder status, and support admin review/correction of crisis state changes. |
| Notifications and dispatch | Users can configure notification preferences, receive inbox alerts, and opt into dispatch messages. Dispatch email delivery is handled through Resend when configured. |
| NGO reports | Admins can generate and archive PDF reports for resolved or closed crisis events. Reports aggregate crisis data, resources, responders, evidence, documentation, OCR scans, and verified volunteer work. |
| Timesheet and gamification | Volunteers can log verified response work, upload evidence, earn badge points, and appear on leaderboard views. |
| Administration | Admins can manage users, roles, bans, unpublished reports, flagged reviews, flagged volunteers, crisis reports, and NGO reporting workflows. |

## Architecture

```text
+--------------------+        credentials/cookies        +----------------------+
| React 19 + Vite    | <-------------------------------> | Express REST API     |
| Tailwind frontend  |                                   | TypeScript backend   |
+---------+----------+                                   +----------+-----------+
          |                                                         |
          | Google Maps JavaScript API                              | Prisma Client
          |                                                         |
          v                                                         v
+--------------------+                                   +----------------------+
| Browser geolocation|                                   | MongoDB Atlas        |
| media uploads      |                                   | application data     |
+--------------------+                                   +----------+-----------+
                                                                 |
                                                                 |
                    +--------------------------------------------+-----------------------------------+
                    |                 External services                                             |
                    | Groq chat + Whisper, OCR.space, Gemini image summaries, Resend dispatch email |
                    +--------------------------------------------------------------------------------+
```

The frontend calls the backend through `VITE_API_URL` and always sends cookies with `credentials: "include"`. The backend enables CORS credentials for configured origins, serves uploaded files from `/uploads`, and mounts all application routes under `/api`.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 6, TypeScript, Tailwind CSS, Lucide React, React Markdown, `@react-google-maps/api` |
| Backend | Node.js, Express 4, TypeScript, Prisma Client, Zod, Multer, Cookie Parser |
| Database | MongoDB via Prisma |
| Authentication | JWT stored in HTTP-only cookies, bcrypt password hashing, role-based middleware |
| AI and OCR | Groq chat completions, Groq Whisper transcription, OCR.space, optional Google Gemini image summaries |
| Reporting | PDFKit for NGO report generation |
| Notifications | In-app notification records, Resend-backed dispatch emails when configured |
| Testing | Vitest backend test suite |

## Repository Structure

```text
CORE/
  backend/
    prisma/
      schema.prisma         # MongoDB schema, enums, relations, indexes
      seed.ts               # Bangladesh-focused demo data seed
    src/
      config/               # Environment loading and runtime config
      controllers/          # Request handlers
      middleware/           # Auth, role checks, validation, error handling
      routes/               # API route composition
      services/             # Domain logic, AI clients, OCR, dispatch, reports
      tests/                # Vitest backend coverage
      utils/                # JWT, async wrappers, helpers
    uploads/                # Runtime file storage for local development
  frontend/
    src/
      components/           # Shared UI and domain components
      contexts/             # Auth/session context
      pages/                # Route-level screens
      services/             # API client and payload helpers
      types/                # Frontend domain types
      utils/                # Presentation and data helpers
  docs/                     # Supporting project documentation
  README.md
```

## Application Routes

### Public routes

- `/` - landing page
- `/signup`, `/login`, `/forgot-password`, `/reset-password` - authentication flows
- `/shared/:token` - public secure-folder share view

### Authenticated routes

- `/dashboard` - crisis command dashboard
- `/dashboard/incidents/:id` - crisis detail and response context
- `/report-incident` - emergency report submission
- `/reports/explore`, `/reports/:id` - community report exploration and detail
- `/profile` - profile, password, and dispatch opt-in settings
- `/map` - incident map
- `/gallery` - evidence gallery
- `/resources/add`, `/resources/my`, `/browse-resources` - resource contribution and browsing
- `/volunteers`, `/volunteers/:volunteerId` - volunteer directory and profiles
- `/docs`, `/docs/:folderId` - secure documentation
- `/ocr` - OCR upload and scan workflow
- `/notifications`, `/notifications/preferences` - notification inbox and preferences
- `/leaderboard` - volunteer leaderboard

### Volunteer-only routes

- `/tasks` - volunteer timesheet, task logging, and evidence upload

### Admin-only routes

- `/admin` - user and moderation administration
- `/reports/review` - unpublished report review
- `/reports/generate`, `/ngo-reports/archive` - NGO report generation and archive

## Backend API Map

All backend routes are mounted under `/api`.

| Route group | Purpose |
| --- | --- |
| `GET /health` | API health check |
| `/auth` | Register, login, logout, current user, forgot password, reset password |
| `/profile` | Profile updates, password changes, dispatch opt-in, dispatch logs |
| `/admin` | User management, roles, bans, unpublished reports, flagged moderation |
| `/reports` | Incident submission, personal/community reports, map reports, report detail |
| `/dashboard` | Crisis feed, situation report, critical SSE stream, crisis incident detail |
| `/crises` | Crisis updates, responder status, admin update dismissal, status correction |
| `/resources` | Resource listing, creation, updates, reservations, reservation decisions, history |
| `/volunteers` | Volunteer search and volunteer profile reads |
| `/reviews` | Volunteer reviews, eligible crisis review targets, flagged review moderation |
| `/docs` | Secure folders, notes, files, restoration, pinning, share links, public share reads |
| `/evidence` | Evidence posts, media, likes, comments, verification, flagging |
| `/ocr` | OCR uploads, OCR of folder files, scan history, scan detail, item edits, attachments |
| `/notifications` | Notification preferences, inbox, read state, dispatch, cleanup |
| `/timesheet` | Volunteer task logging, admin verification, leaderboard, crisis dropdown |
| `/ngo-reports` | NGO PDF report generation, archive listing, file access |

## Data Model

The Prisma schema models the platform around these major domains:

| Domain | Models and enums |
| --- | --- |
| Identity and access | `User`, `Role` |
| Incident intake | `IncidentReport`, `IncidentType`, `IncidentSeverity`, `IncidentStatus` |
| Crisis operations | `CrisisEvent`, `CrisisEventReport`, `CrisisEventUpdate`, `CrisisResponder`, crisis status and verification enums |
| Resource management | `Resource`, `Reservation`, `ResourceHistory` |
| Volunteer reputation | `Review`, `InteractionContext`, volunteer flag fields on `User` |
| Evidence and social review | `EvidencePost`, `EvidenceFlag`, `Comment`, `Like` |
| Secure documentation | `SecureFolder`, `FolderFile`, `FolderNote`, `ShareLink` |
| OCR | `OCRScan`, `OCRItem` |
| Notifications and dispatch | `NotificationSubscription`, `Notification`, `DispatchAlertLog`, `NotificationType`, `DispatchAlertStatus` |
| Timesheets and badges | `VolunteerTask`, `Badge`, task and badge enums |
| NGO reporting | `NGOReport` |

## Local Development

### Prerequisites

- Node.js 20 LTS or newer recommended
- npm
- MongoDB Atlas or another MongoDB connection string supported by Prisma
- Google Maps JavaScript API key for map features
- Groq API key for AI report analysis and voice transcription
- Optional OCR.space, Gemini, and Resend credentials for full feature coverage

### 1. Install dependencies

```bash
cd CORE/backend
npm install

cd ../frontend
npm install
```

### 2. Configure backend environment

Create `backend/.env` from `backend/.env.example`, then replace the placeholder values.

```powershell
cd backend
Copy-Item .env.example .env
```

On macOS or Linux, use:

```bash
cp .env.example .env
```

At minimum, local development requires:

```env
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/core?retryWrites=true&w=majority"
PORT=5000
CORS_ORIGIN="http://localhost:5173"
JWT_SECRET="replace-with-a-long-random-secret"
GROQ_API_KEY="replace-with-your-groq-api-key"
```

### 3. Configure frontend environment

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_MAPS_API_KEY=replace-with-your-google-maps-api-key
```

`VITE_API_URL` should include `/api`. Keeping it explicit avoids inconsistent media or shared-link URL fallbacks during development.

### 4. Generate Prisma client and push schema

```bash
cd backend
npm run prisma:generate
npm run prisma:push
```

### 5. Seed development data

```bash
npm run seed
```

The seed script clears existing application data and creates a Bangladesh-focused demo dataset. Use it only against a local or disposable development database.

### 6. Start the development servers

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- API health: `http://localhost:5000/api/health`

## Environment Variables

### Backend

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | MongoDB connection string used by Prisma |
| `JWT_SECRET` | Yes | Secret for signing authentication cookies |
| `GROQ_API_KEY` | Yes | Groq API key for text analysis and voice transcription |
| `PORT` | No | Backend port, defaults to `5000` |
| `CORS_ORIGIN` | No | Comma-separated allowed frontend origins, defaults to local Vite origins |
| `GROQ_BASE_URL` | No | Groq-compatible API base URL |
| `GROQ_WHISPER_MODEL` | No | Speech-to-text model, defaults to `whisper-large-v3` |
| `GROQ_QWEN_MODEL` | No | Chat model, defaults to `qwen/qwen3-32b` |
| `AI_REQUEST_TIMEOUT_MS` | No | Timeout for AI requests |
| `OCR_PROVIDER` | No | Set to `ocrspace` or `mock` |
| `OCR_SPACE_API_KEY` | No | OCR.space API key; missing key falls back to mock behavior |
| `OCR_SPACE_ENDPOINT` | No | OCR.space endpoint override |
| `OCR_REQUEST_TIMEOUT_MS` | No | OCR request timeout |
| `GEMINI_API_KEY` | No | Enables Gemini-powered disaster image summaries in OCR workflows |
| `RESEND_API_KEY` | No | Enables dispatch email delivery |
| `RESEND_FROM_EMAIL` | No | Sender identity for dispatch email |
| `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_LOCATION` | No | Seed-time admin account configuration |

`backend/.env.example` also contains Twilio variables for legacy compatibility. The current dispatch implementation routes alerts through the Resend-backed dispatch service.

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Recommended | Backend API base URL, for example `http://localhost:5000/api` |
| `VITE_GOOGLE_MAPS_API_KEY` | Required for maps | Google Maps JavaScript API key |

## Database and Seed Data

The seed file creates:

- Admin, user, and volunteer accounts
- Published and under-review incident reports
- Clustered crisis events
- Reviews and volunteer fraud/quality flags
- Resources and resource availability states
- Secure documentation folders, files, notes, and share links

Useful development accounts after seeding:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@core.local` or the configured `ADMIN_EMAIL` | `Admin@12345` or configured `ADMIN_PASSWORD` |
| Admin | `mizan@core.local` | `Admin@12345` |
| User | `farhan@core.local` | `User@12345` |
| Volunteer | `ayesha.vol@core.local` | `Volunteer@12345` |

Do not use seed credentials in production.

## Scripts

### Backend

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Express server with `tsx watch` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled backend from `dist/server.js` |
| `npm test` | Run the Vitest backend suite |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:push` | Push the Prisma schema to MongoDB |
| `npm run prisma:migrate` | Defined in `package.json`; for this MongoDB project, `prisma:push` is the normal schema sync path |
| `npm run seed` | Seed demo data |

### Frontend

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build production assets |
| `npm run preview` | Preview the production build locally |

## Testing and Quality Gates

Run these before merging application changes:

```bash
cd backend
npm test
npm run build

cd ../frontend
npm run build
```

The backend test suite covers authentication utilities, RBAC behavior, validation, report services and routes, AI prompt behavior, dashboard/report map logic, crisis responder/update services, resource/review services, dispatch alerts, and external client error handling.

The frontend currently relies on TypeScript and the Vite production build as its primary automated quality gate.

## Deployment Notes

The live frontend is deployed at:

[https://core-frontend-jx9h.onrender.com/](https://core-frontend-jx9h.onrender.com/)

Branch strategy:

- `main` is the primary development branch.
- `deploy/render` contains Render-specific deployment adjustments and should be updated carefully so deploy-only changes are preserved.

Typical Render configuration:

| Service | Root directory | Build command | Start/publish command |
| --- | --- | --- | --- |
| Backend web service | `backend` | `npm install && npm run prisma:generate && npm run build` | `npm start` |
| Frontend static site | `frontend` | `npm install && npm run build` | Publish `dist` |

Production environment checklist:

- Backend `DATABASE_URL` points to the production MongoDB database.
- Backend `JWT_SECRET` is long, random, and unique to production.
- Backend `GROQ_API_KEY` is configured.
- Backend `CORS_ORIGIN` includes the deployed frontend origin: `https://core-frontend-jx9h.onrender.com`.
- Frontend `VITE_API_URL` points to the deployed backend API and includes `/api`.
- Frontend `VITE_GOOGLE_MAPS_API_KEY` is configured and allowed for the deployed domain.
- Optional OCR, Gemini, and Resend credentials are configured only when those integrations are needed.
- Persistent storage or object storage is planned for durable uploaded evidence and generated reports. Local `/uploads` storage is convenient for development but may not be durable on ephemeral hosting plans.

## Security and Operational Notes

- Passwords are hashed with bcrypt before storage.
- Authentication uses signed JWTs stored in HTTP-only cookies.
- Role-aware middleware protects volunteer and admin endpoints.
- CORS is configured with credential support and an allowlist of trusted origins.
- File upload routes use Multer with file type and size limits for incident media, resources, documents, evidence, OCR uploads, and task evidence.
- Admin workflows exist for user bans, role changes, unpublished report moderation, review moderation, volunteer flag review, crisis update correction, and NGO report generation.
- `.env` files, production secrets, uploads, and generated dependencies should stay out of version control.

## Troubleshooting

### Authorization errors on protected pages

Check that:

- The backend is running and reachable from the frontend.
- `VITE_API_URL` points to the backend `/api` URL.
- `CORS_ORIGIN` includes the exact frontend origin.
- The browser is accepting cookies for the site.
- The logged-in user has the required role for the route.

### Maps do not load

Check that `VITE_GOOGLE_MAPS_API_KEY` is present, the Maps JavaScript API is enabled in Google Cloud, and the key allows the domain you are using.

### AI or voice analysis fails

Check `GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_QWEN_MODEL`, `GROQ_WHISPER_MODEL`, and `AI_REQUEST_TIMEOUT_MS`.

### OCR returns mock or empty results

Set `OCR_PROVIDER=ocrspace` and provide `OCR_SPACE_API_KEY`. Add `GEMINI_API_KEY` only if image summary generation is needed.

### Seed data removes existing records

`npm run seed` intentionally clears and recreates demo data. Run it only on local or disposable databases.

## License

No license file is currently included in this repository. Add one before distributing or open sourcing the project.
