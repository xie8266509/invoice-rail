import { createHash } from "node:crypto";
import type { Database } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/database";

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  limit: number;
  remaining: number;
  resetAt: string;
};

export const RATE_LIMITS = {
  authChallenge: { name: "auth_challenge", limit: 10, windowMs: 60_000 },
  authVerify: { name: "auth_verify", limit: 10, windowMs: 60_000 },
  sessionWrite: { name: "session_write", limit: 20, windowMs: 60_000 },
  invoiceWrite: { name: "invoice_write", limit: 30, windowMs: 60_000 },
  teamWrite: { name: "team_write", limit: 20, windowMs: 60_000 },
  webhookWrite: { name: "webhook_write", limit: 20, windowMs: 60_000 },
  publicPaymentRead: { name: "payment_read", limit: 120, windowMs: 60_000 },
  indexer: { name: "indexer", limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

export class RateLimitError extends Error {
  readonly result: RateLimitResult;

  constructor(result: RateLimitResult) {
    super("Too many requests. Please retry shortly.");
    this.name = "RateLimitError";
    this.result = result;
  }
}

function validatePolicy(policy: RateLimitPolicy): void {
  if (!/^[a-z0-9_]+$/.test(policy.name)) throw new Error("Rate limit name is invalid.");
  if (!Number.isInteger(policy.limit) || policy.limit < 1 || policy.limit > 100_000) {
    throw new Error("Rate limit must be an integer between 1 and 100000.");
  }
  if (!Number.isInteger(policy.windowMs) || policy.windowMs < 1_000) {
    throw new Error("Rate limit window must be at least one second.");
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  ).slice(0, 128);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const retryAfter = Math.max(
    1,
    Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000),
  );
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": result.resetAt,
    "Retry-After": String(retryAfter),
  };
}

export function createRateLimitResponse(error: RateLimitError): Response {
  return Response.json(
    { error: error.message, retryAt: error.result.resetAt },
    {
      status: 429,
      headers: rateLimitHeaders(error.result),
    },
  );
}

export async function consumeRateLimit(
  database: Database,
  policy: RateLimitPolicy,
  identity: string,
  now = new Date(),
): Promise<RateLimitResult> {
  validatePolicy(policy);
  const nowMs = now.getTime();
  const windowStart = Math.floor(nowMs / policy.windowMs) * policy.windowMs;
  const resetAt = new Date(windowStart + policy.windowMs);
  const bucketKey = digest(`${policy.name}:${identity}`);
  const expiresAt = new Date(windowStart + policy.windowMs * 2).toISOString();
  const timestamp = now.toISOString();

  await database.query("DELETE FROM rate_limit_buckets WHERE expires_at < $1", [timestamp]);
  const result = await database.query<{ request_count: number | string }>(
    `INSERT INTO rate_limit_buckets (
       bucket_key, window_start, request_count, expires_at, updated_at
     ) VALUES ($1, $2, 1, $3, $4)
     ON CONFLICT (bucket_key, window_start) DO UPDATE SET
       request_count = rate_limit_buckets.request_count + 1,
       expires_at = EXCLUDED.expires_at,
       updated_at = EXCLUDED.updated_at
     WHERE rate_limit_buckets.request_count < $5
     RETURNING request_count`,
    [bucketKey, String(windowStart), expiresAt, timestamp, policy.limit],
  );
  const count = result.rows[0] ? Number(result.rows[0].request_count) : policy.limit;
  const response = {
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    resetAt: resetAt.toISOString(),
  };
  if (result.rows.length === 0) throw new RateLimitError(response);
  return response;
}

export async function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  subject?: string,
): Promise<RateLimitResult> {
  const identity = subject
    ? `${clientIdentifier(request)}:${subject.slice(0, 256)}`
    : clientIdentifier(request);
  return consumeRateLimit(await getDatabase(), policy, identity);
}
