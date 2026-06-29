// env.mjs — zero-dependency .env loader. Imported FIRST by make.mjs so the API
// keys are present even when the shell that launched us (e.g. Claude Desktop's
// local agent) didn't source ~/.zshrc. Shell env always wins over the file.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env");
if (fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = raw.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, "");
    if (val && !process.env[key]) process.env[key] = val; // shell env wins
  }
}
