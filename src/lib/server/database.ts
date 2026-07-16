import "server-only";

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import {
  LATEST_SCHEMA_VERSION,
  runMigrations,
} from "@/lib/server/migrations";

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
    databaseGlobal.invoiceRailSchemaVersion === LATEST_SCHEMA_VERSION
  ) {
    return databaseGlobal.invoiceRailDatabase;
  }

  if (!databaseGlobal.invoiceRailDatabaseInitializing) {
    const databasePromise = databaseGlobal.invoiceRailDatabase
      ? Promise.resolve(databaseGlobal.invoiceRailDatabase)
      : createDatabase();
    databaseGlobal.invoiceRailDatabaseInitializing = databasePromise.then(async (database) => {
      const migrationStatus = await runMigrations(database);
      databaseGlobal.invoiceRailDatabase = database;
      databaseGlobal.invoiceRailSchemaVersion = migrationStatus.currentVersion;
      databaseGlobal.invoiceRailDatabaseInitializing = undefined;
      return database;
    }).catch((error) => {
      databaseGlobal.invoiceRailDatabaseInitializing = undefined;
      throw error;
    });
  }
  return databaseGlobal.invoiceRailDatabaseInitializing;
}
