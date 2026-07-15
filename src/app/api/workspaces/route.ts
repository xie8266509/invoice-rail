import { NextResponse } from "next/server";
import { AuthenticationError, requireAuthenticatedMerchant } from "@/lib/server/auth";
import { listWorkspaces } from "@/lib/server/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const address = await requireAuthenticatedMerchant(request);
    return NextResponse.json({ workspaces: await listWorkspaces(address) });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : 500;
    const reason = error instanceof Error ? error.message : "Workspace request failed.";
    return NextResponse.json({ error: reason }, { status });
  }
}
