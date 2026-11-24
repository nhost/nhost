// design-doctor (synced from dashboard/design-doctor) as a dashboard-lint engine.
// New findings are those whose count per file, rule and subject went up compared with the
// merge-base, so moved or reordered classes are not reported. No baseline file is stored.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findBiome } from './biome.mjs';
import { loadTypeScript } from './checks.mjs';
import { git, readBase, readHead, UsageError, withCheckout } from './git.mjs';
import { createRestyle } from './restyle/index.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOL = join(ROOT, 'design-doctor', 'tool');
const PINNED = join(ROOT, 'design-doctor', 'pinned.json');
const RESTYLE_POLICY = join(ROOT, 'design-doctor', 'restyle.json');
const RESTYLE_DOC = join(ROOT, 'design-doctor', 'no-restyle.md');
const CACHE = join(ROOT, 'cache', 'design-doctor');
const VOCAB = join(CACHE, 'vocab');
const DEFAULT_REF = 'HEAD';
const DASHBOARD_LINKS = ['src', 'tailwind.config.js', 'package.json', 'biome.json', 'postcss.config.js', 'tsconfig.json', '.gitignore'];
const SUGGESTED = new Set(['no-raw-colors', 'no-arbitrary-values', 'no-unknown-classes']);
const IGNORE_COMMENT = /design-doctor-ignore/;

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const readJsonFile = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function pinned() {
  return existsSync(PINNED) ? readJsonFile(PINNED) : null;
}

function requireDependencies(repo) {
  const missing = [['dashboard/node_modules', 'tailwindcss'], ['node_modules', 'typescript']].filter(
    ([base, name]) => !existsSync(join(repo, base, name, 'package.json')) && !existsSync(join(repo, 'dashboard/node_modules', name, 'package.json')),
  );
  if (missing.length > 0) {
    throw new UsageError(`design-doctor needs ${missing.map(([, name]) => name).join(' and ')} from this worktree's node_modules.`, 'Run pnpm install in this worktree.');
  }
}

function requireTool() {
  const pin = pinned();
  if (!pin || !existsSync(join(TOOL, 'cli.mjs'))) {
    throw new UsageError('design-doctor is not installed.', 'Run dashboard-lint design sync (copies dashboard/design-doctor from the current checkout).');
  }
  return pin;
}

// Copy dashboard/design-doctor at a commit into this tool's folder (tests left out).
export function sync({ repo, ref = DEFAULT_REF }) {
  const sha = git(repo, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  const tmp = mkdtempSync(join(tmpdir(), 'design-doctor-sync-'));
  try {
    const tar = join(tmp, 'tool.tar');
    writeFileSync(tar, execFileSync('git', ['-C', repo, 'archive', '--format=tar', sha, 'dashboard/design-doctor'], { maxBuffer: 1 << 28 }));
    execFileSync('tar', ['-xf', tar, '-C', tmp]);
    rmSync(join(tmp, 'dashboard/design-doctor/tests'), { recursive: true, force: true });
    rmSync(TOOL, { recursive: true, force: true });
    mkdirSync(dirname(TOOL), { recursive: true });
    cpSync(join(tmp, 'dashboard/design-doctor'), TOOL, { recursive: true });
    const pin = { repo, ref, commit: sha, subject: git(repo, ['log', '-1', '--format=%s', sha]).trim(), syncedAt: new Date().toISOString() };
    writeFileSync(PINNED, `${JSON.stringify(pin, null, 2)}\n`);
    return pin;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function link(target, path) {
  if (existsSync(target)) {
    symlinkSync(target, path);
  }
}

// <dir>/dashboard/design-doctor is a real copy (Node resolves modules to their real path and the
// tool finds dashboard/ relative to itself); everything else links to the worktree.
function buildMirror(dir, worktree) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'dashboard'), { recursive: true });
  for (const name of ['.gitignore', 'biome.json', 'node_modules']) {
    link(join(worktree, name), join(dir, name));
  }
  for (const name of [...DASHBOARD_LINKS, 'node_modules']) {
    link(join(worktree, 'dashboard', name), join(dir, 'dashboard', name));
  }
  cpSync(TOOL, join(dir, 'dashboard/design-doctor'), { recursive: true });
}

