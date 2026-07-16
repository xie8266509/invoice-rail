# Invoice Rail operations runbook

## Release gates

Every release must pass:

```bash
pnpm check
pnpm verify:assets
```

For a release that changes settlement logic, also verify a known transaction directly:

```bash
pnpm verify:invoice -- \
  IR-260715-8747A0EB3759 \
  0xe118311A862aAf12e70390385B349c9eCeF75b06 \
  0.01 \
  USDC \
  0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1
```

## Database migrations

Schema changes are ordered in `src/lib/server/migrations.ts`. Each applied migration is recorded with its version, name, SHA-256 checksum, and timestamp in `schema_migrations`.

Rules:

1. Never edit an applied migration. Add the next consecutive version.
2. Keep migrations backward-compatible with the previous application release whenever possible.
3. DDL and its version record run in one database transaction.
4. A row lock prevents two application requests from applying the same migration concurrently.
5. Checksum drift and databases newer than the application fail closed.

The web process applies pending migrations before serving its first database-backed request. `/api/health` reports the active schema version.

## Migration rehearsal and rollback

Before a production schema release:

1. Create a managed PostgreSQL backup or provider snapshot.
2. Restore the backup to a temporary database.
3. Start the new application against the temporary database.
4. Confirm `/api/health` returns the expected `schemaVersion` and `pnpm ops:check` exits successfully.
5. Exercise login, invoice creation, payment lookup, export, and webhook dispatch.
6. Deploy the same immutable image to production.

If migration execution fails, PostgreSQL rolls back the migration transaction and the application returns unavailable rather than serving a partial schema. Roll the application image back to the previous release and inspect the structured `health.failed` event. Restore the database backup only when a migration made an intentionally destructive change; the current migrations are additive and do not require destructive rollback.

## Health, metrics, and alerts

- `GET /api/health` is the public readiness endpoint. Critical operational alerts return HTTP `503`.
- `GET /api/metrics` returns schema, invoice, webhook, rate-limit, cursor, and worker-heartbeat data. In production it requires `Authorization: Bearer $METRICS_SECRET`.
- `pnpm ops:check` reads the protected endpoint and exits nonzero for critical alerts. Set `FAIL_ON_WARNING=true` to make warnings fail the check.

Alert rules:

| Signal | Warning | Critical |
| --- | --- | --- |
| Indexer heartbeat | older than `INDEXER_STALE_AFTER_MS` | older than 4× threshold or latest run failed |
| Webhook failures | 1–9 failed deliveries | 10 or more |
| Webhook backlog | more than 50 pending | more than 200 |
| Database metrics latency | over 1 second | over 5 seconds |
| Schema | — | pending migration |

Configure the hosting provider to notify the project owner when `/api/health` remains unavailable or an operations check exits nonzero. Keep `METRICS_SECRET` distinct from `INDEXER_SECRET`.

## Incident response

### Indexer stalled or failed

1. Read the latest `indexer.failed` or `worker.cycle.failed` structured event.
2. Run `pnpm verify:assets` to distinguish RPC/provider failure from application failure.
3. Confirm the persisted `nextBlock` and heartbeat through `pnpm ops:check`.
4. Restart only the worker. The persisted cursor resumes without scanning from genesis.
5. Confirm a later heartbeat is healthy and `/api/health` clears the alert.

### RPC rate limit

1. Confirm the error is a provider `429` or request-limit response.
2. Run `NEXT_PUBLIC_ARC_RPC_URL=http://127.0.0.1:1 pnpm verify:assets` to prove fallback operation.
3. Move a healthy provider to the first configured position only after verifying it.
4. Do not change wallet RPC settings automatically; give the payer an explicit network remediation step.

### Webhook backlog

1. Inspect pending and failed counts through `/api/metrics`.
2. Confirm the destination endpoint and its TLS certificate are healthy.
3. Leave pending events in the signed outbox; retries are idempotent per endpoint, event type, and invoice.
4. Do not manually mark a delivery complete without destination evidence.

### Database unavailable

1. Check the managed database status and connection limit.
2. Verify `DATABASE_URL` and `DATABASE_POOL_SIZE` without printing credentials.
3. Restore connectivity, then confirm schema checksum validation and `/api/health`.
4. If corruption or a destructive migration is suspected, stop writes and restore the most recent verified backup.
