<!--
Sync Impact Report
- Version change: (unversioned template) → 1.0.0
- Modified principles: all template placeholders replaced (initial adoption)
  - [PRINCIPLE_1_NAME] → I. Backend-Enforced Authorization
  - [PRINCIPLE_2_NAME] → II. Secrets Stay on the Server
  - [PRINCIPLE_3_NAME] → III. Bilingual Content by Design
  - [PRINCIPLE_4_NAME] → IV. Approved Schema and Safe Concurrent Edits
  - [PRINCIPLE_5_NAME] → V. Accessible, Responsive Frontend
  - Added: VI. Tested and Deterministic
  - Added: VII. Simplicity and Separation of Layers
- Added sections: Technology and Deployment Constraints; Development Workflow and Quality Gates
- Removed sections: none
- Deferred TODOs: none (ratification date set to first adoption, 2026-11-12)
- Sources: REQUIREMENTS.md, README.md, .github/workflows/test.yml, .githooks/pre-push
-->

# Tenshinkai Aikido Dojo Website Constitution

## Core Principles

### I. Backend-Enforced Authorization

- Every protected operation MUST check permissions on the backend. Hiding a control in the
  frontend is never authorization.
- The public API MUST be read-only and MUST return published content only. Drafts and other
  unpublished records MUST NOT be reachable through any public endpoint.
- Roles are Public visitor, User, Moderator and Admin. The permission matrix in
  `backend/README.md` is the source of truth and MUST be updated before role behavior changes.
- Moderators MUST NOT grant or revoke admin rights. The system MUST prevent removing or
  deactivating the last active Admin.
- Public registration MUST stay disabled unless a spec explicitly approves it.
- State-changing requests MUST be protected against CSRF, and sign-in and translation endpoints
  MUST be rate-limited.

Rationale: the site is public, and only staff should ever change it.

### II. Secrets Stay on the Server

- API keys, passwords, tokens, database credentials and private keys MUST NOT be committed.
  They live in environment variables or a secrets service. Example config files contain
  placeholders only.
- Third-party services that need keys (Cloudinary, the translation provider) MUST be called only
  from the backend.
- Variables prefixed `VITE_` are built into public JavaScript and MUST NOT hold secrets.
- Public responses MUST NOT expose stack traces, internal paths, schema details or credentials.
- Personal data collection is limited to what an approved feature needs.

Rationale: anything shipped to the browser or pushed to GitHub is public. A `.gitignore` entry
does not remove a secret that was already committed.

### III. Bilingual Content by Design

- Every translatable field MUST store both an English and a Vietnamese value. Translation happens
  when an editor saves, never on page view.
- At least one language per field is required, not both. A failed or slow translation MUST NOT
  block saving or publishing. The public site falls back to whichever language exists.
- Each record MUST track its source language and whether its translation is machine-generated
  or reviewed by a person. A human-corrected translation MUST NOT be overwritten without asking.
- Martial arts terms (for example Shodan, Godan, Kyu-shinsa) MUST stay untranslated.
- All new UI text MUST be added in both languages in `frontend/src/i18n/`.

Rationale: the dojo serves English and Vietnamese speakers equally.

### IV. Approved Schema and Safe Concurrent Edits

- Models, migrations and tables MUST NOT be created or changed without an approved schema
  proposal that documents entities, relationships, constraints and data lifecycle.
- Until a table is approved, content stays in the mock JSON files, shaped like the future API
  responses.
- Content updates MUST use optimistic concurrency: the edit carries the version it loaded, the
  check-and-write is atomic, and a stale write is rejected with a conflict (HTTP 409) and a
  user-friendly way to resolve it. Silently overwriting another editor's work is a defect.

Rationale: schema changes are expensive to undo on a live database, and several staff edit the
same content.

### V. Accessible, Responsive Frontend

- Pages MUST use semantic HTML, work by keyboard, and pass axe checks (including color contrast)
  in both languages.
