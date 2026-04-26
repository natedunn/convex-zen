import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export type DoctorFramework = "next" | "tanstack-start" | "unknown";
export type DoctorState =
  | "greenfield"
  | "existing-framework-no-convex"
  | "existing-framework-with-convex-no-auth"
  | "existing-framework-with-convex-auth"
  | "existing-framework-with-better-auth"
  | "existing-framework-with-other-auth"
  | "unknown";
export type FindingStatus = "ok" | "missing" | "warning" | "info";
export type RecommendedFlow =
  | "choose-starting-point"
  | "install-convex-first"
  | "add-convex-zen"
  | "migrate-from-convex-auth"
  | "migrate-from-better-auth"
  | "migrate-from-other-auth"
  | "investigate-manually";

export interface DoctorFinding {
  id: string;
  status: FindingStatus;
  path?: string;
  message: string;
}

export interface DoctorResult {
  cwd: string;
  framework: DoctorFramework;
  state: DoctorState;
  findings: DoctorFinding[];
  recommendedFlow: RecommendedFlow;
  recommendedDocs: string[];
  nextSteps: string[];
}

type PackageJsonShape = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type ProjectSignals = {
  framework: DoctorFramework;
  hasPackageJson: boolean;
  hasAppDir: boolean;
  hasSrcRoutesDir: boolean;
  hasNextConfig: boolean;
  hasViteConfig: boolean;
  hasConvexDir: boolean;
  hasConvexConfig: boolean;
  hasAuthConfig: boolean;
  hasZenConfig: boolean;
  hasZenGeneratedMeta: boolean;
  hasNextAuthRoute: boolean;
  hasNextAuthProvider: boolean;
  hasTanstackApiRoute: boolean;
  tanstackApiRoutePath: string | null;
  hasTanstackRouter: boolean;
  hasTanstackRootRoute: boolean;
  convexAuthDetected: boolean;
  betterAuthDetected: boolean;
  genericAuthDetected: boolean;
  packageJson: PackageJsonShape | null;
};

const DOC_ROOT = "apps/docs/external/install";
const SOURCE_FILE_PATTERN = /\.(cjs|cts|js|json|jsx|mjs|mts|ts|tsx)$/;
const SCRIPT_EXTENSIONS = ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"] as const;

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(targetPath: string): Promise<string | null> {
  try {
    return await readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

async function readPackageJson(cwd: string): Promise<PackageJsonShape | null> {
  const source = await readTextIfExists(path.join(cwd, "package.json"));
  if (!source) {
    return null;
  }
  try {
    return JSON.parse(source) as PackageJsonShape;
  } catch {
    return null;
  }
}

function listPackageNames(packageJson: PackageJsonShape | null): Set<string> {
  return new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
  ]);
}

async function findConfigMatch(
  cwd: string,
  candidates: readonly string[]
): Promise<boolean> {
  for (const candidate of candidates) {
    if (await pathExists(path.join(cwd, candidate))) {
      return true;
    }
  }
  return false;
}

async function collectSourceTexts(cwd: string): Promise<string> {
  const queue = [
    path.join(cwd, "package.json"),
    path.join(cwd, "convex"),
    path.join(cwd, "app"),
    path.join(cwd, "src"),
  ];
  const texts: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !(await pathExists(current))) {
      continue;
    }
    const currentStat = await stat(current);
    if (currentStat.isDirectory()) {
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") {
          continue;
        }
        queue.push(path.join(current, entry.name));
      }
      continue;
    }
    if (!SOURCE_FILE_PATTERN.test(current)) {
      continue;
    }
    const source = await readTextIfExists(current);
    if (source) {
      texts.push(source);
    }
  }

  return texts.join("\n");
}

