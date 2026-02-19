# Grocery Agent

A mobile-first web app for meal planning and grocery shopping, powered by AI.

## Architecture

- **Frontend**: React + Vite SPA (deployed to GitHub Pages)
- **Backend**: Python FastAPI with LangChain + OpenAI (deployed to Render)
- **Database**: PostgreSQL (Supabase in production, local via Docker in development)

## Local Development

### Prerequisites

- Docker & Docker Compose
- An OpenAI API key

### Setup

1. Copy the environment template and fill in your values:

```bash
cp orchestration/.env.example orchestration/.env
```

2. Edit `orchestration/.env` and set at minimum:
   - `OPENAI_API_KEY` — your OpenAI API key
   - `MASTER_KEY` — a secret for account creation
   - `JWT_SECRET` — a secret for signing auth tokens

3. Start all services:

```bash
cd orchestration
docker compose up --build
```

4. Run database migrations (first time only):

```bash
cd databases
alembic upgrade head
```

5. Open the app:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API docs: http://localhost:8000/docs

### Creating an Account

On the signup page, enter a username, password, and the `MASTER_KEY` you configured. Only people with the master key can create accounts.

## Project Structure

```
├── frontend/          React SPA (Vite)
├── backend/           FastAPI application
│   └── app/
│       ├── models/    SQLAlchemy ORM models
│       ├── schemas/   Pydantic request/response schemas
│       ├── routers/   API route handlers
│       └── services/  Business logic (auth, AI)
├── databases/         Alembic migrations
├── orchestration/     Docker Compose for local dev
└── .github/workflows/ CI/CD
```
