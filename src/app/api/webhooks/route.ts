import { NextResponse } from "next/server";
import {
  AuthenticationError,
  hasValidRequestOrigin,
} from "@/lib/server/auth";
import { PermissionError, requireWorkspaceAccess } from "@/lib/server/permissions";
import { logEvent, requestId, requestLogData, withRequestId } from "@/lib/server/observability";
import {
  createRateLimitResponse,
  enforceRateLimit,
  RATE_LIMITS,
  RateLimitError,
} from "@/lib/server/rate-limit";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookEndpoints,
} from "@/lib/server/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown, request: Request, id: string) {
  if (error instanceof RateLimitError) {
    logEvent("warn", "webhook.rate_limited", requestLogData(request, id));
    return withRequestId(createRateLimitResponse(error), id);
  }
  if (error instanceof AuthenticationError) {
    return withRequestId(NextResponse.json({ error: error.message }, { status: 401 }), id);
  }
  if (error instanceof PermissionError) {
    return withRequestId(NextResponse.json({ error: error.message }, { status: 403 }), id);
  }
  const reason = error instanceof Error ? error.message : "Webhook request failed.";
  logEvent("warn", "webhook.request.failed", { ...requestLogData(request, id), error });
  return withRequestId(NextResponse.json({ error: reason }, { status: 400 }), id);
}

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const access = await requireWorkspaceAccess(request, "owner");
    return withRequestId(
      NextResponse.json({ endpoints: await listWebhookEndpoints(access.workspaceAddress) }),
      id,
    );
  } catch (error) {
    return failure(error, request, id);
  }
}

export async function POST(request: Request) {
  const id = requestId(request);
  if (!hasValidRequestOrigin(request)) {
    return withRequestId(
      NextResponse.json({ error: "Invalid request origin." }, { status: 403 }),
      id,
    );
  }
  try {
    await enforceRateLimit(request, RATE_LIMITS.webhookWrite);
    const access = await requireWorkspaceAccess(request, "owner");
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== "string" || body.url.length > 2048) {
      return withRequestId(
        NextResponse.json({ error: "A webhook URL is required." }, { status: 400 }),
        id,
      );
    }
    const created = await createWebhookEndpoint(access.workspaceAddress, body.url);
    logEvent("info", "webhook.endpoint.created", {
      ...requestLogData(request, id),
      endpointId: created.endpoint.id,
    });
    return withRequestId(NextResponse.json(
      created,
      { status: 201 },
    ), id);
  } catch (error) {
    return failure(error, request, id);
  }
}

export async function DELETE(request: Request) {
  const requestIdentifier = requestId(request);
  if (!hasValidRequestOrigin(request)) {
    return withRequestId(
      NextResponse.json({ error: "Invalid request origin." }, { status: 403 }),
      requestIdentifier,
    );
  }
  try {
    await enforceRateLimit(request, RATE_LIMITS.webhookWrite);
    const access = await requireWorkspaceAccess(request, "owner");
    const endpointId = new URL(request.url).searchParams.get("id");
    if (!endpointId || !/^wh_[a-f0-9]{32}$/.test(endpointId)) {
      return withRequestId(
        NextResponse.json({ error: "A valid webhook endpoint ID is required." }, { status: 400 }),
        requestIdentifier,
      );
    }
    const deleted = await deleteWebhookEndpoint(access.workspaceAddress, endpointId);
    if (deleted) {
      logEvent("info", "webhook.endpoint.deleted", {
        ...requestLogData(request, requestIdentifier),
        endpointId,
      });
    }
    return withRequestId(deleted
      ? NextResponse.json({ deleted: true })
      : NextResponse.json({ error: "Webhook endpoint not found." }, { status: 404 }), requestIdentifier);
  } catch (error) {
    return failure(error, request, requestIdentifier);
  }
}
