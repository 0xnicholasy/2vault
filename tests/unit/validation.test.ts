import { describe, it, expect } from "vitest";
import { validateOpenRouterKey, validateVaultApiKey } from "@/utils/validation";

describe("validateOpenRouterKey", () => {
  it("returns valid for empty string", () => {
    expect(validateOpenRouterKey("")).toEqual({ valid: true });
  });

  it("returns valid for correctly formatted key", () => {
    expect(
      validateOpenRouterKey("sk-or-v1-abcdefghijklmnop")
    ).toEqual({ valid: true });
  });

  it("returns error for wrong prefix", () => {
    const result = validateOpenRouterKey("sk-test-abcdefghijklmnop");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("sk-or-");
  });

  it("returns error for too-short key", () => {
    const result = validateOpenRouterKey("sk-or-short");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too short");
  });
});

describe("validateVaultApiKey", () => {
  it("returns valid for empty string", () => {
    expect(validateVaultApiKey("")).toEqual({ valid: true });
  });

  it("returns valid for key with sufficient length", () => {
    expect(validateVaultApiKey("abcdef")).toEqual({ valid: true });
  });

  it("returns error for too-short key", () => {
    const result = validateVaultApiKey("abc");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too short");
  });
});
