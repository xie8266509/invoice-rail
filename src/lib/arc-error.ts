import { ARC_RPC_URL } from "@/lib/constants";

export function arcErrorMessage(error: unknown, fallback: string): string {
  const objectMessage = error && typeof error === "object" && "message" in error
    ? (error as { message?: unknown }).message
    : undefined;
  const message = error instanceof Error
    ? error.message
    : typeof objectMessage === "string" && objectMessage.trim()
      ? objectMessage
      : fallback;
  if (/request limit reached|rate limit|too many requests|\b429\b/i.test(message)) {
    return `Arc Testnet RPC is rate-limited. In your wallet, change the Arc Testnet RPC URL to ${ARC_RPC_URL}, then retry.`;
  }
  return message;
}
