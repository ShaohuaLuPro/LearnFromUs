# LearnFromUs Forum

LearnFromUs is a community forum for sharing coding hacks, project showcases, and practical product lessons.

## Architecture
- Frontend: React, hosted on Render Static Site
- Backend API: Node.js + Express, hosted on Render Web Service
- Databases:
- PostgreSQL on Neon for users, auth, posts, follows, and transactional data
- MongoDB for activity events and document-style analytics data
- DuckDB for local analytical snapshots and cross-source reporting

## Repository Structure
- `src/`: React frontend
- `server/`: Express API
- `database/schema.sql`: PostgreSQL schema
- `database/SETUP.md`: database setup notes

## Current Deployment

### Frontend
- Hosted on Render Static Site
- Public URL: set `REACT_APP_SITE_URL` to your Render frontend domain or custom domain

### Backend
- Hosted on Render
- Public API base URL: `https://learnfromus.onrender.com`
- Health check: `https://learnfromus.onrender.com/api/health`

### Databases
- Backend connects to Neon using `DATABASE_URL`
- Backend optionally connects to MongoDB using `MONGODB_URI`

## Environment Variables

### Frontend (`.env.local`)
```env
REACT_APP_API_BASE_URL=http://localhost:4000
REACT_APP_SITE_URL=http://localhost:3000
```

For local development, point the frontend to your local API.
Production builds automatically fall back to `https://learnfromus.onrender.com` if a localhost API URL is detected.

### Backend (`server/.env` for local dev, Render env vars for production)
```env
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_ORIGIN=http://localhost:3000,https://your-frontend.onrender.com
PASSWORD_RESET_BASE_URL=https://your-frontend.onrender.com/login
ADMIN_EMAILS=admin@example.com
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/?appName=Cluster0
MONGODB_DB_NAME=learnfromus
DUCKDB_PATH=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
DAILY_AI_USAGE_LIMIT=20
```

Notes:
- `server/.env` is for local development only
- production secrets should be stored in Render, not in GitHub
- do not commit real secrets
- when `OPENAI_API_KEY` is configured, the forum assistant uses OpenAI for style-aware post drafting and falls back to the built-in template generator if the API is unavailable

## Local Development

### 1) Install dependencies
```powershell
npm install
npm run server:install
```

### 2) Configure environment
Frontend:
```powershell
Copy-Item .env.example .env.local
```

Backend:
```powershell
Copy-Item server\.env.example server\.env
```

Then fill in:
- `server/.env`
- `.env.local`

### 3) Initialize database
```powershell
psql "postgresql://USER:PASSWORD@HOST/DB?sslmode=require" -f database/schema.sql
```

### 4) Run locally
Backend:
```powershell
npm run migrate --prefix server
npm run server:dev
```

Frontend:
```powershell
npm start
```

## API Endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/account/activity`
- `GET /api/account/posts`
- `GET /api/posts`
- `GET /api/posts/:postId`
- `POST /api/posts`
- `POST /api/posts/:postId/appeal`
- `PUT /api/posts/:postId`
- `DELETE /api/posts/:postId`
- `GET /api/admin/analytics/overview`
- `GET /api/admin/posts/moderation`
- `POST /api/admin/posts/:postId/remove`
- `POST /api/admin/posts/:postId/restore`

## Render Configuration
- Backend:
  - Service Type: Web Service
  - Root Directory: `server`
  - Build Command: `npm install`
  - Start Command: `npm start`
- Frontend:
  - Service Type: Static Site
  - Root Directory: `.`
  - Build Command: `npm install && npm run build`
  - Publish Directory: `build`
  - Rewrite Rule: `/* -> /index.html`

Required Render environment variables:
- Frontend:
  - `REACT_APP_API_BASE_URL`
  - `REACT_APP_SITE_URL`
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_ORIGIN`
- `PASSWORD_RESET_BASE_URL`
- `ADMIN_EMAILS`
- `MONGODB_URI` (optional)
- `DUCKDB_PATH` (optional)
- `OPENAI_API_KEY` (optional, enables OpenAI drafting)
- `OPENAI_MODEL` (optional, defaults to `gpt-5-mini`)
- `DAILY_AI_USAGE_LIMIT` (optional, defaults to `20` for non-admin accounts)

Before starting the backend in a new environment, run:

```powershell
npm run migrate --prefix server
```

This repository also includes a `render.yaml` blueprint so you can create both services from one config file.

## Security Notes
- Do not put `DATABASE_URL` or `JWT_SECRET` in the frontend
- Do not commit `server/.env`
- Use Render environment variables for production secrets
