import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { generateAuthFunctions } from "../src/cli/generate";

const tempDirs: string[] = [];
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexZenEntry = path.join(packageDir, "src", "client", "index.ts");
const convexZenComponentEntry = path.join(packageDir, "src", "component", "index.ts");
const systemAdminPluginEntry = path.resolve(packageDir, "..", "convex-zen-system-admin", "src", "index.ts");
const organizationPluginEntry = path.resolve(
  packageDir,
  "..",
  "convex-zen-organization",
  "src",
  "index.ts"
);
const examplePluginPackage = "convex-zen-example";

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
  await mkdir(path.join(cwd, "convex", "plugins", "custom"), { recursive: true });
  await writeFile(
    path.join(cwd, "convex", "plugins", "custom", "convex.config.ts"),
    `
import { defineComponent } from "convex/server";

const custom = defineComponent("custom_plugin");

export default custom;
`,
    "utf8"
  );
  await writeFile(
    path.join(cwd, "convex", "plugins", "custom", "gateway.ts"),
    `
import { v } from "convex/values";
import { pluginQuery } from ${JSON.stringify(convexZenComponentEntry)};

export const getMessage = pluginQuery({
  auth: "public",
  args: {
    value: v.optional(v.string()),
  },
  handler: async (_ctx, _args) => "hello",
});
`,
    "utf8"
  );
  await writeFile(
    path.join(cwd, "convex", "plugins", "custom", "index.ts"),
    `
import { definePlugin } from ${JSON.stringify(convexZenEntry)};
import * as gateway from "./gateway";

export const customPlugin = definePlugin({
  id: "custom",
  gateway,
});
`,
    "utf8"
  );
}

