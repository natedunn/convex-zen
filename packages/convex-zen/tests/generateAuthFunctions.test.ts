import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { generateAuthFunctions } from "../src/cli/generate";

const tempDirs: string[] = [];
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexZenEntry = path.join(packageDir, "src", "client", "index.ts");
const adminPluginEntry = path.join(packageDir, "src", "client", "plugins", "admin.ts");
const organizationPluginEntry = path.join(
  packageDir,
  "src",
  "client",
  "plugins",
  "organization.ts"
);

async function createTempWorkspace(): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "convex-zen-generate-"));
  tempDirs.push(cwd);
  await mkdir(path.join(cwd, "convex"), { recursive: true });
  return cwd;
}

async function writeZenConfigFile(cwd: string, source: string): Promise<void> {
  await writeFile(path.join(cwd, "convex", "zen.config.ts"), source, "utf8");
}

async function writeCustomPluginFile(cwd: string): Promise<void> {
  await mkdir(path.join(cwd, "convex", "customPlugin"), { recursive: true });
  await writeFile(
    path.join(cwd, "convex", "customPlugin", "convex.config.ts"),
    `
import { defineComponent } from "convex/server";

const custom = defineComponent("custom_plugin");

export default custom;
`,
    "utf8"
  );
  await writeFile(
    path.join(cwd, "convex", "customPlugin.ts"),
    `
import { defineAuthPlugin } from ${JSON.stringify(convexZenEntry)};

export const customPlugin = defineAuthPlugin({
  id: "custom",
  component: { importPath: "./customPlugin/convex.config" },
  createClientRuntime: () => ({
    getMessage: async () => "hello",
  }),
  publicFunctions: {
    functions: {
      getMessage: {
        kind: "query",
        auth: "public",
        runtimeMethod: "getMessage",
        argsSource: "{}",
      },
    },
  },
});
`,
    "utf8"
  );
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    })
  );
});

