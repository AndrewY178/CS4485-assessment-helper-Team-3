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
