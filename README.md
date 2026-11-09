# CS4485-assessment-helper

A web application designed to simplify faculty teaching evaluations and classroom observations at the University of Texas at Dallas.

The application allows Assessment Committee (AC) members and faculty to manage evaluation cycles, observation requests, observer assignments, and observation reports.

## Tech Stack

- **React** — Frontend framework
- **TypeScript** — Type-safe JavaScript
- **Vite** — Development server and build tool
- **CSS** — Styling
- **Flask (Python)** — Backend API
- **MySQL 8.0** — Database, runs in Docker (no local MySQL install needed)

## Getting Started

### Prerequisites

Make sure these are installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Node.js and npm
- Git

Verify Docker is installed:

```bash
docker --version
docker compose version
```

### First-time setup

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd <repo-folder>
   ```

2. **Create your `.env` file**

   Copy the example file:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and replace the placeholder passwords with your own. Never commit this file.

3. **Start the database and backend**
   ```bash
   docker compose up -d --build
   ```
   `-d` runs the containers in the background. `--build` builds the backend image.

4. **Wait for the database to finish initializing** (about 20-30 seconds the first time):
   ```bash
   docker compose logs -f db
   ```
   Look for `ready for connections`, then press `Ctrl+C` to exit the logs.

5. **Verify the backend is running**
   ```bash
   curl http://localhost:5001/api/health
   ```
   You should see `{"status":"ok"}`.

6. **Start the frontend** (in a second terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open the local URL displayed in the terminal (typically `http://localhost:5173`). Requests to `/api` are forwarded to the backend on port 5001 automatically.

### Build

To create a production build of the frontend:

```bash
cd frontend
npm run build
```

## Application Features

The application uses two main workspaces:

**AC Workspace**
- Executive Dashboard
- Observation Template Management
- Evaluation Cycle Setup
- Faculty Sign-up Tracking
- Observer Selection
- Observation Tracking and Reports

**Faculty Workspace**
- Personal Dashboard
- Evaluation Sign-up
- Observer Requests (sent and received)
- Upcoming and Completed Observations
- Observation Reports
- Feedback Surveys

Faculty members can participate as both Observers and Observees. AC Members also have access to the Faculty Workspace.

### EmailJS email delivery

The backend's reusable `emailservice.py` sends emails through EmailJS. AC-created accounts cannot log in until the invited user opens the one-time setup link, verifies their email, and sets a password. Forgot-password requests email a separate one-time reset link. The AC-only dashboard **Send reminders** action uses backend data: a missing report for the latest sign-up cycle is `Due`; a missing report for the previous sign-up cycle is `Overdue`. It sends at most one reminder per faculty member, preferring the overdue cycle when multiple cycles are incomplete.

1. In EmailJS, create a service and a template. Set the template's **To Email** field to `{{to_email}}`. In the email body, use `Hello {{to_name}},` and `{{message}}`.
2. The backend reads these settings from the repository-root `.env` file. The Compose configuration passes them into the backend container:

   ```dotenv
   VITE_EMAILJS_SERVICE_ID=your_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_template_id
   VITE_EMAILJS_PUBLIC_KEY=your_public_key
   VITE_EMAILJS_TEST_RECIPIENT=your_test_inbox@example.com
   EMAILJS_PASSWORD_TEMPLATE_ID=your_password_email_template_id
   EMAILJS_REMINDER_TEMPLATE_ID=your_reminder_template_id
   REMINDER_TEST_MODE=true
   FRONTEND_URL=http://localhost:5173
   ```

   The password template ID is optional; when absent, password emails use `VITE_EMAILJS_TEMPLATE_ID`. The reminder template ID is optional; when absent, reminders also use `VITE_EMAILJS_TEMPLATE_ID`. Configure the reminder template's **To Email** as `{{to_email}}`, its subject as `Assessment Helper evaluation reminder`, and its entire body as just `{{message}}`. The backend message already includes the greeting, faculty name, status, cycle, and login instructions; extra template text or another `{{message}}` creates duplicate content. Do not use `{{to_email}}` as the greeting.

   `REMINDER_TEST_MODE=true` (the Compose default) sends one personalized test message per eligible faculty member to `VITE_EMAILJS_TEST_RECIPIENT`; each message identifies its intended recipient. Only set `REMINDER_TEST_MODE=false` when ready to email faculty directly. `FRONTEND_URL` must be the frontend's origin (use your deployed site URL outside local development); it is sent with backend EmailJS requests. Restart the backend container after editing `.env`:

   ```bash
   docker compose up -d --force-recreate backend
   ```
