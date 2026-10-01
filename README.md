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
cd threatforge/backend
python -m venv .venv
.\.venv\Scripts\activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend runs at:

```text
http://localhost:8080
```

## Run Frontend

Open a new terminal:

```powershell
cd threatforge/frontend
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