function hasAnyNeedle(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

async function findFirstExistingPath(
  cwd: string,
  candidates: readonly string[]
): Promise<string | null> {
  for (const candidate of candidates) {
    if (await pathExists(path.join(cwd, candidate))) {
      return candidate;
    }
  }
  return null;
}

async function findFileContainingNeedles(
  rootPath: string,
  needles: readonly string[]
): Promise<string | null> {
  const queue = [rootPath];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !(await pathExists(current))) {
      continue;
    }

    const currentStat = await stat(current);
    if (currentStat.isDirectory()) {
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") {
          continue;
        }
        queue.push(path.join(current, entry.name));
      }
      continue;
    }

    if (!SOURCE_FILE_PATTERN.test(current)) {
      continue;
    }

    const source = await readTextIfExists(current);
    if (source && hasAnyNeedle(source, needles)) {
      return current;
    }
  }

  return null;
}

async function findTanstackApiRoutePath(cwd: string): Promise<string | null> {
  const routeCandidates = SCRIPT_EXTENSIONS.flatMap((extension) => [
    path.posix.join("src", "routes", `api.auth.$.${extension}`),
    path.posix.join("src", "routes", "api", `auth.$.${extension}`),
    path.posix.join("src", "routes", "api", "auth", `$.${extension}`),
  ]);
  const directMatch = await findFirstExistingPath(cwd, routeCandidates);
  if (directMatch) {
    return directMatch;
  }

  const semanticMatch = await findFileContainingNeedles(
    path.join(cwd, "src", "routes"),
    ['createFileRoute("/api/auth/$")', "createFileRoute('/api/auth/$')"]
  );
  if (semanticMatch) {
    return toPosixPath(path.relative(cwd, semanticMatch));
  }

  const routeTreePath = await findFirstExistingPath(cwd, ["src/routeTree.gen.ts"]);
  if (!routeTreePath) {
    return null;
  }
  const routeTreeSource = await readTextIfExists(path.join(cwd, routeTreePath));
  if (
    routeTreeSource &&
    hasAnyNeedle(routeTreeSource, [
      "path: '/api/auth/$'",
      'path: "/api/auth/$"',
      "fullPath: '/api/auth/$'",
      'fullPath: "/api/auth/$"',
    ])
  ) {
    return routeTreePath;
  }

  return null;
}

