import { accessSync, constants } from "node:fs";
import { delimiter, join, resolve } from "node:path";

export function findExternalBinary(name, root) {
  const workspaceBin = resolve(root, "node_modules/.bin");
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
