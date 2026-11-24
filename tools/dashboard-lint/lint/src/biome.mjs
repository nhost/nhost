import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError } from './git.mjs';
import { RULE_ID_BY_BIOME_CODE, RULES_BY_ID } from './rules.mjs';

const BIOME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'biome');

function pinnedVersion(repo) {
  const overlay = join(repo, 'nixops/overlays/js.nix');
  if (!existsSync(overlay)) {
    return null;
  }
  return readFileSync(overlay, 'utf8').match(/biome_version = "([^"]+)"/)?.[1] ?? null;
}

function versionOf(binary) {
  try {
    return execFileSync(binary, ['--version'], { encoding: 'utf8' }).match(/Version: (\S+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function findBiome(repo) {
  const wanted = pinnedVersion(repo);
  if (process.env.DASHBOARD_LINT_BIOME) {
    return process.env.DASHBOARD_LINT_BIOME;
  }
  const onPath = (() => {
    try {
      return execFileSync('sh', ['-c', 'command -v biome'], { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  })();
  if (onPath && (!wanted || versionOf(onPath) === wanted)) {
    return onPath;
  }
  if (wanted && existsSync('/nix/store')) {
    const suffix = `-biome-${wanted}`;
    for (const entry of readdirSync('/nix/store')) {
      if (entry.endsWith(suffix) && existsSync(join('/nix/store', entry, 'bin/biome'))) {
        return join('/nix/store', entry, 'bin/biome');
      }
    }
  }
  throw new UsageError(
    `Biome ${wanted ?? ''} not found.`,
    'Enter the dashboard dev shell once (nix develop .#dashboard) so the pinned Biome is in the Nix store, or set DASHBOARD_LINT_BIOME=/path/to/biome.',
  );
}

// Lints the given { path, text } files in a scratch directory that mirrors repo paths,
// so the repo's own biome.json files never apply.
export function runBiome(repo, files) {
  if (files.length === 0) {
    return [];
  }
  const stage = mkdtempSync(join(tmpdir(), 'dashboard-lint-'));
  try {
    for (const { path, text } of files) {
      mkdirSync(join(stage, dirname(path)), { recursive: true });
      writeFileSync(join(stage, path), text);
    }
    const template = readFileSync(join(BIOME_DIR, 'biome.template.json'), 'utf8');
    writeFileSync(join(stage, 'biome.json'), template.replaceAll('@PLUGINS@', join(BIOME_DIR, 'plugins')));
    let output;
    try {
      output = execFileSync(findBiome(repo), ['lint', '--reporter=rdjson', '--max-diagnostics=none', '--diagnostic-level=info', 'dashboard'], {
        cwd: stage,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      output = error.stdout?.toString() ?? '';
      if (!output.trim().startsWith('{')) {
        throw new Error(`biome failed: ${error.stderr?.toString().trim() || error.message}`);
      }
    }
    const report = JSON.parse(output);
    return (report.diagnostics ?? []).flatMap((diagnostic) => {
      const code = diagnostic.code?.value ?? '';
      const tagged = diagnostic.message.match(/^\[([a-z0-9-]+)\] /);
      const rule = tagged ? tagged[1] : RULE_ID_BY_BIOME_CODE.get(code);
      if (!rule || !RULES_BY_ID.has(rule)) {
        return [];
      }
      const { start, end } = diagnostic.location.range;
      return [
        {
          rule,
          file: diagnostic.location.path,
          line: start.line,
          column: start.column,
          endLine: end.line,
          message: tagged ? diagnostic.message.slice(tagged[0].length) : diagnostic.message,
        },
      ];
    });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
