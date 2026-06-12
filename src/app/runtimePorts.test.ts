import { describe, expect, it } from "vitest";
import { resolveAppDataMode } from "./runtimePorts";

describe("resolveAppDataMode", () => {
  it("uses explicit mode when provided", () => {
    expect(resolveAppDataMode({ mode: "mock", supabaseUrl: "url", supabaseAnonKey: "key" })).toBe("mock");
    expect(resolveAppDataMode({ mode: "supabase" })).toBe("supabase");
  });

  it("defaults to supabase only when both env values exist", () => {
    expect(resolveAppDataMode({ supabaseUrl: "url", supabaseAnonKey: "key" })).toBe("supabase");
    expect(resolveAppDataMode({ supabaseUrl: "url" })).toBe("mock");
    expect(resolveAppDataMode({})).toBe("mock");
  });
});
