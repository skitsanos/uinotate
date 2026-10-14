const root = new URL("../", import.meta.url);
const result = await Bun.build({ entrypoints: [new URL("src/widget.js", root).pathname], target: "browser", format: "iife" });
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const license = await Bun.file(new URL("node_modules/html-to-image/LICENSE", root)).text();
const banner = "/* Uinotate browser bundle. Generated from src/widget.js by bun run build.\n\nIncludes html-to-image 1.11.13:\n" + license + "\n*/\n";
await Bun.write(new URL("lib.js", root), banner + await result.outputs[0].text());
console.log("Built lib.js (screenshot renderer included; no extra script required).");
