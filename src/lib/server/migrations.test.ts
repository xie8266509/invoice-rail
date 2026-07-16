import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/server/database";
import {
  getMigrationStatus,
  LATEST_SCHEMA_VERSION,
  MIGRATIONS,
  runMigrations,
  type Migration,
} from "@/lib/server/migrations";

const databases: PGlite[] = [];

function wrap(database: Pick<PGlite, "query" | "exec" | "transaction">): Database {
  return {
    async query<Row extends object>(text: string, params: unknown[] = []) {
      const result = await database.query<Row>(text, params);
      return { rows: result.rows };
    },
    async exec(text: string) {
      await database.exec(text);
    },
    async transaction<Result>(callback: (transaction: Database) => Promise<Result>) {
      return database.transaction(async (transaction) => callback(wrap(transaction)));
    },
  };
}

function createDatabase(): Database {
  const database = new PGlite();
  databases.push(database);
  return wrap(database);
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()));
});

describe("database migrations", () => {
  it("applies every migration in order and records checksums", async () => {
    const database = createDatabase();
    const status = await runMigrations(database);

    expect(status.currentVersion).toBe(LATEST_SCHEMA_VERSION);
    expect(status.pending).toBe(0);
    expect(status.applied.map((migration) => migration.version)).toEqual([1, 2, 3, 4]);
    expect(status.applied.every((migration) => migration.checksum.length === 64)).toBe(true);

    const tables = await database.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(expect.arrayContaining([
      "auth_sessions",
      "invoices",
      "payments",
      "schema_migrations",
      "webhook_deliveries",
    ]));
  });

  it("is idempotent", async () => {
    const database = createDatabase();
    await runMigrations(database);
    const second = await runMigrations(database);

    expect(second.applied).toHaveLength(MIGRATIONS.length);
    expect(second.pending).toBe(0);
  });

  it("adopts an existing alpha schema without deleting data", async () => {
    const database = createDatabase();
    await database.exec(`
      CREATE TABLE invoices (
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
      INSERT INTO invoices VALUES (
        'IR-ALPHA', 'share', '0x1', 'Alpha', '0x2', '0.01', 'USDC', 'memo',
        '2026-07-22', '2026-07-15T00:00:00.000Z', NULL, 'open', NULL, NULL,
        '0x3', '0x4', '0x5', '2026-07-15T00:00:00.000Z'
      );
    `);

    await runMigrations(database);
    const invoice = await database.query<{ id: string }>(
      "SELECT id FROM invoices WHERE id = 'IR-ALPHA'",
    );
    expect(invoice.rows).toEqual([{ id: "IR-ALPHA" }]);
  });

  it("rejects migration drift", async () => {
    const database = createDatabase();
    await runMigrations(database);
    await database.query(
      "UPDATE schema_migrations SET checksum = 'changed' WHERE version = 2",
    );

    await expect(getMigrationStatus(database)).rejects.toThrow("does not match");
  });

  it("rolls back a failed migration", async () => {
    const database = createDatabase();
    await runMigrations(database);
    const failing: readonly Migration[] = [
      ...MIGRATIONS,
      {
        version: 5,
        name: "failing_rehearsal",
        sql: "CREATE TABLE should_rollback (id INTEGER); SELECT missing_column FROM invoices;",
      },
    ];

    await expect(runMigrations(database, failing)).rejects.toThrow();
    const recorded = await database.query<{ count: number | string }>(
      "SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 5",
    );
    expect(Number(recorded.rows[0].count)).toBe(0);
    const table = await database.query<{ count: number | string }>(
      `SELECT COUNT(*) AS count FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'should_rollback'`,
    );
    expect(Number(table.rows[0].count)).toBe(0);
  });
});
