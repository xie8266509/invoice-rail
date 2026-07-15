import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import {
  AuthenticationError,
  hasValidRequestOrigin,
} from "@/lib/server/auth";
import { PermissionError, requireWorkspaceAccess } from "@/lib/server/permissions";
import {
  listTeamMembers,
  removeTeamMember,
  setTeamMember,
} from "@/lib/server/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const status = error instanceof AuthenticationError
    ? 401
    : error instanceof PermissionError
      ? 403
      : 400;
  const reason = error instanceof Error ? error.message : "Team request failed.";
  return NextResponse.json({ error: reason }, { status });
}

export async function GET(request: Request) {
  try {
    const access = await requireWorkspaceAccess(request, "viewer");
    return NextResponse.json({
      role: access.role,
      members: await listTeamMembers(access.workspaceAddress),
    });
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
    const body = await request.json() as { address?: unknown; role?: unknown };
    if (
      typeof body.address !== "string" ||
      !isAddress(body.address) ||
      (body.role !== "editor" && body.role !== "viewer")
    ) {
      return NextResponse.json({ error: "A valid member address and role are required." }, { status: 400 });
    }
    const member = await setTeamMember({
      workspaceAddress: access.workspaceAddress,
      memberAddress: getAddress(body.address),
      role: body.role,
      invitedBy: access.actorAddress,
    });
    return NextResponse.json({ member }, { status: 201 });
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
    const memberAddress = new URL(request.url).searchParams.get("member");
    if (!memberAddress || !isAddress(memberAddress)) {
      return NextResponse.json({ error: "A valid member address is required." }, { status: 400 });
    }
    const deleted = await removeTeamMember(access.workspaceAddress, getAddress(memberAddress));
    return deleted
      ? NextResponse.json({ deleted: true })
      : NextResponse.json({ error: "Team member not found." }, { status: 404 });
  } catch (error) {
    return failure(error);
  }
}
