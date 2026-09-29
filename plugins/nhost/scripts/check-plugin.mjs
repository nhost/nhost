#!/usr/bin/env node
// Checks the plugin against the OpenAI Plugins Directory rules that `claude plugin validate`
// doesn't cover. Rules: https://developers.openai.com/plugins/deploy/submission-errors
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const errors = [];
const fail = (msg) => errors.push(msg);

const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const claude = readJson(".claude-plugin/plugin.json");
const codex = readJson(".codex-plugin/plugin.json");
readJson(".claude-plugin/marketplace.json");
readJson(".agents/plugins/marketplace.json");
const mcp = readJson(".mcp.json");

if (!mcp.mcpServers || typeof mcp.mcpServers !== "object") fail(".mcp.json must use the mcpServers wrapper");

for (const key of ["name", "version", "description"]) {
  if (claude[key] !== codex[key]) fail(`${key} differs between .claude-plugin and .codex-plugin manifests`);
}
if (!claude.description?.trim()) fail("description must not be empty");
if (!/^[A-Za-z0-9_-]{1,64}$/.test(claude.name)) fail("plugin name must be <=64 chars of [A-Za-z0-9_-]");
if (!/^\d+\.\d+\.\d+/.test(claude.version)) fail("version must be semver");

const ui = codex.interface ?? {};
const categories = ["Productivity", "Creativity", "Developer Tools", "Business & Operations", "Data & Analytics",
  "Communication", "Education & Research", "Security", "Finance", "Healthcare", "Travel", "Entertainment", "Other"];
if (!ui.displayName || ui.displayName.length > 30) fail("interface.displayName must be 1-30 chars");
if (!ui.shortDescription || ui.shortDescription.length > 30) fail("interface.shortDescription must be 1-30 chars");
if ((ui.longDescription ?? "").length > 4000) fail("interface.longDescription must be <=4000 chars");
if (!categories.includes(ui.category)) fail(`interface.category must be one of: ${categories.join(", ")}`);
const prompts = ui.defaultPrompt ?? [];
if (prompts.length > 3) fail("at most 3 defaultPrompt entries");
if (new Set(prompts).size !== prompts.length) fail("defaultPrompt entries must be unique");
for (const p of prompts) if (p.length > 128 || p.includes("\n")) fail(`defaultPrompt too long or multi-line: ${p}`);
for (const k of ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"]) {
  if (ui[k] && !ui[k].startsWith("https://")) fail(`interface.${k} must be https`);
}
for (const k of ["logo", "composerIcon"]) {
  if (!ui[k] || !existsSync(join(root, ui[k]))) fail(`interface.${k} missing or file not found`);
}
if (ui.developerName !== codex.author?.name) fail("interface.developerName must match author.name");

// Skills
const skillsDir = join(root, "skills");
const skills = readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
if (skills.length === 0) fail("at least one skill is required");
const hostWords = /\b(Claude|Codex|ChatGPT|Cursor|Anthropic|OpenAI)\b/;
for (const d of skills) {
  const file = join(skillsDir, d.name, "SKILL.md");
  if (!existsSync(file)) { fail(`skills/${d.name}/SKILL.md missing`); continue; }
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { fail(`skills/${d.name}: missing frontmatter`); continue; }
  const fm = Object.fromEntries(m[1].split("\n").filter((l) => /^\w[\w-]*:/.test(l))
    .map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
  const allowed = ["name", "description"];
  for (const k of Object.keys(fm)) if (!allowed.includes(k)) fail(`skills/${d.name}: unexpected frontmatter key ${k}`);
  if (fm.name !== d.name) fail(`skills/${d.name}: frontmatter name must equal folder name`);
  if (!fm.description) fail(`skills/${d.name}: description required`);
  else if (fm.description.length > 1024) fail(`skills/${d.name}: description ${fm.description.length} > 1024 chars`);
  if (`${claude.name}:${d.name}`.length > 64) fail(`skills/${d.name}: plugin:skill identity > 64 chars`);
  if (!m[2].trim()) fail(`skills/${d.name}: empty body`);
  const hit = m[2].match(hostWords);
  if (hit) fail(`skills/${d.name}/SKILL.md: host-specific word "${hit[0]}" (use "the agent")`);
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ plugin checks passed (${skills.length} skills)`);
