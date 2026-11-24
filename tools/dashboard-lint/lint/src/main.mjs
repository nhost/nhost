import { parseArgs } from 'node:util';
import { runBiome } from './biome.mjs';
import { loadTypeScript, runChecks } from './checks.mjs';
import { allFiles, changedFiles, readHead, repoRoot, resolveRange, UsageError } from './git.mjs';
import { readGenerated, ruleDoc, runDesign, sync as syncDesign } from './design.mjs';
import { RULES, RULES_BY_ID } from './rules.mjs';

const HELP = `dashboard-lint: lint only the code a branch adds to dashboard/src

Usage:
  dashboard-lint [--base <ref>] [--head <ref> | --commit <sha>] [--scope lines|new-files|all]
                 [--rule <id,...>] [--format text|json] [--repo <path>]
  dashboard-lint --list-rules [--format text|json]
  dashboard-lint design sync [--repo <nhost checkout>] [--ref <branch or commit>]
  dashboard-lint design catalog|tokens [--repo <path>]
  dashboard-lint design explain <rule>

Scope (default: lines)
  lines      New files completely; existing files only on added or changed lines.
             File-level rules fire only when this change causes them (a new file,
             a new folder, or a file crossing 500 lines).
  new-files  Only files that do not exist on the base.
  all        Every file under dashboard/src, ignoring the diff. For audits, not agents.

Range
  --base     Ref to compare against. Default: origin/main. The merge-base is used.
  --head     Commit to lint. Default: the working tree, including uncommitted and
             untracked files.
  --commit   Shorthand for --base <sha>^ --head <sha>.

Design (rule id: design)
  design-doctor, synced from dashboard/design-doctor. Each changed file is
  checked at the merge-base and at head, each with the theme and component catalog of its
  own commit. A finding is new when its count per file, rule and subject (for example
  no-raw-colors / bg-blue-500) goes up, so reordering or reformatting classes reports
  nothing. Added design-doctor-ignore comments are findings too.
  design sync      copy dashboard/design-doctor from a commit (default: HEAD of the
                   current repository) into this tool
  design catalog   print the component catalog for this worktree (read before writing UI)
  design tokens    print the theme tokens for this worktree
  design explain   print a rule's documentation

Exit codes: 0 no findings, 1 findings, 2 usage or environment error.

Examples
  dashboard-lint
  dashboard-lint --format json
  dashboard-lint --commit 1a2b3c4 --rule it-not-test
  dashboard-lint --scope all --rule no-jsx-comments
`;

function overlaps(finding, ranges) {
  return ranges.some(([start, end]) => finding.line <= end && finding.endLine >= start);
}

function designCommand(argv) {
  const [action, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    options: { repo: { type: 'string' }, ref: { type: 'string' } },
    allowPositionals: true,
    strict: true,
  });
  if (action === 'sync') {
    const pin = syncDesign({ repo: repoRoot(values.repo ?? process.cwd()), ...(values.ref && { ref: values.ref }) });
    process.stdout.write(`design-doctor synced from ${pin.ref} at ${pin.commit.slice(0, 10)} (${pin.subject}).\n`);
    return 0;
  }
  if (action === 'catalog' || action === 'tokens') {
    process.stdout.write(readGenerated(repoRoot(values.repo ?? process.cwd()), `${action}.md`));
    return 0;
  }
  if (action === 'explain' && positionals.length === 1) {
    process.stdout.write(ruleDoc(positionals[0]));
    return 0;
  }
  throw new UsageError(`Unknown design command: ${argv.join(' ') || '(none)'}.`, 'Use dashboard-lint design sync | catalog | tokens | explain <rule>.');
}

