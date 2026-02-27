# LearnFromUs Forum

LearnFromUs is a community forum for sharing coding hacks, project showcases, and practical product lessons.

## Architecture
- Frontend: React, hosted on GitHub Pages
- Backend API: Node.js + Express, hosted on Render
- Database: PostgreSQL, hosted on Neon

## Repository Structure
- `src/`: React frontend
- `server/`: Express API
- `database/schema.sql`: PostgreSQL schema
- `database/SETUP.md`: database setup notes

## Current Deployment

### Frontend
- Hosted on GitHub Pages
- Public URL: `https://shaohualupro.github.io/LearnFromUs/`

### Backend
- Hosted on Render
- Public API base URL: `https://learnfromus.onrender.com`
- Health check: `https://learnfromus.onrender.com/api/health`

### Database
- Hosted on Neon
- Backend connects using `DATABASE_URL` from Render environment variables

## Environment Variables

### Frontend (`.env.local`)
```env
REACT_APP_API_BASE_URL=https://learnfromus.onrender.com
```

### Backend (`server/.env` for local dev, Render env vars for production)
```env
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_ORIGIN=http://localhost:3000,https://shaohualupro.github.io
```

Notes:
- `server/.env` is for local development only
- production secrets should be stored in Render, not in GitHub
- do not commit real secrets

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
- `GET /api/posts`
- `POST /api/posts`
- `PUT /api/posts/:postId`
- `DELETE /api/posts/:postId`

## Render Configuration
- Service Type: Web Service
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`

Required Render environment variables:
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_ORIGIN`

## GitHub Pages Deployment
To publish the frontend:

```powershell
npm run deploy
```

This builds the React app and publishes it to the `gh-pages` branch.

## Security Notes
- Do not put `DATABASE_URL` or `JWT_SECRET` in the frontend
- Do not commit `server/.env`
- Use Render environment variables for production secrets
