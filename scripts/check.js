import { spawnSync } from "node:child_process";

const files = ["lib.js", "src/widget.js", "src/screenshot.js", "scripts/build.js", "scripts/build-site.js", "scripts/dev-netlify.js", "scripts/setup-netlify-secret.js", "scripts/smoke-site.js", "scripts/check.js", "examples/server.js", "examples/demo.js", "examples/minimal.js", "netlify/lib/demo-api.js", "netlify/functions/demo-session.mjs", "netlify/functions/feedback.mjs"];
files.push("examples/ingestion/server.js", "examples/ingestion/dashboard.js", "examples/ingestion/try.js");
for (const file of files) {
  const result = spawnSync("node", ["--check", file], { stdio: "inherit" });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log("Syntax checks passed for " + files.length + " JavaScript files.");
