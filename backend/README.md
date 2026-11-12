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

The live backend runs on one small Google Cloud VM. The React site stays on Vercel. The root [README](../README.md#deploying) explains how the two connect.

| Part | Where | Job |
|---|---|---|
| Caddy | VM, ports 80 and 443 | HTTPS with a free certificate it renews itself, serves `staticfiles/`, passes everything else to Gunicorn |
| Gunicorn | VM, `127.0.0.1:8000` only | Runs Django. One process with four threads, from `gunicorn.conf.py`. Kept running by systemd. |
| MySQL 8.4 | VM, `127.0.0.1` only | The `Tenshinkai` database |
| Cloudinary, Azure Translator, Gmail | Outside services | Photos, translation, password reset email |

Don't use `runserver` in production.

The steps below are what the live server was built with. Commands run in the VM's SSH window unless they say otherwise.

### 1. Create the VM

In Google Cloud, go to **Compute Engine > VM instances > Create instance**. These settings stay within the free tier:

| Setting | Value |
|---|---|
| Region | `us-west1`, `us-central1` or `us-east1` |
| Machine type | `e2-micro` (1 GB memory) |
| Boot disk | Ubuntu 26.04 LTS, x86/64, **standard persistent disk**, 30 GB |
| Data protection | No backups (snapshots cost money) |
| Firewall | Allow HTTP and HTTPS traffic |

Set a $1 budget alert under **Billing > Budgets & alerts**. The cost estimate on the create page doesn't subtract the free tier.

Ubuntu 26.04 matters: its own MySQL is 8.4, which Django 6.1 requires. Ubuntu 24.04 ships MySQL 8.0.

### 2. Prepare the server

Add 2 GB of swap, so MySQL isn't stopped when the 1 GB of memory runs out:

```sh
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Install the software:

```sh
sudo apt update
sudo apt install -y mysql-server python3-venv python3-dev build-essential pkg-config libmysqlclient-dev git nano caddy
```

Make MySQL small and private:

```sh
sudo tee /etc/mysql/mysql.conf.d/zz-dojo.cnf > /dev/null <<'EOF'
[mysqld]
bind-address = 127.0.0.1
mysqlx = OFF
performance_schema = OFF
max_connections = 30
innodb_buffer_pool_size = 128M
EOF
sudo systemctl restart mysql
```

### 3. Database, users and settings

Create the database and a MySQL user that can only reach it. In `sudo mysql`, using your own password without `'`, `"`, `\`, `$` or backticks:

```sql
CREATE DATABASE Tenshinkai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dojo'@'localhost' IDENTIFIED BY 'your-password-here';
GRANT ALL PRIVILEGES ON Tenshinkai.* TO 'dojo'@'localhost';
```

Create a `dojo` system user that runs the app and can't log in, and a settings file only it and root can read:

```sh
sudo useradd --system --create-home --home-dir /srv/dojo --shell /usr/sbin/nologin dojo
sudo install -d -m 750 -o root -g dojo /etc/dojo
sudo install -m 640 -o root -g dojo /dev/null /etc/dojo/env
python3 -c "import secrets; print('DJANGO_SECRET_KEY=' + secrets.token_urlsafe(50))" | sudo tee -a /etc/dojo/env > /dev/null
sudo nano /etc/dojo/env
```

`/etc/dojo/env` is the server's version of `.env`. Add these below the secret key line:

```
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=tenshinkaisj.duckdns.org,localhost
DJANGO_CSRF_TRUSTED_ORIGINS=https://tenshinkaisj.duckdns.org
DB_NAME=Tenshinkai
DB_USER=dojo
DB_PASSWORD=your-password-here
DB_HOST=localhost
DB_PORT=3306
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
AZURE_TRANSLATOR_KEY=...
AZURE_TRANSLATOR_REGION=...
EMAIL_HOST=...
EMAIL_PORT=...
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
DEFAULT_FROM_EMAIL="Tenshinkai Aikido <address@example.com>"
```

- Use a new `DJANGO_SECRET_KEY` on the server, never the one from a laptop. Changing it signs everyone out.
- Don't paste secrets into chats or screenshots. If one was ever shared, replace it before using it here.
- If `nano` shows `[Mac Format]` when saving, press **Esc** then **M** to turn it off, or every setting ends up on one line. `sudo grep -c $'\r' /etc/dojo/env` should print `0`.
- `sudo cut -d= -f1 /etc/dojo/env` lists the setting names without their values.
- The Cloudinary key needs permission to upload and delete. A "Media Library User" key is refused with `NotAllowed`.

### 4. Code and Python packages

```sh
sudo -u dojo git clone https://github.com/Pikalot/dojo-page.git /srv/dojo/app
sudo -u dojo python3 -m venv /srv/dojo/venv
sudo -u dojo /srv/dojo/venv/bin/pip install -r /srv/dojo/app/backend/requirements.txt
```

The server follows `main`.

### 5. Tables, admin account and content

A small `dojo-manage` command loads `/etc/dojo/env` and runs `manage.py`:

```sh
sudo tee /usr/local/bin/dojo-manage > /dev/null <<'EOF'
#!/bin/sh
set -a; . /etc/dojo/env; set +a
cd /srv/dojo/app/backend
exec /srv/dojo/venv/bin/python manage.py "$@"
EOF
sudo chmod 755 /usr/local/bin/dojo-manage
```

`sudo -u dojo dojo-manage <command>` on the server works like `python manage.py <command>` locally.

```sh
sudo -u dojo dojo-manage migrate
sudo -u dojo dojo-manage createsuperuser
sudo -u dojo dojo-manage collectstatic --noinput
```

To load the starting content, upload the private `dbqueries/populatedb.sql` (the SSH window's **UPLOAD FILE** button), then run it. It must run after `createsuperuser`, because it records user 1 as the author. It only adds records.

```sh
sudo mysql --default-character-set=utf8mb4 < ~/populatedb.sql
```

Never run `createdb.sql` or `dropdb.sql` on the server. Migrations create the tables.

### 6. Keep it running

```sh
sudo tee /etc/systemd/system/dojo.service > /dev/null <<'EOF'
[Unit]
Description=Tenshinkai backend (Gunicorn)
After=network.target mysql.service
Requires=mysql.service

[Service]
User=dojo
Group=dojo
WorkingDirectory=/srv/dojo/app/backend
EnvironmentFile=/etc/dojo/env
ExecStart=/srv/dojo/venv/bin/gunicorn config.wsgi
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now dojo
curl -s -o /dev/null -w "%{http_code}\n" -H "X-Forwarded-Proto: https" http://localhost:8000/api/faq
```

The last line should print `200`. systemd starts Gunicorn at boot and restarts it if it crashes.

### 7. Name and HTTPS

1. At [duckdns.org](https://www.duckdns.org), create a name and set it to the VM's external IP. The live site uses `tenshinkaisj.duckdns.org`. Keep the DuckDNS token private.
2. Configure Caddy. It gets and renews the certificate itself:

```sh
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
tenshinkaisj.duckdns.org {
	encode gzip

	request_body {
		max_size 12MB
	}

	handle_path /static/* {
		root * /srv/dojo/app/backend/staticfiles
		file_server
	}

	handle {
		reverse_proxy 127.0.0.1:8000 {
			header_up X-Real-IP {remote_host}
		}
	}
}
EOF
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl restart caddy
```

The editor is then at `https://tenshinkaisj.duckdns.org/admin/`.

`header_up X-Real-IP {remote_host}` always replaces whatever a visitor sends, so login limits see real addresses. Gunicorn only listens on `127.0.0.1`, so nobody can skip Caddy. Staff go straight to this address (the website's **Staff sign-in** link points here), not through Vercel.

### Releasing an update

After merging into `main`:

```sh
sudo -u dojo git -C /srv/dojo/app pull
sudo -u dojo /srv/dojo/venv/bin/pip install -r /srv/dojo/app/backend/requirements.txt
sudo -u dojo dojo-manage migrate
sudo -u dojo dojo-manage collectstatic --noinput
sudo systemctl restart dojo
```

Take a backup before any release with a migration. If a change touches both the API and the website, keep the API change backward compatible, and deploy the backend first.

### Everyday commands

| Task | Command |
|---|---|
| Is it running? | `systemctl status dojo caddy mysql --no-pager` |
| Backend logs | `sudo journalctl -u dojo -n 100 --no-pager` |
| Caddy logs | `sudo journalctl -u caddy -n 100 --no-pager` |
| Restart after changing `/etc/dojo/env` | `sudo systemctl restart dojo` |
| Change an admin password | `sudo -u dojo dojo-manage changepassword <username>` |
| Memory and swap | `free -h` |

If `sudo` replies "I'm afraid I can't do that" in the browser SSH window, close the window and open a new one.

### Backups and rollback

Backups aren't automated yet. To take one and download it with **DOWNLOAD FILE**:

```sh
sudo mysqldump --single-transaction --routines --triggers Tenshinkai | gzip > ~/tenshinkai-$(date +%F).sql.gz
```

To restore one, which replaces the current data:

```sh
gunzip -c ~/tenshinkai-YYYY-MM-DD.sql.gz | sudo mysql Tenshinkai
```

- Test restoring a backup now and then.
- To roll back code, check out the previous commit in `/srv/dojo/app` and restart. If a migration has to be undone, restore a backup taken before it, because undoing a migration can lose data.

### Notes and limitations

- **The external IP can change** if the VM is stopped and started. Update it on DuckDNS when that happens. Automatic updates aren't set up yet.
- **Rate limits are counted per Gunicorn process** in memory. Configure a shared cache such as Redis before raising `workers` in `gunicorn.conf.py`. Counts also reset on restart.
- **HSTS** is on for a year including subdomains, so only serve this backend from a name where every subdomain has HTTPS.
- **If you add a Content-Security-Policy**, allow `frame-src https://www.google.com` for the map.
- **If the server ever sits behind another proxy**, it must still set `X-Real-IP` to the visitor's address and `X-Forwarded-Proto`, and strip copies sent by visitors.
- **Logs:** application events go to the `dojo` logger, which systemd keeps in the journal. Admin changes are recorded in the admin's history. Error monitoring isn't set up yet.
