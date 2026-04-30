import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);

async function expectPathExists(relativePath: string): Promise<void> {
  await expect(access(path.join(repoRoot, relativePath))).resolves.toBeUndefined();
}

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

describe("docs contract", () => {
  it("includes the required scenario docs", async () => {
    const docs = [
      "apps/docs/external/install/README.md",
      "apps/docs/external/oauth-proxy.md",
      "apps/docs/external/install/next/from-scratch.md",
      "apps/docs/external/install/next/add-to-existing-convex.md",
      "apps/docs/external/install/next/migrate-from-convex-auth.md",
      "apps/docs/external/install/next/migrate-from-better-auth.md",
      "apps/docs/external/install/tanstack-start/from-scratch.md",
      "apps/docs/external/install/tanstack-start/add-to-existing-convex.md",
      "apps/docs/external/install/tanstack-start/migrate-from-convex-auth.md",
      "apps/docs/external/install/tanstack-start/migrate-from-better-auth.md",
      "apps/docs/external/install/shared/migration-checklist.md",
    ];

    await Promise.all(docs.map((doc) => expectPathExists(doc)));
  });

  it("keeps Next docs aligned with provider and layout wiring", async () => {
    const source = await readRepoFile(
      "apps/docs/external/install/next/add-to-existing-convex.md"
    );

    expect(source).toContain("apps/next/app/auth-provider.tsx");
    expect(source).toContain("apps/next/app/layout.tsx");
    expect(source).toContain("apps/next/app/api/auth/[...auth]/route.ts");
  });

  it("keeps TanStack docs aligned with router and root route wiring", async () => {
    const source = await readRepoFile(
      "apps/docs/external/install/tanstack-start/add-to-existing-convex.md"
    );

    expect(source).toContain("apps/tanstack/src/router.tsx");
    expect(source).toContain("apps/tanstack/src/routes/__root.tsx");
    expect(source).toContain("apps/tanstack/src/routes/api/auth/$.tsx");
  });

  it("references real canonical example files", async () => {
    const paths = [
      "apps/next/src/lib/auth-server.ts",
      "apps/next/src/lib/auth-client.ts",
      "apps/next/app/auth-provider.tsx",
      "apps/next/app/layout.tsx",
      "apps/next/app/api/auth/[...auth]/route.ts",
      "apps/tanstack/src/lib/auth-server.ts",
      "apps/tanstack/src/lib/auth-client.ts",
      "apps/tanstack/src/router.tsx",
      "apps/tanstack/src/routes/__root.tsx",
      "apps/tanstack/src/routes/api/auth/$.tsx",
    ];

    await Promise.all(paths.map((entry) => expectPathExists(entry)));
  });

  it("root docs point agents at LLMS.md and doctor", async () => {
    const readme = await readRepoFile("README.md");
    const llms = await readRepoFile("LLMS.md");
    const oauth = await readRepoFile("apps/docs/external/oauth.md");
    const oauthProxy = await readRepoFile("apps/docs/external/oauth-proxy.md");
    const expo = await readRepoFile("apps/docs/external/expo-installation.md");

    expect(readme).toContain("LLMS.md");
    expect(readme).toContain("npx convex-zen doctor");
    expect(readme).toContain("oauth-proxy.md");
    expect(llms).toContain("npx convex-zen doctor");
    expect(llms).toContain("oauthProxy.allowedReturnTargets");
    expect(llms).toContain("CONVEX_ZEN_PROXY_BROKER");
    expect(llms).toContain("completeOAuthProxy(...)");
    expect(oauth).toContain("oauth_proxy_code");
    expect(oauth).toContain("oauth-proxy.md");
    expect(oauthProxy).toContain("zen.config.ts");
    expect(expo).toContain("completeOAuthProxy");
  });

  it("scenario add guides include one-shot OAuth proxy guidance", async () => {
    const nextAddGuide = await readRepoFile(
      "apps/docs/external/install/next/add-to-existing-convex.md"
    );
    const tanstackAddGuide = await readRepoFile(
      "apps/docs/external/install/tanstack-start/add-to-existing-convex.md"
    );

    expect(nextAddGuide).toContain("oauthProxy.allowedReturnTargets");
    expect(nextAddGuide).toContain("CONVEX_ZEN_PROXY_BROKER");
    expect(nextAddGuide).toContain("apps/docs/external/oauth-proxy.md");
    expect(tanstackAddGuide).toContain("oauthProxy.allowedReturnTargets");
    expect(tanstackAddGuide).toContain("CONVEX_ZEN_PROXY_BROKER");
    expect(tanstackAddGuide).toContain("apps/docs/external/oauth-proxy.md");
  });
});
