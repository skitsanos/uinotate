import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const child = spawn("netlify", ["dev", "--offline", "--no-open"], {
  stdio: "inherit",
  env: { ...process.env, UINOTATE_DEMO_SIGNING_SECRET: process.env.UINOTATE_DEMO_SIGNING_SECRET || randomBytes(32).toString("hex") }
});
child.on("error", (error) => { console.error("Could not start Netlify CLI: " + error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
