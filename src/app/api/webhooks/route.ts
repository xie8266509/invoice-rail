import { NextResponse } from "next/server";
import {
  AuthenticationError,
  hasValidRequestOrigin,
} from "@/lib/server/auth";
import { PermissionError, requireWorkspaceAccess } from "@/lib/server/permissions";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookEndpoints,
} from "@/lib/server/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof PermissionError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  const reason = error instanceof Error ? error.message : "Webhook request failed.";
  return NextResponse.json({ error: reason }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const access = await requireWorkspaceAccess(request, "owner");
    return NextResponse.json({ endpoints: await listWebhookEndpoints(access.workspaceAddress) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const access = await requireWorkspaceAccess(request, "owner");
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== "string" || body.url.length > 2048) {
      return NextResponse.json({ error: "A webhook URL is required." }, { status: 400 });
    }
    return NextResponse.json(
      await createWebhookEndpoint(access.workspaceAddress, body.url),
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const access = await requireWorkspaceAccess(request, "owner");
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^wh_[a-f0-9]{32}$/.test(id)) {
      return NextResponse.json({ error: "A valid webhook endpoint ID is required." }, { status: 400 });
    }
    const deleted = await deleteWebhookEndpoint(access.workspaceAddress, id);
    return deleted
      ? NextResponse.json({ deleted: true })
      : NextResponse.json({ error: "Webhook endpoint not found." }, { status: 404 });
  } catch (error) {
    return failure(error);
  }
}
