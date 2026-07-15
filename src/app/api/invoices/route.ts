import { NextResponse } from "next/server";
import { getAddress } from "viem";
import {
  AuthenticationError,
  hasValidRequestOrigin,
} from "@/lib/server/auth";
import { PermissionError, requireWorkspaceAccess } from "@/lib/server/permissions";
import {
  listInvoicesByMerchant,
  storeInvoice,
} from "@/lib/server/invoice-repository";
import {
  validateInvoiceInput,
  type Invoice,
  type InvoiceInput,
} from "@/lib/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "The invoice request failed.";
}

function parseInvoice(value: unknown): Invoice {
  if (!value || typeof value !== "object") throw new Error("Invoice data is required.");
  const input = value as Record<string, unknown>;
  const token = input.token === "USDC" || input.token === "EURC" ? input.token : "USDC";
  const candidate: InvoiceInput = {
    merchantName: typeof input.merchantName === "string" ? input.merchantName : "",
    recipient: typeof input.recipient === "string" ? input.recipient : "",
    amount: typeof input.amount === "string" ? input.amount : "",
    token,
    memo: typeof input.memo === "string" ? input.memo : "",
    dueDate: typeof input.dueDate === "string" ? input.dueDate : "",
  };
  const errors = validateInvoiceInput(candidate);
  if (Object.keys(errors).length > 0) throw new Error("Invoice fields are invalid.");
  if (typeof input.id !== "string" || !/^IR-\d{6}-[A-F0-9]{6,12}$/.test(input.id)) {
    throw new Error("Invoice ID is invalid.");
  }
  if (
    typeof input.createdAt !== "string" ||
    !Number.isFinite(new Date(input.createdAt).getTime())
  ) {
    throw new Error("Invoice creation time is invalid.");
  }
  if (
    input.createdBlock !== undefined &&
    (typeof input.createdBlock !== "string" || !/^\d+$/.test(input.createdBlock))
  ) {
    throw new Error("Invoice block anchor is invalid.");
  }

  return {
    id: input.id,
    ...candidate,
    recipient: getAddress(candidate.recipient),
    merchantName: candidate.merchantName.trim(),
    memo: candidate.memo.trim(),
    createdAt: input.createdAt,
    createdBlock: input.createdBlock as string | undefined,
    status: "open",
  };
}

export async function GET(request: Request) {
  try {
    const access = await requireWorkspaceAccess(request, "viewer");
    const invoices = await listInvoicesByMerchant(access.workspaceAddress);
    return NextResponse.json({ invoices });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const access = await requireWorkspaceAccess(request, "editor");
    const body = await request.json() as { invoice?: unknown };
    const invoice = parseInvoice(body.invoice);
    const stored = await storeInvoice(invoice, access.workspaceAddress);
    return NextResponse.json({ invoice: stored }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
