# ProfPilot

ProfPilot is an AI-assisted professor workflow platform. The MVP foundation provides a
Next.js frontend, FastAPI backend, PostgreSQL database, Docker Compose setup, shared
role types, and seed data for professor/student flows.

## Monorepo Structure

```text
apps/
  api/      FastAPI backend
  web/      Next.js frontend
packages/
  shared/   Shared TypeScript role and API types
infra/
  postgres/ PostgreSQL initialization files
docs/
  product-brief.md
```

## Run With Docker

```bash
cp .env.example .env
docker compose up --build
```

If a local port is already in use, override it in `.env`:

```bash
WEB_PORT=3001
API_PORT=8001
POSTGRES_PORT=5433
```

Services:

- Web: http://localhost:3000
- API: http://localhost:8000
- API health: http://localhost:8000/health
- PostgreSQL: localhost:5432

Inside Docker, the web server uses `API_INTERNAL_BASE_URL=http://api:8000` for
server-side API calls.

## Seed Users

The API creates the base tables and seed users on startup.

Professor:

- `professor@profpilot.local`
- Professor Kim

Students:

- `s2026001@profpilot.local`
- Student Lee
- student id `2026001`

- `s2026002@profpilot.local`
- Student Park
- student id `2026002`

## Foundation Scope

Included:

- Common app shell and routes
- Professor/student role model
- Shared API client
- FastAPI health and user endpoints
- PostgreSQL connection
- Startup seed data
- Docker Compose for web, API, and database

Not included yet:

- Full exam module
- Consultation module
- Graduation project module
- Real authentication
- AI provider integration
- Live USB implementation
