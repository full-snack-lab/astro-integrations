import type { ContentSecurityPolicyConfig, SecurityHeaderOverrides } from "./options.js";
import { DEFAULT_CONTENT_SECURITY_POLICY } from "./options.js";

/** Provider-neutral security and privacy response header defaults. */
export const DEFAULT_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

/** Builds a fresh security header set with explicit additions and removals. */
export function createSecurityHeaders(overrides: SecurityHeaderOverrides = {}): Headers {
  const headers = new Headers(DEFAULT_SECURITY_HEADERS);
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  }
  return headers;
}

/** Serializes an Astro CSP configuration for non-rendered static responses. */
export function contentSecurityPolicy(
  config: ContentSecurityPolicyConfig = DEFAULT_CONTENT_SECURITY_POLICY,
): string {
  const directives = [...(config.directives ?? [])].map(String);
  appendDirectiveFamily(directives, "script", config.scriptDirective);
  appendDirectiveFamily(directives, "style", config.styleDirective);
  return directives.join("; ");
}

/** Formats one deterministic platform `_headers` artifact. */
export function staticHeadersArtifact(headers: Headers): string {
  const entries = [...headers.entries()].sort(([left], [right]) => left.localeCompare(right));
  return ["/*", ...entries.map(([name, value]) => `  ${name}: ${value}`), ""].join("\n");
}

type DirectiveKind = "attribute" | "default" | "element";
type DirectiveEntry = string | { hash?: string; kind?: DirectiveKind; resource?: string };
type DirectiveConfig = {
  hashes?: readonly DirectiveEntry[];
  resources?: readonly DirectiveEntry[];
  strictDynamic?: boolean;
};

function appendDirectiveFamily(
  directives: string[],
  family: "script" | "style",
  config: DirectiveConfig | undefined,
): void {
  if (!config) return;
  const values: Record<DirectiveKind, string[]> = {
    attribute: [],
    default: [],
    element: [],
  };
  for (const entry of config.resources ?? []) appendEntry(values, entry, "resource");
  for (const entry of config.hashes ?? []) appendEntry(values, entry, "hash");
  if (family === "script" && config.strictDynamic) {
    values.default.push("'strict-dynamic'");
  }
  for (const kind of ["default", "element", "attribute"] as const) {
    if (values[kind].length === 0) continue;
    const suffix = kind === "default" ? "" : `-${kind === "element" ? "elem" : "attr"}`;
    directives.push(`${family}-src${suffix} ${values[kind].join(" ")}`);
  }
}

function appendEntry(
  values: Record<DirectiveKind, string[]>,
  entry: DirectiveEntry,
  property: "hash" | "resource",
): void {
  if (typeof entry === "string") {
    values.default.push(entry);
    return;
  }
  const value = entry[property];
  if (value) values[entry.kind ?? "default"].push(value);
}
