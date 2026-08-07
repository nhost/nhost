#!/usr/bin/env node
// Transform rustdoc JSON (`cargo rustdoc --output-format json`) into Starlight
// markdown, mirroring the TypeDoc-generated `nhost-js` reference pages. This is
// the Rust analogue of `typedoc-plugin-markdown`: one page per top-level module
// (`main`, `auth`, `storage`, `graphql`, `functions`, `session`, `fetch`,
// `middleware`), each grouping the module's public items by kind with rendered
// signatures and doc comments.
//
// Usage: node rustdoc-to-md.mjs <path-to-nhost.json> <output-dir>
//
// Kept dependency-free (plain Node ESM) so it runs under the same Node the docs
// build already uses for TypeDoc — no extra toolchain in the docs pipeline.

import fs from 'node:fs';
import path from 'node:path';

const [, , jsonPath, outDir] = process.argv;
if (!jsonPath || !outDir) {
  console.error('usage: node rustdoc-to-md.mjs <nhost.json> <output-dir>');
  process.exit(1);
}

const doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const index = doc.index;
const paths = doc.paths;

const item = (id) => index[String(id)];

// ---------------------------------------------------------------------------
// Type rendering: the rustdoc `Type` union. Every variant observed in the crate
// is handled; unknown shapes degrade to a readable placeholder rather than
// throwing, so a future rustdoc format tweak can't silently break the build.
// ---------------------------------------------------------------------------

function renderType(t) {
  if (t == null) return '_';
  if (typeof t === 'string') return t;

  if ('resolved_path' in t) {
    const p = t.resolved_path;
    return escapePathName(p.path) + renderGenericArgs(p.args);
  }
  if ('generic' in t) return t.generic;
  if ('primitive' in t) return t.primitive;
  if ('borrowed_ref' in t) {
    const r = t.borrowed_ref;
    const lt = r.lifetime ? `${r.lifetime} ` : '';
    const mut = r.is_mutable ? 'mut ' : '';
    return `&${lt}${mut}${renderType(r.type)}`;
  }
  if ('raw_pointer' in t) {
    const r = t.raw_pointer;
    return `*${r.is_mutable ? 'mut' : 'const'} ${renderType(r.type)}`;
  }
  if ('slice' in t) return `[${renderType(t.slice)}]`;
  if ('array' in t) return `[${renderType(t.array.type)}; ${t.array.len}]`;
  if ('tuple' in t) return `(${t.tuple.map(renderType).join(', ')})`;
  if ('dyn_trait' in t) {
    const dt = t.dyn_trait;
    const traits = dt.traits
      .map(
        (tr) =>
          escapePathName(tr.trait.path) + renderGenericArgs(tr.trait.args),
      )
      .join(' + ');
    const lt = dt.lifetime ? ` + ${dt.lifetime}` : '';
    return `dyn ${traits}${lt}`;
  }
  if ('impl_trait' in t) {
    return `impl ${t.impl_trait.map(renderBound).filter(Boolean).join(' + ')}`;
  }
  if ('qualified_path' in t) {
    const q = t.qualified_path;
    const self_ = renderType(q.self_type);
    if (q.trait) {
      return `<${self_} as ${escapePathName(q.trait.path)}${renderGenericArgs(q.trait.args)}>::${q.name}`;
    }
    return `${self_}::${q.name}`;
  }
  if ('function_pointer' in t) {
    const fp = t.function_pointer;
    const inputs = (fp.sig?.inputs ?? [])
      .map(([, ty]) => renderType(ty))
      .join(', ');
    const out = fp.sig?.output ? ` -> ${renderType(fp.sig.output)}` : '';
    return `fn(${inputs})${out}`;
  }
  if ('infer' in t) return '_';
  if ('pat' in t) return renderType(t.pat.type);
  return '_';
}

