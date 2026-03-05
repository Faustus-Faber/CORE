# Module 1 Feature 1 - Emergency Reporting Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement Module 1.1 end-to-end emergency reporting with voice transcription/translation and text classification using the new external APIs, supporting both in-browser voice recording and audio-file upload, then publish validated reports and expose searchable/sortable reporting views for community, reporter, and admin moderation flows.

**Architecture:** Use a synchronous request pipeline for Module 1.1 MVP: validate form input -> optional voice API call -> text analysis API call -> persist normalized report with metadata -> return confirmation payload -> redirect reporter to Reports Explorer. Frontend voice input supports two sources that converge into one backend contract: (1) browser recording via `MediaRecorder` to `.webm` blob and (2) direct file upload (`.mp3/.wav/.webm`). Reporting views consume protected list APIs with query-driven search/filter/sort (including severity ranking): reporter/community endpoints (`GET /api/reports`, `GET /api/reports/mine`) and admin moderation endpoints (`GET /api/admin/reports/unpublished`, `PATCH /api/admin/reports/:reportId/status`).

**Tech Stack:** Express + TypeScript + Prisma (MongoDB), React + TypeScript + Tailwind, Vitest, fetch/FormData, JWT-auth protected routes.

---

## Constraints
- Scale: up to 10,000 concurrent users (SRS NFR).
- Consistency: strong write for report persistence; eventual visibility for map/dashboard consumers.
- Latency: non-AI endpoints <= 500ms; classification endpoint expected ~7-8s.
- Team/platform: existing monolith (`backend/` + `frontend/`) on current stack.
- Cost: no queue/extra infra required for Module 1.1.

## Options
1. Synchronous in-request AI orchestration (single request/response).
- Pros: simplest, minimal files, fastest to deliver.
- Cons: request waits on voice/classification latency.

2. Async queue/background processing.
- Pros: better resilience and throughput long-term.
- Cons: new infra + workers + polling/websocket complexity.

3. Hybrid (write pending record, process in-process async, poll status).
- Pros: better UX than pure sync.
- Cons: more moving parts than current MVP.

## Recommendation
Choose **Option 1 (Synchronous)** for Module 1.1 now. It is consistent with current codebase simplicity, avoids infrastructure overhead, and remains acceptable with clear loading UX. Revisit hybrid/queue if p95 latency or timeout rates become unacceptable.

## Decision Record
- Decided: synchronous orchestration with robust timeout/error handling and explicit metadata persistence.
- Rejected for now: queue-based processing and status polling.

## Open Questions
- (implementation discovery) Should voice endpoint retries be added (e.g., 1 retry on 5xx)?
- (implementation discovery) Should incident title always be replaced by model output or only when empty?
- (resolved) Suspected spam reports are hidden from community feed but visible to owners as `Under Review`.

---

## UI Consistency Rules (Must Follow)
- Reuse current visual tokens and shell patterns:
  - `bg-canvas`, `text-ink`, `bg-tide`, `bg-ember`, `shadow-panel`, `ring-slate-200`.
  - Card shells: `rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200`.
  - Primary buttons: `rounded-md bg-tide ... text-white`.
  - Error blocks: `rounded-md bg-red-50 ... text-red-700`.
- Keep page in existing `<AppShell />` layout (`max-w-6xl`, consistent spacing).
- Use existing form rhythm from `RegisterPage.tsx` and `ProfilePage.tsx`.

---

## Path Convention
- Backend feature files live under `backend/src/{controllers,routes,services,tests,utils}`.
- Frontend feature files live under `frontend/src/{pages,services}`.
- Tests colocated in `backend/src/tests/` using `*.test.ts`.

---

### Task 1: Add Report Data Model

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Test: `backend/src/tests/reportSchemaModel.test.ts` (create)

**Step 1: Write the failing schema-oriented test**
- Create `backend/src/tests/reportSchemaModel.test.ts` with assertions that Prisma enum/value contracts exist in source text (IncidentStatus, SeverityLevel, IncidentType, IncidentReport model field names).

**Step 2: Run test to verify it fails**
- Run: `cd backend && npm test -- src/tests/reportSchemaModel.test.ts`
- Expected: FAIL because model/enums do not exist yet.

**Step 3: Add minimal Prisma model/enums**
- In `schema.prisma`, add:
  - Enums: `IncidentSeverity`, `IncidentStatus`, `IncidentType`.
  - Model: `IncidentReport` with required fields:
    - reporterId, title, description, incidentType, severityLevel, credibilityScore, spamFlagged, locationText
    - voice metadata: sourceAudioFilename, detectedLanguage, languageProbability, translatedDescription
    - AI metadata: classifiedIncidentType, classifiedIncidentTitle
    - status, createdAt, updatedAt.

