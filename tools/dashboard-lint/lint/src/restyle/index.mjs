// no-restyle, ported from shadcn-ui/lint (MIT): a design-system component's className carries
// only what the policy allows (here: layout); appearance comes from its variants and sizes.
// Policy: design-doctor/restyle.json. Findings use the design engine's shape (rule id, subject
// "<Component> <class>"), so they are counted against the merge-base like the other design rules.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createClassifier } from './classify.mjs';
import { compilePolicy } from './policy.mjs';
import { findSites } from './sites.mjs';

// The same files design-doctor's plugins cover.
const OUT_OF_SCOPE = /\/components\/ui\/v3\/|\.(test|spec)\.|\/__tests__\/|\/tests\/|\/testUtils\/|\/mocks\/|\/__mocks__\/|\/generated\/|\/__generated__\//;
export const inScope = (path) => path.startsWith('dashboard/src/') && !OUT_OF_SCOPE.test(path);

const SEPARATE = 'Put it on a parent element';

function cssClasses(dashboard, require) {
  const postcss = require('postcss');
  const dir = join(dashboard, 'src/styles');
  const classes = new Set();
  if (!existsSync(dir)) {
    return classes;
  }
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.css'))) {
    postcss.parse(readFileSync(join(dir, file), 'utf8'), { from: file }).walkRules((rule) => {
      for (const match of rule.selector.matchAll(/\.((?:\\.|[\w-])+)/g)) {
        classes.add(match[1].replace(/\\(.)/g, '$1'));
      }
    });
  }
  return classes;
}

// catalog: design-doctor's generated catalog.json for the head commit.
export function createRestyle({ repo, ts, catalog, policySpec }) {
  const dashboard = join(repo, 'dashboard');
  const require = createRequire(join(dashboard, 'package.json'));
  let classifier = null;
  const classifierFor = () => (classifier ??= createClassifier(dashboard, { cssClasses: [...cssClasses(dashboard, require)] }));
  const policy = compilePolicy(policySpec);
  const byName = new Map(catalog.components.map((component) => [component.name, component]));

  const details = (component) => {
    const entry = byName.get(component);
    const axes = entry?.cva?.find((recipe) => recipe.variants?.variant || recipe.variants?.size)?.variants ?? {};
    return {
      variants: axes.variant?.length ? axes.variant : null,
      sizes: axes.size?.length ? axes.size : null,
      where: entry ? `in dashboard/${entry.source}` : `to <${component}>`,
    };
  };

  const message = (site, classification, verdict) => {
    const C = site.component;
    const { token, category } = classification;
    const { variants, sizes, where } = details(C);
    const head = site.via ? `"${token}" on <${site.via}> inside <${site.tag} asChild> merges into <${C}>:` : `"${token}" is not allowed on <${C}>:`;
    if (verdict.kind === 'denied') {
      return `${head} its contract denies ${verdict.entries.join(' ')}.`;
    }
    if (category === 'unclassified') {
      return `${head} the grammar does not recognize it. Fix the spelling, or use a class Tailwind generates.`;
    }
    if (category === 'declared') {
      return `${head} your CSS declares it, and what it changes cannot be read. Use a variant, or put it on a parent element.`;
    }
    if (category === 'layout') {
      return verdict.entries.length
        ? `${head} its contract allows ${verdict.entries.join(' ')}. Use one of those, or put layout classes on a parent element.`
        : `${head} its contract allows no classes. ${SEPARATE} instead.`;
    }
    const owns = `<${C}> owns its ${category}.`;
    if (category === 'spacing') {
      const around = policy.decide(C, { token: 'm-4', category: 'layout', group: 'm' }).ok ? 'margin here or gap on the parent' : 'gap on the parent';
      return sizes
        ? `${head} ${owns} Use a size (${sizes.join(', ')}), or ${around} for space around it. Add a size ${where} only if the design explicitly calls for one.`
        : `${head} ${owns} For space around it, use ${around}.`;
    }
    return variants
      ? `${head} ${owns} Use a variant: ${variants.join(', ')}. Add a new variant ${where} only if the design explicitly calls for a treatment none of these provides.`
      : `${head} ${owns} Add a variant ${where} only if the design explicitly calls for this treatment.`;
  };

  // files: [{ path, text }]. Returns findings in the design engine's shape.
  const findingsFor = (files) => {
    const findings = [];
    for (const { path, text } of files) {
      if (!inScope(path) || !/\.tsx$/.test(path)) {
        continue;
      }
      for (const site of findSites(ts, path, text)) {
        for (const { token, line, column } of site.tokens) {
          const classification = classifierFor().classify(token);
          const verdict = policy.decide(site.component, classification);
          if (verdict.ok) {
            continue;
          }
          findings.push({
            ruleId: 'no-restyle',
            subject: `${site.component} ${token}`,
            guidance: message(site, classification, verdict),
            category: classification.category,
            file: path,
            line,
            column,
            endLine: line,
          });
        }
      }
    }
    return findings;
  };
  return { findingsFor };
}
