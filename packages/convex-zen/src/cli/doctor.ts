import type { DoctorResult } from "./detect.js";
import { detectProject } from "./detect.js";

export interface DoctorOptions {
  cwd: string;
  json: boolean;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  return detectProject(options.cwd);
}

export function formatDoctorReport(result: DoctorResult): string {
  const lines: string[] = [
    "convex-zen doctor",
    `  framework: ${result.framework}`,
    `  state: ${result.state}`,
    `  recommended flow: ${result.recommendedFlow}`,
    "  findings:",
  ];

  for (const finding of result.findings) {
    const suffix = finding.path ? ` (${finding.path})` : "";
    lines.push(`    - [${finding.status}] ${finding.message}${suffix}`);
  }

  lines.push("  docs:");
  for (const doc of result.recommendedDocs) {
    lines.push(`    - ${doc}`);
  }

  lines.push("  next steps:");
  for (const step of result.nextSteps) {
    lines.push(`    - ${step}`);
  }

  return lines.join("\n");
}
