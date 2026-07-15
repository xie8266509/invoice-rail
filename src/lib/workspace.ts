import type { Address } from "viem";

export type WorkspaceRole = "owner" | "editor" | "viewer";

export type WorkspaceAccess = {
  workspaceAddress: Address;
  role: WorkspaceRole;
};

export type TeamMember = {
  address: Address;
  role: WorkspaceRole;
  createdAt: string;
};
