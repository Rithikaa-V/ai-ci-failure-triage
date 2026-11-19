import { readFileSync } from "node:fs";
import type { TestFailure } from "./types.js";

const ANSI = /\u001b\[[0-9;]*m/g;
export const stripAnsi = (s = ""): string => s.replace(ANSI, "");

interface PwResult {
  status: string;
  duration: number;
  retry: number;
  error?: { message?: string; stack?: string };
}
interface PwTest {
  projectName?: string;
  status?: string;
  results: PwResult[];
}
interface PwSpec {
  title: string;
  file?: string;
  tests: PwTest[];
}
interface PwSuite {
  title?: string;
  file?: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}

/** Extract failed + flaky tests from a Playwright JSON report. */
export function parsePlaywrightReport(report: { suites?: PwSuite[] }): TestFailure[] {
  const out: TestFailure[] = [];

  const walk = (suite: PwSuite, path: string[]) => {
    const here = suite.title ? [...path, suite.title] : path;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests) {
        if (t.status !== "unexpected" && t.status !== "flaky") continue;
        const failedRun = t.results.find((r) => r.status === "failed" || r.status === "timedOut");
        if (!failedRun) continue;
        const project = t.projectName ?? "default";
        const file = spec.file ?? suite.file ?? "unknown";
        const title = [...here, spec.title].join(" › ");
        out.push({
          id: `${file}::${title}::${project}`,
          title,
          file,
          project,
          error: stripAnsi(failedRun.error?.message ?? "No error message"),
          stack: stripAnsi(failedRun.error?.stack ?? ""),
          durationMs: failedRun.duration,
          retries: t.results.length - 1,
          flaky: t.status === "flaky",
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };

  for (const s of report.suites ?? []) walk(s, []);
  return out;
}

export function loadPlaywrightReport(path: string): TestFailure[] {
  return parsePlaywrightReport(JSON.parse(readFileSync(path, "utf8")));
}
