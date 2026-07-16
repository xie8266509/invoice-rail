import { NextResponse } from "next/server";
import { runArcIndexer } from "@/lib/server/indexer";
import { recordServiceHeartbeat } from "@/lib/server/metrics";
import { logEvent, requestId, requestLogData, withRequestId } from "@/lib/server/observability";
import {
  createRateLimitResponse,
  enforceRateLimit,
  RATE_LIMITS,
  RateLimitError,
} from "@/lib/server/rate-limit";
import { dispatchPendingWebhooks } from "@/lib/server/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const id = requestId(request);
  const secret = process.env.INDEXER_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return withRequestId(
      NextResponse.json({ error: "Indexer is not configured." }, { status: 503 }),
      id,
    );
  }
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    logEvent("warn", "indexer.unauthorized", requestLogData(request, id));
    return withRequestId(NextResponse.json({ error: "Unauthorized." }, { status: 401 }), id);
  }
  try {
    await enforceRateLimit(request, RATE_LIMITS.indexer, "worker");
    const startedAt = Date.now();
    const indexer = await runArcIndexer(12);
    const webhooks = await dispatchPendingWebhooks(20);
    const durationMs = Date.now() - startedAt;
    await recordServiceHeartbeat("indexer", "ok", { durationMs, indexer, webhooks });
    logEvent("info", "indexer.completed", {
      ...requestLogData(request, id),
      durationMs,
      indexer,
      webhooks,
    });
    return withRequestId(NextResponse.json({ indexer, webhooks, durationMs }), id);
  } catch (error) {
    if (error instanceof RateLimitError) {
      logEvent("warn", "indexer.rate_limited", requestLogData(request, id));
      return withRequestId(createRateLimitResponse(error), id);
    }
    const reason = error instanceof Error ? error.message : "Indexer failed.";
    await recordServiceHeartbeat("indexer", "error", { error }).catch(() => undefined);
    logEvent("error", "indexer.failed", { ...requestLogData(request, id), error });
    return withRequestId(NextResponse.json({ error: reason }, { status: 500 }), id);
  }
}
