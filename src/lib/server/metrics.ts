import "server-only";

import { getDatabase, type Database } from "@/lib/server/database";
import { getMigrationStatus } from "@/lib/server/migrations";
import { sanitizeLogData, type LogData } from "@/lib/server/observability";

type CountRow = { status: string; count: number | string };
type CursorRow = { next_block: bigint | string; updated_at: string };
type HeartbeatRow = { name: string; status: "ok" | "error"; observed_at: string; details: string };

export type OperationalMetrics = {
  databaseLatencyMs: number;
  schema: { currentVersion: number; latestVersion: number; pending: number };
  invoices: Record<string, number>;
  webhooks: Record<string, number>;
  activeRateLimitBuckets: number;
  indexer: {
    nextBlock?: string;
    cursorUpdatedAt?: string;
    heartbeat?: {
      status: "ok" | "error";
      observedAt: string;
      details: LogData;
    };
  };
};

export type OperationalAlert = {
  severity: "warning" | "critical";
  code: string;
  message: string;
};

function countMap(rows: CountRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
}

function parseDetails(value: string): LogData {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? sanitizeLogData(parsed as LogData) : {};
  } catch {
    return {};
  }
}

export async function recordServiceHeartbeat(
  name: string,
  status: "ok" | "error",
  details: LogData,
  database?: Database,
): Promise<void> {
  if (!/^[a-z0-9_-]{1,64}$/.test(name)) throw new Error("Heartbeat name is invalid.");
  const db = database ?? await getDatabase();
  const observedAt = new Date().toISOString();
  const serialized = JSON.stringify(sanitizeLogData(details)).slice(0, 8_000);
  await db.query(
    `INSERT INTO service_heartbeats (name, status, observed_at, details)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE SET
       status = EXCLUDED.status,
       observed_at = EXCLUDED.observed_at,
       details = EXCLUDED.details`,
    [name, status, observedAt, serialized],
  );
}

export async function getOperationalMetrics(database?: Database): Promise<OperationalMetrics> {
  const startedAt = Date.now();
  const db = database ?? await getDatabase();
  const [schema, invoices, webhooks, rateLimits, cursor, heartbeat] = await Promise.all([
    getMigrationStatus(db),
    db.query<CountRow>("SELECT status, COUNT(*) AS count FROM invoices GROUP BY status"),
    db.query<CountRow>(
      "SELECT status, COUNT(*) AS count FROM webhook_deliveries GROUP BY status",
    ),
    db.query<{ count: number | string }>(
      "SELECT COUNT(*) AS count FROM rate_limit_buckets WHERE expires_at >= $1",
      [new Date().toISOString()],
    ),
    db.query<CursorRow>(
      "SELECT next_block, updated_at FROM indexer_cursors WHERE name = 'arc-memo' LIMIT 1",
    ),
    db.query<HeartbeatRow>(
      "SELECT name, status, observed_at, details FROM service_heartbeats WHERE name = 'indexer' LIMIT 1",
    ),
  ]);
  const cursorRow = cursor.rows[0];
  const heartbeatRow = heartbeat.rows[0];
  return {
    databaseLatencyMs: Date.now() - startedAt,
    schema: {
      currentVersion: schema.currentVersion,
      latestVersion: schema.latestVersion,
      pending: schema.pending,
    },
    invoices: countMap(invoices.rows),
    webhooks: countMap(webhooks.rows),
    activeRateLimitBuckets: Number(rateLimits.rows[0]?.count ?? 0),
    indexer: {
      nextBlock: cursorRow ? String(cursorRow.next_block) : undefined,
      cursorUpdatedAt: cursorRow?.updated_at,
      heartbeat: heartbeatRow ? {
        status: heartbeatRow.status,
        observedAt: heartbeatRow.observed_at,
        details: parseDetails(heartbeatRow.details),
      } : undefined,
    },
  };
}

export function evaluateOperationalAlerts(
  metrics: OperationalMetrics,
  now = new Date(),
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  if (metrics.schema.pending > 0) {
    alerts.push({
      severity: "critical",
      code: "schema_migration_pending",
      message: `${metrics.schema.pending} database migration(s) are pending.`,
    });
  }
  if (metrics.indexer.heartbeat?.status === "error") {
    alerts.push({
      severity: "critical",
      code: "indexer_error",
      message: "The latest indexer run failed.",
    });
  }
  if (metrics.indexer.heartbeat) {
    const staleAfter = Number(process.env.INDEXER_STALE_AFTER_MS ?? "60000");
    const age = now.getTime() - new Date(metrics.indexer.heartbeat.observedAt).getTime();
    if (Number.isFinite(staleAfter) && age > staleAfter * 4) {
      alerts.push({
        severity: "critical",
        code: "indexer_stale",
        message: `The indexer heartbeat is ${Math.round(age / 1000)} seconds old.`,
      });
    } else if (Number.isFinite(staleAfter) && age > staleAfter) {
      alerts.push({
        severity: "warning",
        code: "indexer_stale",
        message: `The indexer heartbeat is ${Math.round(age / 1000)} seconds old.`,
      });
    }
  }
  if ((metrics.webhooks.failed ?? 0) >= 10) {
    alerts.push({
      severity: "critical",
      code: "webhook_failures",
      message: `${metrics.webhooks.failed} webhook deliveries require attention.`,
    });
  } else if ((metrics.webhooks.failed ?? 0) > 0) {
    alerts.push({
      severity: "warning",
      code: "webhook_failures",
      message: `${metrics.webhooks.failed} webhook delivery or deliveries require attention.`,
    });
  }
  if ((metrics.webhooks.pending ?? 0) > 200) {
    alerts.push({
      severity: "critical",
      code: "webhook_backlog",
      message: `${metrics.webhooks.pending} webhook deliveries are pending.`,
    });
  } else if ((metrics.webhooks.pending ?? 0) > 50) {
    alerts.push({
      severity: "warning",
      code: "webhook_backlog",
      message: `${metrics.webhooks.pending} webhook deliveries are pending.`,
    });
  }
  if (metrics.databaseLatencyMs > 5_000) {
    alerts.push({
      severity: "critical",
      code: "database_latency",
      message: `Database health queries took ${metrics.databaseLatencyMs} milliseconds.`,
    });
  } else if (metrics.databaseLatencyMs > 1_000) {
    alerts.push({
      severity: "warning",
      code: "database_latency",
      message: `Database health queries took ${metrics.databaseLatencyMs} milliseconds.`,
    });
  }
  return alerts;
}
