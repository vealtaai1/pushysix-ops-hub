const fs = require("fs");
const path = require("path");

function ensureJsonFile(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, "{}\n", "utf8");
}

const root = path.resolve(__dirname, "..");
const nextServer = path.join(root, ".next", "server");

// Next build (15.1.x) sometimes attempts to read these before creating them.
ensureJsonFile(path.join(nextServer, "pages-manifest.json"));
ensureJsonFile(path.join(nextServer, "app", "_not-found", "page.js.nft.json"));
