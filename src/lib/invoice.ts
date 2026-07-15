import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { TOKENS, type TokenSymbol } from "@/lib/constants";

export type InvoiceStatus = "open" | "processing" | "paid" | "expired";

export type Invoice = {
  id: string;
  merchantName: string;
  recipient: Address;
  amount: string;
  token: TokenSymbol;
  memo: string;
  dueDate: string;
  createdAt: string;
  createdBlock?: string;
  status: InvoiceStatus;
  txHash?: Hex;
  paidAt?: string;
  shareId?: string;
  merchantAddress?: Address;
};

export type ShareableInvoice = Pick<
  Invoice,
  | "id"
  | "merchantName"
  | "recipient"
  | "amount"
  | "token"
  | "memo"
  | "dueDate"
  | "createdAt"
  | "createdBlock"
>;

export type InvoiceInput = {
  merchantName: string;
  recipient: string;
  amount: string;
  token: TokenSymbol;
  memo: string;
  dueDate: string;
};

export type InvoiceValidationErrors = Partial<Record<keyof InvoiceInput, string>>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function createInvoiceId(now = new Date()): string {
  const date = now.toISOString().slice(2, 10).replaceAll("-", "");
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  return `IR-${date}-${random}`;
}

export function validateInvoiceInput(input: InvoiceInput): InvoiceValidationErrors {
  const errors: InvoiceValidationErrors = {};
  const amount = Number(input.amount);

  if (input.merchantName.trim().length < 2) {
    errors.merchantName = "Enter a merchant or project name.";
  }
  if (!isAddress(input.recipient)) {
    errors.recipient = "Enter a valid EVM recipient address.";
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Enter an amount greater than zero.";
  } else if (!/^\d+(\.\d{1,6})?$/.test(input.amount)) {
    errors.amount = "Use no more than 6 decimal places.";
  }
  if (!input.dueDate) {
    errors.dueDate = "Choose a due date.";
  }
  if (input.memo.length > 120) {
    errors.memo = "Keep the memo under 120 characters.";
  }

  return errors;
}

export function createInvoice(
  input: InvoiceInput,
  createdBlock?: bigint,
  now = new Date(),
): Invoice {
  return {
    id: createInvoiceId(now),
    merchantName: input.merchantName.trim(),
    recipient: getAddress(input.recipient),
    amount: input.amount,
    token: input.token,
    memo: input.memo.trim(),
    dueDate: input.dueDate,
    createdAt: now.toISOString(),
    createdBlock: createdBlock?.toString(),
    status: "open",
  };
}

export function toShareableInvoice(invoice: Invoice | ShareableInvoice): ShareableInvoice {
  const {
    id,
    merchantName,
    recipient,
    amount,
    token,
    memo,
    dueDate,
    createdAt,
    createdBlock,
  } = invoice;
  return {
    id,
    merchantName,
    recipient,
    amount,
    token,
    memo,
    dueDate,
    createdAt,
    createdBlock,
  };
}

export function encodeInvoice(invoice: Invoice | ShareableInvoice): string {
  return bytesToBase64Url(encoder.encode(JSON.stringify(toShareableInvoice(invoice))));
}

export function decodeInvoice(encoded: string): Invoice {
  try {
    const decoded = JSON.parse(decoder.decode(base64UrlToBytes(encoded))) as unknown;
    if (!decoded || typeof decoded !== "object") throw new Error();

    const parsed = decoded as Record<string, unknown>;
    const validCreatedBlock =
      parsed.createdBlock === undefined ||
      (typeof parsed.createdBlock === "string" && /^\d+$/.test(parsed.createdBlock));
    const validDueDate =
      typeof parsed.dueDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate) &&
      Number.isFinite(new Date(`${parsed.dueDate}T12:00:00`).getTime());
    const validAmount =
      typeof parsed.amount === "string" &&
      /^\d+(\.\d{1,6})?$/.test(parsed.amount) &&
      Number(parsed.amount) > 0;
    const validToken =
      typeof parsed.token === "string" && Object.hasOwn(TOKENS, parsed.token);

    if (
      typeof parsed.id !== "string" ||
      parsed.id.length > 80 ||
      typeof parsed.merchantName !== "string" ||
      parsed.merchantName.length < 2 ||
      parsed.merchantName.length > 80 ||
      typeof parsed.recipient !== "string" ||
      !isAddress(parsed.recipient) ||
      !validToken ||
      !validAmount ||
      typeof parsed.memo !== "string" ||
      parsed.memo.length > 120 ||
      !validDueDate ||
      typeof parsed.createdAt !== "string" ||
      !Number.isFinite(new Date(parsed.createdAt).getTime()) ||
      !validCreatedBlock
    ) {
      throw new Error();
    }

    const invoice = parsed as unknown as ShareableInvoice;
    return {
      ...invoice,
      recipient: getAddress(invoice.recipient),
      status: isInvoiceExpired(invoice) ? "expired" : "open",
    };
  } catch {
    throw new Error("This payment link is incomplete or invalid.");
  }
}

export function getMemoId(invoiceId: string): Hex {
  return keccak256(stringToHex(invoiceId));
}

export function getTransferData(invoice: ShareableInvoice): Hex {
  const token = TOKENS[invoice.token];
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [invoice.recipient, parseUnits(invoice.amount, token.decimals)],
  });
}

export function getCallDataHash(invoice: ShareableInvoice): Hex {
  return keccak256(getTransferData(invoice));
}

export function getMemoData(invoice: ShareableInvoice): Hex {
  const note = invoice.memo ? `;note=${invoice.memo.slice(0, 80)}` : "";
  return stringToHex(`invoice=${invoice.id}${note}`);
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function isInvoiceExpired(invoice: ShareableInvoice): boolean {
  const due = new Date(`${invoice.dueDate}T23:59:59`).getTime();
  return Number.isFinite(due) && due < Date.now();
}
