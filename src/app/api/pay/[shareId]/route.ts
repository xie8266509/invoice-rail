import { NextResponse } from "next/server";
import { getInvoiceByShareId } from "@/lib/server/invoice-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await context.params;
  if (!/^[a-f0-9]{32}$/.test(shareId)) {
    return NextResponse.json({ error: "Payment link is invalid." }, { status: 400 });
  }
  const invoice = await getInvoiceByShareId(shareId);
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  return NextResponse.json({ invoice });
}
