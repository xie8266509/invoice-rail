import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { createAuthChallenge, hasValidRequestOrigin } from "@/lib/server/auth";
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
    await enforceRateLimit(request, RATE_LIMITS.authChallenge);
    const body = await request.json() as { address?: unknown };
    if (typeof body.address !== "string" || !isAddress(body.address)) {
      return withRequestId(
        NextResponse.json({ error: "A valid wallet address is required." }, { status: 400 }),
        id,
      );
    }
    const challenge = await createAuthChallenge(getAddress(body.address), request);
    logEvent("info", "auth.challenge.created", requestLogData(request, id));
    return withRequestId(NextResponse.json(challenge), id);
  } catch (error) {
    if (error instanceof RateLimitError) {
      logEvent("warn", "auth.challenge.rate_limited", requestLogData(request, id));
      return withRequestId(createRateLimitResponse(error), id);
    }
    const reason = error instanceof Error ? error.message : "Sign-in request failed.";
    logEvent("warn", "auth.challenge.failed", { ...requestLogData(request, id), error });
    return withRequestId(NextResponse.json({ error: reason }, { status: 400 }), id);
  }
}
