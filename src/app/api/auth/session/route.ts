import { NextResponse } from "next/server";
import {
  getAuthenticatedMerchant,
  hasValidRequestOrigin,
  revokeCurrentSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const address = await getAuthenticatedMerchant(request);
  return NextResponse.json({ authenticated: Boolean(address), address });
}

export async function DELETE(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  await revokeCurrentSession(request);
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
