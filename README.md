# ThreatForge

Security review workspace with a FastAPI backend and React/Vite frontend.

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL

## Database Setup

Create the PostgreSQL database:

```powershell
createdb -U postgres threatforge
```

Create `threatforge/backend/.env`:

```env
DATABASE_URL
MAX_FILE_MB
CORS_ORIGINS
JIRA_BASE_URL
JIRA_EMAIL
JIRA_API_TOKEN
JIRA_PROJECT_KEY
JIRA_ISSUE_TYPE
```

For Jira integration, also add:

```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=YOURPROJECT
JIRA_ISSUE_TYPE=Task
```

## Run Backend

```powershell (windows)
cd threatforge
cd backend
python -m venv .venv
.\.venv\Scripts\activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend runs at:

```text
http://localhost:8000
```

## Run Frontend

Open a new terminal:

```powershell
cd threatforge
cd frontend
npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

## Basic Flow

1. Start PostgreSQL.
2. Start the backend on port `8000`.
3. Start the frontend on port `5173`.
4. Open `http://localhost:5173`.
5. Create/select a codebase and upload reports.

## Run With Docker

This Docker setup starts its own PostgreSQL container and does not touch your local Windows PostgreSQL database.

Start Docker from the repository root:

```powershell
docker compose up --build
```

Open the Docker frontend at:

```text
http://localhost:3000
```

The backend API is exposed at:

```text
http://localhost:8000
```

Inside Docker, PostgreSQL runs on the internal `db:5432` service. The backend creates the required tables automatically on startup.

To inspect the Docker database:

```powershell
docker compose exec db psql -U postgres -d threatforge
```

Stop Docker:

```powershell
docker compose down
```

Stop Docker and delete only the Docker PostgreSQL data volume:

```powershell
docker compose down -v
```

