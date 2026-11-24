// For each rule: take existing violations from a `--scope all` report, find the commit
// that introduced each one, and check `dashboard-lint --commit <sha>` reports it.
// Usage: node prove.mjs <all-report.json> [repo]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/rules.mjs';

const [reportPath, repo = process.cwd()] = process.argv.slice(2);
const lint = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'dashboard-lint');
const report = JSON.parse(readFileSync(reportPath, 'utf8')).data.findings;
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const lines = (sha, path) => {
  try {
    const text = execFileSync('git', ['show', `${sha}:${path}`], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    return text.split('\n').length;
  } catch {
    return 0;
  }
};

function introducingCommit(rule, finding) {
  if (rule.id === 'max-file-lines') {
    const history = git('log', '--format=%H', '--reverse', '--', finding.file).split('\n');
    return history.find((sha) => lines(sha, finding.file) > 500 && lines(`${sha}^`, finding.file) <= 500) ?? null;
  }
  if (rule.fileLevel) {
    return git('log', '--diff-filter=A', '--format=%H', '--', finding.file).split('\n').at(-1) || null;
  }
  return git('blame', '-L', `${finding.line},${finding.line}`, '--porcelain', 'HEAD', '--', finding.file).split(' ')[0];
}

const results = [];
for (const rule of RULES) {
  const samples = report.filter((f) => f.rule === rule.id);
  const seen = new Set();
  let proof = null;
  let tried = 0;
  for (const sample of samples) {
    if (seen.has(sample.file) || tried >= 6) {
      continue;
    }
    seen.add(sample.file);
    tried += 1;
    const sha = introducingCommit(rule, sample);
    if (!sha) {
      continue;
    }
    let output;
    try {
      output = execFileSync(lint, ['--commit', sha, '--rule', rule.id, '--format', 'json'], { cwd: repo, encoding: 'utf8' });
    } catch (error) {
      output = error.stdout;
    }
    const data = JSON.parse(output).data;
    const hit = data.findings.find((f) => f.rule === rule.id);
    if (hit) {
      proof = { sha: sha.slice(0, 10), subject: git('log', '-1', '--format=%s', sha), file: hit.file.replace('dashboard/src/', ''), line: hit.line };
      break;
    }
  }
  results.push({ rule: rule.id, existing: samples.length, proof });
}

for (const { rule, existing, proof } of results) {
  console.log(
    proof
      ? `PROVEN   ${rule.padEnd(28)} ${proof.sha} ${proof.subject}\n         -> ${proof.file}:${proof.line}`
      : `NO PROOF ${rule.padEnd(28)} (${existing} existing violations, none reproduced)`,
  );
}
process.exitCode = results.every((r) => r.proof || r.existing === 0) ? 0 : 1;
