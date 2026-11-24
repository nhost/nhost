// Rule policy adapted from shadcn-ui/lint@9a55f6d (MIT; see NOTICE.md).
import type { Catalog } from '../../contracts/catalog.mts';

const id = 'require-static-classes';
const docs = `design-doctor/docs/rules/${id}.md`;
const helper = '^(?:cn|clsx|cx|twMerge|twJoin|tw)$';
const forwarded =
  '^(?:className|[A-Za-z0-9_$]*[Cc]lass(?:Names?|es)?|[A-Za-z_$][A-Za-z0-9_$]*(?:\\??\\.[A-Za-z_$][A-Za-z0-9_$]*)*\\??\\.(?:className|[A-Za-z0-9_$]*[Cc]lass(?:Names?|es)?))$';
const context =
  'or { JsxAttribute(name=r"^(?:className|[A-Za-z_$][A-Za-z0-9_$]*ClassName)$"), JsCallExpression(callee=r"^(?:cn|clsx|cx|twMerge|twJoin|tw|cva)$") }';
const paths = /^@\/components\/(?:ui\/v3|form|common|presentational)\//;

export function designImports(catalog: Catalog): string[] {
  return catalog.modules
    .map(({ importPath }) => importPath)
    .filter((path) => paths.test(path))
    .sort();
}

