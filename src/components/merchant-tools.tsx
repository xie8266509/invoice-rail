"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  DownloadSimple,
  Trash,
  UsersThree,
  WebhooksLogo,
} from "@phosphor-icons/react";
import {
  Badge,
  Button,
  Callout,
  Dialog,
  Flex,
  IconButton,
  Select,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { getAddress, isAddress, type Address } from "viem";
import { formatAddress } from "@/lib/invoice";
import type {
  TeamMember,
  WorkspaceAccess,
  WorkspaceRole,
} from "@/lib/workspace";

type WebhookEndpoint = {
  id: string;
  url: string;
  active: boolean;
  createdAt: string;
};

type MerchantToolsProps = {
  account: Address;
  workspace: WorkspaceAccess;
  workspaces: WorkspaceAccess[];
  onWorkspaceChange: (address: Address) => void;
};

function roleLabel(role: WorkspaceRole): string {
  return role[0].toUpperCase() + role.slice(1);
}

function apiUrl(path: string, workspaceAddress: Address): string {
  return `${path}?workspace=${encodeURIComponent(workspaceAddress)}`;
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

export function MerchantTools({
  account,
  workspace,
  workspaces,
  onWorkspaceChange,
}: MerchantToolsProps) {
  const [teamOpen, setTeamOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string>();
  const [memberAddress, setMemberAddress] = useState("");
  const [memberRole, setMemberRole] = useState<"editor" | "viewer">("editor");
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookError, setWebhookError] = useState<string>();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [newSecret, setNewSecret] = useState<string>();
  const [secretCopied, setSecretCopied] = useState(false);
  const isOwner = workspace.role === "owner";

  async function loadTeam() {
    setTeamLoading(true);
    setTeamError(undefined);
    try {
      const response = await fetch(apiUrl("/api/team", workspace.workspaceAddress), {
        cache: "no-store",
      });
      const body = await responseJson(response);
      if (!response.ok || !Array.isArray(body.members)) {
        throw new Error(typeof body.error === "string" ? body.error : "Team could not be loaded.");
      }
      setMembers(body.members as TeamMember[]);
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : "Team could not be loaded.");
    } finally {
      setTeamLoading(false);
    }
  }

  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTeamError(undefined);
    if (!isAddress(memberAddress)) {
      setTeamError("Enter a valid EVM wallet address.");
      return;
    }
    const response = await fetch(apiUrl("/api/team", workspace.workspaceAddress), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: getAddress(memberAddress), role: memberRole }),
    });
    const body = await responseJson(response);
    if (!response.ok) {
      setTeamError(typeof body.error === "string" ? body.error : "Team member could not be saved.");
      return;
    }
    setMemberAddress("");
    await loadTeam();
  }

  async function removeMember(address: Address) {
    setTeamError(undefined);
    const url = `${apiUrl("/api/team", workspace.workspaceAddress)}&member=${encodeURIComponent(address)}`;
    const response = await fetch(url, { method: "DELETE" });
    const body = await responseJson(response);
    if (!response.ok) {
      setTeamError(typeof body.error === "string" ? body.error : "Team member could not be removed.");
      return;
    }
    await loadTeam();
  }

  async function loadWebhooks() {
    setWebhookLoading(true);
    setWebhookError(undefined);
    try {
      const response = await fetch(apiUrl("/api/webhooks", workspace.workspaceAddress), {
        cache: "no-store",
      });
      const body = await responseJson(response);
      if (!response.ok || !Array.isArray(body.endpoints)) {
        throw new Error(
          typeof body.error === "string" ? body.error : "Webhooks could not be loaded.",
        );
      }
      setEndpoints(body.endpoints as WebhookEndpoint[]);
    } catch (error) {
      setWebhookError(error instanceof Error ? error.message : "Webhooks could not be loaded.");
    } finally {
      setWebhookLoading(false);
    }
  }

  async function createWebhook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWebhookError(undefined);
    setNewSecret(undefined);
    const response = await fetch(apiUrl("/api/webhooks", workspace.workspaceAddress), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const body = await responseJson(response);
    if (!response.ok || typeof body.secret !== "string") {
      setWebhookError(
        typeof body.error === "string" ? body.error : "Webhook endpoint could not be created.",
      );
      return;
    }
    setWebhookUrl("");
    setNewSecret(body.secret);
    setSecretCopied(false);
    await loadWebhooks();
  }

  async function deleteWebhook(id: string) {
    setWebhookError(undefined);
    const url = `${apiUrl("/api/webhooks", workspace.workspaceAddress)}&id=${encodeURIComponent(id)}`;
    const response = await fetch(url, { method: "DELETE" });
    const body = await responseJson(response);
    if (!response.ok) {
      setWebhookError(
        typeof body.error === "string" ? body.error : "Webhook endpoint could not be deleted.",
      );
      return;
    }
    await loadWebhooks();
  }

  return (
    <section className="operations-bar" aria-label="Workspace tools">
      <div className="workspace-control">
        <Text size="1" color="gray" weight="medium">Workspace</Text>
        <Select.Root
          value={workspace.workspaceAddress}
          onValueChange={(value) => onWorkspaceChange(getAddress(value))}
        >
          <Select.Trigger aria-label="Active workspace" />
          <Select.Content>
            {workspaces.map((item) => (
              <Select.Item key={item.workspaceAddress} value={item.workspaceAddress}>
                {item.workspaceAddress.toLowerCase() === account.toLowerCase()
                  ? "My workspace"
                  : formatAddress(item.workspaceAddress)}
                {` - ${roleLabel(item.role)}`}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        <Badge color={workspace.role === "viewer" ? "gray" : "jade"} variant="soft">
          {roleLabel(workspace.role)}
        </Badge>
      </div>

      <Flex gap="2" wrap="wrap" className="operations-actions">
        <Dialog.Root
          open={teamOpen}
          onOpenChange={(open) => {
            setTeamOpen(open);
            if (open) void loadTeam();
          }}
        >
          <Dialog.Trigger>
            <Button variant="soft" color="gray">
              <UsersThree size={17} />
              Team
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="620px">
            <Dialog.Title>Workspace team</Dialog.Title>
            <Dialog.Description>
              Editors can create invoices. Viewers can review and export records.
            </Dialog.Description>

            {teamError ? (
              <Callout.Root color="red" size="1" role="alert" className="dialog-callout">
                <Callout.Text>{teamError}</Callout.Text>
              </Callout.Root>
            ) : null}

            {isOwner ? (
              <form className="member-form" onSubmit={saveMember}>
                <label className="field-group member-address-field">
                  <Text size="2" weight="medium">Wallet address</Text>
                  <TextField.Root
                    value={memberAddress}
                    onChange={(event) => setMemberAddress(event.target.value)}
                    placeholder="0x..."
                    className="mono-input"
                  />
                </label>
                <label className="field-group">
                  <Text size="2" weight="medium">Role</Text>
                  <Select.Root
                    value={memberRole}
                    onValueChange={(value) => setMemberRole(value as "editor" | "viewer")}
                  >
                    <Select.Trigger aria-label="Member role" />
                    <Select.Content>
                      <Select.Item value="editor">Editor</Select.Item>
                      <Select.Item value="viewer">Viewer</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </label>
                <Button type="submit">Add member</Button>
              </form>
            ) : null}

            <div className="settings-list" aria-busy={teamLoading}>
              {teamLoading ? (
                <Text size="2" color="gray">Loading team...</Text>
              ) : members.map((member) => (
                <div className="settings-row" key={member.address}>
                  <div>
                    <Text as="div" size="2" weight="medium" className="mono-text">
                      {formatAddress(member.address)}
                    </Text>
                    <Text as="div" size="1" color="gray">{roleLabel(member.role)}</Text>
                  </div>
                  {isOwner && member.role !== "owner" ? (
                    <Tooltip content="Remove member">
                      <IconButton
                        type="button"
                        variant="ghost"
                        color="red"
                        aria-label={`Remove ${formatAddress(member.address)}`}
                        onClick={() => void removeMember(member.address)}
                      >
                        <Trash size={17} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </div>
              ))}
            </div>
            <Flex justify="end" mt="4">
              <Dialog.Close><Button variant="soft" color="gray">Done</Button></Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>

        {isOwner ? (
          <Dialog.Root
            open={webhookOpen}
            onOpenChange={(open) => {
              setWebhookOpen(open);
              if (open) void loadWebhooks();
              else setNewSecret(undefined);
            }}
          >
            <Dialog.Trigger>
              <Button variant="soft" color="gray">
                <WebhooksLogo size={17} />
                Webhooks
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="680px">
              <Dialog.Title>Payment webhooks</Dialog.Title>
              <Dialog.Description>
                Send a signed event when an invoice is confirmed on Arc.
              </Dialog.Description>

              {webhookError ? (
                <Callout.Root color="red" size="1" role="alert" className="dialog-callout">
                  <Callout.Text>{webhookError}</Callout.Text>
                </Callout.Root>
              ) : null}
              {newSecret ? (
                <Callout.Root color="jade" size="1" className="dialog-callout">
                  <Callout.Text>
                    Save this signing secret now. It will not be shown again.
                    <span className="secret-line mono-text">{newSecret}</span>
                  </Callout.Text>
                  <Button
                    type="button"
                    size="1"
                    variant="soft"
                    onClick={() => {
                      navigator.clipboard.writeText(newSecret).then(() => setSecretCopied(true));
                    }}
                  >
                    {secretCopied ? <Check size={15} /> : <Copy size={15} />}
                    {secretCopied ? "Copied" : "Copy"}
                  </Button>
                </Callout.Root>
              ) : null}

              <form className="webhook-form" onSubmit={createWebhook}>
                <label className="field-group">
                  <Text size="2" weight="medium">Endpoint URL</Text>
                  <TextField.Root
                    type="url"
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                    placeholder="https://example.com/webhooks/invoice-rail"
                  />
                </label>
                <Button type="submit">Add endpoint</Button>
              </form>

              <div className="settings-list" aria-busy={webhookLoading}>
                {webhookLoading ? (
                  <Text size="2" color="gray">Loading webhooks...</Text>
                ) : endpoints.length === 0 ? (
                  <Text size="2" color="gray">No webhook endpoints configured.</Text>
                ) : endpoints.map((endpoint) => (
                  <div className="settings-row" key={endpoint.id}>
                    <div className="endpoint-copy">
                      <Text as="div" size="2" weight="medium">{endpoint.url}</Text>
                      <Text as="div" size="1" color="gray" className="mono-text">
                        {endpoint.id}
                      </Text>
                    </div>
                    <Tooltip content="Delete endpoint">
                      <IconButton
                        type="button"
                        variant="ghost"
                        color="red"
                        aria-label={`Delete ${endpoint.url}`}
                        onClick={() => void deleteWebhook(endpoint.id)}
                      >
                        <Trash size={17} />
                      </IconButton>
                    </Tooltip>
                  </div>
                ))}
              </div>
              <Flex justify="end" mt="4">
                <Dialog.Close><Button variant="soft" color="gray">Done</Button></Dialog.Close>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
        ) : null}

        <Button asChild variant="soft" color="gray">
          <a
            href={apiUrl("/api/invoices/export", workspace.workspaceAddress)}
            download
          >
            <DownloadSimple size={17} />
            Export CSV
          </a>
        </Button>
      </Flex>
    </section>
  );
}
