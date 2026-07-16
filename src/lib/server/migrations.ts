import { createHash } from "node:crypto";
import type { Database } from "@/lib/server/database";

export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "core_invoices_and_payments",
    sql: `
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        share_id TEXT UNIQUE NOT NULL,
        merchant_address TEXT NOT NULL,
        merchant_name TEXT NOT NULL,
        recipient TEXT NOT NULL,
        amount TEXT NOT NULL,
        token TEXT NOT NULL CHECK (token IN ('USDC', 'EURC')),
        memo TEXT NOT NULL,
        due_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_block BIGINT,
        status TEXT NOT NULL CHECK (status IN ('open', 'processing', 'paid', 'expired')),
        tx_hash TEXT,
        paid_at TEXT,
        memo_id TEXT UNIQUE NOT NULL,
        call_data_hash TEXT NOT NULL,
        token_address TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS invoices_merchant_address_idx
        ON invoices (LOWER(merchant_address), created_at DESC);
      CREATE INDEX IF NOT EXISTS invoices_status_created_block_idx
        ON invoices (status, created_block);

      CREATE TABLE IF NOT EXISTS payments (
        transaction_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        invoice_id TEXT NOT NULL REFERENCES invoices(id),
        payer TEXT NOT NULL,
        block_number BIGINT NOT NULL,
        paid_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (transaction_hash, log_index)
      );

      CREATE TABLE IF NOT EXISTS indexer_cursors (
        name TEXT PRIMARY KEY,
        next_block BIGINT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: "wallet_auth_and_workspaces",
    sql: `
      CREATE TABLE IF NOT EXISTS auth_challenges (
        id_hash TEXT PRIMARY KEY,
        address TEXT NOT NULL,
        message TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS auth_challenges_address_idx
        ON auth_challenges (LOWER(address), created_at DESC);

      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        merchant_address TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx
        ON auth_sessions (expires_at);

      CREATE TABLE IF NOT EXISTS team_members (
        workspace_address TEXT NOT NULL,
        member_address TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
        invited_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (workspace_address, member_address)
      );

      CREATE INDEX IF NOT EXISTS team_members_member_idx
        ON team_members (LOWER(member_address), created_at DESC);
    `,
  },
  {
    version: 3,
    name: "signed_webhook_outbox",
    sql: `
      CREATE TABLE IF NOT EXISTS webhook_endpoints (
        id TEXT PRIMARY KEY,
        merchant_address TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (merchant_address, url)
      );

      CREATE INDEX IF NOT EXISTS webhook_endpoints_merchant_idx
        ON webhook_endpoints (LOWER(merchant_address), active);

      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY,
        endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        invoice_id TEXT NOT NULL REFERENCES invoices(id),
        payload TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL,
        last_error TEXT,
        created_at TEXT NOT NULL,
        delivered_at TEXT,
        UNIQUE (endpoint_id, event_type, invoice_id)
      );

      CREATE INDEX IF NOT EXISTS webhook_deliveries_pending_idx
        ON webhook_deliveries (status, next_attempt_at);
    `,
  },
  {
    version: 4,
    name: "operational_controls",
    sql: `
      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        bucket_key TEXT NOT NULL,
        window_start BIGINT NOT NULL,
        request_count INTEGER NOT NULL CHECK (request_count >= 0),
        expires_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (bucket_key, window_start)
      );

      CREATE INDEX IF NOT EXISTS rate_limit_buckets_expiry_idx
        ON rate_limit_buckets (expires_at);

      CREATE TABLE IF NOT EXISTS service_heartbeats (
        name TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
        observed_at TEXT NOT NULL,
        details TEXT NOT NULL
      );
    `,
  },
] as const;

export const LATEST_SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 0;

type MigrationRow = {
  version: number | string;
  name: string;
  checksum: string;
  applied_at: string;
};

export type MigrationStatus = {
  currentVersion: number;
  latestVersion: number;
  pending: number;
  applied: Array<{
    version: number;
    name: string;
    checksum: string;
    appliedAt: string;
  }>;
};

function checksum(migration: Migration): string {
  return createHash("sha256").update(migration.sql.trim()).digest("hex");
}

function validateMigrations(migrations: readonly Migration[]): void {
  let previous = 0;
  const names = new Set<string>();
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version !== previous + 1) {
      throw new Error("Database migrations must use consecutive integer versions starting at 1.");
    }
    if (!/^[a-z0-9_]+$/.test(migration.name) || names.has(migration.name)) {
      throw new Error(`Database migration name is invalid or duplicated: ${migration.name}`);
    }
    if (!migration.sql.trim()) throw new Error(`Database migration ${migration.version} is empty.`);
    previous = migration.version;
    names.add(migration.name);
  }
}

async function ensureMigrationTables(database: Database): Promise<void> {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_migration_lock (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      updated_at TEXT NOT NULL
    );

    INSERT INTO schema_migration_lock (id, updated_at)
    VALUES (1, CURRENT_TIMESTAMP::TEXT)
    ON CONFLICT (id) DO NOTHING;
  `);
}

function mapRows(rows: MigrationRow[]): MigrationStatus["applied"] {
  return rows.map((row) => ({
    version: Number(row.version),
    name: row.name,
    checksum: row.checksum,
    appliedAt: row.applied_at,
  }));
}

function assertAppliedMigrations(
  applied: MigrationStatus["applied"],
  migrations: readonly Migration[],
): void {
  for (const row of applied) {
    const migration = migrations.find((candidate) => candidate.version === row.version);
    if (!migration) {
      throw new Error(
        `Database schema version ${row.version} is newer than this application supports.`,
      );
    }
    if (migration.name !== row.name || checksum(migration) !== row.checksum) {
      throw new Error(
        `Database migration ${row.version} (${row.name}) does not match the application checksum.`,
      );
    }
  }
}

export async function getMigrationStatus(
  database: Database,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<MigrationStatus> {
  validateMigrations(migrations);
  await ensureMigrationTables(database);
  const result = await database.query<MigrationRow>(
    "SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC",
  );
  const applied = mapRows(result.rows);
  assertAppliedMigrations(applied, migrations);
  const currentVersion = applied.at(-1)?.version ?? 0;
  const latestVersion = migrations.at(-1)?.version ?? 0;
  return {
    currentVersion,
    latestVersion,
    pending: migrations.filter((migration) => migration.version > currentVersion).length,
    applied,
  };
}

export async function runMigrations(
  database: Database,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<MigrationStatus> {
  validateMigrations(migrations);
  await ensureMigrationTables(database);

  await database.transaction(async (transaction) => {
    await transaction.query(
      "SELECT id FROM schema_migration_lock WHERE id = 1 FOR UPDATE",
    );
    const result = await transaction.query<MigrationRow>(
      "SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC",
    );
    const applied = mapRows(result.rows);
    assertAppliedMigrations(applied, migrations);
    const appliedVersions = new Set(applied.map((migration) => migration.version));

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;
      await transaction.exec(migration.sql);
      await transaction.query(
        `INSERT INTO schema_migrations (version, name, checksum, applied_at)
         VALUES ($1, $2, $3, $4)`,
        [migration.version, migration.name, checksum(migration), new Date().toISOString()],
      );
    }

    await transaction.query(
      "UPDATE schema_migration_lock SET updated_at = $1 WHERE id = 1",
      [new Date().toISOString()],
    );
  });

  return getMigrationStatus(database, migrations);
}
