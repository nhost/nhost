import { fileURLToPath } from 'node:url';
import type { Catalog } from '../contracts/catalog.mts';
import type { Tokens } from '../contracts/tokens.mts';
import { namedColors } from '../theme/colors.mts';
import { loadTheme } from '../theme/load.mts';
import type { Manifest } from './manifest.mts';
import { vocabularyHash } from './manifest.mts';
import { emitClassRule } from './prelude/classes.mts';
import {
  arbitraryClaim,
  categoriesFor,
  emitArbitraryValues,
  probeArbitraryRoots,
  propertyPatterns,
} from './rules/no-arbitrary-values.mts';
import {
  allowedStyleNames,
  emitInlineStyles,
} from './rules/no-inline-styles.mts';
import {
  claimedByRawColors,
  emitRawColors,
  svgAllowedVariables,
} from './rules/no-raw-colors.mts';
import {
  replacements as catalogReplacements,
  type Replacement,
} from './rules/no-reinvented-components.mts';
import {
  type UnknownVocabulary,
  unknownVocabulary,
} from './rules/no-unknown-classes.mts';
import {
  designImports,
  emitStaticClasses,
} from './rules/require-static-classes.mts';

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const rule = 'no-direct-radix-imports';

type RadixMap = Record<string, Record<string, string[]>>;

export function radixMap(catalog: Catalog): RadixMap {
  const map: RadixMap = {};
  for (const component of catalog.components) {
    const radix = component.radix;
    if (!radix || radix.package === '@radix-ui/react-slot') {
      continue;
    }
    const prefix = radix.package
      .slice('@radix-ui/react-'.length)
      .split('-')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join('');
    const names = radix.primitive.startsWith(prefix)
      ? [radix.primitive, radix.primitive.slice(prefix.length)]
      : [
          radix.primitive,
          radix.primitive === 'Root' ? prefix : `${prefix}${radix.primitive}`,
        ];
    for (const name of names) {
      map[radix.package] ??= {};
      map[radix.package][name] ??= [];
      const replacements = map[radix.package][name];
      const suggestion = `${component.name} from ${component.importPath}`;
      if (!replacements.includes(suggestion)) {
        replacements.push(suggestion);
      }
    }
  }
  for (const names of Object.values(map)) {
    for (const replacements of Object.values(names)) {
      replacements.sort(compare);
    }
  }
  return Object.fromEntries(
    Object.entries(map)
      .sort(([a], [b]) => compare(a, b))
      .map(([pkg, names]) => [
        pkg,
        Object.fromEntries(
          Object.entries(names).sort(([a], [b]) => compare(a, b)),
        ),
      ]),
  );
}

// All GritQL is emitted here. Do not construct plugin fragments in a rule or
// hand-edit generated/plugins. Grit's backtick message interpolates $name.
function diagnostic(
  id: string,
  span: string,
  subject: string,
  guidance: string,
): string {
  const text = `[design/${id}] "${subject}" ${guidance} Docs: design-doctor/docs/rules/${id}.md`;
  if (text.includes('`') || text.includes('\\"')) {
    throw new Error('Grit diagnostic contains an unsupported quote/backtick');
  }
  return `register_diagnostic(span=${span}, message=\`${text}\`, severity="warn")`;
}

// The cheap node-kind and anchored source checks precede the catalog dispatch.
// No catalog table is visited for the overwhelming majority of JS imports.
const radixSource = '$source <: r"^[\'\\x22]@radix-ui/[a-z0-9-]+[\'\\x22]$"';
const notSlot =
  'not { $source <: r"^[\'\\x22]@radix-ui/react-slot[\'\\x22]$" }';
const fallback =
  'No exact ui/v3 export is recorded for this primitive; check the catalog or ask design before replacing it.';
const packageGuidance =
  'This package import has no single safe exact replacement; use named ui/v3 exports where applicable.';

