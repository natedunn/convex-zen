import type { OAuthProviderId } from "../types.js";
import type { OAuthProxyReturnTargetRule } from "../types.js";

type OAuthProxyEnvRecord = Record<string, string | undefined>;

function normalizeTrimmed(value: string): string {
  return value.trim();
}

export function normalizeOAuthProxyBrokerOrigin(url: string): string {
  const trimmed = normalizeTrimmed(url);
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("OAuth proxy brokerOrigin must be an absolute URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("OAuth proxy brokerOrigin must use http or https");
  }
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = "";
  return parsed.toString().replace(/\/$/, "");
}

function parseAbsoluteUrl(value: string, fieldName: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${fieldName} must be an absolute URL`);
  }
}

function hasWildcardHostname(hostname: string): boolean {
  return hostname.includes("*");
}

function assertNoUnexpectedPathParts(url: URL, fieldName: string): void {
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new Error(`${fieldName} must not include a path, query, or hash`);
  }
}

function normalizeWebUrl(url: string, fieldName: string): string {
  const parsed = parseAbsoluteUrl(url, fieldName);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${fieldName} must use http or https`);
  }
  if (hasWildcardHostname(parsed.hostname)) {
    throw new Error(`${fieldName} must not include wildcards`);
  }
  assertNoUnexpectedPathParts(parsed, fieldName);
  return parsed.origin;
}

function normalizeWebUrlPattern(pattern: string): {
  protocol: string;
  hostnameSuffix: string;
  port: string;
} {
  const parsed = parseAbsoluteUrl(pattern, "OAuth proxy web URL pattern");
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("OAuth proxy web URL pattern must use http or https");
  }
  assertNoUnexpectedPathParts(parsed, "OAuth proxy web URL pattern");
  const hostname = parsed.hostname;
  if (!hostname.startsWith("*.")) {
    throw new Error(
      'OAuth proxy web URL pattern must start with "*." in the hostname'
    );
  }
  if (hostname.slice(2).includes("*")) {
    throw new Error(
      "OAuth proxy web URL pattern may only contain a single wildcard hostname prefix"
    );
  }
  return {
    protocol: parsed.protocol,
    hostnameSuffix: hostname.slice(2),
    port: parsed.port,
  };
}

function normalizeNativeCallback(callbackUrl: string): string {
  const parsed = parseAbsoluteUrl(callbackUrl, "OAuth proxy native callback");
  parsed.hash = "";
  return parsed.toString();
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveOAuthProxyOptionsFromEnv(): {
  brokerOrigin?: string;
} | undefined {
  const env =
    (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env ??
    {};
  const brokerOrigin = normalizeEnvValue(
    env["CONVEX_ZEN_PROXY_BROKER"]
  );

  if (!brokerOrigin) {
    return undefined;
  }

  return {
    brokerOrigin,
  };
}

export function assertValidOAuthProxyReturnTargetRules(
  rules: readonly OAuthProxyReturnTargetRule[]
): void {
  for (const rule of rules) {
    switch (rule.type) {
      case "webUrl":
        normalizeWebUrl(rule.url, "OAuth proxy web URL");
        break;
      case "webUrlPattern":
        normalizeWebUrlPattern(rule.pattern);
        break;
      case "nativeCallback":
        normalizeNativeCallback(rule.callbackUrl);
        break;
    }
  }
}

export function matchesOAuthProxyReturnTarget(
  returnTarget: string,
  rules: readonly OAuthProxyReturnTargetRule[]
): boolean {
  for (const rule of rules) {
    switch (rule.type) {
      case "webUrl": {
        try {
          const target = parseAbsoluteUrl(returnTarget, "OAuth proxy return target");
          if (target.origin === normalizeWebUrl(rule.url, "OAuth proxy web URL")) {
            return true;
          }
        } catch {
          return false;
        }
        break;
      }
      case "webUrlPattern": {
        let target: URL;
        try {
          target = parseAbsoluteUrl(returnTarget, "OAuth proxy return target");
        } catch {
          return false;
        }
        const pattern = normalizeWebUrlPattern(rule.pattern);
        if (target.protocol !== pattern.protocol) {
          break;
        }
        if (pattern.port !== target.port) {
          break;
        }
        const hostname = target.hostname;
        if (!hostname.endsWith(`.${pattern.hostnameSuffix}`)) {
          break;
        }
        const prefix = hostname.slice(
          0,
          hostname.length - pattern.hostnameSuffix.length - 1
        );
        if (prefix.length > 0) {
          return true;
        }
        break;
      }
      case "nativeCallback":
        if (normalizeNativeCallback(returnTarget) === normalizeNativeCallback(rule.callbackUrl)) {
          return true;
        }
        break;
    }
  }
  return false;
}

export function buildOAuthProxySignInUrl(args: {
  brokerOrigin: string;
  basePath: string;
  providerId: OAuthProviderId;
  returnTarget: string;
  redirectTo?: string;
  errorRedirectTo?: string;
}): string {
  const brokerOrigin = normalizeOAuthProxyBrokerOrigin(args.brokerOrigin);
  const url = new URL(
    `${args.basePath}/proxy/sign-in/${args.providerId}`,
    brokerOrigin
  );
  url.searchParams.set("returnTarget", args.returnTarget);
  if (args.redirectTo) {
    url.searchParams.set("redirectTo", args.redirectTo);
  }
  if (args.errorRedirectTo) {
    url.searchParams.set("errorRedirectTo", args.errorRedirectTo);
  }
  return url.toString();
}
