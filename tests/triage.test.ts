import { describe, expect, it } from "vitest";
import { clusterFailures } from "../src/cluster.js";
import type { LLMProvider } from "../src/llm.js";
import { loadPlaywrightReport } from "../src/parser.js";
import { renderReport } from "../src/report.js";
import { parseLLMResponse, triageClusters } from "../src/triage.js";

const clusters = clusterFailures(loadPlaywrightReport("fixtures/playwright-report.json"));

const fakeProvider = (respond: (p: string) => string): LLMProvider => ({
  name: "fake",
  complete: async (p) => respond(p),
});

describe("parseLLMResponse", () => {
  it("accepts JSON wrapped in markdown fences", () => {
    const raw = "```json\n" + JSON.stringify({ results: [{ signature: "a", category: "FLAKY", severity: "LOW", confidence: 0.9, rootCause: "r", suggestedFix: "f" }] }) + "\n```";
    expect(parseLLMResponse(raw)[0].category).toBe("FLAKY");
  });
  it("rejects invalid categories", () => {
    const raw = JSON.stringify({ results: [{ signature: "a", category: "NOPE", severity: "LOW", confidence: 1, rootCause: "r", suggestedFix: "f" }] });
    expect(() => parseLLMResponse(raw)).toThrow();
  });
});

describe("triageClusters", () => {
  it("uses AI output when valid and keeps the heuristic fallback for missing signatures", async () => {
    const provider = fakeProvider(() =>
      JSON.stringify({ results: [{ signature: clusters[0].signature, category: "TEST_BUG", severity: "HIGH", confidence: 0.92, rootCause: "Ambiguous locator", suggestedFix: "Use a unique test id" }] }),
    );
    const results = await triageClusters(clusters, provider);
    expect(results[0].source).toBe("ai");
    expect(results[1].source).toBe("heuristic");
  });

  it("falls back to heuristics when the LLM returns garbage", async () => {
    const results = await triageClusters(clusters, fakeProvider(() => "not json"));
    expect(results.every((r) => r.source === "heuristic")).toBe(true);
  });

  it("includes untrusted-input guard in the prompt", async () => {
    let seen = "";
    await triageClusters(clusters, fakeProvider((p) => ((seen = p), "{}")));
    expect(seen).toContain("untrusted");
  });
});

describe("renderReport", () => {
  it("renders a summary and one section per cluster", async () => {
    const results = await triageClusters(clusters, null);
    const md = renderReport(clusters, results, 6);
    expect(md).toContain("6** failing tests collapsed into **4**");
    expect(md.match(/^## /gm)).toHaveLength(4);
  });
});