async function collectSignals(cwd: string): Promise<ProjectSignals> {
  const packageJson = await readPackageJson(cwd);
  const packageNames = listPackageNames(packageJson);
  const [hasAppDir, hasSrcRoutesDir, hasConvexDir] = await Promise.all([
    pathExists(path.join(cwd, "app")),
    pathExists(path.join(cwd, "src", "routes")),
    pathExists(path.join(cwd, "convex")),
  ]);
  const [hasNextConfig, hasViteConfig] = await Promise.all([
    findConfigMatch(cwd, ["next.config.ts", "next.config.mjs", "next.config.js"]),
    findConfigMatch(cwd, ["vite.config.ts", "vite.config.mjs", "vite.config.js"]),
  ]);
  const tanstackApiRoutePathPromise = findTanstackApiRoutePath(cwd);
  const [
    hasConvexConfig,
    hasAuthConfig,
    hasZenConfig,
    hasZenGeneratedMeta,
    hasNextAuthRoute,
    hasNextAuthProvider,
    hasTanstackRouter,
    hasTanstackRootRoute,
    tanstackApiRoutePath,
  ] = await Promise.all([
    pathExists(path.join(cwd, "convex", "convex.config.ts")),
    pathExists(path.join(cwd, "convex", "auth.config.ts")),
    pathExists(path.join(cwd, "convex", "zen.config.ts")),
    pathExists(path.join(cwd, "convex", "zen", "_generated", "meta.ts")),
    pathExists(path.join(cwd, "app", "api", "auth", "[...auth]", "route.ts")),
    pathExists(path.join(cwd, "app", "auth-provider.tsx")),
    pathExists(path.join(cwd, "src", "router.tsx")),
    pathExists(path.join(cwd, "src", "routes", "__root.tsx")),
    tanstackApiRoutePathPromise,
  ]);
  const hasTanstackApiRoute = tanstackApiRoutePath !== null;

  let framework: DoctorFramework = "unknown";
  if (
    packageNames.has("next") ||
    hasAppDir ||
    hasNextConfig ||
    hasNextAuthRoute ||
    hasNextAuthProvider
  ) {
    framework = "next";
  } else if (
    packageNames.has("@tanstack/react-start") ||
    hasSrcRoutesDir ||
    hasViteConfig ||
    hasTanstackApiRoute ||
    hasTanstackRouter ||
    hasTanstackRootRoute
  ) {
    framework = "tanstack-start";
  }

  const sourceTexts = await collectSourceTexts(cwd);
  const convexAuthDetected =
    packageNames.has("@convex-dev/auth") ||
    hasAnyNeedle(sourceTexts, [
      '"@convex-dev/auth"',
      "'@convex-dev/auth'",
      "convexAuth()",
      "convexAuth(",
    ]);
  const betterAuthDetected =
    packageNames.has("@convex-dev/better-auth") ||
    packageNames.has("better-auth") ||
    packageNames.has("convex-better-auth") ||
    hasAnyNeedle(sourceTexts, [
      '"@convex-dev/better-auth"',
      "'@convex-dev/better-auth'",
      '"better-auth"',
      "'better-auth'",
      '"convex-better-auth"',
      "'convex-better-auth'",
      "betterAuth(",
      "betterAuth.ts",
    ]);
  const genericAuthDetected =
    hasAnyNeedle(sourceTexts, [
      '"next-auth"',
      "'next-auth'",
      '"@auth/core"',
      "'@auth/core'",
      '"@clerk/',
      "'@clerk/",
      '"lucia"',
      "'lucia'",
      '"auth0"',
      "'auth0'",
      '"supabase/auth',
      "'supabase/auth",
    ]) || packageNames.has("next-auth");

  return {
    framework,
    hasPackageJson: packageJson !== null,
    hasAppDir,
    hasSrcRoutesDir,
    hasNextConfig,
    hasViteConfig,
    hasConvexDir,
    hasConvexConfig,
    hasAuthConfig,
    hasZenConfig,
    hasZenGeneratedMeta,
    hasNextAuthRoute,
    hasNextAuthProvider,
    hasTanstackApiRoute,
    tanstackApiRoutePath,
    hasTanstackRouter,
    hasTanstackRootRoute,
    convexAuthDetected,
    betterAuthDetected,
    genericAuthDetected,
    packageJson,
  };
}

function resolveState(signals: ProjectSignals): DoctorState {
  if (signals.framework === "unknown") {
    if (!signals.hasPackageJson && !signals.hasConvexDir) {
      return "greenfield";
    }
    if (!signals.hasConvexDir && !signals.hasConvexConfig) {
      return "unknown";
    }
    return "unknown";
  }

  if (!signals.hasConvexDir && !signals.hasConvexConfig) {
    return "existing-framework-no-convex";
  }

  if (signals.betterAuthDetected) {
    return "existing-framework-with-better-auth";
  }
  if (signals.convexAuthDetected) {
    return "existing-framework-with-convex-auth";
  }
  if (signals.genericAuthDetected) {
    return "existing-framework-with-other-auth";
  }
  return "existing-framework-with-convex-no-auth";
}

function frameworkLabel(framework: DoctorFramework): string {
  switch (framework) {
    case "next":
      return "Next.js";
    case "tanstack-start":
      return "TanStack Start";
    default:
      return "Unknown";
  }
}