- Layouts MUST be mobile-first and MUST NOT scroll sideways at 375px, 768px or 1280px.
- Styling MUST use the shared design tokens in `frontend/src/styles/`. Each component keeps its
  own CSS file.
- Images MUST be optimized (resized WebP/JPEG or Cloudinary), and each page MUST have a proper
  title and basic SEO metadata.
- Interactive features MUST show meaningful states: loading, empty, validation error, success
  and failure.

Rationale: visitors arrive mostly on phones and must be able to read and navigate every section.

### VI. Tested and Deterministic

- Application logic with real behavior (validation, permissions, role changes, concurrency checks,
  error handling, search, formatting) MUST have unit tests. Trivial framework code does not
  need them.
- Changes to interactive UI MUST have component tests (Vitest + Testing Library) and, where
  layout or keyboard behavior is involved, Playwright tests at the three widths.
- Backend changes MUST have Django tests covering success, invalid input, authentication failure,
  authorization failure and stale writes where they apply.
- Tests MUST be deterministic, use isolated test data and the test settings, and MUST NOT depend
  on the network or production data. Destructive tests MUST NEVER run against production.
- Untested critical paths and known limitations MUST be reported honestly.

Rationale: CI on every pull request is the only gate before `main` deploys automatically.

### VII. Simplicity and Separation of Layers

- The frontend reads content only through `frontend/src/api/`. Components MUST NOT read mock
  files or call the backend directly.
- New frameworks or dependencies MUST be justified in the plan (benefit versus cost) before
  they are added.
- API changes that span frontend and backend MUST stay backward compatible, and the backend is
  released first.

Rationale: a small team maintains this site; fewer moving parts means fewer ways to break it.

## Technology and Deployment Constraints

- Frontend: React and JavaScript built with Vite, hosted on Vercel from `main` (root `frontend`).
  Node.js 20.19 or newer.
- Backend: Python 3.12 or newer with Django, using Django's built-in authentication and
  permissions and the Django admin for staff editing. Served by Gunicorn behind Caddy over HTTPS
  on a Google Cloud VM.
- Database: MySQL 8.4 or newer.
- Media: Cloudinary. Machine translation: a server-side provider (currently Azure Translator).
- Production MUST use HTTPS, secure cookies and appropriate security headers, with Django's
  production security settings enabled.
- `frontend/vercel.json` forwards `/api/...` to the backend and MUST be updated if the backend
  moves.

## Development Workflow and Quality Gates

- Work happens on a branch and reaches `main` only through a pull request.
- CI (`.github/workflows/test.yml`) MUST pass before merge: frontend unit tests, production build
  and Playwright tests; backend `makemigrations --check` and the Django test suite.
- The pre-push hook runs the frontend unit tests locally; skipping it does not skip CI.
- Releasing backend changes follows the steps in `backend/README.md` after merge.
- Significant engineering decisions MUST be recorded in the Markdown decision log: context,
  options considered, decision and rationale, trade-offs and risks, and follow-up work.
- Setup, configuration, API contracts, testing and deployment docs MUST be updated in the same
  pull request as the change they describe.
- When wireframes or required content are missing, the gap MUST be raised as a question, not
  filled with invented project-specific requirements. Placeholders MUST be clearly marked.

## Governance

- This constitution overrides other practice documents where they conflict. `REQUIREMENTS.md`
  remains the detailed requirements reference, and `README.md` and `backend/README.md` remain the
  runtime development guidance.
- Every spec, plan and pull request MUST check compliance with these principles. Any deviation
  MUST be written into the plan's Complexity Tracking with its justification and approved by the
  project owner.
- Amendments are made by pull request that updates this file, states the version bump and its
  reason, and notes any affected templates or docs.
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle, MINOR
  for adding a principle or section or materially expanding guidance, PATCH for clarifications
  and wording.

**Version**: 1.0.0 | **Ratified**: 2026-11-12 | **Last Amended**: 2026-11-12