async function main() {
  if (process.argv[2] === 'design') {
    return designCommand(process.argv.slice(3));
  }
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      head: { type: 'string' },
      commit: { type: 'string' },
      scope: { type: 'string', default: 'lines' },
      rule: { type: 'string' },
      format: { type: 'string', default: 'text' },
      repo: { type: 'string' },
      'list-rules': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!['text', 'json'].includes(values.format)) {
    throw new UsageError(`Unknown --format ${values.format}.`, 'Use --format text or --format json.');
  }
  if (values['list-rules']) {
    const rules = RULES.map(({ id, engine, summary, hint }) => ({ id, engine, summary, hint }));
    process.stdout.write(
      values.format === 'json'
        ? `${JSON.stringify({ ok: true, data: { rules } }, null, 2)}\n`
        : rules.map((r) => `${r.id.padEnd(30)} ${r.summary}`).join('\n') + '\n',
    );
    return 0;
  }
  if (!['lines', 'new-files', 'all'].includes(values.scope)) {
    throw new UsageError(`Unknown --scope ${values.scope}.`, 'Use --scope lines, new-files or all.');
  }
  if (values.commit && (values.base || values.head)) {
    throw new UsageError('--commit cannot be combined with --base or --head.', 'Use either --commit <sha> or --base/--head.');
  }

  const enabled = new Set(values.rule ? values.rule.split(',').map((r) => r.trim()) : RULES.map((r) => r.id));
  for (const id of enabled) {
    if (!RULES_BY_ID.has(id)) {
      throw new UsageError(`Unknown rule ${id}.`, 'Run dashboard-lint --list-rules to see rule ids.');
    }
  }

  const repo = repoRoot(values.repo ?? process.cwd());
  const range = resolveRange(repo, values);
  const candidates = values.scope === 'all' ? allFiles(repo, range) : changedFiles(repo, range);
  const files = candidates
    .filter((file) => values.scope !== 'new-files' || file.status === 'added')
    .map((file) => ({ ...file, text: readHead(repo, range, file.path) }))
    .filter((file) => file.text !== null);

  const idsFor = (...engines) => new Set(RULES.filter((r) => engines.includes(r.engine)).map((r) => r.id));
  const biomeRules = idsFor('biome', 'biome-plugin');
  const scriptRules = idsFor('script');
  const needsBiome = [...enabled].some((id) => biomeRules.has(id));
  const needsScripts = [...enabled].some((id) => scriptRules.has(id));
  const design = enabled.has('design') ? await runDesign(repo, range, { scope: values.scope, changedFiles: candidates, overlaps }) : null;

  const raw = [];
  if (needsBiome) {
    raw.push(...runBiome(repo, files).filter((f) => enabled.has(f.rule)));
  }
  if (needsScripts && files.length > 0) {
    const ts = loadTypeScript(repo);
    for (const file of files) {
      raw.push(...runChecks({ ts, repo, range, file, text: file.text, enabled }));
    }
  }

  const byPath = new Map(files.map((file) => [file.path, file]));
  const findings = [];
  let preExisting = 0;
  for (const finding of raw) {
    const rule = RULES_BY_ID.get(finding.rule);
    const file = byPath.get(finding.file);
    if (rule.fileLevel || overlaps(finding, file?.added ?? [])) {
      findings.push({ ...finding, summary: rule.summary, hint: rule.hint });
    } else {
      preExisting += 1;
    }
  }
  const designRule = RULES_BY_ID.get('design');
  findings.push(...(design?.findings ?? []).map((finding) => ({ ...finding, summary: designRule.summary, hint: `dashboard-lint design explain ${finding.rule.slice('design/'.length)}` })));
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));

  const summary = {
    base: range.baseRef,
    mergeBase: range.mergeBase.slice(0, 10),
    head: range.worktree ? 'working tree' : range.headCommit.slice(0, 10),
    scope: values.scope,
    filesChecked: files.length,
    findingCount: findings.length,
    preExistingIgnored: preExisting,
  };

  const designReport = design && { tool: design.tool, vocabulary: design.vocabulary, headFindingsInChangedFiles: design.headFindings, baseFindingsInChangedFiles: design.baseFindingsInChangedFiles, notes: design.notes, findingCount: design.findings.length };

  if (values.format === 'json') {
    process.stdout.write(`${JSON.stringify({ ok: true, data: { ...summary, design: designReport, findings } }, null, 2)}\n`);
  } else {
    const header = `dashboard-lint: ${summary.findingCount} finding(s) in new code; ${summary.filesChecked} file(s) checked against ${summary.base} (merge-base ${summary.mergeBase}), head ${summary.head}, scope ${summary.scope}.`;
    const ignored = preExisting > 0 ? `\n${preExisting} pre-existing finding(s) in touched files ignored; they are not part of this change.` : '';
    const body = findings
      .map((f) => `${f.file}:${f.line}:${f.column}  ${f.rule}${f.severity ? ` (${f.severity})` : ''}\n  ${f.message}\n  fix: ${f.hint}`)
      .join('\n\n');
    process.stdout.write(`${header}${ignored}${designReport ? `\n${describeDesign(designReport, values.scope)}` : ''}${body ? `\n\n${body}` : ''}\n`);
  }
  return findings.length > 0 ? 1 : 0;
}

function describeDesign({ tool, headFindingsInChangedFiles, baseFindingsInChangedFiles, notes, findingCount }, scope) {
  const counts = scope === 'all' ? `${headFindingsInChangedFiles} finding(s)` : `${baseFindingsInChangedFiles} finding(s) in the changed files at the merge-base, ${headFindingsInChangedFiles} now, ${findingCount} new`;
  return [`design-doctor ${tool.commit}: ${counts}.`, ...notes].join('\n');
}

try {
  process.exitCode = await main();
} catch (error) {
  const payload = { ok: false, error: { message: error.message, hint: error.hint ?? 'Run dashboard-lint --help.' } };
  const wantsJson = process.argv.includes('json') || process.argv.includes('--format=json');
  process.stderr.write(wantsJson ? `${JSON.stringify(payload)}\n` : `dashboard-lint: ${error.message}\n  hint: ${payload.error.hint}\n`);
  process.exitCode = 2;
}