function buildFindings(signals: ProjectSignals, state: DoctorState): DoctorFinding[] {
  const findings: DoctorFinding[] = [
    {
      id: "framework",
      status: signals.framework === "unknown" ? "warning" : "ok",
      message: `Detected framework: ${frameworkLabel(signals.framework)}`,
    },
    {
      id: "convex_dir",
      status: signals.hasConvexDir ? "ok" : "missing",
      path: "convex/",
      message: signals.hasConvexDir
        ? "Convex directory is present."
        : "Convex directory is missing.",
    },
    {
      id: "convex_config",
      status: signals.hasConvexConfig ? "ok" : "missing",
      path: "convex/convex.config.ts",
      message: signals.hasConvexConfig
        ? "Convex app config is present."
        : "Convex app config is missing.",
    },
    {
      id: "auth_config",
      status: signals.hasAuthConfig ? "ok" : "missing",
      path: "convex/auth.config.ts",
      message: signals.hasAuthConfig
        ? "Convex auth provider config is present."
        : "Convex auth provider config is missing.",
    },
    {
      id: "zen_config",
      status: signals.hasZenConfig ? "ok" : "missing",
      path: "convex/zen.config.ts",
      message: signals.hasZenConfig
        ? "convex-zen config is present."
        : "convex-zen config is missing.",
    },
    {
      id: "zen_generated_meta",
      status: signals.hasZenGeneratedMeta ? "ok" : "missing",
      path: "convex/zen/_generated/meta.ts",
      message: signals.hasZenGeneratedMeta
        ? "Generated convex-zen metadata is present."
        : "Generated convex-zen metadata is missing. Run `npx convex-zen generate` after setup.",
    },
    {
      id: "layout_assumptions",
      status: "info",
      message:
        "Doctor assumes conventional app/, src/, and convex/ locations at the current workspace root. Custom layouts may need manual verification.",
    },
  ];

  if (signals.framework === "next") {
    findings.push(
      {
        id: "next_auth_route",
        status: signals.hasNextAuthRoute ? "ok" : "missing",
        path: "app/api/auth/[...auth]/route.ts",
        message: signals.hasNextAuthRoute
          ? "Next auth route handler is present."
          : "Next auth route handler is missing.",
      },
      {
        id: "next_auth_provider",
        status: signals.hasNextAuthProvider ? "ok" : "missing",
        path: "app/auth-provider.tsx",
        message: signals.hasNextAuthProvider
          ? "Next auth provider wiring is present."
          : "Next auth provider wiring is missing.",
      }
    );
  }

  if (signals.framework === "tanstack-start") {
    findings.push(
      {
        id: "tanstack_auth_route",
        status: signals.hasTanstackApiRoute ? "ok" : "missing",
        path:
          signals.tanstackApiRoutePath ??
          "src/routes/api/auth/$.{ts,tsx} or another /api/auth/$ TanStack route file",
        message: signals.hasTanstackApiRoute
          ? "TanStack auth route is present."
          : "TanStack auth route is missing.",
      },
      {
        id: "tanstack_router",
        status: signals.hasTanstackRouter ? "ok" : "missing",
        path: "src/router.tsx",
        message: signals.hasTanstackRouter
          ? "TanStack router wiring is present."
          : "TanStack router wiring is missing.",
      },
      {
        id: "tanstack_root_route",
        status: signals.hasTanstackRootRoute ? "ok" : "missing",
        path: "src/routes/__root.tsx",
        message: signals.hasTanstackRootRoute
          ? "TanStack root route wiring is present."
          : "TanStack root route wiring is missing.",
      }
    );
  }

  if (state === "existing-framework-with-convex-auth") {
    findings.push({
      id: "convex_auth_detected",
      status: "warning",
      message: "Detected Convex Auth markers. Use the dedicated migration guide.",
    });
  } else if (state === "existing-framework-with-better-auth") {
    findings.push({
      id: "better_auth_detected",
      status: "warning",
      message: "Detected Better Auth markers. Use the dedicated migration guide.",
    });
  } else if (state === "existing-framework-with-other-auth") {
    findings.push({
      id: "generic_auth_detected",
      status: "warning",
      message: "Detected other auth markers. Use the generic migration checklist and replace routes deliberately.",
    });
  }

  return findings;
}

