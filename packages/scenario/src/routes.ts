// Request routing: every network request a page makes is answered from a
// pinned local file or refused. A route returns a hit or null; the first
// hit wins. Pinned files are checked against a SHA-256 once per run.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export interface RouteHit {
  /** a local file to serve */
  file?: string;
  /** or a body to serve */
  body?: string | Uint8Array;
  contentType?: string;
  /** checked before the file is served; a mismatch fails the request and is recorded */
  sha256?: string;
}

export type Route = (url: URL) => RouteHit | null;

const TYPES: Record<string, string> = {
  js: "text/javascript",
  mjs: "text/javascript",
  wasm: "application/wasm",
  json: "application/json",
  css: "text/css",
  html: "text/html",
  woff2: "font/woff2",
  woff: "font/woff",
  png: "image/png",
  jpg: "image/jpeg",
  glb: "model/gltf-binary",
  onnx: "application/octet-stream",
  bin: "application/octet-stream",
};

export const contentTypeOf = (path: string): string => TYPES[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

const verified = new Map<string, string>();
export function sha256File(path: string): string {
  let h = verified.get(path);
  if (!h) {
    h = createHash("sha256").update(readFileSync(path)).digest("hex");
    verified.set(path, h);
  }
  return h;
}

/** Resolves a hit to bytes, checking the pin. Throws on a missing file or a hash mismatch. */
export function serve(hit: RouteHit): { body: Uint8Array | string; contentType: string } {
  if (hit.body !== undefined) return { body: hit.body, contentType: hit.contentType ?? "application/octet-stream" };
  if (!hit.file) throw new Error("route hit has neither file nor body");
  if (!existsSync(hit.file)) throw new Error(`pinned file missing: ${hit.file}`);
  if (hit.sha256 && sha256File(hit.file) !== hit.sha256.toLowerCase()) throw new Error(`pinned file does not match its sha256: ${hit.file}`);
  return { body: readFileSync(hit.file), contentType: hit.contentType ?? contentTypeOf(hit.file) };
}

/**
 * npm CDN URLs (cdn.jsdelivr.net/npm, unpkg.com) served from a local
 * node_modules, only when the installed version equals the requested one.
 */
export function npmCdn(nodeModules: string): Route {
  return (u) => {
    let rest: string | null = null;
    if (u.hostname === "cdn.jsdelivr.net" && u.pathname.startsWith("/npm/")) rest = u.pathname.slice(5);
    else if (u.hostname === "unpkg.com") rest = u.pathname.slice(1);
    if (!rest) return null;
    // an encoded slash, backslash or dot would survive the URL parser's
    // normalization and climb out of the package after decoding
    if (/%(2f|5c|2e)/i.test(rest)) return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(rest);
    } catch {
      return null;
    }
    const m = /^((?:@[^/]+\/)?[^@/]+)@([^/]+)\/(.*)$/.exec(decoded);
    if (!m) return null;
    const [, name, ver, path] = m as unknown as [string, string, string, string];
    const root = resolve(nodeModules);
    const pkg = resolve(root, name);
    if (relative(root, pkg).startsWith("..") || !pkg.startsWith(root + sep)) return null;
    const pj = join(pkg, "package.json");
    if (!existsSync(pj) || JSON.parse(readFileSync(pj, "utf8")).version !== ver) return null;
    const f = resolve(pkg, path);
    if (!f.startsWith(pkg + sep)) return null;
    return existsSync(f) ? { file: f } : null;
  };
}

export interface LockEntry {
  /** the remote URL the page asks for */
  url: string;
  /** the local file, relative to the lock file's root */
  file: string;
  sha256: string;
}

/** Exact URLs pinned to local files with hashes, as in an assets lock. */
export function pinned(entries: readonly LockEntry[], root = "."): Route {
  const byUrl = new Map(entries.map((e) => [e.url, e]));
  return (u) => {
    const e = byUrl.get(u.href) ?? byUrl.get(`${u.origin}${u.pathname}`);
    return e ? { file: join(root, e.file), sha256: e.sha256 } : null;
  };
}

/** Google Fonts stylesheet requests answered with a fixed body (fonts then go through other routes). */
export function fixedBody(match: (u: URL) => boolean, body: string, contentType: string): Route {
  return (u) => (match(u) ? { body, contentType } : null);
}