describe("generateAuthFunctions", () => {
  it("generates a component-first auth surface with admin enabled", async () => {
    const cwd = await createTempWorkspace();
    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen } from ${JSON.stringify(convexZenEntry)};
import { adminPlugin } from ${JSON.stringify(adminPluginEntry)};

export const zenConfig = defineConvexZen({
  plugins: [adminPlugin()],
});
`
    );

    const result = await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    expect(result.created).toContain(path.join("convex", "auth", "zen", "convex.config.ts"));
    expect(result.created).toContain(path.join("convex", "auth", "core.ts"));
    expect(result.created).toContain(path.join("convex", "auth", "generated.ts"));
    expect(result.created).toContain(path.join("convex", "auth", "plugin", "admin.ts"));
    expect(result.created).toContain(path.join("convex", "auth", "zen", "_runtime.ts"));
    expect(result.created).toContain(path.join("convex", "auth", "zen", "gateway.ts"));
    expect(result.created).not.toContain(path.join("convex", "auth", "gateway.ts"));

    const componentSource = await readFile(
      path.join(cwd, "convex", "auth", "zen", "convex.config.ts"),
      "utf8"
    );
    expect(componentSource).toContain('import core from "convex-zen/core/convex.config";');
    expect(componentSource).toContain('import adminComponent from "convex-zen/plugins/admin/convex.config";');
    expect(componentSource).toContain('const zenComponent = defineComponent("zenComponent");');
    expect(componentSource).toContain('zenComponent.use(core, { name: "core" });');
    expect(componentSource).toContain('zenComponent.use(adminComponent, { name: "adminComponent" });');

    const runtimeSource = await readFile(
      path.join(cwd, "convex", "auth", "generated.ts"),
      "utf8"
    );
    expect(runtimeSource).toContain('import { components } from "../_generated/api";');
    expect(runtimeSource).toContain("components.zenComponent as Record<string, unknown>");
    expect(runtimeSource).toContain("export const auth = createConvexZenClient(");
    expect(runtimeSource).not.toContain("export const componentAuth = createConvexZenClient(");

    const coreSource = await readFile(
      path.join(cwd, "convex", "auth", "core.ts"),
      "utf8"
    );
    expect(coreSource).toContain('import { auth } from "./generated";');
    expect(coreSource).toContain("export const signInWithEmail = mutation({");
    expect(coreSource).toContain("export const currentUser = query({");
    expect(coreSource).not.toContain("export const signOut = mutation({");

    const generatedSource = await readFile(
      path.join(cwd, "convex", "auth", "generated.ts"),
      "utf8"
    );
    expect(generatedSource).toContain("export const auth = createConvexZenClient(");
    expect(generatedSource).toContain('"plugin": {');
    expect(generatedSource).toContain('"admin": {');
    expect(generatedSource).toContain('"signInWithEmail": "mutation"');
    expect(generatedSource).toContain('"admin"');

    const adminSource = await readFile(
      path.join(cwd, "convex", "auth", "plugin", "admin.ts"),
      "utf8"
    );
    expect(adminSource).toContain('import { auth } from "../generated";');
    expect(adminSource).toContain("export const listUsers = query({");
    expect(adminSource).toContain("return auth.plugins.admin.listUsers(ctx, {");
  });

  it("removes disabled plugin files and unmounts them from the generated component", async () => {
    const cwd = await createTempWorkspace();
    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen } from ${JSON.stringify(convexZenEntry)};

export const zenConfig = defineConvexZen({
  plugins: [],
});
`
    );
    await mkdir(path.join(cwd, "convex", "auth", "plugin"), { recursive: true });
    await writeFile(
      path.join(cwd, "convex", "auth", "plugin", "admin.ts"),
      `// @generated by convex-zen generate. DO NOT EDIT.\nexport const stale = true;\n`,
      "utf8"
    );

    const result = await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    expect(result.deleted).toContain(path.join("convex", "auth", "plugin", "admin.ts"));

    const generatedSource = await readFile(
      path.join(cwd, "convex", "auth", "generated.ts"),
      "utf8"
    );
    expect(generatedSource).toContain('"plugin": {}');

    const componentSource = await readFile(
      path.join(cwd, "convex", "auth", "zen", "convex.config.ts"),
      "utf8"
    );
    expect(componentSource).toContain('zenComponent.use(core, { name: "core" });');
    expect(componentSource).not.toContain('zenComponent.use(adminComponent, { name: "adminComponent" });');
  });

  it("ignores commented-out plugin factories and mounts only active plugins", async () => {
    const cwd = await createTempWorkspace();
    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen } from ${JSON.stringify(convexZenEntry)};
import { adminPlugin } from ${JSON.stringify(adminPluginEntry)};
import { organizationPlugin } from ${JSON.stringify(organizationPluginEntry)};

export const zenConfig = defineConvexZen({
  plugins: [
    // adminPlugin(),
    organizationPlugin(),
  ],
});
`
    );

    await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    const generatedSource = await readFile(
      path.join(cwd, "convex", "auth", "generated.ts"),
      "utf8"
    );
    expect(generatedSource).toContain('"organization"');
    expect(generatedSource).not.toContain('"admin"');

    const componentSource = await readFile(
      path.join(cwd, "convex", "auth", "zen", "convex.config.ts"),
      "utf8"
    );
    expect(componentSource).toContain('zenComponent.use(organizationComponent, { name: "organizationComponent" });');
    expect(componentSource).not.toContain('zenComponent.use(adminComponent, { name: "adminComponent" });');
  });

  it("generates third-party plugin component mounts and function refs without built-in special casing", async () => {
    const cwd = await createTempWorkspace();
    await writeCustomPluginFile(cwd);
    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen } from ${JSON.stringify(convexZenEntry)};
import { customPlugin } from "./customPlugin";

export const zenConfig = defineConvexZen({
  plugins: [customPlugin()],
});
`
    );

    await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    const componentSource = await readFile(
      path.join(cwd, "convex", "auth", "zen", "convex.config.ts"),
      "utf8"
    );
    expect(componentSource).toContain('import custom from "../../customPlugin/convex.config";');
    expect(componentSource).toContain('zenComponent.use(custom, { name: "custom" });');

    const pluginSource = await readFile(
      path.join(cwd, "convex", "auth", "plugin", "custom.ts"),
      "utf8"
    );
    expect(pluginSource).toContain('import { auth } from "../generated";');
    expect(pluginSource).toContain("export const getMessage = query({");
    expect(pluginSource).toContain("return auth.plugins.custom.getMessage(ctx, args as any);");

    const generatedSource = await readFile(
      path.join(cwd, "convex", "auth", "generated.ts"),
      "utf8"
    );
    expect(generatedSource).toContain('"custom"');
    expect(generatedSource).toContain('"getMessage": "query"');
  });

  it("generates oauth handlers on the component root gateway when providers are configured", async () => {
    const cwd = await createTempWorkspace();
    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen, defineOAuthProvider } from ${JSON.stringify(convexZenEntry)};

const acmeProvider = defineOAuthProvider({
  id: "acme",
  createConfig: (config: { clientId: string; clientSecret: string }) => ({
    id: "acme",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: "https://acme.example/oauth/authorize",
    tokenUrl: "https://acme.example/oauth/token",
    userInfoUrl: "https://acme.example/api/me",
    scopes: ["profile", "email"],
  }),
  runtime: {
    buildAuthorizationUrl: () => "https://acme.example/oauth/authorize",
    exchangeAuthorizationCode: async () => ({ accessToken: "token" }),
    fetchProfile: async () => ({
      accountId: "acme-user",
      email: "acme@example.com",
      emailVerified: true,
    }),
  },
});

export const zenConfig = defineConvexZen({
  providers: [
    acmeProvider({
      clientId: "client-id",
      clientSecret: "client-secret",
    }),
  ],
});
`
    );

    await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    const coreSource = await readFile(
      path.join(cwd, "convex", "auth", "core.ts"),
      "utf8"
    );
    expect(coreSource).toContain("export const getOAuthUrl = mutation({");
    expect(coreSource).toContain("return auth.getOAuthUrl(ctx, args.providerId, {");
    expect(coreSource).toContain("export const handleOAuthCallback = action({");
    expect(coreSource).toContain("return auth.handleCallback(ctx, args);");

    const generatedSource = await readFile(
      path.join(cwd, "convex", "auth", "generated.ts"),
      "utf8"
    );
    expect(generatedSource).toContain('"getOAuthUrl": "mutation"');
    expect(generatedSource).toContain('"handleOAuthCallback": "action"');
  });
});
