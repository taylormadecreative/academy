// test-mcp.mjs — spins up the MCP server as a subprocess and exercises its tools,
// exactly like Claude Desktop will. Run: node test-mcp.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(HERE, "mcp-server.mjs")],
});
const client = new Client({ name: "smoke-test", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const list = await client.callTool({ name: "list_academy_recipes", arguments: {} });
console.log("LIST ->", list.content[0].text.split("\n")[0]);

console.log("Generating (quote-card, gemini, 1)…");
const gen = await client.callTool({
  name: "generate_academy_content",
  arguments: { recipe: "quote-card", topic: "MCP works in every chat", engine: "gemini", variants: 1 },
});
const kinds = gen.content.map((c) => c.type);
const img = gen.content.find((c) => c.type === "image");
console.log("RESULT content types:", kinds.join(", "));
console.log("TEXT:", gen.content.find((c) => c.type === "text")?.text.split("\n")[0]);
console.log("IMAGE returned:", img ? `yes (${Math.round(img.data.length / 1024)}kb base64, ${img.mimeType})` : "NO");
console.log(img ? "✓ PASS" : "✗ FAIL");

await client.close();
process.exit(img ? 0 : 1);