function mappedNames(mapping: RadixMap): string {
  const branches: string[] = [];
  for (const [pkg, names] of Object.entries(mapping)) {
    // Short and long aliases for the same catalog export share a diagnostic.
    const groups = new Map<string, string[]>();
    for (const [name, replacements] of Object.entries(names)) {
      const guidance = `Use ${replacements.join(' or ')}; check props and behavior, not a guaranteed drop-in replacement.`;
      groups.set(guidance, [...(groups.get(guidance) ?? []), name]);
    }
    const primitives = [...groups].map(
      ([guidance, aliases]) =>
        `$name <: r"^(?:${aliases.join('|')})$" where { ${diagnostic(rule, '$name', '$name', guidance)} }`,
    );
    primitives.push(
      `$name <: r".*" where { not { $name <: r"^(?:${Object.keys(names).join('|')})$" }, ${diagnostic(rule, '$name', '$name', fallback)} }`,
    );
    branches.push(
      `$source <: r"^['\\x22]${pkg}['\\x22]$" where { or { ${primitives.join(',\n        ')} } }`,
    );
  }
  branches.push(
    `$source <: r".*" where { not { $source <: r"^['\\x22](?:${Object.keys(mapping).join('|')})['\\x22]$" }, ${diagnostic(rule, '$name', '$name', fallback)} }`,
  );
  return `or { ${branches.join(',\n      ')} }`;
}

export function emitRadix(catalog: Catalog): string {
  const named = `or {
    JsNamedImportSpecifier(name=$name) as $spec,
    JsShorthandNamedImportSpecifier(local_name=$name) as $spec,
    JsExportNamedFromSpecifier(source_name=$name) as $spec
  } where {
    $spec <: within or { JsImportNamedClause(source=$source), JsImportCombinedClause(source=$source), JsExportFromClause(source=$source), JsExportNamedFromClause(source=$source) },
    ${radixSource},
    ${notSlot},
    $name <: r"^[A-Za-z_$][A-Za-z0-9_$]*$",
    ${mappedNames(radixMap(catalog))}
  }`;
  const namespace = `JsNamespaceImportSpecifier(local_name=$name) as $spec where {
    $spec <: within or { JsImportNamespaceClause(source=$source), JsImportCombinedClause(source=$source) },
    ${radixSource},
    ${notSlot},
    $name <: r"^[A-Za-z_$][A-Za-z0-9_$]*$",
    ${diagnostic(rule, '$name', '$name', 'A namespace has no single drop-in replacement. Import the needed named exports from ui/v3; check the component catalog.')}
  }`;
  // Default bindings (including a combined default + named import) have no
  // imported primitive name; report the local identifier separately.
  const defaultBinding = `JsDefaultImportSpecifier(local_name=$name) as $spec where {
    $spec <: within or { JsImportDefaultClause(source=$source), JsImportCombinedClause(source=$source) },
    ${radixSource},
    ${notSlot},
    $name <: r"^[A-Za-z_$][A-Za-z0-9_$]*$",
    ${diagnostic(rule, '$name', '$name', packageGuidance)}
  }`;
  const moduleSource = `or {
    JsImportBareClause(source=$source),
    JsExportFromClause(source=$source)
  } where {
    ${radixSource},
    ${notSlot},
    ${diagnostic(rule, '$source', '$source', packageGuidance)}
  }`;
  const dynamic = `JsImportCallExpression(arguments=$args) where {
    $args <: contains JsStringLiteralExpression() as $source,
    ${radixSource},
    ${notSlot},
    ${diagnostic(rule, '$source', '$source', packageGuidance)}
  }`;
  return `language js\n\nor {\n  ${[named, namespace, defaultBinding, moduleSource, dynamic].join(',\n  ')}\n}\n`;
}

const reinventedRule = 'no-reinvented-components';

