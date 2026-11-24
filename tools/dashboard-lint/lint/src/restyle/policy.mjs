// no-restyle policy, with shadcn-ui/lint's semantics (docs/rules.md, "The policy" and
// "Contracts"): `allow` and `deny` entries are categories (layout, spacing, ...), class groups
// (p, bg-color, rounded) or classes and `*` patterns. Entries without ":" match the base class,
// ignoring variants, `!`, a leading "-" and an opacity modifier; entries with ":" match the whole
// class. A contract's `pattern` is a regex on the component name; the last matching contract
// applies and inherits the keys it does not set from the top level.
import { CATEGORIES, splitClass } from './classify.mjs';
import { GROUP_CATEGORY } from './categories.mjs';

const KNOWN_CATEGORIES = new Set(['layout', ...CATEGORIES]);

function normalized(token) {
  const { base } = splitClass(token);
  return base.replace(/^-/, '').replace(/\/[^/\]]*$/, '');
}

function compileEntry(entry) {
  if (KNOWN_CATEGORIES.has(entry)) {
    return { entry, test: (c) => c.category === entry };
  }
  const isGroup = Object.hasOwn(GROUP_CATEGORY, entry);
  const pattern = new RegExp(`^${entry.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('.*')}$`);
  const full = entry.includes(':');
  return {
    entry,
    test: (c) => (isGroup && c.group === entry) || pattern.test(full ? c.token : normalized(c.token)),
  };
}

export function compilePolicy({ allow, deny, contracts = [] }) {
  const level = (spec, inherited) => {
    const merged = { ...inherited, ...spec };
    return {
      allow: merged.allow === undefined ? undefined : merged.allow.map(compileEntry),
      deny: merged.deny === undefined ? undefined : merged.deny.map(compileEntry),
      allowNames: merged.allow ?? [],
      denyNames: merged.deny ?? [],
    };
  };
  const top = level({}, { allow, deny });
  const compiled = contracts.map((contract) => ({ pattern: new RegExp(contract.pattern), name: contract.pattern, ...level({ ...(contract.allow !== undefined && { allow: contract.allow }), ...(contract.deny !== undefined && { deny: contract.deny }) }, { allow, deny }) }));
  const contractFor = (component) => compiled.filter((contract) => contract.pattern.test(component)).at(-1) ?? null;

  // classification: { token, category, group }. Returns { ok } or { ok: false, kind, entries, contract }.
  const decide = (component, classification) => {
    const contract = contractFor(component);
    const policy = contract ?? top;
    const denied = policy.deny?.find((entry) => entry.test(classification));
    if (denied) {
      return { ok: false, kind: 'denied', entries: [denied.entry], contract: contract?.name ?? null };
    }
    if (policy.allow === undefined) {
      return policy.deny === undefined ? { ok: false, kind: 'not-allowed', entries: [], contract: contract?.name ?? null } : { ok: true };
    }
    if (policy.allow.some((entry) => entry.test(classification))) {
      return { ok: true };
    }
    return { ok: false, kind: 'not-allowed', entries: policy.allowNames, contract: contract?.name ?? null };
  };
  return { decide, contractFor };
}
