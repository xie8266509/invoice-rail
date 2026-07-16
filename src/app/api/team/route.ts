import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
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
  listTeamMembers,
  removeTeamMember,
  setTeamMember,
} from "@/lib/server/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown, request: Request, id: string) {
  if (error instanceof RateLimitError) {
    logEvent("warn", "team.rate_limited", requestLogData(request, id));
    return withRequestId(createRateLimitResponse(error), id);
  }
  const status = error instanceof AuthenticationError
    ? 401
    : error instanceof PermissionError
      ? 403
      : 400;
  const reason = error instanceof Error ? error.message : "Team request failed.";
  return withRequestId(NextResponse.json({ error: reason }, { status }), id);
}

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const access = await requireWorkspaceAccess(request, "viewer");
    return withRequestId(NextResponse.json({
      role: access.role,
      members: await listTeamMembers(access.workspaceAddress),
    }), id);
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
    await enforceRateLimit(request, RATE_LIMITS.teamWrite);
    const access = await requireWorkspaceAccess(request, "owner");
    const body = await request.json() as { address?: unknown; role?: unknown };
    if (
      typeof body.address !== "string" ||
      !isAddress(body.address) ||
      (body.role !== "editor" && body.role !== "viewer")
    ) {
      return withRequestId(
        NextResponse.json({ error: "A valid member address and role are required." }, { status: 400 }),
        id,
      );
    }
    const member = await setTeamMember({
      workspaceAddress: access.workspaceAddress,
      memberAddress: getAddress(body.address),
      role: body.role,
      invitedBy: access.actorAddress,
    });
    logEvent("info", "team.member.set", {
      ...requestLogData(request, id),
      role: member.role,
    });
    return withRequestId(NextResponse.json({ member }, { status: 201 }), id);
  } catch (error) {
    return failure(error, request, id);
  }
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
    await enforceRateLimit(request, RATE_LIMITS.teamWrite);
    const access = await requireWorkspaceAccess(request, "owner");
    const memberAddress = new URL(request.url).searchParams.get("member");
    if (!memberAddress || !isAddress(memberAddress)) {
      return withRequestId(
        NextResponse.json({ error: "A valid member address is required." }, { status: 400 }),
        id,
      );
    }
    const deleted = await removeTeamMember(access.workspaceAddress, getAddress(memberAddress));
    if (deleted) logEvent("info", "team.member.removed", requestLogData(request, id));
    return withRequestId(deleted
      ? NextResponse.json({ deleted: true })
      : NextResponse.json({ error: "Team member not found." }, { status: 404 }), id);
  } catch (error) {
    return failure(error, request, id);
  }
}
