const appUrl = (process.env.INVOICE_RAIL_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.INDEXER_SECRET;
const intervalMs = Number(process.env.INDEXER_INTERVAL_MS ?? "5000");
const once = process.argv.includes("--once");

if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
  console.error("INDEXER_INTERVAL_MS must be at least 1000 milliseconds.");
  process.exit(1);
}

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
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
  console.log(`${new Date().toISOString()} ${body}`);
}

do {
  try {
    await run();
  } catch (error) {
    console.error(`${new Date().toISOString()} ${error instanceof Error ? error.message : error}`);
    if (once) process.exitCode = 1;
  }
  if (once || stopping) break;
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
} while (!stopping);
