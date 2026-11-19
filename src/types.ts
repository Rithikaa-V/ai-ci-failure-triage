export type Category =
  | "PRODUCT_BUG"
  | "TEST_BUG"
  | "FLAKY"
  | "ENVIRONMENT"
  | "INFRA"
  | "UNKNOWN";

export interface TestFailure {
  id: string;
  title: string;
  file: string;
  project: string;
  error: string;
  stack: string;
  durationMs: number;
  retries: number;
  flaky: boolean;
}

export interface Cluster {
  signature: string;
  normalizedError: string;
  failures: TestFailure[];
  heuristic: Category;
}

export interface TriageResult {
  signature: string;
  category: Category;
  severity: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  rootCause: string;
  suggestedFix: string;
  source: "ai" | "heuristic";
}