// Show the last path segment (e.g. `Option`, `SignInEmailPasswordRequest`)
// rather than the fully-qualified `nhost::auth::...` — matches how the JS
// reference and idiomatic Rust docs read.
function escapePathName(p) {
  if (!p) return '_';
  const segs = String(p).split('::');
  return segs[segs.length - 1];
}

function renderGenericArgs(args) {
  if (!args) return '';
  if ('angle_bracketed' in args) {
    const ab = args.angle_bracketed;
    const parts = [];
    for (const a of ab.args ?? []) {
      if ('type' in a) parts.push(renderType(a.type));
      else if ('lifetime' in a) parts.push(a.lifetime);
      else if ('const' in a) parts.push(a.const?.expr ?? '_');
    }
    for (const c of ab.constraints ?? []) {
      const binding =
        c.binding && 'equality' in c.binding
          ? ` = ${renderType(c.binding.equality.type ?? c.binding.equality)}`
          : '';
      parts.push(`${c.name}${binding}`);
    }
    return parts.length ? `<${parts.join(', ')}>` : '';
  }
  if ('parenthesized' in args) {
    const p = args.parenthesized;
    const inputs = (p.inputs ?? []).map(renderType).join(', ');
    const out = p.output ? ` -> ${renderType(p.output)}` : '';
    return `(${inputs})${out}`;
  }
  return '';
}

function renderBound(b) {
  if ('trait_bound' in b) {
    const tb = b.trait_bound;
    const modifier = tb.modifier === 'maybe' ? '?' : '';
    return `${modifier}${escapePathName(tb.trait.path)}${renderGenericArgs(tb.trait.args)}`;
  }
  if ('outlives' in b) return b.outlives;
  return '';
}

function renderGenerics(generics) {
  if (!generics) return { params: '', where: '' };
  const params = [];
  for (const p of generics.params ?? []) {
    if (p.kind && 'lifetime' in p.kind) {
      params.push(p.name);
    } else if (p.kind && 'type' in p.kind) {
      const bounds = (p.kind.type.bounds ?? [])
        .map(renderBound)
        .filter(Boolean);
      const def = p.kind.type.default
        ? ` = ${renderType(p.kind.type.default)}`
        : '';
      params.push(
        bounds.length
          ? `${p.name}: ${bounds.join(' + ')}${def}`
          : `${p.name}${def}`,
      );
    } else if (p.kind && 'const' in p.kind) {
      params.push(`const ${p.name}: ${renderType(p.kind.const.type)}`);
    }
  }
  const wheres = [];
  for (const w of generics.where_predicates ?? []) {
    if ('bound_predicate' in w) {
      const bp = w.bound_predicate;
      const bounds = (bp.bounds ?? []).map(renderBound).filter(Boolean);
      if (bounds.length)
        wheres.push(`${renderType(bp.type)}: ${bounds.join(' + ')}`);
    } else if ('lifetime_predicate' in w) {
      const lp = w.lifetime_predicate;
      wheres.push(`${lp.lifetime}: ${(lp.outlives ?? []).join(' + ')}`);
    }
  }
  return {
    params: params.length ? `<${params.join(', ')}>` : '',
    where: wheres.length ? `\nwhere\n    ${wheres.join(',\n    ')}` : '',
  };
}

// ---------------------------------------------------------------------------
// Item rendering
// ---------------------------------------------------------------------------

function fnSignature(name, fn, { isMethod = false } = {}) {
  const g = renderGenerics(fn.generics);
  const header = fn.header ?? {};
  const kw =
    (header.is_const ? 'const ' : '') +
    (header.is_async ? 'async ' : '') +
    (header.is_unsafe ? 'unsafe ' : '');
  const inputs = (fn.sig?.inputs ?? []).map(([argName, ty]) => {
    if (isMethod && argName === 'self') return renderSelf(ty);
    return `${argName}: ${renderType(ty)}`;
  });
  const out = fn.sig?.output ? ` -> ${renderType(fn.sig.output)}` : '';
  return `${kw}fn ${name}${g.params}(${inputs.join(', ')})${out}${g.where}`;
}

