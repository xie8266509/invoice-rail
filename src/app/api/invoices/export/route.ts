import { NextResponse } from "next/server";
import { invoicesToCsv } from "@/lib/csv";
import { AuthenticationError } from "@/lib/server/auth";
import { listInvoicesByMerchant } from "@/lib/server/invoice-repository";
import { PermissionError, requireWorkspaceAccess } from "@/lib/server/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await requireWorkspaceAccess(request, "viewer");
    const invoices = await listInvoicesByMerchant(access.workspaceAddress);
    const filename = `invoice-rail-${access.workspaceAddress.slice(2, 8).toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(`\uFEFF${invoicesToCsv(invoices)}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof AuthenticationError
      ? 401
      : error instanceof PermissionError
        ? 403
        : 500;
    const reason = error instanceof Error ? error.message : "CSV export failed.";
    return NextResponse.json({ error: reason }, { status });
  }
}
