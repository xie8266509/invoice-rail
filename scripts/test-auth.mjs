import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const appUrl = (process.env.INVOICE_RAIL_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const account = privateKeyToAccount(generatePrivateKey());
const memberAccount = privateKeyToAccount(generatePrivateKey());

async function json(response) {
  return { status: response.status, body: await response.json(), headers: response.headers };
}

async function authenticate(wallet) {
  const challenge = await json(await fetch(`${appUrl}/api/auth/challenge`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: appUrl },
    body: JSON.stringify({ address: wallet.address }),
  }));
  if (challenge.status !== 200 || !challenge.body.challengeId || !challenge.body.message) {
    throw new Error(`Challenge failed: ${JSON.stringify(challenge.body)}`);
  }
  const signature = await wallet.signMessage({ message: challenge.body.message });
  const verified = await json(await fetch(`${appUrl}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: appUrl },
    body: JSON.stringify({
      address: wallet.address,
      challengeId: challenge.body.challengeId,
      signature,
    }),
  }));
  if (verified.status !== 200) {
    throw new Error(`Verification failed: ${JSON.stringify(verified.body)}`);
  }
  const rawCookie = verified.headers.get("set-cookie");
  const cookie = rawCookie?.split(";", 1)[0];
  const cookieAttributes = rawCookie?.toLowerCase();
  if (!cookie || !cookieAttributes?.includes("httponly") || !cookieAttributes.includes("samesite=lax")) {
    throw new Error("The secure session cookie was not issued.");
  }
  return { challenge, signature, cookie };
}

const unauthorized = await json(await fetch(`${appUrl}/api/invoices`));
if (unauthorized.status !== 401) throw new Error("Unauthenticated invoice access was not rejected.");

const ownerAuth = await authenticate(account);
const memberAuth = await authenticate(memberAccount);
const authorized = await json(await fetch(`${appUrl}/api/invoices`, {
  headers: { cookie: ownerAuth.cookie },
}));
if (authorized.status !== 200 || !Array.isArray(authorized.body.invoices)) {
  throw new Error(`Authenticated invoice access failed: ${JSON.stringify(authorized.body)}`);
}

const workspaceQuery = `workspace=${encodeURIComponent(account.address)}`;
const memberCreated = await json(await fetch(`${appUrl}/api/team?${workspaceQuery}`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: ownerAuth.cookie, origin: appUrl },
  body: JSON.stringify({ address: memberAccount.address, role: "viewer" }),
}));
if (memberCreated.status !== 201 || memberCreated.body.member?.role !== "viewer") {
  throw new Error(`Team member creation failed: ${JSON.stringify(memberCreated.body)}`);
}

const memberWorkspaces = await json(await fetch(`${appUrl}/api/workspaces`, {
  headers: { cookie: memberAuth.cookie },
}));
if (
  memberWorkspaces.status !== 200 ||
  !memberWorkspaces.body.workspaces.some(
    (item) => item.workspaceAddress.toLowerCase() === account.address.toLowerCase() && item.role === "viewer",
  )
) {
  throw new Error(`Member workspace access was not listed: ${JSON.stringify(memberWorkspaces.body)}`);
}

const viewerRead = await json(await fetch(`${appUrl}/api/invoices?${workspaceQuery}`, {
  headers: { cookie: memberAuth.cookie },
}));
if (viewerRead.status !== 200) throw new Error("Viewer could not read workspace invoices.");

const viewerWrite = await json(await fetch(`${appUrl}/api/invoices?${workspaceQuery}`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: memberAuth.cookie, origin: appUrl },
  body: JSON.stringify({}),
}));
if (viewerWrite.status !== 403) throw new Error("Viewer invoice write was not rejected.");

const viewerWebhooks = await json(await fetch(`${appUrl}/api/webhooks?${workspaceQuery}`, {
  headers: { cookie: memberAuth.cookie },
}));
if (viewerWebhooks.status !== 403) throw new Error("Viewer webhook access was not rejected.");

const csvExport = await fetch(`${appUrl}/api/invoices/export?${workspaceQuery}`, {
  headers: { cookie: memberAuth.cookie },
});
if (csvExport.status !== 200 || !csvExport.headers.get("content-type")?.includes("text/csv")) {
  throw new Error("Viewer CSV export failed.");
}

const memberPromoted = await json(await fetch(`${appUrl}/api/team?${workspaceQuery}`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: ownerAuth.cookie, origin: appUrl },
  body: JSON.stringify({ address: memberAccount.address, role: "editor" }),
}));
if (memberPromoted.status !== 201 || memberPromoted.body.member?.role !== "editor") {
  throw new Error(`Team member role update failed: ${JSON.stringify(memberPromoted.body)}`);
}
const editorWriteBoundary = await json(await fetch(`${appUrl}/api/invoices?${workspaceQuery}`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: memberAuth.cookie, origin: appUrl },
  body: JSON.stringify({}),
}));
if (editorWriteBoundary.status !== 400) {
  throw new Error("Editor did not pass the invoice write permission boundary.");
}

const webhookCreated = await json(await fetch(`${appUrl}/api/webhooks`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: ownerAuth.cookie, origin: appUrl },
  body: JSON.stringify({ url: "https://example.com/invoice-rail-test" }),
}));
if (webhookCreated.status !== 201 || !webhookCreated.body.endpoint?.id || !webhookCreated.body.secret) {
  throw new Error(`Webhook creation failed: ${JSON.stringify(webhookCreated.body)}`);
}
const webhookId = webhookCreated.body.endpoint.id;
const webhooks = await json(await fetch(`${appUrl}/api/webhooks`, {
  headers: { cookie: ownerAuth.cookie },
}));
if (webhooks.status !== 200 || !webhooks.body.endpoints.some((item) => item.id === webhookId)) {
  throw new Error(`Webhook listing failed: ${JSON.stringify(webhooks.body)}`);
}
const webhookDeleted = await json(await fetch(
  `${appUrl}/api/webhooks?id=${encodeURIComponent(webhookId)}`,
  { method: "DELETE", headers: { cookie: ownerAuth.cookie, origin: appUrl } },
));
if (webhookDeleted.status !== 200) {
  throw new Error(`Webhook deletion failed: ${JSON.stringify(webhookDeleted.body)}`);
}

const memberDeleted = await json(await fetch(
  `${appUrl}/api/team?${workspaceQuery}&member=${encodeURIComponent(memberAccount.address)}`,
  { method: "DELETE", headers: { cookie: ownerAuth.cookie, origin: appUrl } },
));
if (memberDeleted.status !== 200) {
  throw new Error(`Team member deletion failed: ${JSON.stringify(memberDeleted.body)}`);
}
const revokedRead = await json(await fetch(`${appUrl}/api/invoices?${workspaceQuery}`, {
  headers: { cookie: memberAuth.cookie },
}));
if (revokedRead.status !== 403) throw new Error("Removed team member retained workspace access.");

const replay = await json(await fetch(`${appUrl}/api/auth/verify`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: appUrl },
  body: JSON.stringify({
    address: account.address,
    challengeId: ownerAuth.challenge.body.challengeId,
    signature: ownerAuth.signature,
  }),
}));
if (replay.status !== 401) throw new Error("A consumed sign-in challenge was accepted twice.");

console.log(JSON.stringify({
  address: account.address,
  unauthorizedStatus: unauthorized.status,
  authenticatedStatus: authorized.status,
  challengeReplayStatus: replay.status,
  cookie: "HttpOnly; SameSite=Lax",
  teamRoles: "viewer read/export; editor write; owner team/webhook",
  revocationStatus: revokedRead.status,
  webhookLifecycle: "created, listed, deleted",
}, null, 2));
