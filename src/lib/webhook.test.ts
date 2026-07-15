import { describe, expect, it } from "vitest";
import { normalizeWebhookUrl, webhookRetryDelayMs } from "@/lib/webhook";

describe("webhook utilities", () => {
  it("accepts HTTPS and removes a default port", () => {
    expect(normalizeWebhookUrl("https://example.com:443/events")).toBe(
      "https://example.com/events",
    );
  });

  it("rejects insecure public endpoints", () => {
    expect(() => normalizeWebhookUrl("http://example.com/events")).toThrow("HTTPS");
  });

  it("only allows localhost HTTP when explicitly enabled", () => {
    expect(normalizeWebhookUrl("http://127.0.0.1:4000/hook", true)).toBe(
      "http://127.0.0.1:4000/hook",
    );
  });

  it("rejects private network targets", () => {
    expect(() => normalizeWebhookUrl("https://192.168.1.20/hook")).toThrow("private network");
    expect(() => normalizeWebhookUrl("https://localhost/hook")).toThrow("localhost");
  });

  it("caps exponential retry delays", () => {
    expect(webhookRetryDelayMs(1)).toBe(60_000);
    expect(webhookRetryDelayMs(9)).toBe(12 * 60 * 60_000);
  });
});
