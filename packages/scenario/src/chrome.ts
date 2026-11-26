// The system Chrome through puppeteer-core: no bundled browser download,
// no Playwright (it refuses macOS 12). Every request is routed; a request
// with no route is refused and recorded, and the run fails on it.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { type Route, serve } from "./routes.js";

/** Where Chrome lives on macOS. */
export const CHROME_MAC = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CANDIDATES = [CHROME_MAC, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];

/** The first Chrome found, or null. `HB_CHROME` overrides. */
export function findChrome(): string | null {
  const env = process.env.HB_CHROME;
  if (env && existsSync(env)) return env;
  return CANDIDATES.find((p) => existsSync(p)) ?? null;
}

/** Options of `open`: the page, routes, offline mode, viewport, Chrome path, GPU flags and a hook before navigation. */
export interface OpenOptions {
  /** a file path or URL */
  url: string;
  hash?: string;
  routes?: Route[];
  /** refuse every request that is not file:, data: or blob: (the self contained build check) */
  offline?: boolean;
  /** learned in earlier builds: 420 by 280 reaches about 20 fps under swiftshader */
  width?: number;
  height?: number;
  headless?: boolean;
  chrome?: string;
  args?: string[];
  /** "swiftshader" (default) for lockstep runs, "default" for real frame rate */
  gpu?: "swiftshader" | "default";
  timeoutMs?: number;
  /** runs before the page loads (install samplers, expose bindings) */
  beforeGoto?: (page: Page) => Promise<void>;
}

/** Errors, warnings, blocked and served requests a page made, and the Chrome version. */
export interface PageLog {
  errors: string[];
  warnings: string[];
  blocked: string[];
  served: string[];
  version: string;
}

/** What `open` returns: the browser, the page and the log of errors, warnings, blocked and served requests. */
export interface Opened {
  browser: Browser;
  page: Page;
  log: PageLog;
  close(): Promise<void>;
}

/** The Chrome flags every run gets: autoplay without a gesture, muted audio, file access from files. */
export const DEFAULT_ARGS = ["--autoplay-policy=no-user-gesture-required", "--mute-audio", "--allow-file-access-from-files"];
/**
 * Software GL, the same on every machine; for lockstep runs. Under these
 * flags headless Chrome 150 on macOS 12 ran 0 to 1 animation frames per
 * second (measured 2026-11-22), so real frame rate runs use `gpu: "default"`.
 */
export const SWIFTSHADER_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-webgpu"];

/** Launches the system Chrome with routing and opens a page; throws when no Chrome is found. */
export async function open(o: OpenOptions): Promise<Opened> {
  const chrome = o.chrome ?? findChrome();
  if (!chrome) throw new Error("no chrome found. set HB_CHROME to the browser binary.");
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: o.headless ?? true,
    args: [...DEFAULT_ARGS, ...((o.gpu ?? "swiftshader") === "swiftshader" ? SWIFTSHADER_ARGS : []), ...(o.args ?? [])],
    defaultViewport: { width: o.width ?? 420, height: o.height ?? 280 },
  });
  try {
    return await prepare(browser, o);
  } catch (e) {
    await browser.close().catch(() => undefined);
    throw e;
  }
}

async function prepare(browser: Browser, o: OpenOptions): Promise<Opened> {
  const page = await browser.newPage();
  const log: PageLog = { errors: [], warnings: [], blocked: [], served: [], version: await browser.version() };
  page.on("pageerror", (e) => log.errors.push(`pageerror: ${String((e as Error).message ?? e).slice(0, 400)}`));
  page.on("console", (m) => {
    const t = m.type();
    const text = m.text().slice(0, 400);
    if (t === "error") log.errors.push(`console: ${text}`);
    else if (t === "warn") log.warnings.push(text);
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith("file:") || url.startsWith("data:") || url.startsWith("blob:")) return void req.continue();
    if (o.offline) {
      log.blocked.push(url);
      return void req.abort("internetdisconnected");
    }
    try {
      const u = new URL(url);
      for (const r of o.routes ?? []) {
        const hit = r(u);
        if (!hit) continue;
        const s = serve(hit);
        log.served.push(url);
        return void req.respond({ status: 200, headers: { "access-control-allow-origin": "*", "cross-origin-resource-policy": "cross-origin" }, contentType: s.contentType, body: typeof s.body === "string" ? s.body : Buffer.from(s.body) });
      }
    } catch (e) {
      log.errors.push(`route: ${(e as Error).message}`);
    }
    log.blocked.push(url);
    return void req.abort("blockedbyclient");
  });
  if (o.beforeGoto) await o.beforeGoto(page);
  const target = /^[a-z]+:/.test(o.url) ? o.url : pathToFileURL(resolve(o.url)).href;
  await page.goto(target + (o.hash ?? ""), { waitUntil: "load", timeout: o.timeoutMs ?? 120000 });
  return { browser, page, log, close: () => browser.close() };
}

/** Polls a page condition until it is truthy or the time runs out (null). */
export async function waitFor<T>(page: Page, expr: string, timeoutMs: number, everyMs = 250): Promise<T | null> {
  const t0 = Date.now();
  for (;;) {
    const v = (await page.evaluate(expr)) as T;
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await new Promise((r) => setTimeout(r, everyMs));
  }
}
