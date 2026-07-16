import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  evaluateOperationalAlerts,
  getOperationalMetrics,
} from "@/lib/server/metrics";
import { logEvent, requestId, requestLogData, withRequestId } from "@/lib/server/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request, secret: string): boolean {
  const value = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function GET(request: Request) {
  const id = requestId(request);
  const secret = process.env.METRICS_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return withRequestId(
      NextResponse.json({ error: "Operational metrics are not configured." }, { status: 503 }),
      id,
    );
  }
  if (secret && !authorized(request, secret)) {
    logEvent("warn", "metrics.unauthorized", requestLogData(request, id));
    return withRequestId(
      NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
      id,
    );
  }
  try {
    const metrics = await getOperationalMetrics();
    return withRequestId(NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      metrics,
      alerts: evaluateOperationalAlerts(metrics),
    }, { headers: { "Cache-Control": "no-store" } }), id);
  } catch (error) {
    logEvent("error", "metrics.failed", { ...requestLogData(request, id), error });
    return withRequestId(
      NextResponse.json({ error: "Operational metrics are unavailable." }, { status: 503 }),
      id,
    );
  }
}
