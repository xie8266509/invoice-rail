const appUrl = (process.env.INVOICE_RAIL_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.INDEXER_SECRET;
const intervalMs = Number(process.env.INDEXER_INTERVAL_MS ?? "5000");
const once = process.argv.includes("--once");

if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
  console.error("INDEXER_INTERVAL_MS must be at least 1000 milliseconds.");
  process.exit(1);
}

let stopping = false;

function log(level, event, data = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "invoice-rail-worker",
    event,
    ...data,
  });
  if (level === "error") console.error(entry);
  else console.log(entry);
}

process.on("SIGINT", () => {
  stopping = true;
  log("info", "worker.stopping", { signal: "SIGINT" });
});
process.on("SIGTERM", () => {
  stopping = true;
  log("info", "worker.stopping", { signal: "SIGTERM" });
});

async function run() {
  const headers = secret ? { authorization: `Bearer ${secret}` } : undefined;
  const response = await fetch(`${appUrl}/api/indexer`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Background jobs returned HTTP ${response.status}: ${body}`);
  let result = {};
  try {
    result = JSON.parse(body);
  } catch {
    result = { response: body.slice(0, 2_000) };
  }
  log("info", "worker.cycle.completed", {
    requestId: response.headers.get("x-request-id") ?? undefined,
    result,
  });
}

do {
  try {
    await run();
  } catch (error) {
    log("error", "worker.cycle.failed", {
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    });
    if (once) process.exitCode = 1;
  }
  if (once || stopping) break;
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
} while (!stopping);
