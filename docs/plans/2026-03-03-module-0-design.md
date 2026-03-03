# Module 0 Implementation Design (CORE)

## Scope
Deliver all foundation requirements from Module 0 in `docs/SRS.md`:
- Public landing page
- Registration and authentication
- Password recovery
- Profile management
- Role-based access control
- Admin seed + moderation endpoints
- Logout and role-aware responsive navigation shell

## Architecture
- `backend/`: Express + TypeScript + Prisma (MongoDB) API.
- `frontend/`: React + TypeScript + Tailwind UI.
- Auth uses JWT in `httpOnly` cookies with optional `rememberMe` extension.

## Backend Design
- `User` model in Prisma includes role, profile, volunteer metadata, ban state, reset token fields.
- Auth endpoints:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
  - `GET /api/auth/me`
- Profile endpoints:
  - `PATCH /api/profile`
  - `POST /api/profile/change-password`
- Admin endpoints:
  - `GET /api/admin/users`
  - `PATCH /api/admin/users/:userId/role`
  - `PATCH /api/admin/users/:userId/ban`
- Middleware:
  - `requireAuth` validates JWT
  - `requireRole` enforces RBAC (`403 Forbidden`)
- Seed:
  - `prisma/seed.ts` creates default admin on first run.

## Frontend Design
- Public routes: landing, signup, login, forgot-password, reset-password.
- Protected routes: dashboard, profile, map/resources/volunteers/leaderboard placeholders.
- Role-restricted routes:
  - Volunteer: `/tasks`
  - Admin: `/admin`, `/reports`
- `AppShell` implements responsive navbar states for unauthenticated/authenticated roles.

## Verification Targets
- Backend: `npm run build`, `npm test`
- Frontend: `npm run build`

## Requirement Mapping
- **0.1 Landing Page**: `LandingPage.tsx` with hero, CTA, features, walkthrough, stats, footer.
- **0.2 Sign Up**: `RegisterPage.tsx` + `POST /auth/register`, volunteer field expansion.
- **0.3 Login/JWT**: `LoginPage.tsx` + `POST /auth/login`, `rememberMe`, role routing.
- **0.4 Password Recovery**: forgot/reset routes and pages with 15-minute token logic.
- **0.5 Profile Management**: `ProfilePage.tsx`, update + change-password endpoints.
- **0.6 RBAC**: backend auth/role middleware and permission utility.
- **0.7 Admin Seed**: Prisma seed script + admin moderation endpoints.
- **0.8 Logout**: API logout + navbar logout action.
- **0.9 Responsive Shell**: `AppShell.tsx` responsive role-aware navigation.
