import "server-only";

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const schema = `
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
`;
const SCHEMA_VERSION = 3;

export type Database = {
  query<Row extends object>(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
  exec(text: string): Promise<void>;
  transaction<Result>(callback: (transaction: Database) => Promise<Result>): Promise<Result>;
};

type DatabaseGlobal = typeof globalThis & {
  invoiceRailDatabase?: Database;
  invoiceRailDatabaseInitializing?: Promise<Database>;
  invoiceRailSchemaVersion?: number;
  invoiceRailPostgresPool?: Pool;
};

const databaseGlobal = globalThis as DatabaseGlobal;

type PGliteQueryable = Pick<PGlite, "query" | "exec" | "transaction">;

function wrapPGlite(database: PGliteQueryable): Database {
  const wrapper: Database = {
    async query<Row extends object>(text: string, params: unknown[] = []) {
      const result = await database.query<Row>(text, params);
      return { rows: result.rows };
    },
    async exec(text: string) {
      await database.exec(text);
    },
    async transaction<Result>(callback: (transaction: Database) => Promise<Result>) {
      return database.transaction(async (transaction) =>
        callback(wrapPGlite(transaction as unknown as PGliteQueryable)),
      );
    },
  };
  return wrapper;
}

function wrapPostgres(pool: Pool, client?: PoolClient): Database {
  const queryable = client ?? pool;
  const wrapper: Database = {
    async query<Row extends object>(text: string, params: unknown[] = []) {
      const result = await queryable.query<Row & QueryResultRow>(text, params);
      return { rows: result.rows };
    },
    async exec(text: string) {
      await queryable.query(text);
    },
    async transaction<Result>(callback: (transaction: Database) => Promise<Result>) {
      if (client) return callback(wrapper);
      const transactionClient = await pool.connect();
      try {
        await transactionClient.query("BEGIN");
        const result = await callback(wrapPostgres(pool, transactionClient));
        await transactionClient.query("COMMIT");
        return result;
      } catch (error) {
        await transactionClient.query("ROLLBACK");
        throw error;
      } finally {
        transactionClient.release();
      }
    },
  };
  return wrapper;
}

async function createDatabase(): Promise<Database> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const poolSize = Number(process.env.DATABASE_POOL_SIZE ?? "10");
    if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > 50) {
      throw new Error("DATABASE_POOL_SIZE must be an integer between 1 and 50.");
    }
    const pool = new Pool({
      connectionString: databaseUrl,
      max: poolSize,
      ssl: process.env.DATABASE_SSL === "disable" ? false : undefined,
    });
    databaseGlobal.invoiceRailPostgresPool = pool;
    return wrapPostgres(pool);
  }

  const dataDir = process.env.INVOICE_RAIL_DB_DIR ?? "./.data/invoice-rail";
  if (!dataDir.includes("://")) {
    await mkdir(dirname(resolve(/* turbopackIgnore: true */ dataDir)), {
      recursive: true,
    });
  }
  return wrapPGlite(new PGlite(dataDir));
}

export async function getDatabase(): Promise<Database> {
  if (
    databaseGlobal.invoiceRailDatabase &&
    databaseGlobal.invoiceRailSchemaVersion === SCHEMA_VERSION
  ) {
    return databaseGlobal.invoiceRailDatabase;
  }

  if (!databaseGlobal.invoiceRailDatabaseInitializing) {
    const databasePromise = databaseGlobal.invoiceRailDatabase
      ? Promise.resolve(databaseGlobal.invoiceRailDatabase)
      : createDatabase();
    databaseGlobal.invoiceRailDatabaseInitializing = databasePromise.then(async (database) => {
      await database.exec(schema);
      databaseGlobal.invoiceRailDatabase = database;
      databaseGlobal.invoiceRailSchemaVersion = SCHEMA_VERSION;
      databaseGlobal.invoiceRailDatabaseInitializing = undefined;
      return database;
    }).catch((error) => {
      databaseGlobal.invoiceRailDatabaseInitializing = undefined;
      throw error;
    });
  }
  return databaseGlobal.invoiceRailDatabaseInitializing;
}
