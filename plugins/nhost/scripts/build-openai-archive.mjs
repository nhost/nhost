#!/usr/bin/env node
// Builds the skills-only archives for the OpenAI Plugins Directory portal.
// Rules: https://developers.openai.com/plugins/guides/submit-claude-plugin
//        https://developers.openai.com/plugins/deploy/submission-errors
// Skills-only uploads must not contain MCP configuration (.mcp.json, mcp.json, mcpServers),
// apps (.app.json) or marketplace files, so those are left out.
//
//   dist/nhost-openai-codex-format.zip   .codex-plugin/plugin.json with the listing (interface) filled in
//   dist/nhost-openai-claude-format.zip  .claude-plugin/plugin.json, converted by the portal (fallback)
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

function build(format) {
  const stage = join(dist, `stage-${format}`);
  const top = join(stage, "nhost");
  mkdirSync(top, { recursive: true });
  cpSync(join(root, "skills"), join(top, "skills"), { recursive: true });
  cpSync(join(root, "LICENSE"), join(top, "LICENSE"));

  const dir = format === "codex" ? ".codex-plugin" : ".claude-plugin";
  const manifest = JSON.parse(readFileSync(join(root, dir, "plugin.json"), "utf8"));
  delete manifest.mcpServers;
  delete manifest.apps;
  // The MCP server isn't part of a skills-only upload, so the description must not promise it.
  manifest.description =
    "Build apps on Nhost: Postgres, GraphQL with role-based permissions, Auth, Storage and Functions. " +
    "Skills for setup, database and permissions, auth, storage, functions and frontend integration.";
  manifest.keywords = (manifest.keywords ?? []).filter((k) => k !== "mcp");
  if (format === "codex") cpSync(join(root, "assets"), join(top, "assets"), { recursive: true });
  mkdirSync(join(top, dir));
  writeFileSync(join(top, dir, "plugin.json"), JSON.stringify(manifest, null, 2) + "\n");

  const zip = join(dist, `nhost-openai-${format}-format.zip`);
  execFileSync("zip", ["-qrX", zip, "nhost", "-x", "*.DS_Store"], { cwd: stage });
  rmSync(stage, { recursive: true, force: true });
  console.log(`built ${zip}`);
}

build("codex");
build("claude");
