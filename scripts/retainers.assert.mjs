import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".tmp", "retainers-assert");

rmSync(outDir, { recursive: true, force: true });

// Compile only what we need (see scripts/tsconfig.retainers-assert.json).
execSync("npx --yes tsc -p scripts/tsconfig.retainers-assert.json --pretty false", {
  stdio: "inherit",
  cwd: root,
});

execSync(`node ${path.join(outDir, "scripts", "retainers.assert.js")}`, {
  stdio: "inherit",
  cwd: root,
});
