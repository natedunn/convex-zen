import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { detectProject } from "../src/cli/detect.js";
import { formatDoctorReport } from "../src/cli/doctor.js";

const tempDirs: string[] = [];

async function createTempProject(): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "convex-zen-doctor-"));
  tempDirs.push(cwd);
  return cwd;
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(value, null, 2), "utf8");
}

async function writeText(targetPath: string, source: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, source, "utf8");
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("detectProject", () => {
  it("detects Next + Convex + no auth", async () => {
    const cwd = await createTempProject();
    await writeJson(path.join(cwd, "package.json"), {
      name: "next-app",
      dependencies: { next: "^15.0.0", convex: "^1.36.0" },
    });
    await writeText(path.join(cwd, "next.config.ts"), "export default {};\n");
    await writeText(path.join(cwd, "convex", "convex.config.ts"), "export default {};\n");

    const result = await detectProject(cwd);

    expect(result.framework).toBe("next");
    expect(result.state).toBe("existing-framework-with-convex-no-auth");
    expect(result.recommendedDocs).toEqual([
      "apps/docs/external/install/next/add-to-existing-convex.md",
    ]);
    expect(result.nextSteps[1]).toContain("npx convex-zen generate");
  });

  it("detects TanStack Start + Convex + no auth", async () => {
    const cwd = await createTempProject();
    await writeJson(path.join(cwd, "package.json"), {
      name: "tanstack-app",
      dependencies: {
        "@tanstack/react-start": "^1.0.0",
        convex: "^1.36.0",
      },
    });
    await writeText(path.join(cwd, "vite.config.ts"), "export default {};\n");
    await writeText(path.join(cwd, "src", "routes", "__root.tsx"), "export {};\n");
    await writeText(path.join(cwd, "convex", "convex.config.ts"), "export default {};\n");

    const result = await detectProject(cwd);

    expect(result.framework).toBe("tanstack-start");
    expect(result.state).toBe("existing-framework-with-convex-no-auth");
    expect(result.recommendedDocs).toEqual([
      "apps/docs/external/install/tanstack-start/add-to-existing-convex.md",
    ]);
  });

  it("detects Next + Convex Auth", async () => {
    const cwd = await createTempProject();
    await writeJson(path.join(cwd, "package.json"), {
      name: "next-auth-app",
      dependencies: {
        next: "^15.0.0",
        convex: "^1.36.0",
        "@convex-dev/auth": "^0.0.88",
      },
    });
    await writeText(path.join(cwd, "next.config.ts"), "export default {};\n");
    await writeText(path.join(cwd, "convex", "convex.config.ts"), "export default {};\n");
    await writeText(
      path.join(cwd, "convex", "auth.ts"),
      'import { convexAuth } from "@convex-dev/auth/server";\nexport const auth = convexAuth({});\n'
    );

    const result = await detectProject(cwd);

    expect(result.state).toBe("existing-framework-with-convex-auth");
    expect(result.recommendedDocs).toEqual([
      "apps/docs/external/install/next/migrate-from-convex-auth.md",
    ]);
  });

  it("detects TanStack Start + Better Auth", async () => {
    const cwd = await createTempProject();
    await writeJson(path.join(cwd, "package.json"), {
      name: "tanstack-better-auth-app",
      dependencies: {
        "@tanstack/react-start": "^1.0.0",
        convex: "^1.36.0",
        "better-auth": "^1.0.0",
        "@convex-dev/better-auth": "^0.10.10",
      },
    });
    await writeText(path.join(cwd, "vite.config.ts"), "export default {};\n");
    await writeText(path.join(cwd, "src", "routes", "__root.tsx"), "export {};\n");
    await writeText(path.join(cwd, "convex", "convex.config.ts"), "export default {};\n");
    await writeText(
      path.join(cwd, "convex", "betterAuth.ts"),
      'import { betterAuth } from "better-auth";\nexport const auth = betterAuth({});\n'
    );

    const result = await detectProject(cwd);

    expect(result.state).toBe("existing-framework-with-better-auth");
    expect(result.recommendedDocs).toEqual([
      "apps/docs/external/install/tanstack-start/migrate-from-better-auth.md",
    ]);
  });

  it("detects framework present without Convex", async () => {
    const cwd = await createTempProject();
    await writeJson(path.join(cwd, "package.json"), {
      name: "next-no-convex",
      dependencies: { next: "^15.0.0" },
    });
    await writeText(path.join(cwd, "next.config.ts"), "export default {};\n");

    const result = await detectProject(cwd);

    expect(result.framework).toBe("next");
    expect(result.state).toBe("existing-framework-no-convex");
    expect(result.recommendedDocs).toEqual([
      "apps/docs/external/install/next/from-scratch.md",
    ]);
  });

  it("returns unknown for unsupported projects", async () => {
    const cwd = await createTempProject();
    await writeJson(path.join(cwd, "package.json"), {
      name: "remix-app",
      dependencies: { "@remix-run/react": "^2.0.0" },
    });

    const result = await detectProject(cwd);

    expect(result.framework).toBe("unknown");
    expect(result.state).toBe("unknown");
    expect(result.recommendedDocs).toEqual(["apps/docs/external/install/README.md"]);
  });
});

describe("formatDoctorReport", () => {
  it("renders a readable summary", async () => {
    const cwd = await createTempProject();
    await writeJson(path.join(cwd, "package.json"), {
      name: "next-app",
      dependencies: { next: "^15.0.0", convex: "^1.36.0" },
    });
    await writeText(path.join(cwd, "next.config.ts"), "export default {};\n");
    await writeText(path.join(cwd, "convex", "convex.config.ts"), "export default {};\n");

    const result = await detectProject(cwd);
    const report = formatDoctorReport(result);

    expect(report).toContain("convex-zen doctor");
    expect(report).toContain("existing-framework-with-convex-no-auth");
    expect(report).toContain("apps/docs/external/install/next/add-to-existing-convex.md");
  });
});
