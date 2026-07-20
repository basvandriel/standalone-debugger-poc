import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.join(__dirname, "..", "fixtures");
const EXE = process.platform === "win32" ? ".exe" : "";

/** Normalize path separators to forward slashes for cross-platform comparisons. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

export interface FixtureConfig {
  name: string;
  cwd: string;
  program: string;
  source: string;
  breakpointLine: number;
  expectedSummary: string;
}

export const FIXTURE_CONFIGS: Record<string, FixtureConfig> = {
  "loop-demo": {
    name: "loop-demo",
    cwd: path.join(FIXTURES_ROOT, "loop-demo"),
    program: path.join(
      FIXTURES_ROOT,
      "loop-demo",
      "target",
      "debug",
      `loop-demo${EXE}`,
    ),
    source: path.join(FIXTURES_ROOT, "loop-demo", "src", "main.rs"),
    breakpointLine: 7,
    expectedSummary: "items=[2, 4, 6, 8, 10] total=30",
  },
  "c-loop": {
    name: "c-loop",
    cwd: path.join(FIXTURES_ROOT, "c-loop"),
    program: path.join(FIXTURES_ROOT, "c-loop", "target", "debug", `c-loop${EXE}`),
    source: path.join(FIXTURES_ROOT, "c-loop", "src", "main.c"),
    // Line 34: `total += doubled` — at this point doubled=2 and total=0 are both
    // in scope with known values, matching the Rust fixture's assertion expectations.
    breakpointLine: 34,
    expectedSummary: "items=[2, 4, 6, 8, 10] total=30",
  },
  "cpp-loop": {
    name: "cpp-loop",
    cwd: path.join(FIXTURES_ROOT, "cpp-loop"),
    program: path.join(
      FIXTURES_ROOT,
      "cpp-loop",
      "target",
      "debug",
      `cpp-loop${EXE}`,
    ),
    source: path.join(FIXTURES_ROOT, "cpp-loop", "src", "main.cpp"),
    breakpointLine: 28,
    expectedSummary: "items=[2, 4, 6, 8, 10] total=30",
  },
  "multi-file-demo": {
    name: "multi-file-demo",
    cwd: path.join(FIXTURES_ROOT, "multi-file-demo"),
    program: path.join(
      FIXTURES_ROOT,
      "multi-file-demo",
      "target",
      "debug",
      `multi-file-demo${EXE}`,
    ),
    source: path.join(FIXTURES_ROOT, "multi-file-demo", "src", "main.rs"),
    breakpointLine: 5,
    expectedSummary: "values=[2, 4, 6, 8, 10] total=30",
  },
  "python-loop": {
    name: "python-loop",
    cwd: path.join(FIXTURES_ROOT, "python-loop"),
    program: path.join(FIXTURES_ROOT, "python-loop", "main.py"),
    source: path.join(FIXTURES_ROOT, "python-loop", "main.py"),
    // Line 10: `total += doubled` — first hit: doubled=2, total=0
    breakpointLine: 10,
    expectedSummary: "items=[2, 4, 6, 8, 10] total=30",
  },
  "attach-demo": {
    name: "attach-demo",
    cwd: path.join(FIXTURES_ROOT, "attach-demo"),
    program: path.join(
      FIXTURES_ROOT,
      "attach-demo",
      "target",
      "debug",
      `attach-demo${EXE}`,
    ),
    source: path.join(FIXTURES_ROOT, "attach-demo", "src", "main.rs"),
    breakpointLine: 11,
    expectedSummary: "done, final count=5",
  },
};

export function getFixtureConfig(fixtureName: string): FixtureConfig {
  const config = FIXTURE_CONFIGS[fixtureName];
  if (!config) {
    throw new Error(
      `Unknown fixture: ${fixtureName}. Supported fixtures: ${Object.keys(FIXTURE_CONFIGS).join(", ")}`,
    );
  }
  return config;
}

export const fixtureNames = Object.keys(FIXTURE_CONFIGS);