function trie(words: readonly string[]): string {
  const root = new Map<string, Map<string, unknown> | null>();
  for (const word of words) {
    let node = root;
    for (const char of word) {
      if (!node.has(char)) {
        node.set(char, new Map());
      }
      node = node.get(char) as typeof root;
    }
    node.set('', null);
  }
  const escapeCharacter = (char: string) =>
    char.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const emit = (node: typeof root): string => {
    const children = [...node.keys()].filter(Boolean).sort(compare);
    if (!children.length) {
      return '';
    }
    const parts = children.map(
      (char) => escapeCharacter(char) + emit(node.get(char) as typeof root),
    );
    const body = parts.length === 1 ? parts[0] : `(?:${parts.join('|')})`;
    return node.has('') ? `(?:${body})?` : body;
  };
  return emit(root);
}

function trieChunks(words: readonly string[], limit: number): string[] {
  const chunks: string[][] = [];
  for (const word of words) {
    const current = chunks.at(-1);
    if (!current || trie([...current, word]).length > limit) {
      if (trie([word]).length > limit) {
        throw new Error(`Vocabulary leaf exceeds ${limit} bytes: ${word}`);
      }
      chunks.push([word]);
    } else {
      current.push(word);
    }
  }
  return chunks.map(trie);
}

// Two-level dispatch: test the literal head before any tail regex. A single
// class-vocabulary regex makes Biome scan ~75 KB per token (~40 seconds).
function dispatch(names: readonly string[], limit = 1300): string {
  const single = new Set<string>();
  const heads = new Map<string, Set<string>>();
  for (const raw of names) {
    const name = raw.replace(/^-/, '');
    const match = /^([a-z0-9]+)-(.+)$/.exec(name);
    if (!match) {
      single.add(name);
      continue;
    }
    if (!heads.has(match[1])) {
      heads.set(match[1], new Set());
    }
    heads.get(match[1])?.add(match[2]);
  }
  const pattern = (words: readonly string[]) =>
    `r"${trie(words).replaceAll('"', '\\"')}"`;
  const branches = [...heads]
    .sort(([a], [b]) => compare(a, b))
    .map(([head, values]) => {
      const rests = [...values].sort(compare);
      const full = trie(rests);
      if (full.length <= limit) {
        return `and { $head <: "${head}", $rest <: ${pattern(rests)} }`;
      }
      const leaves: string[] = [];
      const sub = new Map<string, string[]>();
      for (const rest of rests) {
        const match = /^([a-z0-9]+)-(.+)$/.exec(rest);
        if (!match) {
          leaves.push(rest);
          continue;
        }
        if (!sub.has(match[1])) {
          sub.set(match[1], []);
        }
        sub.get(match[1])?.push(match[2]);
      }
      // Bound every trie, including leaves without a second dash.
      const leafParts = trieChunks(leaves, limit).map(
        (part) => `$rest <: r"${part}"`,
      );
      const inner = [...sub]
        .sort(([a], [b]) => compare(a, b))
        .flatMap(([subhead, tails]) =>
          trieChunks(tails, limit).map(
            (part) => `and { $h2 <: "${subhead}", $r2 <: r"${part}" }`,
          ),
        );
      return `and { $head <: "${head}", or { ${[...leafParts, `$rest <: r"([a-z0-9]+)-(.+)"($h2, $r2) where { or { ${inner.join(', ')} } }`].join(', ')} } }`;
    });
  return `pattern known() { or {
  ${trieChunks([...single].sort(compare), limit)
    .map((part) => `r"${part}"`)
    .join(', ')},
  r"-?([a-z0-9]+)-(.+)"($head, $rest) where { or { ${branches.join(',\n    ')} } }
} }`;
}