async function writeInstalledPluginPackage(cwd: string): Promise<void> {
  const packageDir = path.join(cwd, "node_modules", "acme-installed-plugin");
  await mkdir(path.join(packageDir, "dist"), { recursive: true });
  await writeFile(
    path.join(packageDir, "package.json"),
    JSON.stringify(
      {
        name: "acme-installed-plugin",
        version: "1.0.0",
        type: "module",
        exports: {
          ".": {
            import: "./dist/index.js",
          },
          "./gateway": {
            import: "./dist/gateway.js",
          },
          "./convex.config": {
            import: "./dist/convex.config.js",
          },
        },
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(packageDir, "dist", "index.js"),
    `
import * as gateway from "./gateway.js";

export const installedPlugin = {
  definition: {
    id: "installed",
    gateway,
  },
};
`,
    "utf8"
  );
  await writeFile(
    path.join(packageDir, "dist", "gateway.js"),
    `
const PLUGIN_FUNCTION_METADATA_KEY = "__convexZenPluginFunction";

export const getMessage = {
  [PLUGIN_FUNCTION_METADATA_KEY]: {
    kind: "query",
    auth: "public",
    args: {},
  },
};
`,
    "utf8"
  );
  await writeFile(
    path.join(packageDir, "dist", "convex.config.js"),
    `
export default {};
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
import { systemAdminPlugin } from ${JSON.stringify(systemAdminPluginEntry)};

const zenConfig = defineConvexZen({
  plugins: [systemAdminPlugin()],
});

export default zenConfig;
`
    );

    const result = await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    expect(result.created).toContain(path.join("convex", "zen", "component", "convex.config.ts"));
    expect(result.created).toContain(path.join("convex", "zen", "core.ts"));
    expect(result.created).toContain(path.join("convex", "zen", "_generated", "auth.ts"));
    expect(result.created).toContain(path.join("convex", "zen", "_generated", "meta.ts"));
    expect(result.created).not.toContain(path.join("convex", "zen", "_generated", "oauth.ts"));
    expect(result.created).toContain(path.join("convex", "zen", "plugin", "systemAdmin.ts"));
    expect(result.created).toContain(path.join("convex", "zen", "component", "_runtime.ts"));
    expect(result.created).toContain(path.join("convex", "zen", "component", "gateway.ts"));
    expect(result.created).not.toContain(path.join("convex", "zen", "gateway.ts"));

    const componentSource = await readFile(
      path.join(cwd, "convex", "zen", "component", "convex.config.ts"),
      "utf8"
    );
    expect(componentSource).toContain('import core from "convex-zen/core/convex.config";');
    expect(componentSource).toContain('convex-zen-system-admin/src/convex.config');
    expect(componentSource).toContain('const zenComponent = defineComponent("zenComponent");');
    expect(componentSource).toContain('zenComponent.use(core, { name: "core" });');
    expect(componentSource).toContain('zenComponent.use(systemAdminComponent, { name: "systemAdminComponent" });');

    const runtimeSource = await readFile(
      path.join(cwd, "convex", "zen", "_generated", "auth.ts"),
      "utf8"
    );
    expect(runtimeSource).toContain('export { auth } from "../component/_runtime";');

    const coreSource = await readFile(
      path.join(cwd, "convex", "zen", "core.ts"),
      "utf8"
    );
    expect(coreSource).toContain('import { auth } from "./_generated/auth";');
    expect(coreSource).toContain("export const signInWithEmail = mutation({");
    expect(coreSource).toContain("export const currentUser = query({");
    expect(coreSource).not.toContain("export const signOut = mutation({");

    const generatedSource = await readFile(
      path.join(cwd, "convex", "zen", "_generated", "meta.ts"),
      "utf8"
    );
    expect(generatedSource).toContain('"plugin": {');
    expect(generatedSource).toContain('"systemAdmin": {');
    expect(generatedSource).toContain('"signInWithEmail": "mutation"');
    expect(generatedSource).toContain('"systemAdmin"');

    await expect(
      readFile(path.join(cwd, "convex", "zen", "_generated", "oauth.ts"), "utf8")
    ).rejects.toThrow();

    const adminSource = await readFile(
      path.join(cwd, "convex", "zen", "plugin", "systemAdmin.ts"),
      "utf8"
    );
    expect(adminSource).toContain('import { auth } from "../_generated/auth";');
    expect(adminSource).toContain("export const listUsers = query({");
    expect(adminSource).toContain("return auth.plugins.systemAdmin.listUsers(ctx, args);");
  });

  it("removes disabled plugin files and unmounts them from the generated component", async () => {
    const cwd = await createTempWorkspace();
    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen } from ${JSON.stringify(convexZenEntry)};

const zenConfig = defineConvexZen({
  plugins: [],
});

export default zenConfig;
`
    );
    await mkdir(path.join(cwd, "convex", "zen", "plugin"), { recursive: true });
    await writeFile(
      path.join(cwd, "convex", "zen", "plugin", "systemAdmin.ts"),
      `// @generated by convex-zen generate. DO NOT EDIT.\nexport const stale = true;\n`,
      "utf8"
    );

    const result = await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    expect(result.deleted).toContain(path.join("convex", "zen", "plugin", "systemAdmin.ts"));

    const generatedSource = await readFile(
      path.join(cwd, "convex", "zen", "_generated", "meta.ts"),
      "utf8"
    );
    expect(generatedSource).toContain('"plugin": {}');

    const componentSource = await readFile(
      path.join(cwd, "convex", "zen", "component", "convex.config.ts"),
      "utf8"
    );
    expect(componentSource).toContain('zenComponent.use(core, { name: "core" });');
    expect(componentSource).not.toContain('zenComponent.use(systemAdminComponent, { name: "systemAdminComponent" });');
  });

  it("ignores commented-out plugin factories and mounts only active plugins", async () => {
    const cwd = await createTempWorkspace();
    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen } from ${JSON.stringify(convexZenEntry)};
import { systemAdminPlugin } from ${JSON.stringify(systemAdminPluginEntry)};
import { organizationPlugin } from ${JSON.stringify(organizationPluginEntry)};

const zenConfig = defineConvexZen({
  plugins: [
    // systemAdminPlugin(),
    organizationPlugin(),
  ],
});

export default zenConfig;
`
    );

    await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    const generatedSource = await readFile(
      path.join(cwd, "convex", "zen", "_generated", "meta.ts"),
      "utf8"
    );
    expect(generatedSource).toContain('"organization"');
    expect(generatedSource).not.toContain('"admin"');

    const componentSource = await readFile(
      path.join(cwd, "convex", "zen", "component", "convex.config.ts"),
      "utf8"
    );
    expect(componentSource).toContain('zenComponent.use(organizationComponent, { name: "organizationComponent" });');
    expect(componentSource).not.toContain('zenComponent.use(systemAdminComponent, { name: "systemAdminComponent" });');
  });

  it("generates third-party plugin component mounts and function refs without built-in special casing", async () => {
    const cwd = await createTempWorkspace();
    await writeCustomPluginFile(cwd);
    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen } from ${JSON.stringify(convexZenEntry)};
import { customPlugin } from "./plugins/custom";

const zenConfig = defineConvexZen({
  plugins: [customPlugin()],
});

export default zenConfig;
`
    );

    await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    const componentSource = await readFile(
      path.join(cwd, "convex", "zen", "component", "convex.config.ts"),
      "utf8"
    );
    expect(componentSource).toContain('import customComponent from "../../plugins/custom/convex.config";');
    expect(componentSource).toContain('zenComponent.use(customComponent, { name: "customComponent" });');

    const pluginSource = await readFile(
      path.join(cwd, "convex", "zen", "plugin", "custom.ts"),
      "utf8"
    );
    expect(pluginSource).toContain('import { auth } from "../_generated/auth";');
    expect(pluginSource).toContain('import * as pluginGateway from "../../plugins/custom/gateway";');
    expect(pluginSource).toContain("export const getMessage = query({");
    expect(pluginSource).toContain("return auth.plugins.custom.getMessage(ctx, args);");

    const generatedSource = await readFile(
      path.join(cwd, "convex", "zen", "_generated", "meta.ts"),
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

const zenConfig = defineConvexZen({
  providers: [
    acmeProvider({
      clientId: "client-id",
      clientSecret: "client-secret",
    }),
  ],
});

export default zenConfig;
`
    );

    await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    const coreSource = await readFile(
      path.join(cwd, "convex", "zen", "core.ts"),
      "utf8"
    );
    expect(coreSource).toContain("export const getOAuthUrl = mutation({");
    expect(coreSource).toContain("return auth.getOAuthUrl(ctx, args.providerId, {");
    expect(coreSource).toContain("export const handleOAuthCallback = action({");
    expect(coreSource).toContain("return auth.handleCallback(ctx, args);");

    const generatedSource = await readFile(
      path.join(cwd, "convex", "zen", "_generated", "meta.ts"),
      "utf8"
    );
    expect(generatedSource).toContain('"getOAuthUrl": "mutation"');
    expect(generatedSource).toContain('"handleOAuthCallback": "action"');

    const oauthSource = await readFile(
      path.join(cwd, "convex", "zen", "_generated", "oauth.ts"),
      "utf8"
    );
    expect(oauthSource).toContain("export function resolveOAuthProvider(providerId: string)");
  });

  it("deletes generated oauth helpers when providers are removed", async () => {
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

const zenConfig = defineConvexZen({
  providers: [
    acmeProvider({
      clientId: "client-id",
      clientSecret: "client-secret",
    }),
  ],
});

export default zenConfig;
`
    );

    await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen } from ${JSON.stringify(convexZenEntry)};

