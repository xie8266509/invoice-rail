import type { Invoice } from "@/lib/invoice";

const headers = [
  "invoice_id",
  "status",
  "merchant",
  "recipient",
  "amount",
  "token",
  "memo",
  "due_date",
  "created_at",
  "paid_at",
  "transaction_hash",
] as const;

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function invoicesToCsv(invoices: Invoice[]): string {
  const rows = invoices.map((invoice) => [
    invoice.id,
    invoice.status,
    invoice.merchantName,
    invoice.recipient,
    invoice.amount,
    invoice.token,
    invoice.memo,
    invoice.dueDate,
    invoice.createdAt,
    invoice.paidAt ?? "",
    invoice.txHash ?? "",
  ]);
  return [headers, ...rows]
    .map((row) => row.map((value) => csvCell(String(value))).join(","))
    .join("\r\n");
}
