import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

const DEFAULT_URL = "http://127.0.0.1:8787";
let processHandle: ChildProcess | null = null;
let startup: Promise<string> | null = null;

function serviceUrl() {
  return process.env.MAP_ANYTHING_URL || DEFAULT_URL;
}

function portFromUrl(url: string) {
  return new URL(url).port || "8787";
}

async function isReady(url: string) {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/health?ready=true`, {
      signal: AbortSignal.timeout(900_000),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { modelReady?: boolean };
    return data.modelReady === true;
  } catch {
    return false;
  }
}

export async function ensureMapAnythingService(): Promise<string> {
  const url = serviceUrl();
  if (await isReady(url)) return url;
  if (process.env.MAP_ANYTHING_AUTO_START === "false") {
    throw new Error(`MapAnything is not running at ${url}. Start the app-managed service or set MAP_ANYTHING_AUTO_START=true.`);
  }
  if (startup) return startup;

  startup = (async () => {
    const python = process.env.MAP_ANYTHING_PYTHON || "python3";
    const appDir = resolve(process.cwd(), process.env.MAP_ANYTHING_APP_DIR || "services/mapanything");
    const child = spawn(
      python,
      ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", portFromUrl(url)],
      { cwd: appDir, stdio: "inherit", env: process.env },
    );
    processHandle = child;
    child.once("exit", () => {
      if (processHandle === child) processHandle = null;
    });
    process.once("exit", () => child.kill());

    const deadline = Date.now() + 900_000;
    while (Date.now() < deadline) {
      if (await isReady(url)) return url;
      if (child.exitCode !== null) {
        throw new Error(`MapAnything service exited with code ${child.exitCode}. Install its Python dependencies and MapAnything.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`MapAnything service did not become ready at ${url}. Install its Python dependencies and MapAnything.`);
  })().finally(() => {
    startup = null;
  });
  return startup;
}

export function stopMapAnythingService() {
  processHandle?.kill();
  processHandle = null;
}