// A temporary mirror of the worktree for this run: generation writes into it, and suggestion
// helpers are loaded from it so they resolve the worktree's node_modules. Per run, so two runs
// never write into the same folder.
function withMirror(worktree, fn) {
  let dir = null;
  const mirror = () => {
    if (!dir) {
      dir = mkdtempSync(join(tmpdir(), 'design-doctor-mirror-'));
      buildMirror(dir, worktree);
    }
    return dir;
  };
  const cleanup = () => dir && rmSync(dir, { recursive: true, force: true });
  let result;
  try {
    result = fn(mirror);
  } catch (error) {
    cleanup();
    throw error;
  }
  if (result instanceof Promise) {
    return result.finally(cleanup);
  }
  cleanup();
  return result;
}

const PACKAGES = ['tailwindcss', '@tailwindcss/forms', '@tailwindcss/typography', 'tailwindcss-animate'];
const MAX_VOCABULARIES = 20;

function packageVersion(worktree, name) {
  for (const base of ['dashboard/node_modules', 'node_modules']) {
    const path = join(worktree, base, name, 'package.json');
    if (existsSync(path)) {
      return readJsonFile(path).version;
    }
  }
  return 'missing';
}

// Reads dashboard files from the working tree or from a commit (one git process for all paths).
function sourceReader(repo, commit) {
  if (!commit) {
    return {
      read: (paths) => new Map(paths.map((path) => [path, existsSync(join(repo, 'dashboard', path)) ? readFileSync(join(repo, 'dashboard', path)) : null])),
      list: (dir) => walk(join(repo, 'dashboard'), dir),
    };
  }
  return {
    read(paths) {
      const output = execFileSync('git', ['cat-file', '--batch'], { cwd: repo, input: paths.map((path) => `${commit}:dashboard/${path}\n`).join(''), maxBuffer: 1 << 28 });
      const result = new Map();
      let offset = 0;
      for (const path of paths) {
        const newline = output.indexOf(10, offset);
        const header = output.subarray(offset, newline).toString();
        offset = newline + 1;
        if (header.endsWith(' missing') || header.endsWith(' ambiguous')) {
          result.set(path, null);
          continue;
        }
        const size = Number(header.split(' ')[2]);
        result.set(path, output.subarray(offset, offset + size));
        offset += size + 1;
      }
      return result;
    },
    list: (dir) =>
      git(repo, ['ls-tree', '-r', '--name-only', commit, '--', `dashboard/${dir}`])
        .split('\n')
        .filter(Boolean)
        .map((path) => path.slice('dashboard/'.length)),
  };
}

