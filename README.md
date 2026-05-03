# GeneralEveryThing

## Local setup

1. `docker compose -f infra/docker-compose.yml up -d`
2. `cd apps/api && python -m venv .venv && source .venv/bin/activate && pip install -e .`
3. `cd apps/web && pnpm install`
4. `pnpm dev:web`
5. `pnpm dev:api`
