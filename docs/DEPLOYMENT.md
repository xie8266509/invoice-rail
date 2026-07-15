# Production deployment

Invoice Rail runs as two processes backed by one PostgreSQL database:

- `web`: the Next.js application and API, listening on port `3000`.
- `worker`: `node scripts/run-indexer.mjs`, which calls the protected background-jobs endpoint.

Both processes can use the same container image. The web process starts with `node server.js`; the worker overrides that command with `node scripts/run-indexer.mjs`.

## Required environment variables

| Variable | Process | Purpose |
| --- | --- | --- |
| `APP_ORIGIN` | web | Exact public HTTPS origin used for signed login messages and request-origin checks. |
| `DATABASE_URL` | web | PostgreSQL connection string. Production must not use the local PGlite default. |
| `INDEXER_SECRET` | web, worker | Shared high-entropy bearer secret protecting `/api/indexer`. |
| `INVOICE_RAIL_APP_URL` | worker | Internal or public base URL of the web service. |

Optional variables are documented in `.env.example`. `NEXT_PUBLIC_ARC_RPC_URL` is embedded in the browser bundle at build time, so set it as a container build argument as well as a runtime variable.
The application automatically falls back across the public dRPC, Blockdaemon, and Circle endpoints for read operations. Wallets keep their own network configuration, so an already-added Arc Testnet network may still need its RPC URL changed manually if that provider is rate-limited.

## Local production-like stack

Docker Compose starts PostgreSQL, the production Next.js bundle, and the background worker.

```bash
cp .env.docker.example .env.docker
# Replace both placeholder secrets with URL-safe random values before continuing.
docker compose --env-file .env.docker up --build
```

Verify readiness:

```bash
curl --fail http://localhost:3000/api/health
```

The health endpoint checks that the application can reach and initialize its database. It intentionally does not expose connection details.

Stop the stack without deleting PostgreSQL data:

```bash
docker compose --env-file .env.docker down
```

## Cloud service layout

Use a provider that supports a containerized web service, a continuously running worker, and managed PostgreSQL. Configure the following:

1. Build one image from `Dockerfile`.
2. Start the web service with the image default command.
3. Start the worker from the same image with `node scripts/run-indexer.mjs`.
4. Give only the web service `DATABASE_URL`; the worker reaches the database through the web API.
5. Set the web health-check path to `/api/health`.
6. Terminate TLS at the platform and set `APP_ORIGIN` to the resulting `https://` origin.
7. Keep the worker URL internal when the platform supports private service networking.

The application emits baseline `nosniff`, clickjacking, referrer, and browser-permission security headers. Add HSTS at the TLS-terminating load balancer after the final HTTPS domain is stable.

The current schema is initialized idempotently on the first database-backed request. Before multiple production releases introduce schema changes, replace this bootstrap behavior with ordered, versioned migrations.

## Render Blueprint

The repository-root `render.yaml` provisions the production topology on Render:

- `invoice-rail-web`: a Docker web service with `/api/health` readiness checks;
- `invoice-rail-worker`: the same Docker image running `node scripts/run-indexer.mjs`;
- `invoice-rail-db`: PostgreSQL 17 with public inbound access disabled.

The Blueprint uses Render service references instead of committed credentials:

- `DATABASE_URL` comes from the database's private connection string;
- `APP_ORIGIN` and `INVOICE_RAIL_APP_URL` come from the web service's `RENDER_EXTERNAL_URL`;
- Render generates `INDEXER_SECRET` once and shares it with the worker.

Both application services deploy only after the linked GitHub checks pass. The committed baseline uses Starter compute for the web and worker plus the smallest persistent paid PostgreSQL plan. Review Render's current pricing in the confirmation screen before applying the Blueprint.

To deploy, open Render's **Blueprints** page, create a Blueprint from the GitHub repository, and select the root `render.yaml`. Do not create the three resources manually in parallel with the Blueprint because matching service names can cause conflicts.

## Release verification

Run these checks before every deployment:

```bash
pnpm check
```

After deployment:

1. Confirm `/api/health` returns HTTP `200`.
2. Sign in with a fresh wallet challenge.
3. Create an invoice and open its short payment link in a private browser session.
4. Complete a small Arc Testnet payment.
5. Confirm the worker marks the invoice paid and delivers any configured webhook.
6. Restart the web instance and confirm the invoice is still present.
