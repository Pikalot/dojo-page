# Tenshinkai Aikido Dojo Website

Informational website for the Tenshinkai Aikido dojo. It is being built in two phases:

1. **Frontend** (current): a responsive React site using placeholder content.
2. **Backend** (planned): Django, with staff content management, sign-in, and permissions.

## Repository layout

```
frontend/          React app (Vite)
  assets-src/      Original, full-size images (inputs to npm run images)
  e2e/             Playwright browser tests
  public/          Files served as-is (favicon, robots.txt)
  scripts/         Asset tooling
  src/
    assets/        Optimized images used by the app
    components/    UI components, each with its own CSS file
    data/          Placeholder content, shaped like the future API responses
    hooks/         Reusable React hooks
    i18n/          English and Vietnamese UI text, plus language state
    lib/           Plain logic (search, formatting, scrolling)
    styles/        Design tokens and shared styles
    sections.js    Page sections used by the navbar and the search
```

## Running the frontend

You need Node.js 20.19 or newer (it has been tested on Node 25).

```sh
cd frontend
npm install
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
- Switching language, and that the choice is remembered.
- Accessibility checks with axe, including color contrast, in both languages.

The browser tests block Google Maps so they don't depend on the network. The map itself is checked by hand.

When a test fails, Playwright prints which width it failed at, and saves a trace in `frontend/test-results/`.

## Images

Full-size images go in `frontend/assets-src/`. Running `npm run images` (needs macOS `sips` and `cwebp`, from `brew install webp`) creates resized WebP and JPEG copies in `src/assets/hero/`. Those generated copies are committed, so this only needs to run again when a source image changes.

## Placeholder content

Everything in `frontend/src/data/siteContent.js` is a placeholder. That includes the text, prices (`$XX`), ranks (`Xth Dan`), and contact details. The address and map point at San José State University for now. The logo and instructor photos are placeholders too. A note in the page footer says the content isn't final.

The Vietnamese UI text in `frontend/src/i18n/strings.js` is a first draft and needs review by a native speaker.