function walk(root, dir) {
  const full = join(root, dir);
  if (!existsSync(full)) {
    return [];
  }
  return readdirSync(full, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

// Files design-doctor's generator finds by listing folders (tokens/inputs.mts). Files it reaches
// by following imports are covered by the content check of the files that import them.
function listedInputs(reader) {
  const notTest = (path) => !/(?:\.test\.|\.spec\.)/.test(path);
  const styles = reader.list('src/styles').filter((path) => path.endsWith('.css'));
  const v3 = reader.list('src/components/ui/v3').filter((path) => /\.tsx?$/.test(path));
  const barrels = ['form', 'common', 'presentational'].flatMap((folder) =>
    reader.list(`src/components/${folder}`).filter((path) => new RegExp(`^src/components/${folder}/[^/]+/index\\.ts$`).test(path)),
  );
  return [...styles, ...v3, ...barrels].filter(notTest);
}

// A cached vocabulary is reused only when every input its generation recorded still has the
// same hash and no new file appeared in the folders the generator lists.
function findVocabulary({ repo, pin, biomeVersion, commit }) {
  if (!existsSync(VOCAB)) {
    return null;
  }
  const candidates = readdirSync(VOCAB)
    .filter((id) => !id.startsWith('.'))
    .map((id) => ({ id, dir: join(VOCAB, id) }))
    .filter(({ dir }) => existsSync(join(dir, 'meta.json')))
    .map((entry) => ({ ...entry, meta: readJsonFile(join(entry.dir, 'meta.json')) }))
    .filter(({ meta }) => meta.toolCommit === pin.commit && meta.biomeVersion === biomeVersion)
    .sort((a, b) => b.meta.lastUsedAt.localeCompare(a.meta.lastUsedAt));
  if (candidates.length === 0) {
    return null;
  }
  const reader = sourceReader(repo, commit);
  const listed = listedInputs(reader);
  const recorded = candidates.map((entry) => ({ ...entry, inputs: readJsonFile(join(entry.dir, 'generated/index.json')).inputs }));
  const paths = [...new Set(recorded.flatMap(({ inputs }) => Object.keys(inputs)).filter((path) => !/^(design-doctor\/|biome:|package:)/.test(path)))];
  const contents = reader.read(paths);
  const hashes = new Map([...contents].map(([path, buffer]) => [path, buffer ? sha256(buffer) : null]));
  for (const name of PACKAGES) {
    hashes.set(`package:${name}`, sha256(packageVersion(repo, name)));
  }
  for (const entry of recorded) {
    const matches = Object.entries(entry.inputs).every(([path, hash]) => /^(design-doctor\/|biome:)/.test(path) || hashes.get(path) === hash);
    if (matches && listed.every((path) => path in entry.inputs)) {
      writeFileSync(join(entry.dir, 'meta.json'), `${JSON.stringify({ ...entry.meta, lastUsedAt: new Date().toISOString() })}\n`);
      return { key: entry.id, dir: entry.dir };
    }
  }
  return null;
}

function generateIn(mirrorDir, biome) {
  try {
    execFileSync(process.execPath, ['design-doctor/cli.mjs', 'generate'], {
      cwd: join(mirrorDir, 'dashboard'),
      env: { ...process.env, PATH: `${dirname(biome)}:${process.env.PATH}` },
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 26,
    });
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().split('\n').slice(0, 6).join('\n');
    throw new UsageError(`design-doctor generate failed: ${output}`, 'Run dashboard-lint design sync, or check the dashboard theme and catalog inputs.');
  }
  return { generated: join(mirrorDir, 'dashboard/design-doctor/generated'), config: join(mirrorDir, 'dashboard/biome.design.json') };
}

function store({ pin, biomeVersion }, { generated, config }) {
  const inputs = readJsonFile(join(generated, 'index.json')).inputs;
  const id = sha256(JSON.stringify([pin.commit, biomeVersion, Object.entries(inputs).filter(([path]) => !path.startsWith('design-doctor/')).sort()])).slice(0, 24);
  const dir = join(VOCAB, id);
  if (!existsSync(join(dir, 'meta.json'))) {
    // Written under a temporary name and renamed, so a parallel run never reads half an entry.
    mkdirSync(VOCAB, { recursive: true });
    const tmp = mkdtempSync(join(VOCAB, '.tmp-'));
    cpSync(generated, join(tmp, 'generated'), { recursive: true });
    cpSync(config, join(tmp, 'biome.design.json'));
    const now = new Date().toISOString();
    writeFileSync(join(tmp, 'meta.json'), `${JSON.stringify({ toolCommit: pin.commit, biomeVersion, createdAt: now, lastUsedAt: now })}\n`);
    try {
      renameSync(tmp, dir);
    } catch {
      rmSync(tmp, { recursive: true, force: true });
    }
    prune();
  }
  return { key: id, dir };
}

function prune() {
  const entries = readdirSync(VOCAB)
    .filter((id) => !id.startsWith('.') && existsSync(join(VOCAB, id, 'meta.json')))
    .map((id) => ({ id, lastUsedAt: readJsonFile(join(VOCAB, id, 'meta.json')).lastUsedAt }))
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  for (const { id } of entries.slice(MAX_VOCABULARIES)) {
    rmSync(join(VOCAB, id), { recursive: true, force: true });
  }
}

// The vocabulary (generated plugins, tokens, catalog) for the working tree or for a commit.
function vocabulary({ repo, pin, biome, biomeVersion, commit, mirror }) {
  const hit = findVocabulary({ repo, pin, biomeVersion, commit });
  if (hit) {
    return hit;
  }
  if (!commit) {
    return store({ pin, biomeVersion }, generateIn(mirror(), biome));
  }
  // Generate inside the throwaway checkout: Node resolves require() from a file's real path,
  // so the commit's tailwind.config.js needs node_modules next to it, not next to a link.
  return withCheckout(
    repo,
    commit,
    (checkout) => {
      link(join(repo, 'node_modules'), join(checkout, 'node_modules'));
      link(join(repo, 'dashboard/node_modules'), join(checkout, 'dashboard/node_modules'));
      rmSync(join(checkout, 'dashboard/design-doctor'), { recursive: true, force: true });
      cpSync(TOOL, join(checkout, 'dashboard/design-doctor'), { recursive: true });
      return store({ pin, biomeVersion }, generateIn(checkout, biome));
    },
    { paths: ['/dashboard/', '/biome.json', '/.gitignore'] },
  );
}

async function loadParser() {
  return import(pathToFileURL(join(TOOL, 'src/biome/parse.mts')).href);
}

// Run the vocabulary's plugins (and nothing else) on staged copies of the given files.
async function lintStaged(vocab, files, biome) {
  if (files.length === 0) {
    return [];
  }
  const { parseMessage } = await loadParser();
  const design = readJsonFile(join(vocab.dir, 'biome.design.json'));
  const stage = mkdtempSync(join(tmpdir(), 'design-doctor-stage-'));
  try {
    for (const { path, text } of files) {
      mkdirSync(dirname(join(stage, path)), { recursive: true });
      writeFileSync(join(stage, path), text);
    }
    const plugins = design.plugins.map((plugin) => ({ ...plugin, path: join(vocab.dir, plugin.path.replace(/^\.\/design-doctor\//, '')) }));
    writeFileSync(
      join(stage, 'biome.json'),
      JSON.stringify({ root: true, vcs: { enabled: false }, formatter: { enabled: false }, assist: { enabled: false }, linter: { enabled: true, rules: { recommended: false } }, plugins }),
    );
    let output;
    let stderr = '';
    try {
      output = execFileSync(biome, ['lint', '--reporter=rdjson', '--max-diagnostics=none', '--diagnostic-level=info', 'dashboard'], {
        cwd: stage,
        encoding: 'utf8',
        maxBuffer: 1 << 28,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      output = error.stdout?.toString() ?? '';
      stderr = error.stderr?.toString() ?? '';
    }
    let report;
    try {
      report = JSON.parse(output);
    } catch {
      throw new UsageError(`design-doctor's Biome run produced no report: ${stderr.trim().split('\n').slice(0, 4).join(' ')}`, 'This is inconclusive, not a pass. Check the Biome version and the synced tool.');
    }
    const findings = [];
    for (const diagnostic of report.diagnostics ?? []) {
      const message = parseMessage(diagnostic.message ?? '');
      if (!message) {
        if (/plugin/i.test(diagnostic.code?.value ?? '') || /plugin/i.test(diagnostic.message ?? '')) {
          throw new UsageError(`design-doctor plugin failure: ${String(diagnostic.message).slice(0, 300)}`, 'This is inconclusive, not a pass. Check the Biome version and the synced tool.');
        }
        continue;
      }
      const { start, end } = diagnostic.location.range;
      for (const { subject, guidance } of message.subjects) {
        findings.push({ ruleId: message.ruleId, subject, guidance, file: diagnostic.location.path, line: start.line, column: start.column, endLine: end.line });
      }
    }
    return findings;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

const keyOf = (f) => `${f.file}\0${f.ruleId}\0${f.subject}`;

async function suggestions(mirrorOf, vocab, findings) {
  const wanted = findings.filter((f) => SUGGESTED.has(f.ruleId));
  if (wanted.length === 0) {
    return new Map();
  }
  const mirror = mirrorOf();
  const load = (path) => import(pathToFileURL(join(mirror, 'dashboard/design-doctor/src', path)).href);
  const tokens = readJsonFile(join(vocab.dir, 'generated/tokens.json'));
  const result = new Map();
  let vocabularyForUnknown = null;
  for (const finding of wanted) {
    const id = `${finding.ruleId}\0${finding.subject}`;
    if (result.has(id)) {
      continue;
    }
    try {
      if (finding.ruleId === 'no-raw-colors') {
        result.set(id, (await load('theme/suggest.mts')).suggestRawColor(finding.subject, tokens));
      } else if (finding.ruleId === 'no-arbitrary-values') {
        result.set(id, (await load('theme/arbitrary-suggest.mts')).suggestArbitraryValue(finding.subject, tokens));
      } else {
        if (!vocabularyForUnknown) {
          const { loadTheme } = await load('theme/load.mts');
          const { unknownVocabulary } = await load('grit/rules/no-unknown-classes.mts');
          vocabularyForUnknown = unknownVocabulary(loadTheme(join(mirror, 'dashboard')).resolved, join(mirror, 'dashboard'));
        }
        const { suggestUnknownClass } = await load('theme/similar.mts');
        result.set(id, suggestUnknownClass(finding.subject, vocabularyForUnknown.classes, vocabularyForUnknown.variants.map(({ name }) => name)));
      }
    } catch {
      result.set(id, null);
    }
  }
  return result;
}

// scope: 'lines' | 'new-files' | 'all'. changedFiles: dashboard-lint's changed lintable files.
export function runDesign(repo, range, options) {
  return withMirror(repo, (mirror) => design(repo, range, { ...options, mirror }));
}

async function design(repo, range, { scope, changedFiles, overlaps, mirror }) {
  const pin = requireTool();
  requireDependencies(repo);
  const biome = findBiome(repo);
  const biomeVersion = execFileSync(biome, ['--version'], { encoding: 'utf8' }).match(/Version: (\S+)/)?.[1];
  const wantedBiome = readJsonFile(join(TOOL, 'manifest.json')).biomeVersion;
  if (biomeVersion !== wantedBiome) {
    throw new UsageError(`design-doctor's plugins are written for Biome ${wantedBiome}; found ${biomeVersion}.`, 'Use the Biome version the tool pins, or sync a design-doctor built for this Biome.');
  }
  const notes = [];
  const headVocab = vocabulary({ repo, pin, biome, biomeVersion, commit: range.worktree ? null : range.headCommit, mirror });
  const files = scope === 'all' ? changedFiles : changedFiles.filter((file) => scope !== 'new-files' || file.status === 'added');
  const headFiles = files.map((file) => ({ ...file, text: readHead(repo, range, file.path) })).filter((file) => file.text !== null);
  // no-restyle (ported from shadcn-ui/lint) runs in-process, on the same files and in the same
  // shape as the plugin rules, so its findings are counted the same way.
  const restyle = createRestyle({ repo, ts: loadTypeScript(repo), catalog: readJsonFile(join(headVocab.dir, 'generated/catalog.json')), policySpec: restylePolicy() });
  const head = [...(await lintStaged(headVocab, headFiles.map(({ path, text }) => ({ path, text })), biome)), ...restyle.findingsFor(headFiles)];

  let introduced;
  let baseCount = 0;
  if (scope === 'all') {
    introduced = head;
  } else {
    let baseVocab = headVocab;
    try {
      baseVocab = vocabulary({ repo, pin, biome, biomeVersion, commit: range.mergeBase });
    } catch (error) {
      notes.push(`Could not generate the vocabulary at the merge-base (${error.message.split('\n')[0]}); the branch's vocabulary was used for the base.`);
    }
    if (baseVocab.key !== headVocab.key) {
      notes.push('The theme or component catalog differs between the merge-base and this branch; each side was checked with its own vocabulary.');
    }
    const baseFiles = headFiles
      .filter((file) => file.status !== 'added')
      .map((file) => ({ path: file.path, text: readBase(repo, range, file.basePath ?? file.path) }))
      .filter((file) => file.text !== null);
    const base = [...(await lintStaged(baseVocab, baseFiles, biome)), ...restyle.findingsFor(baseFiles)];
    baseCount = base.length;
    // Counts are netted per rule and subject across all changed files, so code moved from one
    // file into another (an extracted component) is not new. Extras are reported in files whose
    // count went up, preferring findings on added lines.
    const count = (list) => list.reduce((map, f) => map.set(f.key, (map.get(f.key) ?? 0) + 1), new Map());
    const withKeys = (list, keyOf) => list.map((f) => ({ ...f, key: keyOf(f) }));
    const subjectKey = (f) => `${f.ruleId}\0${f.subject}`;
    const baseTotals = count(withKeys(base, subjectKey));
    const headKeyed = withKeys(head, subjectKey);
    const headTotals = count(headKeyed);
    const basePerFile = count(withKeys(base, keyOf));
    const headPerFile = count(withKeys(head, keyOf));
    introduced = [];
    for (const [key, total] of headTotals) {
      const extra = total - (baseTotals.get(key) ?? 0);
      if (extra <= 0) {
        continue;
      }
      const grew = (f) => (headPerFile.get(keyOf(f)) ?? 0) > (basePerFile.get(keyOf(f)) ?? 0);
      const ranked = headKeyed
        .filter((f) => f.key === key)
        .sort((a, b) => Number(grew(b)) - Number(grew(a)) || Number(overlaps(b, byPath(files, b.file))) - Number(overlaps(a, byPath(files, a.file))) || a.file.localeCompare(b.file) || a.line - b.line);
      introduced.push(...ranked.slice(0, extra));
    }
  }

  const suggested = await suggestions(mirror, headVocab, introduced);
  const findings = introduced.map((f) => {
    const suggestion = suggested.get(`${f.ruleId}\0${f.subject}`);
    return {
      rule: `design/${f.ruleId}`,
      file: f.file,
      line: f.line,
      column: f.column,
      endLine: f.endLine,
      message: f.ruleId === 'no-restyle' ? f.guidance : `"${f.subject}": ${localCommands(f.guidance)}${suggestion ? ` ${suggestion}` : ''}`,
    };
  });

  for (const file of headFiles) {
    const lines = file.text.split('\n');
    file.added.forEach(([start, end]) => {
      for (let line = start; line <= Math.min(end, lines.length); line += 1) {
        if (IGNORE_COMMENT.test(lines[line - 1])) {
          findings.push({ rule: 'design/no-ignore-comments', file: file.path, line, column: lines[line - 1].search(IGNORE_COMMENT) + 1, endLine: line, message: 'A design-doctor-ignore comment was added.' });
        }
      }
    });
  }

  return {
    tool: { commit: pin.commit.slice(0, 10), ref: pin.ref },
    vocabulary: headVocab.key.slice(0, 12),
    headFindings: head.length,
    baseFindingsInChangedFiles: baseCount,
    notes,
    findings,
  };
}

// The rule texts name the branch's pnpm scripts; point to the local commands instead.
function localCommands(guidance) {
  return guidance
    .replace('run pnpm design-doctor for specific guidance', 'see dashboard-lint design explain no-unknown-classes')
    .replace(/pnpm design-doctor for (.*?) in generated\/tokens\.md/, 'dashboard-lint design tokens for $1')
    .replaceAll('pnpm design-doctor', 'dashboard-lint design tokens');
}

function byPath(files, path) {
  return files.find((file) => file.path === path)?.added ?? [];
}

export function readGenerated(repo, name) {
  const pin = requireTool();
  requireDependencies(repo);
  const biome = findBiome(repo);
  const biomeVersion = execFileSync(biome, ['--version'], { encoding: 'utf8' }).match(/Version: (\S+)/)?.[1];
  return withMirror(repo, (mirror) => readFileSync(join(vocabulary({ repo, pin, biome, biomeVersion, commit: null, mirror }).dir, 'generated', name), 'utf8'));
}

function restylePolicy() {
  const spec = existsSync(RESTYLE_POLICY) ? readJsonFile(RESTYLE_POLICY) : { allow: ['layout'] };
  const unknown = Object.keys(spec).filter((key) => !['allow', 'deny', 'contracts'].includes(key));
  if (unknown.length > 0) {
    throw new UsageError(`Unknown keys in ${RESTYLE_POLICY}: ${unknown.join(', ')}.`, 'Use allow, deny and contracts ([{ pattern, allow, deny }]).');
  }
  return spec;
}

export function ruleDoc(id) {
  requireTool();
  const name = id.replace(/^design\//, '');
  const path = name === 'no-restyle' ? RESTYLE_DOC : join(TOOL, 'docs/rules', `${name}.md`);
  if (!existsSync(path)) {
    throw new UsageError(`No design rule ${id}.`, 'Run dashboard-lint --list-rules.');
  }
  return readFileSync(path, 'utf8');
}
