# LearnFromUs Forum

Community forum MVP for coding hacks and project showcases.

## Stack
- Frontend: React (GitHub Pages)
- Backend: Node.js + Express
- Database: PostgreSQL (Neon recommended)

## Project Structure
- `src/` frontend
- `server/` backend API
- `database/schema.sql` PostgreSQL schema

## Local Setup

### 1) Install dependencies
```powershell
npm install
npm install --prefix server
```

### 2) Configure environment
Frontend:
```powershell
Copy-Item .env.example .env.local
```

Backend:
```powershell
Copy-Item server\\.env.example server\\.env
```

Set `server/.env`:
- `DATABASE_URL=...`
- `JWT_SECRET=...`
- `FRONTEND_ORIGIN=http://localhost:3000,https://<your-github-username>.github.io`

### 3) Initialize database
```powershell
psql "postgresql://USER:PASSWORD@HOST/DB?sslmode=require" -f database/schema.sql
```

### 4) Run app
Backend:
```powershell
npm run dev --prefix server
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
- `POST /api/posts` (auth required)

## Deploy (GitHub Pages + Hosted API)
1. Deploy backend to Render/Railway/Vercel
2. Set backend env vars: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`
3. Set frontend `REACT_APP_API_BASE_URL` to your backend URL
4. Deploy frontend to GitHub Pages

Do not put database secrets in frontend or GitHub Pages.
