# ShadApp — Dashboard (Next.js)

Web dashboard for ShadApp staff (super admins and account managers) and for
clients. Talks to the Laravel backend in `shadapp-backend`.

---

## Requirements

- Node.js 20+
- A running backend (see `shadapp-backend/README.md`)

---

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

The dev server runs on <http://localhost:3000>.

### Environment variables

`.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# These must match REVERB_APP_KEY / REVERB_HOST / REVERB_PORT / REVERB_SCHEME
# in the backend's .env. A mismatch produces no error — realtime just silently
# never connects.
NEXT_PUBLIC_REVERB_KEY=shadapp-key
NEXT_PUBLIC_REVERB_HOST=localhost
NEXT_PUBLIC_REVERB_PORT=8080
NEXT_PUBLIC_REVERB_SCHEME=http
```

Note `NEXT_PUBLIC_REVERB_SCHEME` is `http`/`https` here (Laravel Echo derives
the WebSocket scheme itself), whereas the mobile app's `REVERB_SCHEME` is
`ws`/`wss`. They look inconsistent but both are correct.

For production, `NEXT_PUBLIC_REVERB_SCHEME=https` and the backend's
`REVERB_SCHEME=https`.

---

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm start        # serve the production build
npm run lint     # ESLint
npm test         # run the test suite once
npm run test:watch  # re-run on file changes
```

---

## Tests

Vitest + React Testing Library, `jsdom` environment. `src/test/setup.ts` mocks
`next/link` globally (it reaches for App Router context that doesn't exist
under Vitest) and clears `localStorage`/cookies between tests.

Coverage focuses on what's expensive to get wrong silently: the auth/session
helpers in `src/lib/` (including a regression test for a fixed fail-open bug
in sub-user permission checks), the `api.ts` axios interceptors (429 retry,
401 logout redirect), small reusable UI components, and the security- and
data-critical components — `ActivityFeed` (XSS regression test),
`LocationPickerModal` (search/geocode), and the login/forgot-password/
reset-password pages.

Components that call `useTranslations()`/`useLocale()` need
`src/test/render.tsx`'s `renderWithIntl()` helper instead of RTL's plain
`render()` — it wraps the component in `NextIntlClientProvider` using the
real `messages/en.json`/`ar.json`, so a renamed or removed translation key
fails the test the same way it would break the app.

Not yet covered: the remaining feature tabs (chat, approvals, payments,
files, contracts, meetings, calendar) and the client-portal mirror
components. Same patterns as what's here — add as they change or as time
allows.

---

## Architecture notes

### Auth token handling

The Sanctum token is **never** stored in `localStorage` and never touched by
client-side JavaScript. Instead:

1. Login posts to a Next.js route handler, which stores the token in an
   **httpOnly cookie**.
2. All API calls go to the same-origin proxy at `/api/proxy/*`
   (`src/app/api/proxy/[...path]/route.ts`), which reads that cookie
   server-side and attaches the bearer token.

This is deliberate: it means an XSS bug elsewhere in the app cannot exfiltrate
the token. When adding API calls, use the shared `src/lib/api.ts` axios
instance so they route through the proxy — do not call the Laravel origin
directly.

### Realtime

`src/lib/echo.ts` sets up Laravel Echo against Reverb. Channel authorisation
also goes through the same-origin proxy, for the same cookie reason as above.

Every channel is **private**. `src/lib/api.ts` attaches an `X-Socket-Id` header
to outgoing requests so the backend's `broadcast(...)->toOthers()` can exclude
the tab that triggered the event — without it, the sender receives an echo of
its own message.

### Maps

Client location picking uses Leaflet + OpenStreetMap tiles, with geocoding via
Nominatim. No API key and no billing. Leaflet touches `window` at import time,
so map components must be loaded with `next/dynamic` and `ssr: false`.

### Internationalisation

`next-intl`, with message catalogues in `messages/en.json` and
`messages/ar.json`. Arabic is RTL. Any new user-facing string needs an entry in
**both** files.

---

## Layout

```
src/
  app/
    api/proxy/      Same-origin proxy to the Laravel backend
    api/session/    Login/logout — sets and clears the httpOnly cookie
    dashboard/      Authenticated pages
  components/       Feature-grouped React components
  lib/              api.ts (axios), echo.ts (realtime), auth helpers
messages/           i18n catalogues (en, ar)
```
