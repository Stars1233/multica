import { describe, expect, it } from "vitest";
import { isSkillsLocalSupportedProvider } from "./skills-local-support";

describe("isSkillsLocalSupportedProvider", () => {
  it("returns true for the providers whose runtime honours skills_local", () => {
    expect(isSkillsLocalSupportedProvider("claude")).toBe(true);
    expect(isSkillsLocalSupportedProvider("codex")).toBe(true);
  });

  it("returns false for every other provider in the daemon catalog", () => {
    // Snapshot of the providers daemon recognises today (MUL-2603 thread).
    // None of them currently enforce skills_local at exec time, so the UI
    // hides the toggle for all of them.
    for (const p of [
      "copilot",
      "opencode",
      "openclaw",
      "pi",
      "cursor",
      "kimi",
      "kiro",
      "gemini",
      "hermes",
    ]) {
      expect(isSkillsLocalSupportedProvider(p)).toBe(false);
    }
  });

  it("returns false for missing / unknown provider values", () => {
    expect(isSkillsLocalSupportedProvider(null)).toBe(false);
    expect(isSkillsLocalSupportedProvider(undefined)).toBe(false);
    expect(isSkillsLocalSupportedProvider("")).toBe(false);
    expect(isSkillsLocalSupportedProvider("not-a-real-provider")).toBe(false);
  });
});