// A complete variant prefix is checked separately from its base. Keeping it
// as one regex avoids per-segment Grit captures on every class site.
function variantPatterns(vocabulary: UnknownVocabulary): {
  present: string;
  known: string;
} {
  const staticNames = vocabulary.variants.flatMap(({ name, isArbitrary }) =>
    isArbitrary ? [] : [name],
  );
  const variants = vocabulary.variants.filter(({ isArbitrary }) => isArbitrary);
  const groups = new Map<string, string[]>();
  for (const { name, values } of variants) {
    const key = values.join('\u0000');
    groups.set(key, [...(groups.get(key) ?? []), name]);
  }
  const parameterized = [...groups].map(([key, names]) => {
    const literal = key ? `${trie(key.split('\u0000'))}|` : '';
    const named = names.some((name) => /^(?:group|peer)(?:-|$)/.test(name))
      ? '(?:/[a-zA-Z0-9_-]+)?'
      : '';
    return `${trie(names)}-(?:${literal}\\[[^\\]]+\\])${named}`;
  });
  const segment = `(?:${trie(staticNames)}|${parameterized.join('|')}|\\[[^\\]]+\\])`;
  return {
    present: 'r"^(?:\\[[^\\]]+\\]|[^:\\[\\]]+(?:\\[[^\\]]+\\])?):[\\s\\S]+$"',
    // A tail with no bare colon forces every subsequent variant through the
    // same segment matcher; colons inside nested arbitrary brackets stay legal.
    known: `r"^(?:${segment}:)+(?:[^:\\[]|\\[(?:[^\\[\\]]|\\[[^\\]]*\\])*\\])+$"`,
  };
}

export function emitUnknown(vocabulary: UnknownVocabulary): string {
  const known = dispatch(vocabulary.classes);
  const dynamicRoots = trieChunks(vocabulary.arbitraryRoots, 1200)
    .map((part) => `r"^${part}$"`)
    .join(', ');
  const dynamic = `pattern known_dynamic() {
    $token where {
      $token <: class_normalized($base),
      or {
        $base <: r"^\\[[a-zA-Z-]+:[^\\]]+\\]$",
        $base <: r"^\\[var\\(--[^)]+\\)\\]$",
        and {
          $base <: r"^-?([a-z][a-z0-9-]*)-\\[[^\\]]+\\](?:/(?:[\\w.%]+|\\[[^\\]]+\\]))?$"($root),
          $root <: or { ${dynamicRoots} }
        }
      }
    }
  }`;
  const variants = variantPatterns(vocabulary);
  const staticBase = `pattern known_static() {
    $token where {
      not { $token <: includes ":" },
      $token <: class_normalized($base),
      or {
        $base <: known(),
        $base <: r"^(.+)/(?:[\\w.%]+|\\[[^\\]]+\\])$"($withoutOpacity) where { $withoutOpacity <: known() },
        $base <: r"^(?:group|peer)/[a-zA-Z0-9_-]+$"
      }
    }
  }`;
  const commonVariants = [
    'hover',
    'sm',
    'dark',
    'lg',
    'md',
    'focus-visible',
    'focus',
    'disabled',
    'xl',
  ];
  const common = commonVariants
    .map(
      (name) =>
        `and { $part <: includes "${name}:", $part <: r"^${name}:[^:]+$" }`,
    )
    .join(', ');
  const predicate = `not { $part <: includes ":", or { ${common}, not { $part <: ${variants.present} }, $part <: ${variants.known} } },
    not { $part <: includes "[", not { $part <: includes ":" }, ${arbitraryClaim(vocabulary.arbitraryRoots)} },
    not { $part <: known_static() },
    not { $part <: includes "[", not { $part <: includes ":" }, $part <: known_dynamic() },
    not { $site <: r"(?s).*\\[[^\\]]* [^\\]]*.*" },
    not { $site <: within JsComputedMemberExpression() },
    not {
      $site <: JsTemplateChunkElement(),
      or {
        and {
          $site <: r"^([^\\s]+)(?:[\\s][\\s\\S]*)?$"($first),
          $part <: $first,
          $site <: after JsTemplateElement()
        },
        and {
          $site <: r"^(?:[\\s\\S]*[\\s])?([^\\s]+)$"($last),
          $part <: $last,
          $site <: before JsTemplateElement()
        }
      }
    }`;
  return emitClassRule('no-unknown-classes', {
    highConfidence: true,
    bracketAware: false,
    siteAware: true,
    predicate,
    guidance:
      'Unknown Tailwind v3 utility or variant generates no CSS. Use a supported utility or variant, or declare an extension in tailwind.config.js; run pnpm design-doctor for specific guidance.',
  }).replace(
    'language js\n\n',
    `language js\n\n${known}\n${staticBase}\n${dynamic}\n\n`,
  );
}

