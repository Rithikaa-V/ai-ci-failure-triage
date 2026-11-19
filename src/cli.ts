import "dotenv/config";
import { appendFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { clusterFailures } from "./cluster.js";
import { createProvider } from "./llm.js";
import { loadPlaywrightReport } from "./parser.js";
import { renderReport } from "./report.js";
import { triageClusters } from "./triage.js";

const { values } = parseArgs({
  options: {
    report: { type: "string", default: "playwright-report.json" },
    out: { type: "string", default: "triage-report.md" },
    provider: { type: "string", default: "gemini" }, // gemini | groq | none
    "fail-on-product-bug": { type: "boolean", default: false },
  },
});

const failures = loadPlaywrightReport(values.report!);
if (failures.length === 0) {
  console.log("No failures found. Nothing to triage.");
  process.exit(0);
}

const clusters = clusterFailures(failures);
const provider = values.provider === "none" ? null : createProvider(values.provider!);
if (!provider && values.provider !== "none") {
  console.warn(`No API key for "${values.provider}". Using heuristic classification only.`);
}

const results = await triageClusters(clusters, provider);
const markdown = renderReport(clusters, results, failures.length);
writeFileSync(values.out!, markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);

console.log(`${failures.length} failures -> ${clusters.length} groups. Report: ${values.out}`);
if (values["fail-on-product-bug"] && results.some((r) => r.category === "PRODUCT_BUG")) process.exit(1);
