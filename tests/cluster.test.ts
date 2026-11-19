import { describe, expect, it } from "vitest";
import { clusterFailures, heuristicCategory, normalizeError } from "../src/cluster.js";
import { loadPlaywrightReport } from "../src/parser.js";

describe("normalizeError", () => {
  it("removes volatile numbers, urls and ids", () => {
    const a = normalizeError("Timeout 30000ms at http://x.io/a?id=1 for #btn-1");
    const b = normalizeError("Timeout 5000ms at http://y.io/b?id=9 for #btn-7");
    expect(a).toBe(b);
  });
});

describe("heuristicCategory", () => {
  it.each([
    ["connect ECONNREFUSED 10.0.0.1:80", "ENVIRONMENT"],
    ["strict mode violation: locator resolved to 2 elements", "TEST_BUG"],
    ["Expected: 1 Received: 2", "PRODUCT_BUG"],
    ["Target page, context or browser has been closed", "INFRA"],
    ["Timeout 5000ms exceeded.", "FLAKY"],
    ["something odd", "UNKNOWN"],
  ])("%s -> %s", (msg, cat) => expect(heuristicCategory(msg)).toBe(cat));

  it("marks all-flaky clusters as FLAKY", () => {
    expect(heuristicCategory("Expected: 1", true)).toBe("FLAKY");
  });
});

describe("clusterFailures (fixture)", () => {
  it("groups 6 failures into 4 root causes, largest first", () => {
    const failures = loadPlaywrightReport("fixtures/playwright-report.json");
    expect(failures).toHaveLength(6);
    const clusters = clusterFailures(failures);
    expect(clusters).toHaveLength(4);
    expect(clusters[0].failures).toHaveLength(3);
    expect(clusters[0].heuristic).toBe("TEST_BUG");
  });
});
