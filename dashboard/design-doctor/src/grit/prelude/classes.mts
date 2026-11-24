export interface NormalizedClass {
  variants: string[];
  base: string;
  normalized: string;
}

export function normalizeClass(text: string): NormalizedClass {
  const segments: string[] = [];
  let square = 0;
  let round = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '[') {
      square++;
    } else if (char === ']') {
      square = Math.max(0, square - 1);
    } else if (char === '(' && !square) {
      round++;
    } else if (char === ')' && !square) {
      round = Math.max(0, round - 1);
    } else if (char === ':' && !square && !round) {
      segments.push(text.slice(start, index));
      start = index + 1;
    }
  }
  const base = text.slice(start);
  return {
    variants: segments,
    base,
    normalized: base.replace(/^!/, '').replace(/^-/, ''),
  };
}

// U+2028 is treated as whitespace before accumulating template chunks, so
// it cannot occur inside an extracted subject. Grit preserves it in messages.
export const CLASS_SUBJECT_SEPARATOR = '\u2028';

// Capture only colons outside arbitrary variant brackets. The normalized
// base drops important/negative prefixes but retains slash opacity.
const normalized = `pattern class_normalized($normalized) {
  $token where {
    $token <: r"^(?:(?:[A-Za-z0-9_+/@-]+(?:\\[[^\\]]+\\])?|\\[[^\\]]+\\]):)*([\\s\\S]+)$"($base),
    $base <: r"^(?:!|-)*([\\s\\S]+)$"($normalized)
  }
}\n\n`;

function simplePrelude(predicate: string, siteAware: boolean): string {
  return `${normalized}pattern class_token($acc${siteAware ? ', $site' : ''}) {
  $part where { $part <: r"^[^ \\t\\r\\n]+$", ${predicate}, $acc += $part, $acc += "${CLASS_SUBJECT_SEPARATOR}" }
}
`;
}

export function classPrelude(predicate: string, siteAware = false): string {
  const assembled = predicate.replaceAll('$part', '$pending');
  return `${normalized}pattern class_token($acc, $pending${siteAware ? ', $site' : ''}) {
  $part where {
    or {
      $part <: r".*\\[[^\\]]*$" where { $pending += $part, $pending += " " },
      $part <: r".*\\].*" where {
        not $pending <: "",
        $pending += $part,
        ${assembled},
        $acc += $pending,
        $acc += "${CLASS_SUBJECT_SEPARATOR}",
        $pending = ""
      },
      $part <: r"^[^ ]+$" where { not $pending <: "", $pending += $part, $pending += " " },
      $part <: r"^[^ \\t\\r\\n]+$" where {
        $pending <: "",
        ${predicate},
        $acc += $part,
        $acc += "${CLASS_SUBJECT_SEPARATOR}"
      }
    }
  }
}
`;
}

const helpers = '^(?:cn|clsx|cx|twMerge|twJoin|tw|cva)$';
const className = '^(?:className|[A-Za-z_$][A-Za-z0-9_$]*ClassName)$';
const conventional = '^[A-Za-z0-9_$]*[Cc]lass(?:Names?|es)?$';
const helper = `JsCallExpression(callee=r"${helpers}")`;
const property = `JsPropertyObjectMember(name=r"${conventional}")`;
const declarator = `JsVariableDeclarator(id=r"${conventional}")`;
const attribute = `JsxAttribute(name=r"${className}")`;
const ordinary = `or { ${attribute}, ${helper}, ${declarator}, ${property} }`;
const confident = `or { ${attribute}, ${helper} }`;
// Stop exclusions at the nearest class context, not a surrounding callback.
const stop = ordinary;
const exclusions = `not { $site <: within JsBinaryExpression() },
    not { $site <: within JsComputedMemberName() },
    not { $site <: within JsCallExpression(callee=not r"${helpers}") until ${stop} },
    not { $site <: within JsPropertyObjectMember(name=r"^defaultVariants$") },
    not {
      $site <: within JsPropertyObjectMember(name=r"^compoundVariants$"),
      not { $site <: within JsPropertyObjectMember(name=r"^class(?:Name)?$") }
    }`;
