import { createHash } from "node:crypto";
import { stripAnsi } from "./parser.js";
import type { Category, Cluster, TestFailure } from "./types.js";

/** Strip volatile parts (numbers, ids, urls) so the same root cause gets the same signature. */
export function normalizeError(message: string): string {
  return stripAnsi(message)
    .split("\n")
    .slice(0, 3)
    .join(" ")
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/0x[0-9a-f]+/gi, "<hex>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

// Order matters: first match wins.
const RULES: Array<[RegExp, Category]> = [
  [/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|net::ERR_|socket hang up|\b50[234]\b/i, "ENVIRONMENT"],
  [/out of memory|ENOSPC|Target (page, context or browser )?has been closed|worker process/i, "INFRA"],
  [/strict mode violation|waiting for (locator|selector)|element is not (visible|attached|stable)|locator\./i, "TEST_BUG"],
  [/expect\(|Expected|Received|toBe|toEqual|toHaveText|toContain/i, "PRODUCT_BUG"],
  [/Timeout \d+ms exceeded/i, "FLAKY"],
];

export function heuristicCategory(message: string, allFlaky = false): Category {
  if (allFlaky) return "FLAKY";
  for (const [re, cat] of RULES) if (re.test(message)) return cat;
  return "UNKNOWN";
}

export function clusterFailures(failures: TestFailure[]): Cluster[] {
  const map = new Map<string, Cluster>();
  for (const f of failures) {
    const normalizedError = normalizeError(f.error);
    const signature = createHash("sha1").update(normalizedError).digest("hex").slice(0, 10);
    const existing = map.get(signature);
    if (existing) existing.failures.push(f);
    else map.set(signature, { signature, normalizedError, failures: [f], heuristic: "UNKNOWN" });
  }
  const clusters = [...map.values()];
  for (const c of clusters) {
    c.heuristic = heuristicCategory(c.failures[0].error, c.failures.every((f) => f.flaky));
  }
  return clusters.sort((a, b) => b.failures.length - a.failures.length);
}
