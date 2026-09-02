import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, readFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

export const root = resolve(import.meta.dirname, "../..");

export function findExternalBinary(name, rootDir = root) {
  const workspaceBin = resolve(rootDir, "node_modules/.bin");
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory || resolve(directory) === workspaceBin) continue;
    const candidate = join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  throw new Error(`Could not find an executable ${name} outside ${workspaceBin}`);
}

export function hasBinary(name) {
  try {
    findExternalBinary(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Async so an in-process fixture server can keep answering while the child runs.
 * (spawnSync would block the event loop and every browser navigation would hang.)
 */
export function run(command, args, { cwd = root, env } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: env ? { ...process.env, ...env } : process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(`${command} ${args.join(" ")} failed (exit ${code})\n${stderr || stdout}`));
    });
  });
}

export function agentBrowserSession(session) {
  const binary = findExternalBinary("agent-browser");
  const call = (...args) => run(binary, ["--session", session, ...args]);
  call.text = async (...args) => (await call(...args)).trim();
  call.json = async (...args) => JSON.parse(await call(...args));
  call.close = () => call("close").catch(() => {});
  call.binary = binary;
  return call;
}

/** Poll a browser-side expression until it returns a truthy JSON value. */
export async function evalUntil(browser, expression, { attempts = 40, interval = 250, label = expression } = {}) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const raw = (await browser("eval", expression)).trim();
    try {
      last = JSON.parse(raw);
    } catch {
      last = raw;
    }
    if (last) return last;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, interval));
  }
  throw new Error(`Timed out waiting for: ${label}\nLast value: ${JSON.stringify(last)}`);
}

export function gh(args, { cwd = root, input } = {}) {
  const result = spawnSync("gh", args, { cwd, encoding: "utf8", input });
  if (result.status !== 0) throw new Error(`gh ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  return result.stdout;
}

/** `--attach` arrived in gh 2.8x; older installs fail with "unknown flag" mid-run. */
export function requireGhAttach() {
  const help = spawnSync("gh", ["pr", "comment", "--help"], { encoding: "utf8" });
  if (help.status !== 0) throw new Error("gh is not installed or not authenticated");
  if (!help.stdout.includes("--attach")) {
    const version = spawnSync("gh", ["--version"], { encoding: "utf8" }).stdout.split("\n")[0];
    throw new Error(`${version} does not support --attach; upgrade GitHub CLI`);
  }
}

export function pngDimensions(file) {
  const header = readFileSync(file).subarray(0, 24);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

/**
 * Minimal solid-colour PNG encoder so fixtures can differ in size and colour
 * without adding an image dependency. Distinct dimensions let the GitHub probe
 * tell a before asset from an after asset once the URLs are rewritten.
 */
export function makePng(width, height, [r, g, b]) {
  const crcTable = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (buffer) => {
    let c = -1;
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(typed));
    return Buffer.concat([length, typed, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

/**
 * Returns { frames, fps } when ffprobe is available, otherwise { frames: null, fps: null }
 * after checking the file is at least a WebM/Matroska container.
 */
export async function probeVideo(file) {
  const head = readFileSync(file).subarray(0, 4);
  if (!head.equals(WEBM_MAGIC)) throw new Error(`${file} is not a WebM file`);
  if (!hasBinary("ffprobe")) return { frames: null, fps: null };
  const output = await run(findExternalBinary("ffprobe"), [
    "-v",
    "error",
    "-count_frames",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=nb_read_frames,r_frame_rate",
    "-of",
    "json",
    file,
  ]);
  const stream = JSON.parse(output).streams?.[0] ?? {};
  const [numerator, denominator = 1] = String(stream.r_frame_rate ?? "0/1").split("/").map(Number);
  return { frames: Number(stream.nb_read_frames), fps: denominator ? numerator / denominator : null };
}

export const ATTACHMENT_URL = /https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]+/g;
