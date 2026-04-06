# tsumit

tsumit is a community platform for sharing practical work: project writeups, coding notes, postmortems, implementation details, and lessons learned from real execution.

This repo contains the full app:

- React frontend
- Express API
- PostgreSQL-backed product data
- optional MongoDB activity tracking
- DuckDB-powered analytics snapshots
- optional OpenAI-assisted drafting and rewriting
- optional S3 media uploads

## What The Product Does

Current product areas in the codebase include:

- Public feed with spaces, sections, tags, search, sorting, and filters
- Authentication, profile settings, password reset, and account deletion
- User following and follower views
- Space following
- Post creation, editing, AI rewrite, comments, and moderation appeals
- Space request workflow with review and appeal flows
- Admin access management with granular permissions
- Moderation queue and appeal handling
- Analytics overview and Parquet exports
- Media upload flow backed by S3 presigned URLs
- Assistant chat for navigation, drafting, and request generation

## Tech Stack

Frontend:

- React 19
- React Router
- Bootstrap
- `@uiw/react-md-editor`
- TypeScript types mixed into the current React app

Backend:

- Node.js
- Express
- PostgreSQL via `pg`
- JWT auth
- Nodemailer
- MongoDB
- DuckDB
- OpenAI SDK
- AWS S3 presigned uploads

## Repository Structure

```text
.
|-- src/                  React app
|-- public/               static assets, manifest, robots, sitemap
|-- server/               Express API
|   |-- migrations/       SQL migrations
|   |-- src/              server source
|-- database/             schema and setup notes
|-- scripts/              build-time utility scripts
|-- render.yaml           Render blueprint
|-- docs/                 project docs
```

## Local Development

### 1. Install dependencies

```powershell
npm install
npm run server:install
```

### 2. Create env files

Frontend:

```powershell
Copy-Item .env.example .env.local
```

Backend:

```powershell
Copy-Item server\.env.example server\.env
```

### 3. Required local env values

Frontend `.env.local`:

```env
REACT_APP_API_BASE_URL=http://localhost:4000
REACT_APP_SITE_URL=http://localhost:3000
```

Backend `server/.env`:

```env
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_ORIGIN=http://localhost:3000
PASSWORD_RESET_BASE_URL=http://localhost:3000/login
```

### 4. Initialize PostgreSQL

Fresh setup:

```powershell
psql "postgresql://USER:PASSWORD@HOST/DB?sslmode=require" -f database/schema.sql
```

Or run the app migrations:

```powershell
npm run migrate --prefix server
```

### 5. Start the app

Backend:

```powershell
npm run server:dev
```

Frontend:

```powershell
npm start
```

Frontend default local URL:

- `http://localhost:3000`

Backend default local URL:

- `http://localhost:4000`
- health check: `http://localhost:4000/api/health`

## Environment Variables

### Frontend

Used at build time:

- `REACT_APP_API_BASE_URL`
- `REACT_APP_SITE_URL`

Notes:

- In production, the frontend falls back to `https://learnfromus.onrender.com` if a localhost API URL is detected during build.
- For the custom domain rollout, prefer setting this explicitly in Render.

### Backend

