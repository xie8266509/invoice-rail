import { NextResponse } from "next/server";
import {
  getAuthenticatedMerchant,
  hasValidRequestOrigin,
  revokeCurrentSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
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

export async function GET(request: Request) {
  const address = await getAuthenticatedMerchant(request);
  return NextResponse.json({ authenticated: Boolean(address), address });
}

export async function DELETE(request: Request) {
  const id = requestId(request);
  if (!hasValidRequestOrigin(request)) {
    return withRequestId(
      NextResponse.json({ error: "Invalid request origin." }, { status: 403 }),
      id,
    );
  }
  try {
    await enforceRateLimit(request, RATE_LIMITS.sessionWrite);
    await revokeCurrentSession(request);
    const response = NextResponse.json({ authenticated: false });
    response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
    logEvent("info", "auth.session.revoked", requestLogData(request, id));
    return withRequestId(response, id);
  } catch (error) {
    if (error instanceof RateLimitError) {
      logEvent("warn", "auth.session.rate_limited", requestLogData(request, id));
      return withRequestId(createRateLimitResponse(error), id);
    }
    logEvent("error", "auth.session.revoke_failed", { ...requestLogData(request, id), error });
    return withRequestId(
      NextResponse.json({ error: "Sign out failed." }, { status: 500 }),
      id,
    );
  }
}
