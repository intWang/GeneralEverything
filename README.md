# GeneralEveryThing

## Prerequisites

- Docker and Docker Compose installed
- pnpm installed
- Python 3.12 or newer

## Local setup

### Bootstrap

1. `docker compose -f infra/docker-compose.yml up -d`
2. `cd apps/api && python -m venv .venv && source .venv/bin/activate && pip install -e .`
3. `cd apps/web && pnpm install`

The API package includes a minimal `setup.py` shim so editable installs work on older pip/setuptools toolchains without any extra bootstrap step.

### Future dev commands

These become usable after the app skeleton lands in the next task.

4. `pnpm dev:web`
5. `pnpm dev:api`

## Verification

### API

```bash
cd apps/api
source .venv/bin/activate
pytest
```

### Web

```bash
pnpm lint:web
pnpm test:web
```

## CI

GitHub Actions runs these checks automatically in `.github/workflows/ci.yml`:

- API tests on Python 3.12
- Web lint on Node 20 + pnpm 10
- Web Vitest test suite on Node 20 + pnpm 10
