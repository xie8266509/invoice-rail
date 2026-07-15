import { NextResponse } from "next/server";
import { getAddress, isAddress, isHex } from "viem";
import {
  hasValidRequestOrigin,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyAuthChallenge,
} from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    if (
      typeof body.challengeId !== "string" ||
      body.challengeId.length < 32 ||
      typeof body.address !== "string" ||
      !isAddress(body.address) ||
      typeof body.signature !== "string" ||
      !isHex(body.signature)
    ) {
      return NextResponse.json({ error: "The signature response is invalid." }, { status: 400 });
    }
    const session = await verifyAuthChallenge({
      challengeId: body.challengeId,
      address: getAddress(body.address),
      signature: body.signature,
    });
    const response = NextResponse.json({ address: session.address, expiresAt: session.expiresAt });
    response.cookies.set(SESSION_COOKIE_NAME, session.sessionToken, sessionCookieOptions());
    return response;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Wallet verification failed.";
    return NextResponse.json({ error: reason }, { status: 401 });
  }
}