Core:

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_ORIGIN`
- `PASSWORD_RESET_BASE_URL`
- `PASSWORD_RESET_SECRET`
- `PASSWORD_RESET_EXPIRES_IN`
- `ADMIN_EMAILS`

Email:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Analytics and activity:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `DUCKDB_PATH`

AI:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `DAILY_AI_USAGE_LIMIT`

Media uploads:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `MEDIA_PUBLIC_BASE_URL`
- `MEDIA_UPLOAD_PREFIX`
- `MEDIA_ALLOWED_MIME_TYPES`
- `MEDIA_MAX_UPLOAD_BYTES`
- `MEDIA_UPLOAD_URL_TTL_SECONDS`

See:

- [.env.example](./.env.example)
- [server/.env.example](./server/.env.example)

## Key API Areas

Auth and account:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `GET /api/auth/me`
- `PATCH /api/account/profile`
- `PATCH /api/account/password`
- `DELETE /api/account`

Feed and posts:

- `GET /api/posts`
- `GET /api/posts/:postId`
- `GET /api/posts/:postId/comments`
- `POST /api/posts`
- `PUT /api/posts/:postId`
- `DELETE /api/posts/:postId`
- `POST /api/posts/:postId/comments`
- `POST /api/posts/:postId/appeal`
- `POST /api/posts/:postId/ai-rewrite`
- `POST /api/posts/ai-rewrite-draft`

Spaces and workspace:

- `GET /api/forums`
- `POST /api/forums/:forumId/follow`
- `DELETE /api/forums/:forumId/follow`
- `GET /api/forums/:forumId/followers`
- `GET /api/forums/:forumId/access`
- `PATCH /api/forums/:forumId/sections`
- `PATCH /api/forums/:forumId/details`
- `POST /api/forums/:forumId/managers`
- `PATCH /api/forums/:forumId/managers/:userId`
- `DELETE /api/forums/:forumId/managers/:userId`
- `POST /api/forums/:forumId/transfer-ownership`

Space requests:

- `POST /api/forums/requests`
- `POST /api/forums/requests/ai-rewrite`
- `POST /api/forums/requests/:requestId/approve`
- `POST /api/forums/requests/:requestId/reject`
- `POST /api/forums/requests/:requestId/appeal`

User network:

- `GET /api/account/following`
- `GET /api/users/:userId`
- `POST /api/users/:userId/follow`
- `DELETE /api/users/:userId/follow`

Admin:

- `GET /api/admin/access`
- `POST /api/admin/access`
- `PATCH /api/admin/access/:userId`
- `DELETE /api/admin/access/:userId`
- `POST /api/admin/users/reset-password`
- `GET /api/admin/posts/moderation`
- `POST /api/admin/posts/:postId/remove`
- `POST /api/admin/posts/:postId/restore`
- `POST /api/admin/posts/:postId/permanent-delete`
- `POST /api/admin/posts/:postId/reject-appeal`
- `GET /api/admin/analytics/overview`
- `GET /api/admin/analytics/query`
- `GET /api/admin/analytics/parquet`
- `GET /api/admin/analytics/parquet/:dataset`

Media:

- `POST /api/media/upload-url`
- `POST /api/media/:assetId/complete`
- `GET /api/account/media`

Assistant:

- `POST /api/agent/chat`

## Data Layer

PostgreSQL stores core app data:

- users
- auth
- spaces
- follows
- posts
- comments
- moderation
- appeals
- admin access
- space manager access
- media metadata

MongoDB is used for activity/event-style tracking when configured.

DuckDB is used for analytics snapshots and reporting.

## AI Features

When `OPENAI_API_KEY` is configured, the app can:

- draft posts
- rewrite unpublished drafts
- rewrite existing posts
- draft space requests
- route assistant chat actions

When OpenAI is unavailable, some drafting flows fall back to built-in template behavior.

## Media Uploads

Media support is optional.

When AWS credentials and bucket settings are configured:

- the server generates S3 presigned upload URLs
- the frontend uploads files directly to S3
- uploaded assets are recorded in PostgreSQL
- image uploads can be inserted into post content from the composer

## Deployment

This project is set up for Render.

### Frontend service

- Type: Static Site
- Root: `.`
- Build command: `npm install && npm run build`
- Publish directory: `build`
- Rewrite rule: `/* -> /index.html`

### Backend service

- Type: Web Service
- Root: `server`
- Build command: `npm install`
- Start command: `npm start`
- Health check: `/api/health`

Blueprint:

- [render.yaml](./render.yaml)

## Custom Domain

The repo already includes guidance for `tsumit.com`.

See:

- [docs/tsumit-domain-setup.md](./docs/tsumit-domain-setup.md)

Recommended setup:

- App: `https://tsumit.com`
- Redirect alias: `https://www.tsumit.com`
- API: `https://api.tsumit.com`

## Notes And Caveats

- There are still internal route names and code identifiers that use `forum` for compatibility. User-facing branding has been moving toward `space` / `feed`, but the internal model has not been fully renamed yet.
- Some deployment defaults still reference the older Render subdomain until all environment variables are updated in production.
- The repo may contain ongoing work in unrelated files; check `git status` before packaging a release.

## Security

- Do not commit real secrets
- Do not put backend secrets in frontend env files
- Keep production secrets in Render
- Treat `server/.env` as local-only

## Related Files

- [render.yaml](./render.yaml)
- [database/schema.sql](./database/schema.sql)
- [server/.env.example](./server/.env.example)
- [docs/tsumit-domain-setup.md](./docs/tsumit-domain-setup.md)