function classContexts(
  preGate: string,
  tokenizer: string,
  highConfidence: boolean,
): string {
  const gate = preGate ? `${preGate},` : '';
  const context = highConfidence ? confident : ordinary;
  return `or {
  JsxString() as $site where { ${gate} $site <: within ${attribute} until JsxAttribute(), ${tokenizer} },
  JsStringLiteralExpression() as $site where { ${gate} $site <: within ${context}, ${exclusions}, ${tokenizer} },
  JsTemplateChunkElement() as $site where { ${gate} $site <: within ${context}, ${exclusions}, ${tokenizer} },
  JsPropertyObjectMember(name=$site, value=$value) as $member where {
    ${gate}
    $member <: within ${helper},
    or {
      $site <: r"^['\\x22][^'\\x22]+['\\x22]$",
      $site <: r"^[A-Za-z_$][A-Za-z0-9_$]*$" where {
        not { $member <: within JsCallExpression(callee=r"^cva$") until ${helper} }
      }
    },
    not {
      $member <: within JsCallExpression(callee=r"^cva$"),
      $value <: or { JsStringLiteralExpression(), JsArrayExpression(), JsObjectExpression() }
    },
    ${exclusions},
    ${tokenizer}
  }
}`;
}

// One syntax-node diagnostic per class site, with all its token subjects.
// Future rules share these context gates and supply a whole-site pre-gate and
// token predicate; the probe deliberately has no token filter.
export interface ClassRuleOptions {
  predicate?: string;
  preGate?: string;
  // Applied to both site and token before the (potentially expensive) regex
  // predicate. A Grit includes dispatch is much cheaper than an alternation regex.
  substrings?: readonly string[];
  gateLevels?: readonly (readonly string[])[];
  guidance?: string;
  bracketAware?: boolean;
  extraBranch?: string;
  highConfidence?: boolean;
  siteAware?: boolean;
}

function includesGate(subject: string, substrings: readonly string[]): string {
  if (substrings.some((part) => !part || /["\\\r\n]/.test(part))) {
    throw new Error(
      'Class gate substrings must be nonempty Grit string literals',
    );
  }
  return `or { ${substrings.map((part) => `${subject} <: includes "${part}"`).join(', ')} }`;
}

export function emitClassRule(
  id: string,
  options: ClassRuleOptions = {},
): string {
  const {
    predicate = '$part <: r"(?s)^.+$"',
    preGate = '',
    substrings = [],
    gateLevels = [],
    guidance = 'Check the token catalog before replacing this class.',
    bracketAware = true,
    extraBranch,
    highConfidence = false,
    siteAware = false,
  } = options;
  if (guidance.includes('`') || guidance.includes('\n')) {
    throw new Error('Class guidance cannot contain a backtick or newline');
  }
  const gate = (subject: string) => [
    ...gateLevels.map((level) => includesGate(subject, level)),
    ...(substrings.length ? [includesGate(subject, substrings)] : []),
  ];
  const tokenPredicate = [...gate('$part'), predicate].join(', ');
  const siteGate = [...gate('$site'), preGate].filter(Boolean).join(', ');
  const tokenizer = `or {
    $site <: r"^[\\x22']([\\s\\S]*)[\\x22']$"($inner),
    $site <: r"^([\\s\\S]*)$"($inner)
  },
  $acc = "",
  ${bracketAware ? '$pending = "",' : ''}
  $parts = split(join(split(join(split(join(split($inner, "\t"), " "), "\\n"), " "), "${CLASS_SUBJECT_SEPARATOR}"), " "), " "),
  $parts <: every or { class_token($acc${bracketAware ? ', $pending' : ''}${siteAware ? ', $site' : ''}), $_ },
  ${
    bracketAware
      ? `or {
    $pending <: "",
    $pending <: r"^([\\s\\S]*[^ ]) $"($unfinished) where {
      ${tokenPredicate.replaceAll('$part', '$unfinished')},
      $acc += $unfinished,
      $acc += "${CLASS_SUBJECT_SEPARATOR}"
    }
  },`
      : ''
  }
  not $acc <: "",
  register_diagnostic(span=$site, message=\`[design/${id}] $acc Guidance: ${guidance} Docs: design-doctor/docs/rules/${id}.md\`, severity="warn")`;
  const contexts = classContexts(siteGate, tokenizer, highConfidence);
  // Keep node-kind branches at the top level: a named-pattern alternative
  // disables Biome's per-kind dispatch and visits far more nodes.
  return `language js\n\n${bracketAware ? classPrelude(tokenPredicate, siteAware) : simplePrelude(tokenPredicate, siteAware)}\n${extraBranch ? contexts.replace(/}$/, `,\n${extraBranch}\n}`) : contexts}\n`.replace(
    /^[ \t]+$/gm,
    '',
  );
}

export function emitClassProbe(): string {
  return emitClassRule('class-probe', { guidance: 'Probe class tokens.' });
}
