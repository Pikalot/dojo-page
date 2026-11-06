# Tenshinkai Aikido backend

Django app with two jobs: the admin interface where staff edit content, and a read-only JSON API for the public React site. There is no public write endpoint.

## Setup

You need Python 3.12 or newer and MySQL 8.4 or newer.

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then fill it in; set DJANGO_DEBUG=true locally

mysql -u root -p -e "CREATE DATABASE Tenshinkai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver      # admin at http://127.0.0.1:8000/admin/
```

On macOS with Homebrew MySQL, `mysqlclient` may need these first:

```sh
export ARCHFLAGS="-arch arm64"
export MYSQLCLIENT_CFLAGS="$(mysql_config --cflags)"
export MYSQLCLIENT_LDFLAGS="-L/opt/homebrew/lib $(mysql_config --libs)"
```

Migrations create the tables. Don't run the `CREATE TABLE` statements by hand as well. If you already ran them, drop that database first, which deletes its data.

With `DJANGO_DEBUG=false`, Django redirects every request to HTTPS, which `runserver` can't serve. That's why it has to be `true` locally.

The database starts empty apart from what you add in the admin. To load the starter content, run `mysql -u root -p --default-character-set=utf8mb4 < ../dbqueries/populatedb.sql` after `createsuperuser`, because that script records user 1 as the author. The script is private and not in the repository.

To see the React site use this backend: `cd frontend && VITE_USE_API=true npm run dev`.

## Who can do what

The backend enforces all of this. `accounts/roles.py` is the source of truth.

| Action | Visitor | User | Moderator | Admin |
|---|---|---|---|---|
| Read published content | Yes | Yes | Yes | Yes |
| Sign in to the admin | No | No | Yes | Yes |
| Create and edit content | No | No | Assigned categories only | Yes |
| Publish and unpublish | No | No | Assigned categories only | Yes |
| Delete content | No | No | No | Yes |
| Change ranks, roles, class types | No | No | View only | Yes |
| Create and deactivate users, change roles | No | No | No | Yes |
| Delete users | No | No | No | No (deactivate instead) |

- Categories are announcements, instructors, schedules, FAQs and photos. A new moderator has none until an admin assigns them.
- The last active administrator can't be demoted or deactivated.
- A superuser counts as an admin, and only a superuser can change another superuser.

## Content API

Read-only and public. Only published content is returned. Translatable fields are `{ "en": ..., "vi": ... }`.

| Endpoint | Returns | Order |
|---|---|---|
| `GET /api/announcements` | `[{ id, date, title, body }]` | Newest first |
| `GET /api/schedule` | `[{ id, day, start, end, className }]` | Day, then start time |
| `GET /api/instructors` | `{ instructors: [{ id, name, role, rank, bio, photo }], blackBelts: [{ rank, members: [{ id, name }] }] }` | Rank, then seniority, then name |
| `GET /api/faq` | `[{ id, question, answer }]` | Oldest first |
| `GET /api/dojo-photos` | `[{ id, src, alt }]` | `sort_order`, then id |

Anyone with no role in the database is listed in `blackBelts` rather than `instructors`.

## Translation

Editors write each field in English, Vietnamese or both. At least one is required, except for ranks, roles and class types, which need both because each column must be unique. The public site shows whichever language exists.

To turn on automatic translation, create a free (F0) Translator resource in the Azure portal, add these to `.env`, and restart the server. Leave the region empty for a global resource:

```
AZURE_TRANSLATOR_KEY=
AZURE_TRANSLATOR_REGION=
```

When an editor leaves a field, the browser asks Django, and Django asks Azure:

- If the other language is empty, or still holds an untouched machine translation, it's filled in with a note asking the editor to check it.
- If a person wrote the other language, nothing is overwritten. The editor gets a button to replace it.
- If translation fails or isn't set up, a note appears, and saving still works.
- Pressing Save or Upload right after typing waits up to 6 seconds for a translation in progress, then goes ahead regardless.

The key stays on the server. The endpoint is `POST /admin/translate/`, for signed-in staff only, with a CSRF token. Limits: 5,000 characters per request, 200 requests per user per hour, and 60,000 characters a day across all users, so one busy day can't use up the free 2 million a month. Terms in `GLOSSARY` in `content/translation.py`, such as Godan and hakama, stay as written.

**Limitations**

- Whether text was written by a person or a machine is only known while the page is open. After a reload, all existing text counts as written by a person, so it's never overwritten without asking.
- Whether text came from a machine isn't stored or shown on the public site. The editor reviews or corrects it, and saving counts as accepting it.
- Rate limits and the daily budget use Django's cache. See the note on shared caches under Deployment.

## Photo upload

Staff with the Photos category, and admins, can drop one or many photos at **Photos > Upload photos**. Each needs a description in at least one language. Add these to `.env`, from the API Keys page in the Cloudinary console, then restart the server:

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

The browser sends each photo to Django, never to Cloudinary, so the secret stays on the server. For each photo:

1. Check permissions, the descriptions and the file. The file must really be a JPEG, PNG or WebP, up to 10 MB and 50 megapixels. SVG is refused because it can run scripts.
2. Rebuild the image from its pixels, which removes GPS locations and other hidden data, and resize it to at most 2400 px on its longest side.
3. Upload it to Cloudinary under a random name, outside any database transaction.
4. Save the returned link in one transaction, together with the carousel position and the admin history entry. If that fails, the upload is deleted from Cloudinary.

Photos are independent: one failing doesn't affect the others, and it can be retried. New photos are drafts unless "Publish right away" is ticked.

**Deleting.** Only admins can delete a photo. That also permanently deletes its file from Cloudinary, after the database change has committed, so a rollback or a version conflict leaves the file alone. The file's id is read from the saved link. A file stays if the link points anywhere but this project's Cloudinary account, or if another photo uses the same link. Removing a photo from the carousel or from an instructor doesn't delete anything on Cloudinary.

**Limitations**

- If saving fails and deleting from Cloudinary also fails, an unused file stays there. The `dojo.content` log records its id, so it can be removed by hand.
- If deleting a photo's file fails, the record stays deleted, and the admin who deleted it gets a warning with the file's id so it can be removed by hand.
- Changing a photo's link in the admin leaves the old file on Cloudinary.
- Uploads are limited to 100 per user per hour. See the note on shared caches under Deployment.
- Requests go through Django, so the web server must allow request bodies of at least 10 MB.

## Concurrent edits

Content uses optimistic concurrency control. Each record has a `version` number and an `updated_at` time on its `Contents` row.

1. The edit form includes the version it loaded, in a hidden field.
2. Saving runs `UPDATE Contents SET version = version + 1 ... WHERE content_id = ? AND version = ?` as its first write.
3. If no row matches, someone else saved first. The request is refused with HTTP 409 and nothing is written.
4. Otherwise the same transaction writes the edit. If any later step fails, including inline rows or the audit log entry, everything rolls back, including the version change.

Comparing and writing in one statement leaves no gap for another editor. A second editor's `UPDATE` waits for the first to finish, then matches no row.

The 409 page shows the editor's values beside the database's, and offers two choices: discard theirs and load the latest, or replace the latest with theirs. Replacing is checked against the new version, so a third editor's save causes another conflict rather than being lost.

Deleting works the same way, so nobody can delete a record that changed after they read it.

| Status | Meaning |
|---|---|
| 409 | Someone else changed or deleted the record, or the database refused the data |
| 400 | A delete request had no usable version |
| 503 | Deadlock or lock timeout. Nothing was saved, and it's safe to try again |

**Limitations**

- All content writes must go through `content/services.py`. A direct `.save()` in new code, or manual SQL, skips the check.
- Replacing the latest version overwrites whole records. There's no field-by-field merge.
- `Rank`, `Role` and `ClassType` have no version, so the last save wins. They rarely change, and only admins can edit them.
- Reordering or relinking a photo bumps the photo's version, but editing a `Rank` doesn't bump the instructors that use it.
- The check protects each record separately. It doesn't protect rules that span several records.

## Tests

Tests run on MySQL because the guarantees being tested belong to the database. Django creates and removes its own `test_` database, so the database user needs permission to create databases.

```sh
python manage.py test --settings=config.settings_test
```

- `content/tests/test_concurrency.py` runs real transactions on separate connections. If one fails, look for a stuck lock or a lost update.
- `content/tests/test_services.py` covers the version check, rollback and the database's own rules.
- `content/tests/test_admin.py` covers the editing workflow over HTTP, permissions and CSRF.
- `content/tests/test_api.py` covers published-only output, and compares response shapes with `frontend/src/data/mock/`.
- `accounts/tests/` covers roles, the last-admin rule, rate limits and password reset.

A failure message names the test and the expected and actual values. Tests that run threads report a stuck lock as "A thread did not finish".

## Deployment

Runtime: Python 3.12+, MySQL 8.4+, a WSGI server (for example gunicorn, pointing at `config.wsgi`), and a web server handling HTTPS.

- Set everything in `.env.example` as real environment variables, with `DJANGO_DEBUG=false`.
- The HTTPS proxy must set `X-Forwarded-Proto`, strip any client-supplied copy, and pass the real client address as `REMOTE_ADDR`. Otherwise redirects and rate limits won't work correctly.
- Run `python manage.py check --deploy`, `migrate` and `collectstatic`, and serve `staticfiles/` from the web server.
- Route `/api/` and `/admin/` to Django, and everything else to the built frontend.
- Allow `frame-src https://www.google.com` if you add a Content-Security-Policy, for the map.
- Configure a shared cache such as Redis if running more than one server process. The default cache is per process, so each would count rate limits separately.
- HSTS is on for a year including subdomains, so only deploy on a domain where every subdomain has HTTPS.

**Backups and rollback**

- Take regular `mysqldump --single-transaction` backups, and test restoring one.
- To roll back, deploy the previous release. If a migration has to be undone, restore from a backup taken before it, because undoing a migration can lose data.

**Logs:** application events go to the `dojo` logger on the console. Admin changes are recorded in the admin's history. Error monitoring isn't set up yet.