function replacementGuidance(choices: Replacement[], selector: string): string {
  const names = choices.map(
    ({ name, importPath }) => `${name} from ${importPath}`,
  );
  const button = choices.find(({ name }) => name === 'Button');
  const variants = button?.variants.variant?.join(', ');
  const sizes = button?.variants.size?.join(', ');
  const options =
    selector === 'button' && variants && sizes
      ? ` Button offers variants (${variants}), sizes (${sizes}) and asChild composition.`
      : '';
  const safety = choices.every(({ dropIn }) => dropIn)
    ? ' This is a catalogued drop-in replacement.'
    : ' This is not a safe drop-in replacement; check props, semantics and behavior, or ask design when no exact replacement fits.';
  return `Use ${names.join(' or ')} instead of raw <${selector.split('[')[0]}>.${options}${safety}`;
}

// contains ... until stops at nested JSX: asChild only owns its immediate JSX
// children and conditional/logical expression children, not nested markup.
const asChild = `not { $node <: within JsxElement(opening_element=JsxOpeningElement(attributes=$parentAttributes), children=$children) where {
  $parentAttributes <: some JsxAttribute(name=$asChild) where { $asChild <: r"^asChild$" },
  not { $parentAttributes <: some JsxAttribute(name=$asChild, initializer=$state) where { $asChild <: r"^asChild$", $state <: r"^=\\{false\\}$" } },
  $children <: contains $node until or { JsxElement(), JsxSelfClosingElement(), JsxFragment(), JsCallExpression(), JsArrowFunctionExpression(), JsFunctionExpression() }
} }`;

function inputConditions(selector: string): string {
  const type = `$attrs <: some JsxAttribute(name=$type, initializer=$value) where { $type <: r"^type$", $value <: r"^=(?:['\\x22]${selector}['\\x22]|\\{['\\x22]${selector}['\\x22]\\})$" }`;
  if (selector === 'checkbox' || selector === 'radio') {
    return type;
  }
  return `not { $attrs <: some JsxAttribute(name=$type, initializer=$value) where {
    $type <: r"^type$",
    or {
      $value <: r"^=(?:['\\x22](?:checkbox|radio|file|hidden|range)['\\x22]|\\{['\\x22](?:checkbox|radio|file|hidden|range)['\\x22]\\})$",
      not { $value <: r"^=(?:['\\x22][^'\\x22]*['\\x22]|\\{['\\x22][^'\\x22]*['\\x22]\\})$" }
    }
  } }`;
}

export function emitReinvented(catalog: Catalog): string {
  const map = catalogReplacements(catalog);
  const selectors = ['button', 'input', 'textarea', 'select', 'table', 'a'];
  const selectorBranches = selectors.flatMap((selector) => {
    const variants =
      selector === 'input'
        ? [
            ['input[type=checkbox]', inputConditions('checkbox')],
            ['input[type=radio]', inputConditions('radio')],
            ['input', inputConditions('other')],
          ]
        : [[selector, '']];
    return variants.map(
      ([key, condition]) => `$name <: r"^${selector}$" where {
    ${condition ? `${condition},\n    ` : ''}${diagnostic(reinventedRule, '$name', key, replacementGuidance(map[key], key))}
  }`,
    );
  });
  const branches = [
    'JsxElement(opening_element=JsxOpeningElement(name=$name, attributes=$attrs))',
    'JsxSelfClosingElement(name=$name, attributes=$attrs)',
  ].map(
    (opening) => `${opening} as $node where {
  $name <: r"^(?:${selectors.join('|')})$",
  ${asChild},
  or { ${selectorBranches.join(',\n    ')} }
}`,
  );
  return `language js\n\nor {\n  ${branches.join(',\n  ')}\n}\n`;
}

