# Tenshinkai Aikido Dojo Website

Informational website for the Tenshinkai Aikido dojo. It is being built in two phases:

1. **Frontend**: a responsive React site. By default it reads content from local mock files; `VITE_USE_API=true` switches it to the backend.
2. **Backend**: Django, with staff content management, sign-in, and permissions. See [backend/README.md](backend/README.md) for setup, the permission matrix, the API, and how concurrent edits work.

## Repository layout

```
backend/           Django app: admin interface and read-only JSON API
frontend/          React app (Vite)
  assets-src/      Original, full-size images (inputs to npm run images)
  e2e/             Playwright browser tests
  public/          Files served as-is (favicon, robots.txt)
  scripts/         Asset tooling
  src/
    api/           One function per content resource; the only code that reads the mock files or calls the backend
    assets/        Optimized images used by the app
    components/    UI components, each with its own CSS file
    data/mock/     Site content as JSON, shaped like the future API responses
    hooks/         Reusable React hooks
    i18n/          English and Vietnamese UI text, plus language state
    lib/           Plain logic (search, formatting, scrolling)
    styles/        Design tokens and shared styles
    sections.js    Page sections used by the navbar and the search
```

## How it works

```
Visitor -> Vercel (React site) -> /api/... (read-only) -> server: Caddy -> Gunicorn -> Django -> MySQL
Staff   -> "Staff sign-in" link -> server's /admin/ (sign-in required) -> same as above
```

- Visitors read the React site. It only ever reads published content, through the API.
- Staff edit content in the Django admin. Saves are checked against the version they loaded, so nobody silently overwrites someone else's work.
- Photos are stored on Cloudinary. Translations come from Azure Translator. The server holds every key; the website holds none.
- The About text, federation text, contact details and location have no database tables yet, so they still come from `frontend/src/data/mock/`.

## Running the whole app

You need Node.js 20.19 or newer, Python 3.12 or newer, and MySQL 8.4 or newer running.

**First time only.** Follow the setup in [backend/README.md](backend/README.md) to create the database, `backend/.env` and your admin account. Then install the frontend with `cd frontend && npm install`.

**Each time**, in two terminals:

```sh
# Terminal 1: backend, at http://127.0.0.1:8000/admin/
cd backend
source .venv/bin/activate
python manage.py runserver
```

```sh
# Terminal 2: website, at http://localhost:5173
cd frontend
VITE_USE_API=true npm run dev
```

To show the **Staff sign-in** link in the footer, also set `VITE_ADMIN_URL` to the editor's address, for example `VITE_ADMIN_URL=http://127.0.0.1:8000/admin/` locally. In production, set it in Vercel's environment variables. Without it, there is no link.

Without `VITE_USE_API=true`, the website uses only the mock files and doesn't need the backend at all. New records are drafts until published, so they don't appear on the website before that.

## Deploying

| Part | Hosted on | Address |
|---|---|---|
| Website | Vercel | `https://tenshinkaisj.vercel.app` |
| Backend and editor | Google Cloud VM | `https://tenshinkaisj.duckdns.org/admin/` |

Both deploy from `main`.

### Backend

Set up once by following [Deployment in backend/README.md](backend/README.md#deployment). It covers the VM, MySQL, the settings file, Gunicorn, Caddy and HTTPS, and how to release updates.

### Website (Vercel)

1. In the Vercel project's **Settings > Build and Deployment**: Framework Preset **Vite**, Root Directory **`frontend`**, no command overrides.
2. In **Settings > Git**: Production Branch **`main`**.
3. In **Settings > Environments > Production**, add these as **Config** variables (not Secret):

   | Key | Value |
   |---|---|
   | `VITE_USE_API` | `true` |
   | `VITE_ADMIN_URL` | `https://tenshinkaisj.duckdns.org/admin/` |

   Anything starting with `VITE_` is built into the website, where anyone can read it. Never put a password or key in one.
4. `frontend/vercel.json` forwards `/api/...` to the backend. Change its address if the backend moves.

Vercel deploys automatically when `main` changes under `frontend/`. Vite reads the variables at build time, so after changing them, use **Deployments > ⋯ > Redeploy**.

### Releasing a change

1. Work on a branch, and open a pull request into `main`. CI runs the frontend and backend tests.
2. Merge. Vercel redeploys the website by itself.
3. If `backend/` changed, release it on the server ([steps](backend/README.md#releasing-an-update)). If the change spans both, keep the API backward compatible and release the backend first.

## Frontend commands

```sh
cd frontend
npm run dev        # development server at http://localhost:5173
npm run build      # production build in frontend/dist
npm run preview    # serve the production build at http://localhost:4173
```

## Tests

```sh
cd frontend
npm test                          # unit and component tests (Vitest + Testing Library + axe)
npx playwright install chromium   # first time only
npm run test:e2e                  # browser tests at phone (375px), tablet (768px) and desktop (1280px) widths
```

What the browser tests check:
- No sideways scrolling at any of the three widths.
- The navbar shows the menu button on smaller screens and inline links on desktop.
- The header hides when scrolling down and comes back when scrolling up.
- The skip link, keyboard search, and sideways scrolling of the instructor row.
- Searching instructors by name or rank: opening a profile, and jumping to the black belt list.
- Switching language, and that the choice is remembered.
- The photo carousel and viewer: quick arrow clicks, and where focus lands on closing.
- The menu on a phone in landscape, and Vietnamese nav labels at the narrowest desktop width.
- Printing shows every section.
- Accessibility checks with axe, including color contrast, in both languages.

The browser tests block Google Maps so they don't depend on the network. The map itself is checked by hand.

When a test fails, Playwright prints which width it failed at, and saves a trace in `frontend/test-results/`.

## Images

Full-size images go in `frontend/assets-src/`. Running `npm run images` (needs macOS `sips` and `cwebp`, from `brew install webp`) creates resized WebP and JPEG copies of the hero in `src/assets/hero/`, plus the navbar logo (`src/assets/logo.webp`). Those generated copies are committed, so this only needs to run again when a source image changes.

The dojo photos are not part of this. They are hosted on Cloudinary, and their URLs are in `src/data/mock/dojoPhotos.json`.

## Content

Site content is in `frontend/src/data/mock/*.json`, and components get it through `src/api/content.js`. With `VITE_USE_API=true`, announcements, schedule, instructors, FAQ and dojo photos come from the backend instead. The About text, federation text, contact details and location have no database tables yet, so they stay in the mock files either way.

Still to fill in: instructor bios and photos (cards show the dojo logo until a photo exists), and the Vietnamese About text in `about.json`, which is still in English.

The Vietnamese text in `frontend/src/i18n/strings.js` and the mock files is a first draft and needs review by a native speaker.
