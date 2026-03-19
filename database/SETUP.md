# Database Setup (Render + Neon)

## Why Neon
LearnFromUs runs with a Render-hosted frontend and backend. User accounts, posts, follows, and related transactional data live in PostgreSQL, and Neon is a good fit for that setup.

## 1) Create Neon project
1. Create a Neon project and database (for example `learnfromus`).
2. Copy the connection string from Neon dashboard.

## 2) Run schema
Use `psql` with SSL (required by Neon):

```powershell
psql "postgresql://USER:PASSWORD@HOST/DB?sslmode=require" -f database/schema.sql
```

## 3) Local PostgreSQL option (for dev only)
If you want local DB development first:

```powershell
psql -U postgres -h localhost
CREATE DATABASE learnfromus;
\c learnfromus
\i database/schema.sql
```

## 4) Backend env variables (example)
Use these in your future backend project:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
JWT_SECRET=replace_with_long_random_secret
```

## 4.1) Apply server migrations
After the base schema is installed, run the backend migration step for moderation and follow-related changes:

```powershell
npm run migrate --prefix server
```

## 5) Deployment note
- Frontend: Render Static Site
- Backend API: Render Web Service
- Database: Neon

The frontend should call backend APIs, and backend APIs read/write Neon.
