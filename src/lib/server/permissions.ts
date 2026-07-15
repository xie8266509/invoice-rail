import "server-only";

import { getAddress, isAddress, type Address } from "viem";
import { requireAuthenticatedMerchant } from "@/lib/server/auth";
import { getWorkspaceRole } from "@/lib/server/workspaces";
import type { WorkspaceRole } from "@/lib/workspace";

const roleRank: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export class PermissionError extends Error {
  constructor(message = "You do not have permission for this workspace.") {
    super(message);
    this.name = "PermissionError";
  }
}

export async function requireWorkspaceAccess(
  request: Request,
  minimumRole: WorkspaceRole = "viewer",
): Promise<{
  actorAddress: Address;
  workspaceAddress: Address;
  role: WorkspaceRole;
}> {
  const actorAddress = await requireAuthenticatedMerchant(request);
  const requested = new URL(request.url).searchParams.get("workspace");
  if (requested && !isAddress(requested)) {
    throw new PermissionError("A valid workspace address is required.");
  }
  const workspaceAddress = requested ? getAddress(requested) : actorAddress;
  const role = await getWorkspaceRole(workspaceAddress, actorAddress);
  if (!role || roleRank[role] < roleRank[minimumRole]) throw new PermissionError();
  return { actorAddress, workspaceAddress, role };
}
