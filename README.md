# OlympiadNext Admin

Standalone Next.js (App Router) admin console for the OlympiadNext platform.
Consumes the Go backend's `/api/admin/*` and `/api/auth/*` surfaces.

## Running

```bash
npm install
npm run dev        # http://localhost:3001
```

`.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

The admin origin (`http://localhost:3001`) is already in the backend's
default `ALLOWED_ORIGINS`, which it needs for CORS + the trusted-origin
check on `/api/auth/admin/login`.

## Architecture

| Layer | Files | Notes |
| --- | --- | --- |
| API client | `src/lib/api/client.ts` | `credentials: "include"`, 12s timeout, `X-Device-Fingerprint` header, `ApiError`, shared 401 → silent-refresh → retry-once interceptor (`refreshOnce` coalesces concurrent refreshes). |
| Auth state | `src/lib/auth/AuthProvider.tsx` | Access token held **in memory only** (ref + state, never `localStorage`). Refresh token is a browser-managed HttpOnly cookie. Proactive refresh timer fires 30s before expiry; cross-tab `storage` sentinel syncs login/logout. Bootstraps a session from the refresh cookie on mount. |
| Endpoints | `src/lib/api/authApi.ts`, `src/lib/api/eventsApi.ts` | `login` / `refresh` / `logout` / `me`; events `getActiveEvent` (public), `uploadEventImage` (multipart `POST /api/admin/events/upload` → `{ image_url }`), `createEvent` (POST), `updateEvent` (PUT). Bearer token attached automatically by `apiFetch` (FormData bodies supported — browser sets the multipart boundary). |
| Route guard | `src/components/auth/ProtectedRoute.tsx` | Session-presence check + redirect to `/login`. Admin-role authorization stays server-side (`RequireAdmin`). |
| Layout | `src/app/dashboard/layout.tsx`, `src/components/layout/Sidebar.tsx` | Persistent sidebar: **Overview**, **Events Management**. |
| Events module | `src/app/dashboard/events/page.tsx`, `src/components/events/EventForm.tsx` | Form matches `EventRequest` DTO: `title`, `description`, image (`<input type="file" accept="image/*">` with local preview → uploaded on submit, resulting `image_url` attached to the payload), `event_date` (`datetime-local` → strict UTC ISO-8601 via `src/lib/utils/datetime.ts`), `is_active` (toggle). |

## Routes

- `/` → redirects to `/dashboard`
- `/login` — email/password → `POST /api/auth/admin/login`
- `/dashboard` — Overview (active event + session summary)
- `/dashboard/events` — view / create / edit the active event

## Backend endpoints consumed

- `POST /api/auth/admin/login`, `POST /api/auth/admin/refresh`, `POST /api/auth/admin/logout`, `GET /api/auth/me`
  (the admin console uses the backend's admin-scoped auth routes, which set a
  separate `admin_refresh_token` cookie so an admin and a student session can
  coexist in one browser; `admin/login` also 403s a non-admin account)
- `GET /api/client/events` (active event; no admin "list/get" endpoint exists)
- `POST /api/admin/events/upload` — multipart `file` field, returns `{ "image_url": "..." }` *(not yet implemented in the Go backend — see below)*
- `POST /api/admin/events`, `PUT /api/admin/events/{id}` — require `Authorization: Bearer <token>` + admin role

## Backend TODO for image upload

The admin form now uploads image files, but the Go backend needs a matching route:

- `POST /api/admin/events/upload` under the existing `/api/admin` group (already gated by `RequireAccessToken` + `RequireAdmin`).
- Parse `multipart/form-data`, read the `file` part, validate it is an image within a size cap (client allows up to 100 MB; ensure the server's max request/body size and any proxy limit match).
- Persist it (object storage / disk / CDN) and respond `200 { "image_url": "<public URL>" }`.
- Add `multipart/form-data` handling; CORS already allows the `Authorization` header on this origin.