const zenConfig = defineConvexZen({});

export default zenConfig;
`
    );

    const result = await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    expect(result.deleted).toContain(path.join("convex", "zen", "_generated", "oauth.ts"));
    await expect(
      readFile(path.join(cwd, "convex", "zen", "_generated", "oauth.ts"), "utf8")
    ).rejects.toThrow();
  });

  it("ignores commented-out providers when deciding whether to generate oauth helpers", async () => {
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

const zenConfig = defineConvexZen({
  /*
  providers: [
    acmeProvider({
      clientId: "client-id",
      clientSecret: "client-secret",
    }),
  ],
  */
});

export default zenConfig;
`
    );

    const result = await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    expect(result.created).not.toContain(path.join("convex", "zen", "_generated", "oauth.ts"));
    await expect(
      readFile(path.join(cwd, "convex", "zen", "_generated", "oauth.ts"), "utf8")
    ).rejects.toThrow();
  });

  it("resolves an external plugin package by bare module specifier", async () => {
    const cwd = await createTempWorkspace();
    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen } from ${JSON.stringify(convexZenEntry)};
import { examplePlugin } from ${JSON.stringify(examplePluginPackage)};

const zenConfig = defineConvexZen({
  plugins: [examplePlugin()],
});

export default zenConfig;
`
    );

    const result = await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    expect(result.created).toContain(path.join("convex", "zen", "plugin", "example.ts"));

    const componentSource = await readFile(
      path.join(cwd, "convex", "zen", "component", "convex.config.ts"),
      "utf8"
    );
    expect(componentSource).toContain(
      'import exampleComponent from "convex-zen-example/convex.config";'
    );

    const pluginSource = await readFile(
      path.join(cwd, "convex", "zen", "plugin", "example.ts"),
      "utf8"
    );
    expect(pluginSource).toContain(
      'import * as pluginGateway from "convex-zen-example/gateway";'
    );
    expect(pluginSource).toContain("return auth.plugins.example.log(ctx, args);");
    expect(pluginSource).toContain("return auth.plugins.example.listLogs(ctx, args);");
  });

  it("resolves an installed ESM plugin package with import-only exports", async () => {
    const cwd = await createTempWorkspace();
    await writeInstalledPluginPackage(cwd);
    await writeZenConfigFile(
      cwd,
      `
import { defineConvexZen } from ${JSON.stringify(convexZenEntry)};
import { installedPlugin } from "acme-installed-plugin";

const zenConfig = defineConvexZen({
  plugins: [installedPlugin()],
});

export default zenConfig;
`
    );

    const result = await generateAuthFunctions({
      cwd,
      check: false,
      verbose: false,
    });

    expect(result.created).toContain(path.join("convex", "zen", "plugin", "installed.ts"));

    const componentSource = await readFile(
      path.join(cwd, "convex", "zen", "component", "convex.config.ts"),
      "utf8"
    );
    expect(componentSource).toContain(
      'import installedComponent from "acme-installed-plugin/convex.config";'
    );

    const pluginSource = await readFile(
      path.join(cwd, "convex", "zen", "plugin", "installed.ts"),
      "utf8"
    );
    expect(pluginSource).toContain(
      'import * as pluginGateway from "acme-installed-plugin/gateway";'
    );
    expect(pluginSource).toContain("return auth.plugins.installed.getMessage(ctx, args);");
  });
});
