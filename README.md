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
check on `/api/auth/login`.

## Architecture

| Layer | Files | Notes |
| --- | --- | --- |
| API client | `src/lib/api/client.ts` | `credentials: "include"`, 12s timeout, `X-Device-Fingerprint` header, `ApiError`, shared 401 → silent-refresh → retry-once interceptor (`refreshOnce` coalesces concurrent refreshes). |
| Auth state | `src/lib/auth/AuthProvider.tsx` | Access token held **in memory only** (ref + state, never `localStorage`). Refresh token is a browser-managed HttpOnly cookie. Proactive refresh timer fires 30s before expiry; cross-tab `storage` sentinel syncs login/logout. Bootstraps a session from the refresh cookie on mount. |
| Endpoints | `src/lib/api/authApi.ts`, `src/lib/api/eventsApi.ts` | `login` / `refresh` / `logout` / `me`; events `getActiveEvent` (public), `createEvent` (POST), `updateEvent` (PUT). Bearer token attached automatically by `apiFetch`. |
| Route guard | `src/components/auth/ProtectedRoute.tsx` | Session-presence check + redirect to `/login`. Admin-role authorization stays server-side (`RequireAdmin`). |
| Layout | `src/app/dashboard/layout.tsx`, `src/components/layout/Sidebar.tsx` | Persistent sidebar: **Overview**, **Events Management**. |
| Events module | `src/app/dashboard/events/page.tsx`, `src/components/events/EventForm.tsx` | Form matches `EventRequest` DTO: `title`, `description`, `image_url`, `event_date` (`datetime-local` ↔ RFC3339 via `src/lib/utils/datetime.ts`), `is_active` (toggle). |

## Routes

- `/` → redirects to `/dashboard`
- `/login` — email/password → `POST /api/auth/login`
- `/dashboard` — Overview (active event + session summary)
- `/dashboard/events` — view / create / edit the active event

## Backend endpoints consumed

- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/client/events` (active event; no admin "list/get" endpoint exists)
- `POST /api/admin/events`, `PUT /api/admin/events/{id}` — require `Authorization: Bearer <token>` + admin role