function resolveRecommendedDocs(
  framework: DoctorFramework,
  state: DoctorState
): string[] {
  if (framework === "unknown") {
    return [path.join(DOC_ROOT, "README.md")];
  }
  const frameworkRoot = path.join(DOC_ROOT, framework);
  switch (state) {
    case "greenfield":
      return [path.join(DOC_ROOT, "README.md")];
    case "existing-framework-no-convex":
      return [path.join(frameworkRoot, "from-scratch.md")];
    case "existing-framework-with-convex-no-auth":
      return [path.join(frameworkRoot, "add-to-existing-convex.md")];
    case "existing-framework-with-convex-auth":
      return [path.join(frameworkRoot, "migrate-from-convex-auth.md")];
    case "existing-framework-with-better-auth":
      return [path.join(frameworkRoot, "migrate-from-better-auth.md")];
    case "existing-framework-with-other-auth":
      return [
        path.join(DOC_ROOT, "shared", "migration-checklist.md"),
        path.join(frameworkRoot, "add-to-existing-convex.md"),
      ];
    default:
      return [path.join(DOC_ROOT, "README.md")];
  }
}

function resolveRecommendedFlow(state: DoctorState): RecommendedFlow {
  switch (state) {
    case "greenfield":
      return "choose-starting-point";
    case "existing-framework-no-convex":
      return "install-convex-first";
    case "existing-framework-with-convex-no-auth":
      return "add-convex-zen";
    case "existing-framework-with-convex-auth":
      return "migrate-from-convex-auth";
    case "existing-framework-with-better-auth":
      return "migrate-from-better-auth";
    case "existing-framework-with-other-auth":
      return "migrate-from-other-auth";
    default:
      return "investigate-manually";
  }
}

function resolveNextSteps(
  framework: DoctorFramework,
  state: DoctorState
): string[] {
  switch (state) {
    case "greenfield":
      return [
        "Choose Next.js App Router or TanStack Start first.",
        "Open apps/docs/external/install/README.md and pick the matching framework guide.",
      ];
    case "existing-framework-no-convex":
      return [
        "Install Convex into the existing app first.",
        `Then follow ${path.posix.join(DOC_ROOT, framework, "from-scratch.md")} from the Convex step onward.`,
      ];
    case "existing-framework-with-convex-no-auth":
      return [
        "Create convex/zen.config.ts and convex/auth.config.ts.",
        "Run npx convex-zen generate.",
        `Follow ${path.posix.join(DOC_ROOT, framework, "add-to-existing-convex.md")}.`,
      ];
    case "existing-framework-with-convex-auth":
      return [
        "Inventory existing Convex Auth routes, env vars, and session reads.",
        `Follow ${path.posix.join(DOC_ROOT, framework, "migrate-from-convex-auth.md")}.`,
      ];
    case "existing-framework-with-better-auth":
      return [
        "Inventory existing Better Auth routes, env vars, and data model usage.",
        `Follow ${path.posix.join(DOC_ROOT, framework, "migrate-from-better-auth.md")}.`,
      ];
    case "existing-framework-with-other-auth":
      return [
        `Follow ${path.posix.join(DOC_ROOT, "shared", "migration-checklist.md")}.`,
        `Then apply ${path.posix.join(DOC_ROOT, framework, "add-to-existing-convex.md")} once the old auth surface is isolated.`,
      ];
    default:
      return [
        "Project state is ambiguous.",
        `Start with ${path.posix.join(DOC_ROOT, "README.md")} and inspect the example apps before editing.`,
      ];
  }
}

export async function detectProject(cwd: string): Promise<DoctorResult> {
  const signals = await collectSignals(cwd);
  const state = resolveState(signals);
  return {
    cwd,
    framework: signals.framework,
    state,
    findings: buildFindings(signals, state),
    recommendedFlow: resolveRecommendedFlow(state),
    recommendedDocs: resolveRecommendedDocs(signals.framework, state),
    nextSteps: resolveNextSteps(signals.framework, state),
  };
}
