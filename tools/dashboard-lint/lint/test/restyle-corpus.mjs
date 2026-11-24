// Whole-dashboard usage of className on ui/v3 components, by component and category.
// Usage: node restyle-corpus.mjs <repo> [--json out.json]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createClassifier } from '../src/restyle/classify.mjs';
import { findSites } from '../src/restyle/sites.mjs';
import { componentStyles, worktreeReaders } from '../src/restyle/components.mjs';

const [repo, flag, out] = process.argv.slice(2);
const ts = createRequire(join(repo, 'dashboard/package.json'))('typescript');
const { classify } = createClassifier(join(repo, 'dashboard'));
const OUT_OF_SCOPE = /\/components\/ui\/v3\/|\.(test|spec)\.|\/__tests__\/|\/tests\/|\/testUtils\/|\/mocks\/|\/__mocks__\/|\/generated\/|\/__generated__\//;
const files = execFileSync('git', ['ls-files', 'dashboard/src'], { cwd: repo, encoding: 'utf8' })
  .split('\n').filter((p) => /\.tsx?$/.test(p) && !p.endsWith('.d.ts') && !OUT_OF_SCOPE.test(p));
const { readFile, listFiles } = worktreeReaders(repo);
const styles = componentStyles(ts, readFile, listFiles);
const rows = [];
let skipped = 0;
let siteCount = 0;
for (const path of files) {
  for (const site of findSites(ts, path, readFileSync(join(repo, path), 'utf8'))) {
    if (!styles.get(site.component)?.styled) { skipped += 1; continue; }
    siteCount += 1;
    for (const t of site.tokens) {
      const c = classify(t.token);
      rows.push({ path, component: site.component, via: site.via, token: t.token, line: t.line, category: c.category, group: c.group });
    }
  }
}
const byComponent = new Map();
for (const r of rows) {
  const entry = byComponent.get(r.component) ?? { component: r.component, sites: 0, total: 0, cats: {} };
  entry.total += 1;
  entry.cats[r.category] = (entry.cats[r.category] ?? 0) + 1;
  byComponent.set(r.component, entry);
}
const nonLayout = (e) => e.total - (e.cats.layout ?? 0);
console.log(`${skipped} sites on unstyled components skipped`);
console.log(`${files.length} files, ${siteCount} className sites on ui/v3 components, ${rows.length} classes, ${rows.filter((r) => r.category !== 'layout').length} not layout`);
const cats = ['layout', 'spacing', 'typography', 'color', 'shape', 'effects', 'motion', 'declared', 'unclassified'];
console.log(['component'.padEnd(26), ...cats.map((c) => c.slice(0, 6).padStart(7))].join(''));
for (const e of [...byComponent.values()].sort((a, b) => nonLayout(b) - nonLayout(a)).slice(0, 45)) {
  console.log([e.component.padEnd(26), ...cats.map((c) => String(e.cats[c] ?? '').padStart(7))].join(''));
}
if (flag === '--json') writeFileSync(out, JSON.stringify(rows));
