import { NextResponse } from "next/server";
import { runArcIndexer } from "@/lib/server/indexer";
import { dispatchPendingWebhooks } from "@/lib/server/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.INDEXER_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Indexer is not configured." }, { status: 503 });
  }
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const indexer = await runArcIndexer(12);
    const webhooks = await dispatchPendingWebhooks(20);
    return NextResponse.json({ indexer, webhooks });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Indexer failed.";
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
