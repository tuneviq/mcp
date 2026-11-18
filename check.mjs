// Plugin guard (docs/design/mcp-server.md 10.2, P6): no hooks, no telemetry, no foreign URLs, one MCP server,
// MIT licence. Run: node integrations/claude-plugin/check.mjs
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const plugin = join(root, 'tuneviq');
const errors = [];
const fail = (m) => errors.push(m);

function walk(dir) {
  return readdirSync(dir).filter((n) => n !== '.git').flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? [p, ...walk(p)] : [p];
  });
}
const rel = (p) => relative(root, p).replaceAll('\\', '/');
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    fail(`${rel(p)}: not valid JSON (${e.message})`);
    return null;
  }
};
const hasHooksKey = (v) =>
  v && typeof v === 'object' && Object.entries(v).some(([k, x]) => k === 'hooks' || hasHooksKey(x));

const all = walk(root);

// Licence: present and MIT, in the plugin folder and in the repository folder.
for (const dir of [plugin, root]) {
  const lic = join(dir, 'LICENSE');
  if (!existsSync(lic)) fail(`${rel(lic) || 'LICENSE'}: missing`);
  else {
    const t = readFileSync(lic, 'utf8');
    if (!/^MIT License/m.test(t) || !/Copyright \(c\) \d{4} EASYY Technologies s\.r\.o\./.test(t))
      fail(`${rel(lic)}: must be the MIT licence with "Copyright (c) <year> EASYY Technologies s.r.o."`);
  }
}

// No hooks folder or key, no commands or agents folders that could call anything.
for (const p of all) {
  const parts = rel(p).split('/');
  if (parts.includes('hooks')) fail(`${rel(p)}: hooks are not allowed`);
  if (parts.includes('node_modules')) fail(`${rel(p)}: unexpected dependency folder`);
}

const pj = readJson(join(plugin, '.claude-plugin', 'plugin.json'));
if (pj) {
  if (pj.license !== 'MIT') fail('plugin.json: "license" must be "MIT"');
  if (!pj.name || !pj.version || !pj.description) fail('plugin.json: name, version and description are required');
  if (hasHooksKey(pj)) fail('plugin.json: "hooks" key is not allowed');
  for (const k of ['mcpServers', 'commands', 'agents'])
    if (k in pj) fail(`plugin.json: "${k}" is not allowed (servers live only in .mcp.json)`);
}
const mp = readJson(join(root, '.claude-plugin', 'marketplace.json'));
if (mp && (mp.plugins ?? []).length !== 1) fail('marketplace.json: exactly one plugin expected');

// Exactly one MCP server, the Tuneviq one, built only from the two variables.
const mcp = readJson(join(plugin, '.mcp.json'));
if (mcp) {
  const servers = mcp.mcpServers ?? {};
  const names = Object.keys(servers);
  if (names.length !== 1 || names[0] !== 'tuneviq') fail('.mcp.json: exactly one server named "tuneviq" is allowed');
  const s = servers.tuneviq;
  if (s) {
    if (s.type !== 'http') fail('.mcp.json: type must be "http"');
    if (s.url !== '${TUNEVIQ_MCP_URL}') fail('.mcp.json: url must be ${TUNEVIQ_MCP_URL}');
    const h = Object.entries(s.headers ?? {});
    if (h.length !== 1 || h[0][0] !== 'Authorization' || h[0][1] !== 'Bearer ${TUNEVIQ_MCP_TOKEN}')
      fail('.mcp.json: the only header must be Authorization: Bearer ${TUNEVIQ_MCP_TOKEN}');
    for (const k of Object.keys(s)) if (!['type', 'url', 'headers'].includes(k)) fail(`.mcp.json: unexpected key "${k}"`);
  }
  if (hasHooksKey(mcp)) fail('.mcp.json: "hooks" key is not allowed');
}

// Foreign URLs: none in JSON or scripts; in markdown only documentation links.
const url = /https?:\/\/[^\s)"'`>]+/gi;
for (const p of all.filter((f) => statSync(f).isFile() && !f.endsWith('check.mjs') && !/LICENSE$/.test(f))) {
  const text = readFileSync(p, 'utf8');
  const found = text.match(url) ?? [];
  if (!found.length) continue;
  if (/\.md$/.test(p)) {
    // Allowed: documentation links only (a link whose host is docs.* or a claude/anthropic docs page).
    for (const u of found)
      if (!/^https:\/\/(docs\.claude\.com|code\.claude\.com|modelcontextprotocol\.io)\//.test(u))
        fail(`${rel(p)}: URL not allowed: ${u}`);
  } else {
    fail(`${rel(p)}: URL literal not allowed: ${found[0]}`);
  }
}
for (const p of all.filter((f) => statSync(f).isFile() && !/\.(json|md)$/.test(f) && !/LICENSE$/.test(f) && !f.endsWith('check.mjs')))
  fail(`${rel(p)}: unexpected file type (only json, md and LICENSE)`);
// Telemetry words in the skill or readme text.
for (const p of all.filter((f) => /\.(md|json)$/.test(f))) {
  if (/analytics|telemetry-endpoint|track(ing)?\s+pixel/i.test(readFileSync(p, 'utf8')))
    fail(`${rel(p)}: analytics or tracking wording`);
}

if (errors.length) {
  console.error('Plugin check FAILED:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('Plugin check OK');
