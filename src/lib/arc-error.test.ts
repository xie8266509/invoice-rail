import { describe, expect, it } from "vitest";
import { arcErrorMessage } from "@/lib/arc-error";

describe("Arc RPC errors", () => {
  it("turns rate limits into an actionable wallet instruction", () => {
    expect(arcErrorMessage(new Error("request limit reached"), "fallback"))
      .toContain("change the Arc Testnet RPC URL");
  });

  it("keeps unrelated wallet errors intact", () => {
    expect(arcErrorMessage(new Error("User rejected the request."), "fallback"))
      .toBe("User rejected the request.");
  });
});
