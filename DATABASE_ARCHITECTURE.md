# Database Architecture Overview

## Purpose and Responsibilities

The database layer stores all persistent application data for users, chat history, recipes, and household ingredients. It is modeled in PostgreSQL, accessed through SQLAlchemy, and evolved with Alembic migrations.

Primary responsibilities:

- Persist user identities and credentials metadata.
- Persist chat sessions and message history for AI context.
- Persist structured recipes and ingredient collections.
- Persist per-user household pantry inventory.
- Support query patterns for sorting and ingredient search.

## Platform and Lifecycle

- **Engine:** PostgreSQL
- **Managed Production Host:** Supabase
- **Local Development Host:** Docker Postgres container (`postgres:16`)
- **Migration System:** Alembic (`databases/alembic/versions`)
- **ORM Integration:** SQLAlchemy models in `backend/app/models`

## Logical Data Model

### Entity Relationships

- `users` 1-to-many `recipes`
- `users` 1-to-many `chat_sessions`
- `users` 1-to-many `household_ingredients`
- `chat_sessions` 1-to-many `chat_messages`

This model enforces user-scoped ownership across all product domains.

## Table Definitions

### `users`

- `id` (uuid, PK)
- `username` (string, unique)
- `password_hash` (string)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `recipes`

- `id` (uuid, PK)
- `user_id` (uuid, FK -> users.id)
- `name` (string)
- `description` (text)
- `ingredients` (jsonb)
- `prep_time_minutes` (integer)
- `instructions` (text)
- `source` (string)
- `created_at` (timestamp)

### `chat_sessions`

- `id` (uuid, PK)
- `user_id` (uuid, FK -> users.id)
- `title` (string)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### `chat_messages`

- `id` (uuid, PK)
- `session_id` (uuid, FK -> chat_sessions.id)
- `role` (string: `user` or `assistant`)
- `content` (text)
- `created_at` (timestamp)

### `household_ingredients`

- `id` (uuid, PK)
- `user_id` (uuid, FK -> users.id)
- `name` (string)
- `quantity` (string)
- `unit` (string)
- `category` (string)
- `added_at` (timestamp)

## JSONB Recipe Ingredients Design

`recipes.ingredients` uses JSONB to store arrays of structured ingredient objects:

- `{ name, quantity, unit }`

Benefits:

- Flexible structure for AI-generated and manually entered recipe ingredients.
- Supports ingredient-level query filtering without creating join-heavy schemas.
- Works well for read-heavy card/detail recipe rendering in the frontend.

Trade-off:

- Complex validation and some query patterns are harder than fully normalized tables.

## Query and Access Patterns

### User Isolation

All domain queries are filtered by authenticated `user_id` to prevent cross-user data access.

### Recipe Sorting

Backend supports dynamic sorting by recipe fields via query params:

- Example: `sort_by=name&order=asc`

### Ingredient Search in Recipes

Backend filters recipes by values found in the `ingredients` JSONB array:

- Example: `ingredient=chicken`

This enables pantry-aware discovery and quick recipe lookup by ingredient.

## Chat Persistence Model

Conversation state is split into:

- `chat_sessions` (conversation container/metadata)
- `chat_messages` (ordered message log)

During chat:

1. User message is inserted into `chat_messages`.
2. AI stream emits tokens to client.
3. Final assistant message is persisted as a single `chat_messages` row.

This storage model supports session resumption and historical context replay.

## Migrations and Schema Evolution

Alembic manages versioned schema changes:

- Config root: `databases/alembic.ini`
- Runtime migration environment: `databases/alembic/env.py`
- Migration revisions: `databases/alembic/versions/`

Typical workflow:

1. Update SQLAlchemy models.
2. Generate migration revision.
3. Review/adjust migration script.
4. Apply with `alembic upgrade head`.

This keeps local, staging, and production schemas aligned.

## Environment Configuration

Primary connection variable:

- `DATABASE_URL`

Examples:

- **Local compose:** `postgresql://postgres:postgres@postgres:5432/grocery_agent`
- **Supabase production:** pooled Supabase Postgres URI

## Local Development Topology

From `orchestration/docker-compose.yml`:

- Local Postgres runs on container port `5432`.
- Uses a named volume for data persistence across restarts.
- Backend container connects over compose network using service name host.

This gives reproducible local DB behavior without requiring cloud resources.

## Production Topology (Supabase)

- Managed Postgres with operational features handled by Supabase.
- Backend connects using secure connection string in `DATABASE_URL`.
- Alembic migrations run against the same production instance.

Supabase-provided extensions (including UUID support) simplify UUID-based PK defaults.

## Reliability and Integrity Considerations

- Foreign keys enforce ownership and parent-child relationships.
- Unique username constraint prevents duplicate account identity collisions.
- Timestamps support auditability and chronology-sensitive UX (chat and recipes).
- Migration-based changes reduce drift and unsafe manual schema edits.

## Architectural Strengths

- Simple relational core with clear ownership boundaries.
- JSONB for recipe ingredients balances structure with AI-era flexibility.
- Chat/session schema supports long-running conversational context.
- Clean split between persistence concerns (database), schema evolution (Alembic), and access logic (SQLAlchemy in backend).
