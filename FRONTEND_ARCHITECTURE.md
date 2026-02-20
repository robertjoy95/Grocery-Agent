# Frontend Architecture Overview

## Purpose and Responsibilities

The frontend is a mobile-first React single-page application (SPA) built with Vite. It handles user authentication, renders core product workflows (chat, recipes, pantry), and communicates with the backend through REST APIs and JWT bearer authentication.

Primary responsibilities:

- Provide a fast, responsive mobile-first UI.
- Manage authentication state and token lifecycle.
- Render streaming AI responses in the chat interface.
- Support recipe browsing, sorting, and ingredient filtering.
- Support household pantry management.

## Runtime Stack

- **Framework/UI:** React
- **Build Tool:** Vite
- **Routing/App Shell:** SPA pattern
- **API Integration:** Fetch/Axios-style client with JWT injection
- **Styling:** Lightweight CSS approach (global CSS + component styles)
- **Hosting:** GitHub Pages (static deploy)

## Frontend Module Layout

Frontend root: `frontend/src/`

- `main.jsx` - App bootstrap.
- `App.jsx` - Global app composition and route wiring.
- `api/client.js` - API client wrapper with auth header behavior.
- `context/AuthContext.jsx` - Auth state, token persistence, and auth actions.
- `pages/`
  - `Login.jsx`
  - `Signup.jsx`
  - `Chat.jsx`
  - `Recipes.jsx`
  - `Pantry.jsx`
- `components/`
  - `ChatMessage.jsx`
  - `NavBar.jsx`
  - `ProtectedRoute.jsx`
- `styles/global.css` - Global styles and layout constraints.

## UX and Navigation Model

The app is organized around three primary authenticated tabs:

- **Chat**
- **Recipes**
- **Pantry**

A bottom navigation bar supports thumb-friendly mobile use. Auth pages are intentionally minimal and centered for quick onboarding.

## Authentication Architecture

### Auth State

`AuthContext` typically owns:

- Current user/session state.
- JWT token storage and retrieval.
- Login/signup/logout actions.
- Derived auth status for route gating.

### Protected Routes

`ProtectedRoute` ensures all non-auth pages require a valid JWT context. When unauthenticated, users are redirected to login/signup views.

### API Token Propagation

`api/client.js` centralizes API calls and appends:

- `Authorization: Bearer <token>`

to protected requests, reducing repeated per-page networking logic.

## Core Page Architectures

### Chat Page (`pages/Chat.jsx`)

- Full-screen message layout with input anchored to bottom.
- Token streaming updates assistant output incrementally.
- Session controls allow switching or starting conversations.
- Message list scroll behavior mimics messaging apps.

### Streaming Mechanics

- Uses `fetch` + `ReadableStream` to consume SSE from `/chat/send`.
- Parses chunked `data:` events containing token payloads.
- Appends tokens live to the active assistant message buffer.
- Final `done` event marks completion and closes stream handling.

### Recipes Page (`pages/Recipes.jsx`)

- Shows saved recipes in card/list format.
- Expands cards to reveal full fields (ingredients, prep, instructions, source).
- Supports sorting controls (name, prep time, created date, source).
- Supports ingredient text search mapped to backend query params.

### Pantry Page (`pages/Pantry.jsx`)

- Displays current household ingredients.
- Supports add/remove item operations.
- Keeps inventory simple and fast to update from mobile devices.

## Styling and Mobile-First Strategy

The UI is optimized for phone-sized devices first, then scales upward.

Key layout patterns:

- Constrained content width:
  - `max-width: 480px`
  - centered with `margin: auto`
- Responsive typography for readability across device sizes.
- Lightweight style primitives to avoid large CSS framework overhead.

## API Integration Contract

Frontend environment and networking assumptions:

- `VITE_API_URL` defines backend API base URL at build time.
- All domain operations use REST endpoints.
- Auth routes are public; all others require JWT.
- Chat endpoint is long-lived and streaming-capable.

## Build and Deployment

### Build

- Vite compiles static assets for production.
- API base URL is injected using `VITE_API_URL`.

### Deploy (GitHub Pages)

- GitHub Actions builds and deploys output to `gh-pages`.
- Vite `base` is configured for repository page path (`/Grocery-Agent/`).
- Deployment artifact is fully static and CDN-friendly.

## Local Development

Via Docker Compose (`orchestration/docker-compose.yml`):

- Frontend container exposes port `5173`.
- Source mount enables hot module reload (HMR) during development.
- Frontend calls backend container endpoint via configured `VITE_API_URL`.

## Cross-Module Interactions

- **Frontend -> Backend:** REST calls with JWT bearer auth.
- **Frontend <- Backend (chat):** SSE stream for token-by-token rendering.
- **Frontend behavior:** reflects backend user data boundaries and DB-backed state.

## Architectural Strengths

- Clear separation between auth, API client, pages, and UI components.
- Mobile-first UX aligned with frequent on-the-go grocery interactions.
- Streaming chat experience improves perceived speed and engagement.
- Static hosting model keeps frontend infrastructure simple and low-cost.
