// Proves the design engine on known changes, made as commits in a throwaway clone of the repo
// (the repo itself is not touched). Usage: node design-probe.mjs [repo]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.argv[2] ?? process.cwd(), encoding: 'utf8' }).trim();
const lint = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'dashboard-lint');
const clone = mkdtempSync(join(tmpdir(), 'design-probe-'));
const git = (...args) => execFileSync('git', ['-c', 'user.name=probe', '-c', 'user.email=probe@localhost', ...args], { cwd: clone, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const COOKIE = 'dashboard/src/components/common/CookieConsent/CookieConsent.tsx';
const RULES = ['no-arbitrary-values', 'no-direct-radix-imports', 'no-inline-styles', 'no-raw-colors', 'no-reinvented-components', 'no-unknown-classes', 'require-static-classes', 'no-ignore-comments', 'no-restyle'].map((id) => `design/${id}`);

const read = (path) => readFileSync(join(clone, path), 'utf8');
const write = (path, text) => {
  mkdirSync(dirname(join(clone, path)), { recursive: true });
  writeFileSync(join(clone, path), text);
};
const commit = (message) => {
  git('add', '-A', 'dashboard');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
};
const run = (args) => {
  const started = Date.now();
  let out;
  try {
    out = execFileSync(lint, ['--repo', clone, '--rule', 'design', '--format', 'json', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    out = error.stdout;
    if (error.status === 2) {
      throw new Error(`dashboard-lint failed: ${error.stderr}`);
    }
  }
  return { ...JSON.parse(out).data, ms: Date.now() - started };
};

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
};

try {
  const start = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', repo, clone]);
  git('sparse-checkout', 'set', '--no-cone', '/dashboard/', '/biome.json', '/.gitignore', '/nixops/');
  git('checkout', '-q', '--detach', start);
  for (const path of ['node_modules', 'dashboard/node_modules']) {
    if (existsSync(join(repo, path))) {
      symlinkSync(join(repo, path), join(clone, path));
    }
  }
  const original = read(COOKIE);

  // 1. One planted violation per rule, in a new file.
  write(
    'dashboard/src/features/orgs/projects/DesignProbe/DesignProbe.tsx',
    `import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/v3/button';

export default function DesignProbe({ size }: { size: number }) {
  return (
    <Dialog.Root>
      {/* design-doctor-ignore no-raw-colors: probe */}
      <div className="bg-blue-500 text-[13px] flexx" style={{ color: 'red' }}>
        <span className={\`p-\${size}\`}>probe</span>
        <button type="button">go</button>
        <Button className="mt-4 p-4">restyled</Button>
      </div>
    </Dialog.Root>
  );
}
`,
  );
  const planted = run(['--commit', commit('planted')]);
  const got = new Set(planted.findings.map((f) => f.rule));
  const missing = RULES.filter((id) => !got.has(id));
  check('planted', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : `all ${RULES.length} rules reported (${planted.findings.length} findings, ${planted.ms} ms)`);
  git('reset', '-q', '--hard', start);

  // 2. Reordering every className keeps every count: nothing new.
  const reordered = original.replace(/className="([^"]+)"/g, (_, classes) => `className="${classes.split(/\s+/).reverse().join(' ')}"`);
  write(COOKIE, reordered);
  const reformat = run(['--commit', commit('reorder classes')]);
  check('reformat', reformat.findings.length === 0, `${reformat.findings.length} new of ${reformat.design.headFindingsInChangedFiles} (${reformat.design.baseFindingsInChangedFiles} at base), ${reformat.ms} ms`);
  git('reset', '-q', '--hard', start);

  // 3. Extracting the component into a new file moves its findings: nothing new.
  write('dashboard/src/components/common/CookieConsent/CookieBanner.tsx', original);
  write(COOKIE, "export { default } from './CookieBanner';\nexport * from './CookieBanner';\n");
  const extract = run(['--commit', commit('extract component')]);
  check('extract', extract.findings.length === 0, `${extract.findings.length} new of ${extract.design.headFindingsInChangedFiles} (${extract.design.baseFindingsInChangedFiles} at base), ${extract.ms} ms`);
  git('reset', '-q', '--hard', start);

  // 4. One more raw color on an added line: exactly one finding, on that line.
  const lines = original.split('\n');
  const at = lines.findIndex((line) => line.includes('className=')) + 1;
  lines.splice(at, 0, '      <p className="text-white">probe</p>');
  write(COOKIE, lines.join('\n'));
  const one = run(['--commit', commit('one more raw color')]);
  const only = one.findings[0];
  check('one-more', one.findings.length === 1 && only.rule === 'design/no-raw-colors' && only.line === at + 1, `${one.findings.length} finding(s): ${one.findings.map((f) => `${f.rule}@${f.line}`).join(', ')} (expected design/no-raw-colors@${at + 1}), ${one.ms} ms`);
  git('reset', '-q', '--hard', start);

  // 5. Working tree: an uncommitted edit and an untracked file.
  write(COOKIE, original.replace('className="', 'className="bg-red-500 '));
  write('dashboard/src/features/orgs/projects/DesignProbe/Untracked.tsx', 'export function Untracked() {\n  return <div className="text-[13px]">probe</div>;\n}\n');
  const tree = run(['--base', start]);
  const subjects = tree.findings.map((f) => f.message.split('"')[1]).sort();
  check('worktree', JSON.stringify(subjects) === JSON.stringify(['bg-red-500', 'text-[13px]']), `${tree.findings.length} finding(s): ${subjects.join(', ')}, ${tree.ms} ms`);
  git('checkout', '-q', '--', 'dashboard');
  rmSync(join(clone, 'dashboard/src/features/orgs/projects/DesignProbe'), { recursive: true, force: true });

  // 7. no-restyle reads every supported className form, and only checks ui/v3 components.
  write(
    'dashboard/src/features/orgs/projects/DesignProbe/RestyleProbe.tsx',
    `import { Badge } from '@/components/ui/v3/badge';
import { Button as UIButton } from '@/components/ui/v3/button';
import * as Dialog from '@/components/ui/v3/dialog';
import { cn } from '@/lib/utils';

const badgeClassName = 'uppercase mt-1';

export default function RestyleProbe({ active, size }: { active: boolean; size: number }) {
  return (
    <div>
      <UIButton className="mt-4 w-full p-4">a</UIButton>
      <UIButton className={cn('flex-1', active && 'bg-primary', active ? 'rounded-full' : 'shadow-sm')}>b</UIButton>
      <UIButton className={\`ml-2 \${active ? 'text-xs' : ''} p-\${size}\`}>c</UIButton>
      <Badge className={badgeClassName}>d</Badge>
      <Dialog.DialogContent className="max-w-lg gap-2">e</Dialog.DialogContent>
      <UIButton asChild>
        <a href="/x" className="px-2 underline">f</a>
      </UIButton>
      <div className="p-8 bg-primary">g</div>
    </div>
  );
}
`,
  );
  const sites = run(['--commit', commit('restyle sites')]);
  const restyled = sites.findings.filter((f) => f.rule === 'design/no-restyle').map((f) => `${f.message.match(/<(\w+)>(?: owns|:)/)?.[1] ?? '?'} ${f.message.split('"')[1]}`).sort();
  const expected = ['Badge uppercase', 'Button bg-primary', 'Button p-4', 'Button px-2', 'Button rounded-full', 'Button shadow-sm', 'Button text-xs', 'Button underline', 'DialogContent gap-2'];
  const sizeHint = sites.findings.find((f) => f.message.startsWith('"p-4"'))?.message.match(/Use a size \(([^)]+)\)/)?.[1];
  check('restyle-sites', JSON.stringify(restyled) === JSON.stringify(expected) && sizeHint, `${restyled.join(', ')}${sizeHint ? `; p-4 suggests Button's sizes (${sizeHint})` : '; size hint missing'}`);
  git('reset', '-q', '--hard', start);

  // 8. Reordering classes in a file with 20 existing restyles, and extracting it, add none.
  const SERVICES = 'dashboard/src/features/orgs/projects/services/components/ServicesList/ServicesList.tsx';
  const services = read(SERVICES);
  write(SERVICES, services.replace(/className="([^"]+)"/g, (_, classes) => `className="${classes.split(/\s+/).reverse().join(' ')}"`));
  const reorder = run(['--commit', commit('reorder restyled classes')]);
  const reorderRestyles = reorder.findings.filter((f) => f.rule === 'design/no-restyle').length;
  check('restyle-reorder', reorder.findings.length === 0, `${reorder.findings.length} new (${reorderRestyles} no-restyle) of ${reorder.design.headFindingsInChangedFiles} at head`);
  git('reset', '-q', '--hard', start);
  write(SERVICES.replace('ServicesList.tsx', 'ServicesListBody.tsx'), services);
  write(SERVICES, "export { default } from './ServicesListBody';\nexport * from './ServicesListBody';\n");
  const moved = run(['--commit', commit('extract restyled component')]);
  check('restyle-extract', moved.findings.length === 0, `${moved.findings.length} new of ${moved.design.headFindingsInChangedFiles} at head (${moved.design.baseFindingsInChangedFiles} at base)`);
  git('reset', '-q', '--hard', start);

  // 6. A color added to the theme in the same change is a valid token on the branch.
  write('dashboard/tailwind.config.js', read('dashboard/tailwind.config.js').replace('      colors: {\n', "      colors: {\n        probe: 'hsl(var(--probe))',\n"));
  write(COOKIE, original.replace('className="', 'className="bg-probe '));
  const theme = run(['--commit', commit('theme token')]);
  const noted = theme.design.notes.some((note) => note.includes('each side was checked with its own vocabulary'));
  check('theme', theme.findings.length === 0 && noted, `${theme.findings.length} finding(s) ${theme.findings.map((f) => f.message.split('"')[1]).join(', ')}; vocabulary note ${noted ? 'present' : 'missing'}, ${theme.ms} ms`);
} finally {
  rmSync(clone, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `FAIL design probe: ${failed} of ${results.length} cases failed` : `PASS design probe: ${results.length} cases`);
process.exitCode = failed ? 1 : 0;
