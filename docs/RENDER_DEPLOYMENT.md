# Render Deployment Guide for CORE

This guide provides step-by-step instructions for deploying both the **CORE Backend (Express API)** and **CORE Frontend (React SPA)** to [Render](https://render.com/).

---

## Option 1: 1-Click Blueprint Deployment (Recommended)

CORE includes a `render.yaml` blueprint file configured at the root of the repository.

1. Push your changes to GitHub on your desired branch (e.g. `main` or `refinement`).
2. Log into [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** → Select **Blueprint**.
4. Connect your GitHub repository (`CORE`).
5. Render will automatically detect `render.yaml` and configure:
   - **Backend Web Service** (`core-backend`)
   - **Frontend Static Site** (`core-frontend`)
6. Enter the required secret environment variables when prompted:
   - `DATABASE_URL`: Your MongoDB Atlas connection string (`mongodb+srv://...`).
   - `GROQ_API_KEY`: Your Groq API Key.
7. Click **Apply**. Render will automatically build, generate Prisma clients, and deploy both services!

---

## Option 2: Manual Web Service & Static Site Creation

### Step 1: Deploy Backend Web Service

1. On Render Dashboard, click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the Web Service settings:
   - **Name**: `core-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run prisma:generate && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`

4. Add **Environment Variables** under the *Environment* tab:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: `mongodb+srv://<username>:<password>@cluster.mongodb.net/core?retryWrites=true&w=majority`
   - `JWT_SECRET`: A long random string (e.g., `8f9a2b7c4d5e...`)
   - `GROQ_API_KEY`: Your Groq API key
   - `CORS_ORIGIN`: Your deployed frontend URL (e.g. `https://core-frontend.onrender.com`)

5. Click **Create Web Service**. Note the deployed Backend URL (e.g. `https://core-backend.onrender.com`).

---

### Step 2: Push Database Schema (One-Time Setup)

Once the backend web service is deployed, push the Prisma schema to MongoDB Atlas:

```bash
cd backend
npm run prisma:push
```

*(Optional: To seed demo accounts, set `DATABASE_URL` in `backend/.env` to point to production MongoDB Atlas and run `npm run seed`.)*

---

### Step 3: Deploy Frontend Static Site

1. On Render Dashboard, click **New +** → **Static Site**.
2. Connect your GitHub repository.
3. Configure the Static Site settings:
   - **Name**: `core-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. Add **Environment Variables**:
   - `VITE_API_URL`: Your deployed backend API URL including `/api` (e.g. `https://core-backend.onrender.com/api`).

5. Configure **Redirects / Rewrites** (Essential for React Router SPA navigation):
   - Under **Redirects/Rewrites**:
     - **Action**: `Rewrite`
     - **Source**: `/*`
     - **Destination**: `/index.html`

6. Click **Create Static Site**.

---

## Verification Checklist

After deployment completes:

1. **Backend Health Check**: Open `https://<your-backend-url>/api/health` in your browser. It should return `{ "status": "ok" }`.
2. **Frontend Loading**: Open `https://<your-frontend-url>`. The landing page should render cleanly.
3. **Authentication**: Test login using demo credentials (`admin@core.local` / `Admin@12345`).
4. **CORS Validation**: Open browser developer console (F12) to verify zero CORS errors when requesting `/api/auth/me` or `/api/dashboard`.

---

## Environment Variables Summary

### Backend Service (`core-backend`)

| Variable | Recommended Value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enforces production optimizations |
| `DATABASE_URL` | `mongodb+srv://...` | MongoDB Atlas URI |
| `JWT_SECRET` | Secret string | Key for HTTP-Only cookie signing |
| `GROQ_API_KEY` | `gsk_...` | Key for AI Copilot & Voice transcription |
| `CORS_ORIGIN` | `https://core-frontend.onrender.com` | Deployed frontend origin |
| `OCR_SPACE_API_KEY` | Optional | For OCR document processing |
| `GEMINI_API_KEY` | Optional | For Gemini vision summaries |

### Frontend Static Site (`core-frontend`)

| Variable | Recommended Value | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `https://core-backend.onrender.com/api` | Full API URL ending in `/api` |
