import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { evaluateOperationalAlerts, getOperationalMetrics } from "@/lib/server/metrics";
import { logEvent, requestId, requestLogData, withRequestId } from "@/lib/server/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const database = await getDatabase();
    await database.query("SELECT 1 AS ready");
    const metrics = await getOperationalMetrics(database);
    const alerts = evaluateOperationalAlerts(metrics);
    const hasCriticalAlert = alerts.some((alert) => alert.severity === "critical");

    return withRequestId(NextResponse.json(
      {
        status: hasCriticalAlert ? "degraded" : "ok",
        timestamp: new Date().toISOString(),
        schemaVersion: metrics.schema.currentVersion,
        alerts: alerts.map((alert) => alert.code),
      },
      {
        status: hasCriticalAlert ? 503 : 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    ), id);
  } catch (error) {
    logEvent("error", "health.failed", { ...requestLogData(request, id), error });
    return withRequestId(NextResponse.json(
      {
        status: "unavailable",
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    ), id);
  }
}
