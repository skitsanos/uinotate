import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSite, SITE_FILES } from "../scripts/build-site.js";

describe("Netlify publish bundle", () => {
  test("copies only the public runtime and example files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "uinotate-site-"));
    try {
      const output = pathToFileURL(directory + "/");
      await buildSite({ output });
      const files = (await readdir(directory, { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile());
      expect(files.length).toBe(SITE_FILES.length);
      for (const path of SITE_FILES) expect(await Bun.file(new URL(path, output)).text()).toBe(await Bun.file(new URL("../" + path, import.meta.url)).text());
      expect(await Bun.file(new URL("netlify/lib/demo-api.js", output)).exists()).toBe(false);
      expect(await Bun.file(new URL(".env", output)).exists()).toBe(false);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  test("unexpected files are preserved and prevent publishing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "uinotate-site-"));
    try {
      await writeFile(join(directory, "private.txt"), "do not publish");
      await expect(buildSite({ output: pathToFileURL(directory + "/") })).rejects.toThrow("Unexpected entry");
      expect(await Bun.file(join(directory, "private.txt")).text()).toBe("do not publish");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  test("rebuilds a Netlify cache without publishing its generated config", async () => {
    const directory = await mkdtemp(join(tmpdir(), "uinotate-site-"));
    try {
      const output = pathToFileURL(directory + "/");
      await buildSite({ output });
      await writeFile(join(directory, "netlify.toml"), "# Netlify resolved build configuration");
      await expect(buildSite({ output, netlifyBuild: false })).rejects.toThrow("Unexpected entry");
      expect(await Bun.file(new URL("netlify.toml", output)).exists()).toBe(true);
      await buildSite({ output, netlifyBuild: true });
      expect(await Bun.file(new URL("netlify.toml", output)).exists()).toBe(false);
      expect((await readdir(directory, { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile()).length).toBe(SITE_FILES.length);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  test("rejects symlinked publish content", async () => {
    const directory = await mkdtemp(join(tmpdir(), "uinotate-site-"));
    try {
      await symlink(new URL("../src", import.meta.url).pathname, join(directory, "source"));
      await expect(buildSite({ output: pathToFileURL(directory + "/") })).rejects.toThrow("Unexpected entry");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
