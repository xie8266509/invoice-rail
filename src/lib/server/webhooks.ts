import "server-only";

import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { getAddress, type Address } from "viem";
import type { Invoice } from "@/lib/invoice";
import type { Database } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/database";
import { normalizeWebhookUrl, webhookRetryDelayMs } from "@/lib/webhook";

const MAX_DELIVERY_ATTEMPTS = 8;

type WebhookEndpointRow = {
  id: string;
  merchant_address: string;
  url: string;
  secret: string;
  active: boolean;
  created_at: string;
};

type WebhookDeliveryRow = {
  id: string;
  endpoint_id: string;
  url: string;
  secret: string;
  payload: string;
  attempts: number;
};

export type WebhookEndpoint = {
  id: string;
  url: string;
  active: boolean;
  createdAt: string;
};

export type WebhookDispatchResult = {
  attempted: number;
  delivered: number;
  pending: number;
  failed: number;
};

function mapEndpoint(row: WebhookEndpointRow): WebhookEndpoint {
  return {
    id: row.id,
    url: row.url,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function listWebhookEndpoints(merchantAddress: Address): Promise<WebhookEndpoint[]> {
  const db = await getDatabase();
  const result = await db.query<WebhookEndpointRow>(
    `SELECT id, merchant_address, url, secret, active, created_at
     FROM webhook_endpoints
     WHERE LOWER(merchant_address) = LOWER($1)
     ORDER BY created_at DESC`,
    [getAddress(merchantAddress)],
  );
  return result.rows.map(mapEndpoint);
}

export async function createWebhookEndpoint(
  merchantAddress: Address,
  rawUrl: string,
): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
  const db = await getDatabase();
  const url = normalizeWebhookUrl(rawUrl, process.env.NODE_ENV !== "production");
  const id = `wh_${randomUUID().replaceAll("-", "")}`;
  const secret = `whsec_${randomBytes(32).toString("base64url")}`;
  const now = new Date().toISOString();
  const result = await db.query<WebhookEndpointRow>(
    `INSERT INTO webhook_endpoints (
      id, merchant_address, url, secret, active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, TRUE, $5, $5)
    RETURNING id, merchant_address, url, secret, active, created_at`,
    [id, getAddress(merchantAddress), url, secret, now],
  );
  return { endpoint: mapEndpoint(result.rows[0]), secret };
}

export async function deleteWebhookEndpoint(
  merchantAddress: Address,
  endpointId: string,
): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.query<{ id: string }>(
    `DELETE FROM webhook_endpoints
     WHERE id = $1 AND LOWER(merchant_address) = LOWER($2)
     RETURNING id`,
    [endpointId, getAddress(merchantAddress)],
  );
  return result.rows.length === 1;
}

export async function enqueueInvoicePaidWebhooks(
  transaction: Database,
  invoice: Invoice,
  occurredAt: string,
): Promise<void> {
  if (!invoice.merchantAddress || !invoice.txHash || !invoice.paidAt) return;
  const endpoints = await transaction.query<WebhookEndpointRow>(
    `SELECT id, merchant_address, url, secret, active, created_at
     FROM webhook_endpoints
     WHERE LOWER(merchant_address) = LOWER($1) AND active = TRUE`,
    [invoice.merchantAddress],
  );

  for (const endpoint of endpoints.rows) {
    const deliveryId = `evt_${randomUUID().replaceAll("-", "")}`;
    const payload = JSON.stringify({
      id: deliveryId,
      type: "invoice.paid",
      createdAt: occurredAt,
      data: { invoice },
    });
    await transaction.query(
      `INSERT INTO webhook_deliveries (
        id, endpoint_id, event_type, invoice_id, payload, status, attempts,
        next_attempt_at, last_error, created_at, delivered_at
      ) VALUES ($1, $2, 'invoice.paid', $3, $4, 'pending', 0, $5, NULL, $5, NULL)
      ON CONFLICT (endpoint_id, event_type, invoice_id) DO NOTHING`,
      [deliveryId, endpoint.id, invoice.id, payload, occurredAt],
    );
  }
}

function deliverySignature(secret: string, timestamp: string, payload: string): string {
  const value = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${value}`;
}

export async function dispatchPendingWebhooks(limit = 20): Promise<WebhookDispatchResult> {
  const db = await getDatabase();
  const now = new Date();
  const result = await db.query<WebhookDeliveryRow>(
    `SELECT d.id, d.endpoint_id, e.url, e.secret, d.payload, d.attempts
     FROM webhook_deliveries d
     JOIN webhook_endpoints e ON e.id = d.endpoint_id
     WHERE d.status = 'pending' AND d.next_attempt_at <= $1 AND e.active = TRUE
     ORDER BY d.created_at ASC
     LIMIT $2`,
    [now.toISOString(), limit],
  );
  const summary: WebhookDispatchResult = {
    attempted: result.rows.length,
    delivered: 0,
    pending: 0,
    failed: 0,
  };

  for (const delivery of result.rows) {
    const attempt = Number(delivery.attempts) + 1;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    try {
      const response = await fetch(delivery.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Invoice-Rail-Webhook/1.0",
          "x-invoice-rail-delivery": delivery.id,
          "x-invoice-rail-signature": deliverySignature(
            delivery.secret,
            timestamp,
            delivery.payload,
          ),
        },
        body: delivery.payload,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Endpoint returned HTTP ${response.status}.`);
      await db.query(
        `UPDATE webhook_deliveries
         SET status = 'delivered', attempts = $1, delivered_at = $2, last_error = NULL
         WHERE id = $3 AND status = 'pending'`,
        [attempt, new Date().toISOString(), delivery.id],
      );
      summary.delivered += 1;
    } catch (error) {
      const terminal = attempt >= MAX_DELIVERY_ATTEMPTS;
      const nextAttempt = new Date(Date.now() + webhookRetryDelayMs(attempt)).toISOString();
      const reason = error instanceof Error ? error.message.slice(0, 500) : "Delivery failed.";
      await db.query(
        `UPDATE webhook_deliveries
         SET status = $1, attempts = $2, next_attempt_at = $3, last_error = $4
         WHERE id = $5 AND status = 'pending'`,
        [terminal ? "failed" : "pending", attempt, nextAttempt, reason, delivery.id],
      );
      if (terminal) summary.failed += 1;
      else summary.pending += 1;
    }
  }
  return summary;
}
