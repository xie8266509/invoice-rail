import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/server/database";
import { runMigrations } from "@/lib/server/migrations";
import {
  consumeRateLimit,
  RateLimitError,
  type RateLimitPolicy,
} from "@/lib/server/rate-limit";

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

async function createDatabase(): Promise<Database> {
  const database = new PGlite();
  databases.push(database);
  const wrapped = wrap(database);
  await runMigrations(wrapped);
  return wrapped;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()));
});

describe("distributed rate limits", () => {
  const policy: RateLimitPolicy = { name: "test_write", limit: 2, windowMs: 60_000 };

  it("allows requests through the configured limit", async () => {
    const database = await createDatabase();
    const now = new Date("2026-07-15T20:00:00.000Z");

    expect((await consumeRateLimit(database, policy, "client-a", now)).remaining).toBe(1);
    expect((await consumeRateLimit(database, policy, "client-a", now)).remaining).toBe(0);
    await expect(consumeRateLimit(database, policy, "client-a", now)).rejects.toBeInstanceOf(
      RateLimitError,
    );
  });

  it("isolates identities and resets at the next window", async () => {
    const database = await createDatabase();
    const firstWindow = new Date("2026-07-15T20:00:00.000Z");
    await consumeRateLimit(database, policy, "client-a", firstWindow);
    await consumeRateLimit(database, policy, "client-a", firstWindow);

    expect(
      (await consumeRateLimit(database, policy, "client-b", firstWindow)).remaining,
    ).toBe(1);
    expect(
      (await consumeRateLimit(
        database,
        policy,
        "client-a",
        new Date("2026-07-15T20:01:00.000Z"),
      )).remaining,
    ).toBe(1);
  });

  it("stores only hashed client identifiers", async () => {
    const database = await createDatabase();
    await consumeRateLimit(
      database,
      policy,
      "203.0.113.9:wallet-address",
      new Date("2026-07-15T20:00:00.000Z"),
    );
    const result = await database.query<{ bucket_key: string }>(
      "SELECT bucket_key FROM rate_limit_buckets",
    );

    expect(result.rows[0].bucket_key).toMatch(/^[a-f0-9]{64}$/);
    expect(result.rows[0].bucket_key).not.toContain("203.0.113.9");
  });
});
