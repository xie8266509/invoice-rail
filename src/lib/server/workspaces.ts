import "server-only";

import { getAddress, type Address } from "viem";
import { getDatabase } from "@/lib/server/database";
import type { TeamMember, WorkspaceAccess, WorkspaceRole } from "@/lib/workspace";

type MemberRow = {
  workspace_address: string;
  member_address: string;
  role: "editor" | "viewer";
  created_at: string;
};

export async function listWorkspaces(address: Address): Promise<WorkspaceAccess[]> {
  const db = await getDatabase();
  const account = getAddress(address);
  const result = await db.query<MemberRow>(
    `SELECT workspace_address, member_address, role, created_at
     FROM team_members
     WHERE LOWER(member_address) = LOWER($1)
     ORDER BY created_at DESC`,
    [account],
  );
  return [
    { workspaceAddress: account, role: "owner" },
    ...result.rows.map((row) => ({
      workspaceAddress: getAddress(row.workspace_address),
      role: row.role,
    })),
  ];
}

export async function getWorkspaceRole(
  workspaceAddress: Address,
  memberAddress: Address,
): Promise<WorkspaceRole | null> {
  const workspace = getAddress(workspaceAddress);
  const member = getAddress(memberAddress);
  if (workspace.toLowerCase() === member.toLowerCase()) return "owner";
  const db = await getDatabase();
  const result = await db.query<{ role: "editor" | "viewer" }>(
    `SELECT role FROM team_members
     WHERE LOWER(workspace_address) = LOWER($1)
       AND LOWER(member_address) = LOWER($2)
     LIMIT 1`,
    [workspace, member],
  );
  return result.rows[0]?.role ?? null;
}

export async function listTeamMembers(workspaceAddress: Address): Promise<TeamMember[]> {
  const db = await getDatabase();
  const workspace = getAddress(workspaceAddress);
  const result = await db.query<MemberRow>(
    `SELECT workspace_address, member_address, role, created_at
     FROM team_members
     WHERE LOWER(workspace_address) = LOWER($1)
     ORDER BY created_at ASC`,
    [workspace],
  );
  return [
    { address: workspace, role: "owner", createdAt: "" },
    ...result.rows.map((row) => ({
      address: getAddress(row.member_address),
      role: row.role,
      createdAt: row.created_at,
    })),
  ];
}

export async function setTeamMember(input: {
  workspaceAddress: Address;
  memberAddress: Address;
  role: "editor" | "viewer";
  invitedBy: Address;
}): Promise<TeamMember> {
  const db = await getDatabase();
  const workspace = getAddress(input.workspaceAddress);
  const member = getAddress(input.memberAddress);
  if (workspace.toLowerCase() === member.toLowerCase()) {
    throw new Error("The workspace owner already has full access.");
  }
  const now = new Date().toISOString();
  const result = await db.query<MemberRow>(
    `INSERT INTO team_members (
      workspace_address, member_address, role, invited_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $5)
    ON CONFLICT (workspace_address, member_address) DO UPDATE SET
      role = EXCLUDED.role,
      invited_by = EXCLUDED.invited_by,
      updated_at = EXCLUDED.updated_at
    RETURNING workspace_address, member_address, role, created_at`,
    [workspace, member, input.role, getAddress(input.invitedBy), now],
  );
  const row = result.rows[0];
  return { address: getAddress(row.member_address), role: row.role, createdAt: row.created_at };
}

export async function removeTeamMember(
  workspaceAddress: Address,
  memberAddress: Address,
): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.query<{ member_address: string }>(
    `DELETE FROM team_members
     WHERE LOWER(workspace_address) = LOWER($1)
       AND LOWER(member_address) = LOWER($2)
     RETURNING member_address`,
    [getAddress(workspaceAddress), getAddress(memberAddress)],
  );
  return result.rows.length === 1;
}
