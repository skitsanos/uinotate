import { copyFile, lstat, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { relative, join } from "node:path";

export const SITE_FILES = [
  "lib.js", "uinotate.css",
  "examples/index.html", "examples/minimal.html",
  "examples/demo.css", "examples/demo.js", "examples/minimal.css", "examples/minimal.js"
];

export async function buildSite({ root = new URL("../", import.meta.url), output = new URL("dist/", root) } = {}) {
  await mkdir(output, { recursive: true });
  if ((await lstat(output)).isSymbolicLink()) throw new Error("The publish directory must not be a symbolic link.");
  // Refuse unexpected files rather than publishing or deleting unrelated content.
  const existing = await readdir(output, { recursive: true, withFileTypes: true });
  const outputPath = fileURLToPath(output);
  for (const file of existing) {
    const path = relative(outputPath, join(file.parentPath || file.path, file.name)).replaceAll("\\", "/");
    if (file.isSymbolicLink() || (file.isFile() && !SITE_FILES.includes(path)) || (file.isDirectory() && path !== "examples")) throw new Error("Unexpected entry in the publish directory: " + path);
  }
  for (const path of SITE_FILES) {
    const target = new URL(path, output);
    await mkdir(new URL("./", target), { recursive: true });
    await copyFile(new URL(path, root), target);
  }
  return SITE_FILES;
}

if (import.meta.main) {
  await buildSite();
  console.log("Prepared dist/ with " + SITE_FILES.length + " public files. Functions and project source stay outside the publish directory.");
}
