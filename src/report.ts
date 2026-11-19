import type { Cluster, TriageResult } from "./types.js";

const ICON: Record<string, string> = {
  PRODUCT_BUG: "🐞", TEST_BUG: "🧪", FLAKY: "🎲", ENVIRONMENT: "🌐", INFRA: "🏗️", UNKNOWN: "❓",
};

export function renderReport(clusters: Cluster[], results: TriageResult[], totalFailures: number): string {
  const bySig = new Map(results.map((r) => [r.signature, r]));
  const counts: Record<string, number> = {};
  for (const r of results) {
    const size = clusters.find((c) => c.signature === r.signature)?.failures.length ?? 0;
    counts[r.category] = (counts[r.category] ?? 0) + size;
  }

  const lines: string[] = [
    "# FailureSense Triage Report",
    "",
    `**${totalFailures}** failing tests collapsed into **${clusters.length}** unique root-cause groups.`,
    "",
    "| Category | Tests |",
    "|---|---|",
    ...Object.entries(counts).map(([k, v]) => `| ${ICON[k]} ${k} | ${v} |`),
    "",
  ];

  for (const c of clusters) {
    const r = bySig.get(c.signature)!;
    lines.push(
      `## ${ICON[r.category]} ${r.category} · ${r.severity} · ${c.failures.length} test(s)`,
      `*Signature \`${c.signature}\` · confidence ${(r.confidence * 100).toFixed(0)}% · source: ${r.source}*`,
      "",
      `**Root cause:** ${r.rootCause}`,
      "",
      `**Suggested fix:** ${r.suggestedFix}`,
      "",
      "<details><summary>Affected tests and error</summary>",
      "",
      ...c.failures.map((f) => `- \`${f.title}\` (${f.project}${f.flaky ? ", flaky" : ""})`),
      "",
      "```",
      c.failures[0].error.slice(0, 500),
      "```",
      "</details>",
      "",
    );
  }
  return lines.join("\n");
}
