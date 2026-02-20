# Backend Architecture Overview

## Purpose and Responsibilities

The backend is a FastAPI service that provides authenticated REST APIs for user auth, AI chat, recipes, and pantry management. It also coordinates AI tool execution and persists conversation and domain data in PostgreSQL.

Primary responsibilities:

- Expose API endpoints consumed by the React frontend.
- Enforce JWT-based authentication and per-user data isolation.
- Persist application data using SQLAlchemy ORM.
- Stream AI-generated responses token-by-token over Server-Sent Events (SSE).
- Bridge business workflows between routes, services, and the database.

## Runtime Stack

- **Framework:** FastAPI
- **ORM/Data Access:** SQLAlchemy
- **Migrations:** Alembic (in `databases/`)
- **AI Orchestration:** LangChain + OpenAI (`ChatOpenAI`, GPT-4o)
- **Password Security:** bcrypt hashing
- **Auth:** JWT bearer tokens
- **Hosting:** Render (Docker web service)

## Backend Module Layout

Backend root: `backend/app/`

- `main.py` - FastAPI app bootstrap and route registration.
- `config.py` - Settings and environment variable loading.
- `database.py` - SQLAlchemy engine/session lifecycle.
- `models/` - ORM entities (`user`, `recipe`, `chat`, `ingredient`).
- `schemas/` - Pydantic request/response models.
- `routers/` - HTTP route handlers grouped by domain.
- `services/` - Core business logic (`auth.py`, `ai.py`).

## API Surface

### Auth

- `POST /auth/signup`
  - Input: username, password, master_key.
  - Validates `master_key` against `MASTER_KEY`.
  - Creates user with bcrypt-hashed password.
  - Returns JWT for immediate authenticated use.

- `POST /auth/login`
  - Input: username, password.
  - Verifies password hash.
  - Returns JWT.

### Chat

- `POST /chat/send`
  - Auth required.
  - Persists user message.
  - Invokes LangChain streaming (`.astream()`).
  - Streams tokens as SSE (`data: {"token": "..."}`).
  - Emits completion event (`data: {"done": true}`).
  - Persists final assistant message after stream completion.

- `GET /chat/sessions`
  - Auth required.
  - Returns user chat sessions metadata.

### Recipes

- CRUD under `/recipes` (auth required).
- Supports sorting via query params:
  - Example: `/recipes?sort_by=name&order=asc`
- Supports ingredient filtering against JSONB ingredient list:
  - Example: `/recipes?ingredient=chicken`

### Ingredients (Pantry)

- CRUD under `/ingredients` (auth required).
- Manages a per-user household inventory for recipe context and AI tooling.

## Authentication and Authorization Flow

1. Client calls signup or login.
2. Backend validates credentials and issues signed JWT (`JWT_SECRET`).
3. Frontend stores token and sends `Authorization: Bearer <token>`.
4. Protected routes use a dependency (e.g., `get_current_user`) to:
   - Decode and validate token.
   - Resolve the authenticated user.
   - Scope all data operations to that user.

This pattern ensures that every domain operation (chat/recipes/pantry) is user-bound.

## AI Chat Architecture

The AI service (`services/ai.py`) acts as an orchestrator around LangChain:

- Defines assistant behavior with a grocery/meal-planning system prompt.
- Loads historical context from `chat_messages` for session continuity.
- Calls OpenAI through LangChain (`ChatOpenAI`).
- Exposes tool functions that allow the assistant to:
  - Save structured recipes.
  - Read pantry ingredients.
  - Add/remove pantry ingredients.

### Streaming Contract (SSE)

- Content type: `text/event-stream`.
- Event format: JSON in SSE `data:` lines.
- Incremental tokens are sent as they arrive.
- Final sentinel event signals stream completion.
- Persisted final assistant response is built from streamed token sequence.

This design minimizes response latency and supports a typing-like chat UX.

## Data Access Pattern

- Routers parse input and call service/database layers.
- SQLAlchemy sessions handle transaction scope and persistence.
- Models map directly to Postgres tables managed through Alembic migrations.
- Request and response boundaries are enforced with Pydantic schemas.

## Configuration and Environment Variables

Backend-required variables:

- `DATABASE_URL` - SQLAlchemy connection string.
- `OPENAI_API_KEY` - OpenAI credential used by LangChain.
- `MASTER_KEY` - Signup gatekeeper secret.
- `JWT_SECRET` - JWT signing secret.

## Deployment and Operations

### Production (Render + Supabase)

- Render hosts the backend container.
- Supabase provides managed PostgreSQL.
- Health check endpoint: `GET /health`.
- Alembic migrations run during deploy workflow or manually.

### Local Development (Docker Compose)

- Backend runs with live reload (`uvicorn --reload`).
- Connects to local `postgres` service using compose network DNS.
- Migrations executed from `databases/` with `alembic upgrade head`.

## Cross-Module Interactions

- **Frontend -> Backend:** REST + JWT auth.
- **Backend -> Database:** SQLAlchemy ORM queries/transactions.
- **Backend -> OpenAI:** LangChain chat and tool-calling flows.
- **Backend -> Frontend (chat):** SSE token streaming for real-time UI updates.

## Architectural Strengths

- Clear separation of concerns between routers, services, and models.
- Stateless auth via JWT, easy to scale horizontally.
- AI integration isolated in service layer, reducing coupling.
- Streaming-first chat flow improves perceived responsiveness.
- Migration-driven schema lifecycle supports reproducible environments.