export function ruleArtifacts(
  manifest: Manifest,
  catalog: Catalog,
  tokens: Tokens,
  resolvedConfig: unknown = loadTheme(
    fileURLToPath(new URL('../../..', import.meta.url)),
  ).resolved,
) {
  const rawColors = claimedByRawColors();
  const arbitraryRoots = probeArbitraryRoots(resolvedConfig);
  const unknown = unknownVocabulary(
    resolvedConfig,
    fileURLToPath(new URL('../../..', import.meta.url)),
  );
  const implementations = {
    'no-arbitrary-values': {
      vocabulary: {
        roots: arbitraryRoots,
        categories: categoriesFor(arbitraryRoots),
        properties: propertyPatterns,
        tokenizer: 'whitespace-separated-v1',
      },
      emit: () => emitArbitraryValues(arbitraryRoots),
    },
    [rule]: {
      vocabulary: { prefix: '@radix-ui/', exempt: '@radix-ui/react-slot' },
      emit: emitRadix,
    },
    [reinventedRule]: {
      vocabulary: Object.keys(catalogReplacements(catalog)).sort(compare),
      emit: emitReinvented,
    },
    'no-raw-colors': {
      vocabulary: {
        ...rawColors.vocabulary,
        svgAllowedVariables: svgAllowedVariables(tokens),
      },
      emit: () => emitRawColors(tokens),
    },
    'no-inline-styles': {
      vocabulary: {
        allowed: allowedStyleNames,
        colorNames: namedColors,
      },
      emit: emitInlineStyles,
    },
    'no-unknown-classes': {
      vocabulary: {
        classes: unknown.classes,
        variants: unknown.variants,
        arbitraryRoots: unknown.arbitraryRoots,
      },
      emit: () => emitUnknown(unknown),
    },
    'require-static-classes': {
      vocabulary: {
        imports: designImports(catalog),
        components: catalog.components.map(({ name, importPath }) => ({
          name,
          importPath,
        })),
      },
      emit: emitStaticClasses,
    },
  };
  const known = (id: string) => {
    const implementation = implementations[id as keyof typeof implementations];
    if (!implementation) {
      throw new Error(`No Grit emitter for rule: ${id}`);
    }
    return implementation;
  };
  const rules = manifest.rules.map((entry) => ({
    ...entry,
    vocabularyHash: vocabularyHash(known(entry.id).vocabulary),
  }));
  const json = { ...manifest, rules };
  const markdown = `# Design rules\n\nGenerated by \`pnpm design-doctor generate\`. Do not edit. All findings are warnings.\n\n| Rule | Category | Weight | Subject | Docs |\n| --- | --- | --- | --- | --- |\n${rules.map((entry) => `| \`${entry.id}\` | ${entry.category} | ${entry.weight} | ${entry.subject} | [Details](../../${entry.docs}) |`).join('\n')}\n`;
  return {
    'rules.json': `${JSON.stringify(json, null, 2)}\n`,
    'rules.md': markdown,
    ...Object.fromEntries(
      rules.map(({ id }) => [`plugins/${id}.grit`, known(id).emit(catalog)]),
    ),
  };
}

export function designConfig(manifest: Manifest): string {
  return `${JSON.stringify(
    {
      root: true,
      extends: ['../biome.json', './biome.json'],
      vcs: { root: '..' },
      // Explicit root-first extends makes Biome re-evaluate existing import
      // cycles that default lint does not report. Design lint must stay opt-in
      // without introducing unrelated blocking diagnostics.
      linter: { rules: { suspicious: { noImportCycles: 'off' } } },
      plugins: manifest.rules.map(({ id }) => ({
        path: `./design-doctor/generated/plugins/${id}.grit`,
        includes: manifest.scope.includes,
      })),
    },
    null,
    2,
  )}\n`;
}