export function emitStaticClasses(catalog: Catalog): string {
  const imports = designImports(catalog);
  if (!imports.length) {
    throw new Error('The component catalog has no design-system imports');
  }
  const sourcePattern = `^['\\x22](?:${imports.map((path) => path.replaceAll('/', '\\/')).join('|')})['\\x22]$`;
  const exportedNames = [
    ...new Set(catalog.components.map(({ name }) => name)),
  ].sort();
  const imported = `or {
    and {
      $name <: r"^([A-Za-z_$][A-Za-z0-9_$]*)$"($local),
      $module <: contains or {
        JsNamedImportSpecifier(name=$original, local_name=$local) as $spec,
        JsShorthandNamedImportSpecifier(local_name=$local) as $spec,
        JsDefaultImportSpecifier(local_name=$local) as $spec
      } where {
        $spec <: within or { JsImportNamedClause(source=$source), JsImportCombinedClause(source=$source), JsImportDefaultClause(source=$source) },
        $source <: includes "@/components/",
        $source <: r"${sourcePattern}"
      }
    },
    and {
      $name <: r"^([A-Za-z_$][A-Za-z0-9_$]*)\\.([A-Za-z_$][A-Za-z0-9_$]*)$"($namespace, $export),
      $export <: r"^(?:${exportedNames.join('|')})$",
      $module <: contains JsNamespaceImportSpecifier(local_name=$namespace) as $spec where {
        $spec <: within or { JsImportNamespaceClause(source=$source), JsImportCombinedClause(source=$source) },
        $source <: includes "@/components/",
        $source <: r"${sourcePattern}"
      }
    }
  }`;
  const diagnostic = (subject: string, span: string, message: string) =>
    `register_diagnostic(span=${span}, message=\`[design/${id}] "${subject}" ${message} Docs: ${docs}\`, severity="warn")`;
  const opaqueNode = `or {
    JsIdentifierExpression(),
    JsStaticMemberExpression(),
    JsCallExpression(callee=not r"${helper}")
  }`;
  const conventionImport = (kind: string) => `$module <: contains or {
    JsNamedImportSpecifier(local_name=${kind}),
    JsShorthandNamedImportSpecifier(local_name=${kind}),
    JsDefaultImportSpecifier(local_name=${kind})
  }`;
  const unreadable = (kind: string) => `or {
    ${kind} <: JsCallExpression(callee=not r"${helper}"),
    ${kind} <: or { JsIdentifierExpression(), JsStaticMemberExpression() } where {
      not { ${kind} <: r"^(?:undefined|null|true|false)$" },
      or { not { ${kind} <: r"${forwarded}" }, ${conventionImport(kind)} }
    }
  }`;
  const separator = '\u2028';
  // Quoted subjects must be one line or the Biome message parser rejects the report.
  const flatten = (text: string) =>
    `join(split(join(split(join(split(${text}, "\\n"), ""), "\t"), ""), " "), "")`;
  const appendSubject = (kind: string) => `or {
    ${kind} <: JsCallExpression(callee=$callee) where {
      $acc += $name, $acc += " ", $acc += ${flatten('$callee')}, $acc += "()${separator}"
    },
    ${kind} <: or { JsIdentifierExpression(), JsStaticMemberExpression() } where {
      $acc += $name, $acc += " ", $acc += ${flatten(kind)}, $acc += "${separator}"
    }
  }`;
  // Node-kind filters exclude readable literals and helper calls before the
  // costly module import lookup. The single attribute walk covers both branches.
  const component = `JsxAttribute(name=r"^(?:className|[A-Za-z_$][A-Za-z0-9_$]*ClassName)$", initializer=$value) as $attr where {
    $value <: contains JsxExpressionAttributeValue(expression=$e),
    or {
      $e <: JsIdentifierExpression() as $kind,
      $e <: JsStaticMemberExpression() as $kind,
      $e <: JsCallExpression(callee=not r"${helper}") as $kind,
      $e <: JsLogicalExpression(right=$kind) where { $kind <: ${opaqueNode} },
      $e <: JsConditionalExpression(consequent=$kind, alternate=$second) where {
        or { $kind <: ${opaqueNode}, $second <: ${opaqueNode} }
      }
    },
    $attr <: within JsModule() as $module,
    $attr <: within or { JsxOpeningElement(name=$name), JsxSelfClosingElement(name=$name) },
    ${imported},
    or {
      $e <: JsConditionalExpression() where {
        $acc = "",
        or { and { ${unreadable('$kind')}, ${appendSubject('$kind')} }, $kind <: r"[\\s\\S]*" },
        or { and { ${unreadable('$second')}, ${appendSubject('$second')} }, $second <: r"[\\s\\S]*" },
        not $acc <: "",
        register_diagnostic(span=$attr, message=\`[design/${id}] $acc Guidance: This value cannot be checked by the other design rules. Inline complete classes or use a same-file *ClassName/*Classes constant. Docs: ${docs}\`, severity="warn")
      },
      $kind <: JsCallExpression(callee=$callee) where {
        ${unreadable('$kind')},
        $acc = ${flatten('$callee')},
        ${diagnostic('$name $acc()', '$attr', 'This call cannot be checked by the other design rules. Inline complete class strings or use cn/clsx/cx/twMerge/twJoin/tw for complete-class alternatives.')}
      },
      $kind <: or { JsIdentifierExpression(), JsStaticMemberExpression() } where {
        ${unreadable('$kind')},
        $acc = ${flatten('$kind')},
        ${diagnostic('$name $acc', '$attr', 'This value cannot be checked by the other design rules. Inline complete class strings; for constants, use *ClassName/*Classes so their definition is checked.')}
      }
    }
  }`;
  const guidance =
    'Glued interpolation may not generate CSS in Tailwind v3 and cannot be checked by the other design rules. Use a lookup of complete classes, a conditional, or a CSS variable with w-[var(--x)].';
  const placeholder = `\${…}`;
  // Capture the chunk immediately before the final interpolation, without crossing an expression.
  const lastInterpolation =
    '^\\x60(?:[^$\\x60]*\\$\\{[^$\\x60]*\\})*([^$\\x60]*)\\$\\{[^$\\x60]*\\}([^$\\x60]*)\\x60$';
  const bothEdges = `register_diagnostic(span=$site, message=\`[design/${id}] ${placeholder}$first\u2028$last${placeholder}\u2028 Guidance: ${guidance} Docs: ${docs}\`, severity="warn")`;
  const glued = `JsTemplateChunkElement() as $site where {
    $site <: within ${context},
    not { $site <: within or { JsBinaryExpression(), JsComputedMemberName(), JsComputedMemberExpression() } },
    not { $site <: within JsCallExpression(callee=not r"^(?:cn|clsx|cx|twMerge|twJoin|tw|cva)$") until ${context} },
    or {
      $site <: after JsTemplateElement() where {
        $site <: before JsTemplateElement(),
        or {
          $site <: r"^([^\\s]+)[\\s](?:[\\s\\S]*[\\s])?([^\\s]+)$"($first, $last),
          $site <: r"^([^\\s]+)$"($first) where { $last = $first }
        },
        ${bothEdges}
      },
      $site <: r"^(?:[\\s\\S]*[\\s])?([^\\s]+)$"($last) where {
        $site <: before JsTemplateElement(),
        or {
          and {
            $site <: within JsTemplateExpression() as $template,
            $template <: r"${lastInterpolation}"($before, $after),
            $site <: $before,
            $before <: r"^(?:[\\s\\S]*[\\s])?[^\\s]+$",
            $after <: r"^([^\\s]*)(?:[\\s][\\s\\S]*)?$"($tail),
            ${diagnostic(`$last${placeholder}$tail`, '$site', guidance)}
          },
          ${diagnostic(`$last${placeholder}`, '$site', guidance)}
        }
      },
      $site <: r"^([^\\s]+)(?:[\\s][\\s\\S]*)?$"($first) where {
        $site <: after JsTemplateElement(),
        not {
          $site <: within JsTemplateExpression() as $template,
          $template <: r"${lastInterpolation}"($before, $after),
          $before <: r"^(?:[\\s\\S]*[\\s])?[^\\s]+$",
          or { $template <: r"^\\x60[^$\\x60]*\\$\\{[^$\\x60]*\\}[^$\\x60]*\\x60$", $before <: r"^\\s[\\s\\S]*$" }
        },
        ${diagnostic(`${placeholder}$first`, '$site', guidance)}
      }
    }
  }`;
  return `language js\n\nor {\n  ${glued},\n  ${component}
}\n`;
}