**Step 4: Re-run test**
- Run: `cd backend && npm test -- src/tests/reportSchemaModel.test.ts`
- Expected: PASS.

**Step 5: Commit**
- Run:
```bash
git add backend/prisma/schema.prisma backend/src/tests/reportSchemaModel.test.ts
git commit -m "feat: add incident report prisma model for module 1.1"
```

---

### Task 2: Add Environment + External API Clients

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/src/config/env.ts`
- Create: `backend/src/services/voiceReportClient.ts`
- Create: `backend/src/services/textAnalysisClient.ts`
- Test: `backend/src/tests/externalClients.test.ts` (create)

**Step 1: Write failing tests for client contracts**
- Create tests for:
  - voice client request must be multipart/form-data with `audio_file`.
  - text client request must send `{ text, task: "classification" }`.
  - response parsing maps required fields with type checks.

**Step 2: Run tests to verify failures**
- Run: `cd backend && npm test -- src/tests/externalClients.test.ts`
- Expected: FAIL because clients are missing.

**Step 3: Implement minimal clients + env wiring**
- Add env keys:
  - `VOICE_API_BASE_URL`
  - `TEXT_ANALYSIS_API_BASE_URL`
  - `AI_REQUEST_TIMEOUT_MS` (default e.g. 15000)
- Implement:
  - `submitVoiceReport(fileBuffer|stream, filename, mimeType)`
  - `classifyIncidentText(text)`

**Step 4: Re-run tests**
- Run: `cd backend && npm test -- src/tests/externalClients.test.ts`
- Expected: PASS.

**Step 5: Commit**
- Run:
```bash
git add backend/.env.example backend/src/config/env.ts backend/src/services/voiceReportClient.ts backend/src/services/textAnalysisClient.ts backend/src/tests/externalClients.test.ts
git commit -m "feat: add module 1.1 external voice and text analysis clients"
```

---

### Task 3: Add Report Validation and Orchestration Service

**Files:**
- Modify: `backend/src/utils/validation.ts`
- Create: `backend/src/services/reportService.ts`
- Create: `backend/src/tests/reportValidation.test.ts`
- Create: `backend/src/tests/reportService.test.ts`

**Step 1: Write failing validation + service tests**
- Validation test cases:
  - valid report with text-only path.
  - rejects too many files, oversized files, unsupported audio mime.
  - rejects empty title/description/location.
- Service test cases:
  - voice path calls voice client then text classification.
  - text-only path skips voice client.
  - spam detection logic uses `spam_flagged || credibility_score < 30`.

**Step 2: Run tests to verify failures**
- Run:
  - `cd backend && npm test -- src/tests/reportValidation.test.ts`
  - `cd backend && npm test -- src/tests/reportService.test.ts`
- Expected: FAIL.

**Step 3: Implement minimal validation + service**
- Add `reportSubmissionSchema`.
- In `reportService`, orchestrate:
  - normalize payload.
  - optional voice call.
  - classification call.
  - persistence to Prisma `IncidentReport`.
  - status assignment (`SUSPECTED_SPAM` vs `VERIFIED_PENDING_REVIEW` / chosen enum mapping).

**Step 4: Re-run tests**
- Run both tests again.
- Expected: PASS.

**Step 5: Commit**
- Run:
```bash
git add backend/src/utils/validation.ts backend/src/services/reportService.ts backend/src/tests/reportValidation.test.ts backend/src/tests/reportService.test.ts
git commit -m "feat: add module 1.1 validation and emergency report service"
```

---

### Task 4: Expose Protected API Endpoints

**Files:**
- Create: `backend/src/controllers/reportController.ts`
- Create: `backend/src/routes/reportRoutes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/src/tests/reportRoutes.test.ts` (create)

**Step 1: Write failing route tests**
- Cases:
  - unauthenticated `POST /api/reports` -> `401`.
  - authenticated valid submission -> `201` with summary payload.
  - invalid submission -> `400` with field issue details.

**Step 2: Run test to verify failure**
- Run: `cd backend && npm test -- src/tests/reportRoutes.test.ts`
- Expected: FAIL.

**Step 3: Implement route/controller wiring**
- Add controller methods:
  - `createReport`
  - `getMyReports` (optional but recommended for immediate UX/testing).
- Register routes under `/api/reports` with `requireAuth` + `asyncHandler`.

**Step 4: Re-run route tests**
- Run: `cd backend && npm test -- src/tests/reportRoutes.test.ts`
- Expected: PASS.

**Step 5: Commit**
- Run:
```bash
git add backend/src/controllers/reportController.ts backend/src/routes/reportRoutes.ts backend/src/routes/index.ts backend/src/tests/reportRoutes.test.ts
git commit -m "feat: add protected emergency reporting api endpoints"
```

---

### Task 5: Backend Integration Verification

**Files:**
- Modify: `backend/README.md` (if exists) or root `README.md`
- Create: `backend/src/tests/reportIntegration.test.ts` (optional integration-focused)

**Step 1: Write failing integration test (or contract test)**
- Assert full flow: request payload -> stored report includes AI/voice metadata.

**Step 2: Run test to verify failure**
- Run: `cd backend && npm test -- src/tests/reportIntegration.test.ts`
- Expected: FAIL initially.

**Step 3: Implement minimal missing integration glue**
- Fix any mapping/status gaps surfaced by test.

**Step 4: Run full backend verification**
- Run:
  - `cd backend && npm test`
  - `cd backend && npm run build`
- Expected: all PASS.

**Step 5: Commit**
- Run:
```bash
git add backend/src/tests/reportIntegration.test.ts backend/src/** README.md
git commit -m "test: verify end-to-end backend report pipeline"
```

---

### Task 6: Frontend API Integration Layer

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/services/reportPayload.ts`

**Step 1: Write failing type/contract checks**
- Add a small compile-time contract test file (or strict TS interfaces) for:
  - report form payload
  - voice source union (`recordedBlob` | `uploadedFile`)
  - API response shape for creation summary.

**Step 2: Run build to verify failure**
- Run: `cd frontend && npm run build`
- Expected: FAIL due missing/new report types.

**Step 3: Implement API helpers**
- Add `createEmergencyReport(formData)` in `api.ts`.
- Ensure multipart request for media.
- Ensure helper can build `audio_file` from either recorded blob or uploaded file.
- Parse and surface structured validation messages from backend.

**Step 4: Re-run build**
- Run: `cd frontend && npm run build`
- Expected: PASS.

**Step 5: Commit**
- Run:
```bash
git add frontend/src/types.ts frontend/src/services/api.ts frontend/src/services/reportPayload.ts
git commit -m "feat: add frontend report api integration contracts"
```

---

### Task 7: Build Report Submission UI (Style-Aligned)

**Files:**
- Create: `frontend/src/pages/ReportIncidentPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/AppShell.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx` (quick CTA link)

**Step 1: Write failing route-level test/verification checklist**
- Add checklist doc (or test if test runner exists) for required UI behaviors:
  - form fields from SRS
  - voice input controls with both:
    - **Record Voice Note** (start/stop, rerecord, clear)
    - **Upload Audio File** fallback
  - loading state during 7-8s classification
  - confirmation card with severity/type/title.

**Step 2: Run frontend build / route compile check**
- Run: `cd frontend && npm run build`
- Expected: FAIL until route/page added.

**Step 3: Implement minimal page and route wiring**
- Add protected route path `/report-incident`.
- Add nav item in `AppShell` (authenticated roles).
- Implement UI with existing style system (same card/button/error classes).
- Implement recorder UX:
  - mic-permission request and error state.
  - recording state indicator/timer.
  - stop and attach recorded `.webm` as `audio_file`.
  - mutually clear/replace behavior between recorded clip and uploaded file.

**Step 4: Re-run build and manual smoke**
- Run: `cd frontend && npm run build`
- Manual:
  - open `/report-incident`
  - submit text-only report
  - submit report with recorded voice note
  - submit report with uploaded voice file.

**Step 5: Commit**
- Run:
```bash
git add frontend/src/pages/ReportIncidentPage.tsx frontend/src/App.tsx frontend/src/components/AppShell.tsx frontend/src/pages/DashboardPage.tsx
git commit -m "feat: add emergency report submission ui and protected route"
```

---

### Task 8: Reports Explorer, Search/Sort, and Submit Redirect

**Files:**
- Modify: `backend/src/utils/validation.ts`
- Modify: `backend/src/services/reportService.ts`
- Modify: `backend/src/controllers/reportController.ts`
- Modify: `backend/src/routes/reportRoutes.ts`
- Modify: `backend/src/tests/reportValidation.test.ts`
- Modify: `backend/src/tests/reportService.test.ts`
- Modify: `backend/src/tests/reportRoutes.test.ts`
- Create: `backend/src/tests/adminReportModerationRoutes.test.ts`
- Modify: `backend/src/controllers/adminController.ts`
- Modify: `backend/src/routes/adminRoutes.ts`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/pages/ReportsExplorerPage.tsx`
- Create: `frontend/src/pages/AdminReportModerationPage.tsx`
- Modify: `frontend/src/pages/ReportIncidentPage.tsx`
- Modify: `frontend/src/components/AppShell.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Step 1: Add list-query validation and failing tests**
- Add validation contract for report list queries (`search`, `severity`, `sortBy`, `order`) and write tests for defaults + invalid values.

**Step 2: Implement backend list service for feed + mine**
- Add shared listing logic with:
  - `community` scope: published and non-spam reports only.
  - `mine` scope: all owner reports including `UNDER_REVIEW`.
  - Search across title/classified title/location/description.
  - Sort by created time, severity ranking, or credibility.

**Step 3: Expose list endpoints**
- Add/verify:
  - `GET /api/reports` (community feed)
  - `GET /api/reports/mine` (owner submissions)
- Add route tests for auth + query validation + successful responses.

**Step 4: Add Reports Explorer UI**
- Build protected page with:
  - Tabs: `Community Reports`, `My Submissions`
  - Search, severity filter, sort field, sort order
  - Report cards showing severity/status/reporter/location/credibility

**Step 5: Redirect after successful submit**
- On successful `/report-incident` submission, redirect to `/reports/explore?view=mine`.
- Pass submission summary in navigation state and render it as a success banner on Reports Explorer.

**Step 6: Navbar integration**
- Replace single "Report" nav link with a `Reports` dropdown containing:
  - `Submit Incident`
  - `Browse Reports`
  - `Review Unpublished` (admin only)
  - `Generate Reports` (admin only)

**Step 7: Add admin moderation view**
- Add admin-only page to review unpublished reports with:
  - Search/filter/sort controls aligned to Reports Explorer behavior.
  - Publish action that updates report status to `PUBLISHED`.
- Expose and test admin-only endpoints:
  - `GET /api/admin/reports/unpublished`
  - `PATCH /api/admin/reports/:reportId/status`

**Step 8: Verify**
- Run:
  - `cd backend && npm test`
  - `cd backend && npm run build`
  - `cd frontend && npm run build`
- Expected: PASS.

---

### Task 9: End-to-End QA + Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/SRS.md` (only if implementation-level clarifications needed)
- Create: `docs/plans/2026-03-05-module-1-feature-1-test-checklist.md`

**Step 1: Write failing QA checklist (expected outcomes)**
- Cover:
  - auth required
  - media validation
  - recording flow (allow mic, record, stop, submit)
  - upload flow (select audio file, submit)
  - voice translation autopopulates description
  - spam-flagged reports held from public feed.

**Step 2: Execute QA checklist**
- Run backend + frontend dev servers.
- Execute each scenario and record pass/fail.

**Step 3: Apply minimal fixes from QA**
- Patch only defects discovered in checklist.

**Step 4: Final verification commands**
- Run:
  - `cd backend && npm test`
  - `cd backend && npm run build`
  - `cd frontend && npm run build`
- Expected: all PASS.

**Step 5: Commit**
- Run:
```bash
git add README.md docs/plans/2026-03-05-module-1-feature-1-test-checklist.md
git commit -m "docs: add module 1.1 runbook and qa checklist"
```

---

## Final Acceptance Criteria (Module 1.1)
- Authenticated `User`/`Volunteer` can submit incident with text and optional media.
- Voice input supports both:
  - in-browser recording button (start/stop) and submission as `audio_file`
  - direct audio file upload fallback.
- Both voice paths call the specified voice endpoint and persist voice metadata.
- Text analysis calls the specified Qwen endpoint and persists classification fields.
- Spam handling follows: `spam_flagged = true` OR `credibility_score < 30`.
- After successful submit, reporter is redirected to Reports Explorer with a confirmation summary banner.
- Reports Explorer provides `Community Reports` and `My Submissions` with search + severity filter + severity/credibility/time sorting.
- Admin has a dedicated moderation page for unpublished (`UNDER_REVIEW`) reports with publish action.
- Navbar exposes report actions through a dedicated `Reports` dropdown, aligned to role permissions.
- UI displays clear loading/progress and result summary.
- UI uses existing design language and navigation shell.
- All backend tests pass, backend build passes, frontend build passes.

---

Plan complete and saved to `docs/plans/2026-03-05-module-1-feature-1-emergency-reporting-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration. **REQUIRED:** Switch Antigravity to **Fast Mode** for this implementation phase.

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
