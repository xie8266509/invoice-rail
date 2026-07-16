import { NextResponse } from "next/server";
import { getAddress, isAddress, isHex } from "viem";
import {
  hasValidRequestOrigin,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyAuthChallenge,
} from "@/lib/server/auth";
import { logEvent, requestId, requestLogData, withRequestId } from "@/lib/server/observability";
import {
  createRateLimitResponse,
  enforceRateLimit,
  RATE_LIMITS,
  RateLimitError,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const id = requestId(request);
  if (!hasValidRequestOrigin(request)) {
    return withRequestId(
      NextResponse.json({ error: "Invalid request origin." }, { status: 403 }),
      id,
    );
  }
  try {
    await enforceRateLimit(request, RATE_LIMITS.authVerify);
    const body = await request.json() as Record<string, unknown>;
    if (
      typeof body.challengeId !== "string" ||
      body.challengeId.length < 32 ||
      typeof body.address !== "string" ||
      !isAddress(body.address) ||
      typeof body.signature !== "string" ||
      !isHex(body.signature)
    ) {
      return withRequestId(
        NextResponse.json({ error: "The signature response is invalid." }, { status: 400 }),
        id,
      );
    }
    const session = await verifyAuthChallenge({
      challengeId: body.challengeId,
      address: getAddress(body.address),
      signature: body.signature,
    });
    const response = NextResponse.json({ address: session.address, expiresAt: session.expiresAt });
    response.cookies.set(SESSION_COOKIE_NAME, session.sessionToken, sessionCookieOptions());
    logEvent("info", "auth.session.created", requestLogData(request, id));
    return withRequestId(response, id);
  } catch (error) {
    if (error instanceof RateLimitError) {
      logEvent("warn", "auth.verify.rate_limited", requestLogData(request, id));
      return withRequestId(createRateLimitResponse(error), id);
    }
    const reason = error instanceof Error ? error.message : "Wallet verification failed.";
    logEvent("warn", "auth.verify.failed", { ...requestLogData(request, id), error });
    return withRequestId(NextResponse.json({ error: reason }, { status: 401 }), id);
  }
}
