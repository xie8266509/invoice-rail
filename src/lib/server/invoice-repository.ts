import "server-only";

import { getAddress, type Address, type Hex } from "viem";
import { TOKENS } from "@/lib/constants";
import {
  getCallDataHash,
  getMemoId,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/invoice";
import { getDatabase } from "@/lib/server/database";
import { enqueueInvoicePaidWebhooks } from "@/lib/server/webhooks";

type InvoiceRow = {
  id: string;
  share_id: string;
  merchant_address: string;
  merchant_name: string;
  recipient: string;
  amount: string;
  token: "USDC" | "EURC";
  memo: string;
  due_date: string;
  created_at: string;
  created_block: bigint | string | null;
  status: InvoiceStatus;
  tx_hash: Hex | null;
  paid_at: string | null;
  memo_id: Hex;
  call_data_hash: Hex;
  token_address: Address;
};

export type StoredInvoiceVerification = {
  invoice: Invoice;
  memoId: Hex;
  callDataHash: Hex;
  tokenAddress: Address;
};

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    shareId: row.share_id,
    merchantAddress: getAddress(row.merchant_address),
    merchantName: row.merchant_name,
    recipient: getAddress(row.recipient),
    amount: row.amount,
    token: row.token,
    memo: row.memo,
    dueDate: row.due_date,
    createdAt: row.created_at,
    createdBlock: row.created_block === null ? undefined : String(row.created_block),
    status: row.status,
    txHash: row.tx_hash ?? undefined,
    paidAt: row.paid_at ?? undefined,
  };
}

const invoiceColumns = `
  id, share_id, merchant_address, merchant_name, recipient, amount, token, memo,
  due_date, created_at, created_block, status, tx_hash, paid_at, memo_id,
  call_data_hash, token_address
`;

export async function storeInvoice(
  invoice: Invoice,
  merchantAddress: Address,
): Promise<Invoice> {
  const db = await getDatabase();
  const shareId = crypto.randomUUID().replaceAll("-", "");
  const memoId = getMemoId(invoice.id);
  const callDataHash = getCallDataHash(invoice);
  const tokenAddress = TOKENS[invoice.token].address;
  const now = new Date().toISOString();

  await db.transaction(async (transaction) => {
    await transaction.query(
      `INSERT INTO invoices (
        id, share_id, merchant_address, merchant_name, recipient, amount, token,
        memo, due_date, created_at, created_block, status, tx_hash, paid_at,
        memo_id, call_data_hash, token_address, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open', NULL, NULL,
        $12, $13, $14, $15
      ) ON CONFLICT (id) DO NOTHING`,
      [
        invoice.id,
        shareId,
        getAddress(merchantAddress),
        invoice.merchantName,
        getAddress(invoice.recipient),
        invoice.amount,
        invoice.token,
        invoice.memo,
        invoice.dueDate,
        invoice.createdAt,
        invoice.createdBlock ?? null,
        memoId,
        callDataHash,
        tokenAddress,
        now,
      ],
    );

    if (invoice.createdBlock) {
      await transaction.query(
        `INSERT INTO indexer_cursors (name, next_block, updated_at)
         VALUES ('arc-memo', $1, $2)
         ON CONFLICT (name) DO UPDATE SET
           next_block = LEAST(indexer_cursors.next_block, EXCLUDED.next_block),
           updated_at = EXCLUDED.updated_at`,
        [invoice.createdBlock, now],
      );
    }
  });

  const stored = await getInvoiceById(invoice.id);
  if (!stored) throw new Error("The invoice could not be stored.");
  return stored;
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const db = await getDatabase();
  const result = await db.query<InvoiceRow>(
    `SELECT ${invoiceColumns} FROM invoices WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ? mapInvoice(result.rows[0]) : null;
}

export async function getInvoiceByShareId(shareId: string): Promise<Invoice | null> {
  const db = await getDatabase();
  const result = await db.query<InvoiceRow>(
    `SELECT ${invoiceColumns} FROM invoices WHERE share_id = $1 LIMIT 1`,
    [shareId],
  );
  return result.rows[0] ? mapInvoice(result.rows[0]) : null;
}

export async function listInvoicesByMerchant(merchantAddress: Address): Promise<Invoice[]> {
  const db = await getDatabase();
  const result = await db.query<InvoiceRow>(
    `SELECT ${invoiceColumns}
     FROM invoices
     WHERE LOWER(merchant_address) = LOWER($1)
     ORDER BY created_at DESC`,
    [getAddress(merchantAddress)],
  );
  return result.rows.map(mapInvoice);
}

export async function getInvoiceVerificationByMemoId(
  memoId: Hex,
): Promise<StoredInvoiceVerification | null> {
  const db = await getDatabase();
  const result = await db.query<InvoiceRow>(
    `SELECT ${invoiceColumns} FROM invoices WHERE memo_id = $1 LIMIT 1`,
    [memoId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    invoice: mapInvoice(row),
    memoId: row.memo_id,
    callDataHash: row.call_data_hash,
    tokenAddress: getAddress(row.token_address),
  };
}

export async function getIndexerCursor(): Promise<bigint | null> {
  const db = await getDatabase();
  const result = await db.query<{ next_block: bigint | string }>(
    "SELECT next_block FROM indexer_cursors WHERE name = 'arc-memo' LIMIT 1",
  );
  return result.rows[0] ? BigInt(result.rows[0].next_block) : null;
}

export async function setIndexerCursor(nextBlock: bigint): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.query(
    `INSERT INTO indexer_cursors (name, next_block, updated_at)
     VALUES ('arc-memo', $1, $2)
     ON CONFLICT (name) DO UPDATE SET
       next_block = EXCLUDED.next_block,
       updated_at = EXCLUDED.updated_at`,
    [nextBlock.toString(), now],
  );
}

export async function markInvoicePaid(input: {
  invoiceId: string;
  transactionHash: Hex;
  logIndex: number;
  payer: Address;
  blockNumber: bigint;
  paidAt: string;
}): Promise<boolean> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();

  return db.transaction(async (transaction) => {
    const inserted = await transaction.query<{ transaction_hash: string }>(
      `INSERT INTO payments (
        transaction_hash, log_index, invoice_id, payer, block_number, paid_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (transaction_hash, log_index) DO NOTHING
      RETURNING transaction_hash`,
      [
        input.transactionHash,
        input.logIndex,
        input.invoiceId,
        getAddress(input.payer),
        input.blockNumber.toString(),
        input.paidAt,
        createdAt,
      ],
    );
    if (inserted.rows.length === 0) return false;

    const updated = await transaction.query<InvoiceRow>(
      `UPDATE invoices
       SET status = 'paid', tx_hash = $1, paid_at = $2, updated_at = $3
       WHERE id = $4
       RETURNING ${invoiceColumns}`,
      [input.transactionHash, input.paidAt, createdAt, input.invoiceId],
    );
    if (updated.rows[0]) {
      await enqueueInvoicePaidWebhooks(
        transaction,
        mapInvoice(updated.rows[0]),
        createdAt,
      );
    }
    return true;
  });
}
