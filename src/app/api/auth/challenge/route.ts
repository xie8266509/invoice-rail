import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { createAuthChallenge, hasValidRequestOrigin } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const body = await request.json() as { address?: unknown };
    if (typeof body.address !== "string" || !isAddress(body.address)) {
      return NextResponse.json({ error: "A valid wallet address is required." }, { status: 400 });
    }
    return NextResponse.json(await createAuthChallenge(getAddress(body.address), request));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Sign-in request failed.";
    return NextResponse.json({ error: reason }, { status: 400 });
  }
}
