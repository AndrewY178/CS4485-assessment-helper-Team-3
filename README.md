# CS4485-assessment-helper
## Frontend setup

The frontend for **Assessment Helper**, a web application designed to simplify faculty teaching evaluations and classroom observations at the University of Texas at Dallas.

The application provides interfaces for Assessment Committee (AC) members and faculty to manage evaluation cycles, observation requests, observer assignments, and observation reports.

## Tech Stack

- **React** — Frontend framework
- **TypeScript** — Type-safe JavaScript
- **Vite** — Development server and build tool
- **CSS** — Styling
- **Flask + MySQL** — Backend and database (separate from frontend)

## Getting Started

### Prerequisites

Make sure Node.js and npm are installed.

### Installation

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal (typically `http://localhost:5173`).

### Build

To create a production build:

```bash
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

The backend's reusable `emailservice.py` sends emails through EmailJS. Password setup and reset links use this service. The dashboard's **Send reminders** button currently uses the frontend EmailJS integration and sends to sign-up rows marked `Due` or `Overdue`.

1. In EmailJS, create a service and a template. Set the template's **To Email** field to `{{to_email}}`. In the email body, use `Hello {{to_name}},` and `{{message}}`.
2. The backend reads these settings from the repository-root `.env` file. The Compose configuration passes them into the backend container:

   ```dotenv
   VITE_EMAILJS_SERVICE_ID=your_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_template_id
   VITE_EMAILJS_PUBLIC_KEY=your_public_key
   VITE_EMAILJS_TEST_RECIPIENT=your_test_inbox@example.com
   EMAILJS_PASSWORD_TEMPLATE_ID=your_password_email_template_id
   ```

   The password template ID is optional; when absent, password emails use `VITE_EMAILJS_TEMPLATE_ID`. The template should use the `to_email`, `to_name`, and `message` variables. Restart the backend container after editing `.env`:

   ```bash
   docker compose up -d --force-recreate backend
   ```
3. While running the frontend with `npm run dev`, **Send reminders** sends one test email to the configured test inbox, with the due/overdue faculty listed in the message. It does not send to the sample faculty addresses.

The sign-up rows are currently hard-coded demo data. A production build sends an individual email to each due/overdue row, so replace those rows with verified, live sign-up records before using the feature in production. Restrict the EmailJS service to the intended website origins and configure its sending limits.

## Project Structure

```text
frontend/
├── public/           # Static assets
├── src/
│   ├── assets/       # Images and other assets
│   ├── components/   # Reusable UI components
│   ├── context/      # Authentication and navigation
│   ├── data/         # Mock data
│   ├── pages/        # Application pages
│   ├── App.tsx       # Application routing
│   ├── index.css     # Global styles
│   └── main.tsx      # Application entry point
├── package.json
└── README.md
```



## Database setup

This project uses MySQL 8.0 running in Docker. You don't need to install MySQL on your machine.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac/Windows) or Docker Engine (Linux)
- Git

Verify Docker is installed:

```bash
docker --version
docker compose version
```

### First-time setup

1. **Clone the repo**
   ```bash
   git clone <your-repo-url>
   cd <your-repo-folder>
   ```

2. **Create your `.env` file**

   Copy the example file:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and replace the placeholder passwords with your own. Never commit this file.

3. **Start the database**
   ```bash
   docker compose up -d --build
   ```
   the -d makes sure that the docker container detaches when you run it
   the --build gets everything ready for the backend

4. **Wait for it to finish initializing** (about 20-30 seconds the first time):
   ```bash
   docker compose logs -f db
   ```
   Look for `ready for connections`, then press `Ctrl+C` to exit the logs.

5. **Verify it works**
   ```bash
   docker compose exec db mysql -u class_user -p class_project -e "SHOW TABLES;"
   ```
   Enter the `MYSQL_PASSWORD` from your `.env` when prompted. You should see the tables from `db/01-schema.sql`.
   ```bash
   curl http://localhost:5000/api/users
   ```
   should return [] if no users or the users if users have been added

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
| View logs                         | `docker compose logs [db\|backend]`   |

### Changing the schema

SQL files in the `db/` folder run automatically, in alphabetical order, **only the first time** the database starts with an empty volume.

If you (or a teammate) change `db/01-schema.sql` or `db/02-seed.sql`, pull the changes and reset your database:

```bash
docker compose down -v
docker compose up -d
```

This deletes all local data, which is fine for development.

### Troubleshooting

- **Port 3306 already in use:** another MySQL is running locally. Stop it, or change the port mapping in `docker-compose.yml` to `"3307:3306"` and connect on port 3307.
- **Tables don't exist:** the init scripts only run on a fresh volume. Run `docker compose down -v` then `docker compose up -d`.
- **Can't connect right after starting:** the database is still initializing. Wait for `ready for connections` in the logs.
- **Permission denied on the `db/` folder (Linux):** run `sudo chown -R $USER:$USER db`.
- **Access denied for user:** the password in `.env` must match what the database was first created with. If you changed `.env` after the first start, reset with `docker compose down -v`.