function renderSelf(ty) {
  // `self`, `&self`, `&mut self`.
  if (ty && 'borrowed_ref' in ty) {
    const r = ty.borrowed_ref;
    const lt = r.lifetime ? `${r.lifetime} ` : '';
    if (r.type && 'generic' in r.type && r.type.generic === 'Self') {
      return `&${lt}${r.is_mutable ? 'mut ' : ''}self`;
    }
  }
  if (ty && 'generic' in ty && ty.generic === 'Self') return 'self';
  return `self: ${renderType(ty)}`;
}

function codeBlock(sig) {
  return `\`\`\`rust\n${sig}\n\`\`\``;
}

// Convert rustdoc intra-doc links (``[`Foo`]``, `[Foo]`) that have no link
// target into plain inline code so the docs site doesn't emit broken links.
function cleanDocs(docs) {
  if (!docs) return '';
  return docs
    .replace(/\[(`[^`\]]+`)\]\((?![^)]*:)[^)]*\)/g, '$1') // [`X`](X) -> `X`
    .replace(/\[(`[^`\]]+`)\](?!\()/g, '$1') // [`X`] -> `X`
    .replace(/\[([A-Za-z_][A-Za-z0-9_:]*)\](?!\(|\[|:)/g, '`$1`'); // [Foo] -> `Foo`
}

function heading(depth, text) {
  return `${'#'.repeat(depth)} ${text}`;
}

// Inherent methods declared directly on a type (skip trait/synthetic/blanket
// impls, which are std/derive noise). Returns rendered method sections.
function inherentMethods(structOrEnum) {
  const out = [];
  for (const implId of structOrEnum.impls ?? []) {
    const it = item(implId);
    if (!it?.inner.impl) continue;
    const imp = it.inner.impl;
    if (imp.trait || imp.is_synthetic || imp.blanket_impl) continue;
    for (const mid of imp.items ?? []) {
      const m = item(mid);
      if (!m?.inner.function) continue;
      out.push(renderMethod(m));
    }
  }
  return out;
}

function renderMethod(m) {
  const parts = [heading(5, `\`${m.name}\``)];
  parts.push(
    codeBlock(fnSignature(m.name, m.inner.function, { isMethod: true })),
  );
  const d = cleanDocs(m.docs);
  if (d) parts.push(d);
  return parts.join('\n\n');
}

// Non-std trait implementations worth surfacing (custom SDK traits + a few
// well-known user-facing ones), listed compactly by name.
const NOTABLE_TRAITS = new Set([
  'Default',
  'Display',
  'Error',
  'Iterator',
  'FromStr',
]);
function notableTraitImpls(structOrEnum) {
  const names = new Set();
  for (const implId of structOrEnum.impls ?? []) {
    const it = item(implId);
    if (!it?.inner.impl) continue;
    const imp = it.inner.impl;
    if (!imp.trait || imp.is_synthetic || imp.blanket_impl) continue;
    const tid = imp.trait.id;
    const traitItem = tid != null ? item(tid) : null;
    const name = escapePathName(imp.trait.path);
    // Include traits defined in this crate, or a short allow-list of common ones.
    if ((traitItem && traitItem.crate_id === 0) || NOTABLE_TRAITS.has(name)) {
      names.add(name + renderGenericArgs(imp.trait.args));
    }
  }
  return [...names].sort();
}

function renderStruct(name, it) {
  const s = it.inner.struct;
  const g = renderGenerics(s.generics);
  const parts = [heading(3, `\`${name}\``)];
  parts.push(codeBlock(`struct ${name}${g.params}${g.where}`));
  const d = cleanDocs(it.docs);
  if (d) parts.push(d);

  // Public fields (plain structs).
  if (s.kind?.plain?.fields?.length) {
    const rows = [];
    for (const fid of s.kind.plain.fields) {
      const f = item(fid);
      if (!f?.inner.struct_field) continue;
      const fdoc = cleanDocs(f.docs).replace(/\n+/g, ' ').trim();
      rows.push(
        `| \`${f.name}\` | \`${renderType(f.inner.struct_field)}\` | ${fdoc} |`,
      );
    }
    if (rows.length) {
      parts.push(heading(4, 'Fields'));
      parts.push(
        ['| Field | Type | Description |', '| --- | --- | --- |', ...rows].join(
          '\n',
        ),
      );
    }
  }

  const methods = inherentMethods(s);
  if (methods.length) {
    parts.push(heading(4, 'Methods'));
    parts.push(methods.join('\n\n'));
  }
  const traits = notableTraitImpls(s);
  if (traits.length) {
    parts.push(heading(4, 'Trait implementations'));
    parts.push(traits.map((t) => `- \`${t}\``).join('\n'));
  }
  return parts.join('\n\n');
}

function renderEnum(name, it) {
  const e = it.inner.enum;
  const g = renderGenerics(e.generics);
  const parts = [heading(3, `\`${name}\``)];
  parts.push(codeBlock(`enum ${name}${g.params}${g.where}`));
  const d = cleanDocs(it.docs);
  if (d) parts.push(d);

  const rows = [];
  for (const vid of e.variants ?? []) {
    const v = item(vid);
    if (!v?.inner.variant) continue;
    const vdoc = cleanDocs(v.docs).replace(/\n+/g, ' ').trim();
    rows.push(`| \`${v.name}\` | ${vdoc} |`);
  }
  if (rows.length) {
    parts.push(heading(4, 'Variants'));
    parts.push(
      ['| Variant | Description |', '| --- | --- |', ...rows].join('\n'),
    );
  }
  const methods = inherentMethods(e);
  if (methods.length) {
    parts.push(heading(4, 'Methods'));
    parts.push(methods.join('\n\n'));
  }
  const traits = notableTraitImpls(e);
  if (traits.length) {
    parts.push(heading(4, 'Trait implementations'));
    parts.push(traits.map((t) => `- \`${t}\``).join('\n'));
  }
  return parts.join('\n\n');
}

function renderTrait(name, it) {
  const tr = it.inner.trait;
  const g = renderGenerics(tr.generics);
  const parts = [heading(3, `\`${name}\``)];
  parts.push(codeBlock(`trait ${name}${g.params}${g.where}`));
  const d = cleanDocs(it.docs);
  if (d) parts.push(d);
  const methods = [];
  for (const mid of tr.items ?? []) {
    const m = item(mid);
    if (!m?.inner.function) continue;
    methods.push(renderMethod(m));
  }
  if (methods.length) {
    parts.push(heading(4, 'Required / provided methods'));
    parts.push(methods.join('\n\n'));
  }
  return parts.join('\n\n');
}

function renderFunction(name, it) {
  const parts = [heading(3, `\`${name}\``)];
  parts.push(codeBlock(fnSignature(name, it.inner.function)));
  const d = cleanDocs(it.docs);
  if (d) parts.push(d);
  return parts.join('\n\n');
}

function renderTypeAlias(name, it) {
  const ta = it.inner.type_alias;
  const g = renderGenerics(ta.generics);
  const parts = [heading(3, `\`${name}\``)];
  parts.push(codeBlock(`type ${name}${g.params} = ${renderType(ta.type)}`));
  const d = cleanDocs(it.docs);
  if (d) parts.push(d);
  return parts.join('\n\n');
}

function renderConstant(name, it) {
  const c = it.inner.constant;
  const parts = [heading(3, `\`${name}\``)];
  const ty = c.type ? `: ${renderType(c.type)}` : '';
  const val = c.const?.expr ? ` = ${c.const.expr}` : '';
  parts.push(codeBlock(`const ${name}${ty}${val}`));
  const d = cleanDocs(it.docs);
  if (d) parts.push(d);
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Page assembly: collect a module's public items, resolving `use` re-exports
// (including glob re-exports of generated submodules) so a page shows the full
// public surface a caller sees at that module path.
// ---------------------------------------------------------------------------

function collectEntries(moduleId, seen = new Set()) {
  const mod = item(moduleId)?.inner?.module;
  if (!mod) return [];
  const entries = [];
  for (const id of mod.items) {
    if (seen.has(id)) continue;
    seen.add(id);
    const it = item(id);
    if (!it) continue; // external / stripped
    if (it.inner.use) {
      const u = it.inner.use;
      const target = item(u.id);
      if (!target) continue; // re-export of an external item
      if (u.is_glob && target.inner.module) {
        entries.push(...collectEntries(u.id, seen));
      } else if (!target.inner.module) {
        entries.push({ name: u.name ?? target.name, it: target });
      }
      continue;
    }
    if (it.inner.module) continue; // submodules become their own pages
    entries.push({ name: it.name, it });
  }
  return entries;
}

const KIND_ORDER = [
  ['function', 'Functions', renderFunction],
  ['struct', 'Structs', renderStruct],
  ['enum', 'Enums', renderEnum],
  ['trait', 'Traits', renderTrait],
  ['type_alias', 'Type Aliases', renderTypeAlias],
  ['constant', 'Constants', renderConstant],
];

function renderPage(title, moduleDocs, entries) {
  const seenNames = new Set();
  const unique = entries.filter((e) => {
    const key = `${Object.keys(e.it.inner)[0]}:${e.name}`;
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  const out = [`---\ntitle: ${title}\n---`];
  if (moduleDocs) out.push(cleanDocs(moduleDocs));

  for (const [kind, label, renderer] of KIND_ORDER) {
    const items = unique
      .filter((e) => kind in e.it.inner)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!items.length) continue;
    out.push(heading(2, label));
    for (const e of items) out.push(renderer(e.name, e.it));
  }
  return `${out.join('\n\n')}\n`;
}

// Find a module item id by its `paths` entry (dotted path).
function moduleIdByPath(dotted) {
  const want = dotted.join('::');
  for (const [id, meta] of Object.entries(paths)) {
    if (
      meta.kind === 'module' &&
      (meta.path ?? []).join('::') === want &&
      item(id)
    ) {
      return id;
    }
  }
  return null;
}

const ROOT = String(doc.root);

const PAGES = [
  { file: 'main', title: 'Main', moduleId: ROOT },
  { file: 'auth', title: 'Auth', moduleId: moduleIdByPath(['nhost', 'auth']) },
  {
    file: 'storage',
    title: 'Storage',
    moduleId: moduleIdByPath(['nhost', 'storage']),
  },
  {
    file: 'graphql',
    title: 'Graphql',
    moduleId: moduleIdByPath(['nhost', 'graphql']),
  },
  {
    file: 'functions',
    title: 'Functions',
    moduleId: moduleIdByPath(['nhost', 'functions']),
  },
  {
    file: 'session',
    title: 'Session',
    moduleId: moduleIdByPath(['nhost', 'session']),
  },
  {
    file: 'fetch',
    title: 'Fetch',
    moduleId: moduleIdByPath(['nhost', 'fetch']),
  },
  {
    file: 'middleware',
    title: 'Middleware',
    moduleId: moduleIdByPath(['nhost', 'middleware']),
  },
];

fs.mkdirSync(outDir, { recursive: true });
for (const page of PAGES) {
  if (!page.moduleId) {
    console.error(
      `warning: module for page '${page.file}' not found, skipping`,
    );
    continue;
  }
  const modItem = item(page.moduleId);
  const entries = collectEntries(page.moduleId);
  const md = renderPage(page.title, modItem?.docs, entries);
  const dest = path.join(outDir, `${page.file}.md`);
  fs.writeFileSync(dest, md);
  console.log(`wrote ${dest} (${entries.length} items)`);
}
