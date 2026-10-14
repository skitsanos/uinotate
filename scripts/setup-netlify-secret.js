import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

// Initial setup for a newly linked Netlify site. The value never enters source files.
const secret = randomBytes(32).toString("hex");
const result = spawnSync("netlify", ["env:set", "UINOTATE_DEMO_SIGNING_SECRET", secret, "--context", "production", "deploy-preview", "branch-deploy", "--secret"], { encoding: "utf8" });
if (result.error || result.status !== 0) {
  const detail = result.error?.message || result.stderr || result.stdout || "Unknown CLI error";
  console.error("Could not configure the signing secret: " + detail.replaceAll(secret, "[redacted]"));
  process.exitCode = 1;
} else console.log("Configured UINOTATE_DEMO_SIGNING_SECRET in Netlify. Its value is not printed or written locally; deploy to apply it.");