3. While running the frontend with `npm run dev`, log in as an AC Member and press **Send reminders**. The backend determines eligibility from sign-up cycles and submitted reports, then sends one personalized test email per eligible faculty member to the test inbox. EmailJS allows one send request per second, so a batch may take a little time. The button result distinguishes test sends from live sends.

The current cycle is the newest semester with sign-up records; the previous cycle is the next newest semester. A submitted observation report marks that faculty evaluation complete. Restrict the EmailJS service to the intended website origins and configure its sending limits.

Existing databases must be upgraded before deploying the email verification check. Back up the database, then apply `db/migrations/20261103_add_email_verification.sql`. It marks existing accounts with passwords as verified so they can continue to log in; newly invited accounts remain unverified until they use their setup link.

## Project Structure

```text
.
├── backend/              # Flask API
│   ├── app.py            # App setup and general routes
│   ├── auth.py           # Login, logout, password links, account creation
│   ├── api_helpers.py    # Shared helpers (error replies, JSON body, transactions)
│   └── db.py             # MySQL connection pool and query helper
├── db/                   # SQL that runs when the database is first created
│   ├── 01-schema.sql     # Tables
│   ├── 02-seed.sql       # Fake development data
│   └── 03-auth.sql       # Login sessions and password-link tokens
├── frontend/
│   ├── public/           # Static assets
│   ├── src/
│   │   ├── api/          # Calls to the backend
│   │   ├── assets/       # Images and other assets
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # Authentication and navigation
│   │   ├── data/         # Mock data
│   │   ├── pages/        # Application pages
│   │   ├── styles/       # CSS for pages and components
│   │   ├── types/        # Shared TypeScript types
│   │   ├── App.tsx       # Application routing
│   │   ├── index.css     # Global styles
│   │   └── main.tsx      # Application entry point
│   └── package.json
├── docker-compose.yml    # Database and backend containers
├── Dockerfile            # Backend image
├── requirements.txt      # Python dependencies
└── .env.example          # Template for your .env
```


## Database setup

This project uses MySQL 8.0 running in Docker. You don't need to install MySQL on your machine. The first-time setup is in [Getting Started](#getting-started).

### Check the tables

```bash
docker compose exec db mysql -u <MYSQL_USER> -p assessment_helper -e "SHOW TABLES;"
```

Enter the `MYSQL_PASSWORD` from your `.env` when prompted. You should see the tables from `db/01-schema.sql`.

### Connection details

Use these in your app or in a GUI client (MySQL Workbench, DBeaver, etc.):

| Setting  | Value                              |
|----------|------------------------------------|
| Host     | `127.0.0.1`                        |
| Port     | `3306`                             |
| User     | your `MYSQL_USER`                  |
| Password | your `MYSQL_PASSWORD` from `.env`  |
| Database | `assessment_helper`                |

> **Note:** MySQL Workbench may warn that the server version is newer than the Workbench version. This is safe to ignore.

### Everyday commands

| Task                              | Command                    |
|-----------------------------------|----------------------------|
| Start the database and backend    | `docker compose up -d --build`|
| Stop it (keeps data)              | `docker compose stop`      |
| Shut down (keeps data)            | `docker compose down`      |
| Reset the database (deletes data) | `docker compose down -v && docker compose up -d --build` |
| View logs                         | `docker compose logs -f db` or `docker compose logs -f backend` |
| Start the frontend                | `cd frontend && npm run dev` |
| Check frontend code style         | `cd frontend && npm run lint` |

### Changing the schema

SQL files in the `db/` folder run automatically, in alphabetical order, **only the first time** the database starts with an empty volume.

If anyone changes any file in `db/`, pull the changes and reset your database:

```bash
docker compose down -v
docker compose up -d --build
```

This deletes all local data, which is fine for development.

If you need to keep data from the earlier schema, do not reset the volume. Back up the database and apply the one-time additive migration in `db/migrations/20261102_add_signup_columns.sql` with a MySQL client. It adds the sign-up fields required by the current API and maps existing courses to their observees. The API uses the latest semester found in the database when no semester is supplied.

### Troubleshooting

- **Port 3306 already in use:** another MySQL is running locally. Stop it, or change the port mapping in `docker-compose.yml` to `"3307:3306"` and connect on port 3307.
- **Port 5001 already in use:** something else is using the backend's port. 
- **Tables don't exist:** the init scripts only run on a fresh volume. Run `docker compose down -v` then `docker compose up -d --build`.
- **Can't connect right after starting:** the database is still initializing. Wait for `ready for connections` in the logs.
- **Permission denied on the `db/` folder (Linux):** run `sudo chown -R $USER:$USER db`.
- **Access denied for user:** the password in `.env` must match what the database was first created with. If you changed `.env` after the first start, reset with `docker compose down -v`.
