import { NextResponse } from "next/server";
import { getInvoiceByShareId } from "@/lib/server/invoice-repository";
import { withRequestId, requestId } from "@/lib/server/observability";
import {
  createRateLimitResponse,
  enforceRateLimit,
  RATE_LIMITS,
  RateLimitError,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ shareId: string }> },
) {
  const id = requestId(request);
  try {
    await enforceRateLimit(request, RATE_LIMITS.publicPaymentRead);
  } catch (error) {
    if (error instanceof RateLimitError) return withRequestId(createRateLimitResponse(error), id);
    return withRequestId(
      NextResponse.json({ error: "Payment link is unavailable." }, { status: 503 }),
      id,
    );
  }
  const { shareId } = await context.params;
  if (!/^[a-f0-9]{32}$/.test(shareId)) {
    return withRequestId(
      NextResponse.json({ error: "Payment link is invalid." }, { status: 400 }),
      id,
    );
  }
  const invoice = await getInvoiceByShareId(shareId);
  if (!invoice) {
    return withRequestId(NextResponse.json({ error: "Invoice not found." }, { status: 404 }), id);
  }
  return withRequestId(NextResponse.json({ invoice }), id);
}
