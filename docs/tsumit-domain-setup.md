# `tsumit.com` Domain Setup

This project is set up as two deployable services:

- Frontend: Render Static Site
- Backend: Render Web Service

Recommended production layout:

- App: `https://tsumit.com`
- Redirect alias: `https://www.tsumit.com`
- API: `https://api.tsumit.com`

## 1. Add custom domains in Render

Add these in the Render dashboard before changing DNS:

- Frontend service: `tsumit.com`
- Frontend redirect or alias: `www.tsumit.com`
- Backend service: `api.tsumit.com`

Render will show the exact DNS records required for each one. Use the values from Render's UI instead of guessing them manually.

## 2. Configure DNS at your domain registrar

Create the records Render asks for:

- `tsumit.com` -> frontend service
- `www.tsumit.com` -> frontend service or redirect target
- `api.tsumit.com` -> backend service

If your registrar supports URL forwarding and you want a single canonical domain, make `www.tsumit.com` redirect to `https://tsumit.com`.

## 3. Set Render environment variables

Frontend service:

```env
REACT_APP_SITE_URL=https://tsumit.com
REACT_APP_API_BASE_URL=https://api.tsumit.com
```

Backend service:

```env
FRONTEND_ORIGIN=https://tsumit.com,https://www.tsumit.com
PASSWORD_RESET_BASE_URL=https://tsumit.com/login
```

Keep your existing secrets and database variables unchanged.

## 4. Redeploy

Redeploy both services after the env vars are updated.

## 5. Verify

Check these after DNS finishes propagating:

- `https://tsumit.com`
- `https://api.tsumit.com/api/health`
- browser console has no CORS errors
- login and register still work
- password reset links open `https://tsumit.com/login`

## Notes

- The app uses `BrowserRouter`, so the reset URL should be `/login`, not `#/login`.
- If `api.tsumit.com` is not ready yet, temporarily keep `REACT_APP_API_BASE_URL` pointed at your existing Render backend URL.
- Once the custom domain is confirmed working, update any external links or marketing links to use `https://tsumit.com`.
