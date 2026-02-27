# Database Setup (GitHub Pages + Neon)

## Why Neon
GitHub Pages only hosts static frontend files. Your login and post data must be served by an API/backend and a hosted database. Neon is a good fit for PostgreSQL in this setup.

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

## 5) Deployment note
- Frontend: GitHub Pages
- Backend API: Vercel / Railway / Render / Fly.io
- Database: Neon

The frontend should call backend APIs, and backend APIs read/write Neon.
