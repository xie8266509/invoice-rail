import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getAddress, verifyMessage, type Address, type Hex } from "viem";
import { ARC_CHAIN_ID } from "@/lib/constants";
import { getDatabase } from "@/lib/server/database";

export const SESSION_COOKIE_NAME = "invoice_rail_session";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

type ChallengeRow = {
  address: string;
  message: string;
  expires_at: string;
  consumed_at: string | null;
};

type SessionRow = {
  merchant_address: string;
  expires_at: string;
};

export class AuthenticationError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function token(): string {
  return randomBytes(32).toString("base64url");
}

function requestOrigin(request: Request): string {
  return (process.env.APP_ORIGIN ?? new URL(request.url).origin).replace(/\/$/, "");
}

export function hasValidRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin.replace(/\/$/, "") === requestOrigin(request));
}

function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.headers.get("cookie");
  if (!cookies) return undefined;
  for (const part of cookies.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function createAuthChallenge(address: Address, request: Request): Promise<{
  challengeId: string;
  message: string;
  expiresAt: string;
}> {
  const db = await getDatabase();
  const challengeId = token();
  const nonce = randomBytes(12).toString("hex");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS).toISOString();
  const origin = requestOrigin(request);
  const host = new URL(origin).host;
  const normalizedAddress = getAddress(address);
  const message = `${host} wants you to sign in to Invoice Rail with your Ethereum account:\n${normalizedAddress}\n\nAuthorize access to your merchant invoices. This request does not send a transaction.\n\nURI: ${origin}\nVersion: 1\nChain ID: ${ARC_CHAIN_ID}\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt}`;

  await db.transaction(async (transaction) => {
    const now = issuedAt.toISOString();
    await transaction.query("DELETE FROM auth_challenges WHERE expires_at < $1", [now]);
    await transaction.query("DELETE FROM auth_sessions WHERE expires_at < $1", [now]);
    await transaction.query(
      "DELETE FROM auth_challenges WHERE LOWER(address) = LOWER($1) AND consumed_at IS NULL",
      [normalizedAddress],
    );
    await transaction.query(
      `INSERT INTO auth_challenges (
        id_hash, address, message, expires_at, consumed_at, created_at
      ) VALUES ($1, $2, $3, $4, NULL, $5)`,
      [digest(challengeId), normalizedAddress, message, expiresAt, now],
    );
  });

  return { challengeId, message, expiresAt };
}

export async function verifyAuthChallenge(input: {
  challengeId: string;
  address: Address;
  signature: Hex;
}): Promise<{ sessionToken: string; address: Address; expiresAt: string }> {
  const db = await getDatabase();
  const address = getAddress(input.address);
  const result = await db.query<ChallengeRow>(
    `SELECT address, message, expires_at, consumed_at
     FROM auth_challenges
     WHERE id_hash = $1 AND LOWER(address) = LOWER($2)
     LIMIT 1`,
    [digest(input.challengeId), address],
  );
  const challenge = result.rows[0];
  const now = new Date();
  if (
    !challenge ||
    challenge.consumed_at ||
    new Date(challenge.expires_at).getTime() <= now.getTime()
  ) {
    throw new AuthenticationError("The sign-in request is invalid or expired.");
  }

  const valid = await verifyMessage({
    address,
    message: challenge.message,
    signature: input.signature,
  });
  if (!valid) throw new AuthenticationError("The wallet signature is invalid.");

  const sessionToken = token();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db.transaction(async (transaction) => {
    const consumed = await transaction.query<{ id_hash: string }>(
      `UPDATE auth_challenges
       SET consumed_at = $1
       WHERE id_hash = $2 AND consumed_at IS NULL AND expires_at > $1
       RETURNING id_hash`,
      [now.toISOString(), digest(input.challengeId)],
    );
    if (consumed.rows.length !== 1) {
      throw new AuthenticationError("The sign-in request was already used.");
    }
    await transaction.query(
      `INSERT INTO auth_sessions (
        token_hash, merchant_address, expires_at, created_at, last_seen_at
      ) VALUES ($1, $2, $3, $4, $4)`,
      [digest(sessionToken), address, expiresAt, now.toISOString()],
    );
  });

  return { sessionToken, address, expiresAt };
}

export async function getAuthenticatedMerchant(request: Request): Promise<Address | null> {
  const sessionToken = readCookie(request, SESSION_COOKIE_NAME);
  if (!sessionToken) return null;
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.query<SessionRow>(
    `SELECT merchant_address, expires_at
     FROM auth_sessions
     WHERE token_hash = $1 AND expires_at > $2
     LIMIT 1`,
    [digest(sessionToken), now],
  );
  const session = result.rows[0];
  if (!session) return null;
  await db.query(
    "UPDATE auth_sessions SET last_seen_at = $1 WHERE token_hash = $2",
    [now, digest(sessionToken)],
  );
  return getAddress(session.merchant_address);
}

export async function requireAuthenticatedMerchant(request: Request): Promise<Address> {
  const address = await getAuthenticatedMerchant(request);
  if (!address) throw new AuthenticationError();
  return address;
}

export async function revokeCurrentSession(request: Request): Promise<void> {
  const sessionToken = readCookie(request, SESSION_COOKIE_NAME);
  if (!sessionToken) return;
  const db = await getDatabase();
  await db.query("DELETE FROM auth_sessions WHERE token_hash = $1", [digest(sessionToken)]);
}
