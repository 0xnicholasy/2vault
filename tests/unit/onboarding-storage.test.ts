import { describe, it, expect, vi, beforeEach } from "vitest";

const syncStore: Record<string, unknown> = {};

function setupChromeMock() {
  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        get: vi.fn((key: string) =>
          Promise.resolve({ [key]: syncStore[key] })
        ),
        set: vi.fn((obj: Record<string, unknown>) => {
          Object.assign(syncStore, obj);
          return Promise.resolve();
        }),
      },
      local: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
        remove: vi.fn(() => Promise.resolve()),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  });
}

setupChromeMock();

const { isFirstTimeUser, markOnboardingComplete, setOnboardingStep } =
  await import("@/utils/storage");

beforeEach(() => {
  for (const key of Object.keys(syncStore)) delete syncStore[key];
  vi.clearAllMocks();
  setupChromeMock();
});

describe("isFirstTimeUser", () => {
  it("returns true when onboardingComplete is not set", async () => {
    const result = await isFirstTimeUser();
    expect(result).toBe(true);
  });

  it("returns true when onboardingComplete is false", async () => {
    syncStore["onboardingComplete"] = false;
    const result = await isFirstTimeUser();
    expect(result).toBe(true);
  });

  it("returns false after markOnboardingComplete()", async () => {
    await markOnboardingComplete();
    const result = await isFirstTimeUser();
    expect(result).toBe(false);
  });
});

describe("markOnboardingComplete", () => {
  it("sets onboardingComplete to true in sync storage", async () => {
    await markOnboardingComplete();
    expect(syncStore["onboardingComplete"]).toBe(true);
  });
});

describe("setOnboardingStep", () => {
  it("persists step number to sync storage", async () => {
    await setOnboardingStep(1);
    expect(syncStore["onboardingStep"]).toBe(1);
  });

  it("overwrites previous step value", async () => {
    await setOnboardingStep(0);
    await setOnboardingStep(2);
    expect(syncStore["onboardingStep"]).toBe(2);
  });
});
