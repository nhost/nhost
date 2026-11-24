import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import type { Finding, Report } from '../contracts/report.mts';

type Suppression = Report['suppressions'][number];
type Span = { start: number; end: number };
type Comment = Span & { text: string; bodyStart: number };

const marker = /design-doctor-ignore|biome-ignore/;
const directive = /^design-doctor-ignore\s+([a-z-]+):\s*(\S[\s\S]*)$/;
const biomeDirective = /^biome-ignore(?:-all|-start)?(?=\s|:|$)([\s\S]*)$/;
const pluginCategory =
  /(?:^|[\s,])lint(?:\/plugin(?:\/([a-z-]+))?)?(?:\([^)]*\))?(?=$|[\s,:])/g;

// Read only in-scope sources; a source is parsed below only when it contains a marker.
export async function suppressionSources(
  dashboard: string,
  paths: readonly string[],
): Promise<Map<string, string>> {
  const sources = new Map<string, string>();
  for (let index = 0; index < paths.length; index += 64) {
    const entries = await Promise.all(
      paths.slice(index, index + 64).map(async (path) => ({
        path,
        text: await readFile(join(dashboard, path), 'utf8'),
      })),
    );
    for (const { path, text } of entries) {
      if (marker.test(text)) {
        sources.set(path, text);
      }
    }
  }
  return sources;
}

function position(source: ts.SourceFile, index: number): Suppression['start'] {
  const { line } = source.getLineAndCharacterOfPosition(index);
  const lineStart = source.getPositionOfLineAndCharacter(line, 0);
  return {
    line: line + 1,
    column: [...source.text.slice(lineStart, index)].length + 1,
  };
}

// Biome's columns count Unicode code points, while TypeScript offsets count UTF-16.
function offset(source: ts.SourceFile, point: Finding['start']): number {
  const lineStart = source.getPositionOfLineAndCharacter(point.line - 1, 0);
  const lineEnd = source.getLineEndOfPosition(lineStart);
  let current = lineStart;
  for (let index = 1; index < point.column && current < lineEnd; index++) {
    current += String.fromCodePoint(
      source.text.codePointAt(current) ?? 0,
    ).length;
  }
  return current;
}

function parseSource(
  text: string,
  path: string,
): {
  source: ts.SourceFile;
  comments: Comment[];
  nodes: Span[];
} {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const nonCommentText: Span[] = [];
  const jsxComments: Span[] = [];
  const nodes: Span[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxText(node) ||
      ts.isStringLiteral(node) ||
      ts.isRegularExpressionLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      nonCommentText.push({ start: node.getStart(source), end: node.end });
    }
    if (ts.isJsxExpression(node) && !node.expression) {
      jsxComments.push({ start: node.getStart(source), end: node.end });
    }
    if (
      ts.isStatement(node) ||
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node) ||
      (ts.isJsxExpression(node) && node.expression !== undefined) ||
      ts.isJsxAttributeLike(node) ||
      ts.isObjectLiteralElementLike(node) ||
      (ts.isExpression(node) &&
        ((ts.isCallExpression(node.parent) &&
          node.parent.arguments.some((arg) => arg === node)) ||
          (ts.isArrayLiteralExpression(node.parent) &&
            node.parent.elements.some((item) => item === node))))
    ) {
      nodes.push({ start: node.getStart(source), end: node.end });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  // The lexical scanner finds trailing and unattached comments as well as leading
  // ones. Mask JSX text, strings, regex and template chunks before scanning:
  // the standalone scanner lacks the parser context for JSX and regex, and a
  // false comment inside a regex could otherwise swallow real comments after it.
  let lexical = text;
  for (const range of nonCommentText.sort((a, b) => b.start - a.start)) {
    lexical =
      lexical.slice(0, range.start) +
      lexical.slice(range.start, range.end).replace(/[^\r\n]/g, ' ') +
      lexical.slice(range.end);
  }
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.JSX,
    lexical,
  );
  const comments: Comment[] = [];
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token !== ts.SyntaxKind.SingleLineCommentTrivia &&
      token !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue;
    }
    const start = scanner.getTokenStart();
    const end = scanner.getTokenEnd();
    const wrapper = jsxComments.find(
      (range) => range.start < start && end < range.end,
    );
    comments.push({
      start: wrapper?.start ?? start,
      end: wrapper?.end ?? end,
      bodyStart: start + 2,
      text: text.slice(
        start + 2,
        end - (token === ts.SyntaxKind.MultiLineCommentTrivia ? 2 : 0),
      ),
    });
  }
  nodes.sort((a, b) => a.start - b.start || b.end - a.end);
  return { source, comments, nodes };
}

export function suppressFindings(
  findings: Finding[],
  sources: ReadonlyMap<string, string>,
  knownRules: ReadonlySet<string>,
): Suppression[] {
  const byFile = new Map<string, Finding[]>();
  for (const finding of findings) {
    byFile.set(finding.path, [...(byFile.get(finding.path) ?? []), finding]);
  }
  const suppressions: Suppression[] = [];
  for (const [path, text] of sources) {
    if (!marker.test(text)) {
      continue;
    }
    const { source, comments, nodes } = parseSource(text, path);
    const attached = new Set<string>();
    for (const comment of comments) {
      // Biome treats every line of a block comment as a directive. Keep the
      // opener as the first directive's location, but locate later ones on
      // their own lines so each unsafe category is independently visible.
      const lines: { value: string; start: Suppression['start'] }[] = [];
      let index = 0;
      for (const raw of comment.text.split(/(?<=\n)/)) {
        if (!raw) {
          continue;
        }
        const value = raw.trim().replace(/^\*+/, '').trim();
        if (
          value.startsWith('design-doctor-ignore') ||
          biomeDirective.test(value)
        ) {
          const directiveOffset = raw.indexOf(value);
          lines.push({
            value,
            start: lines.length
              ? position(
                  source,
                  comment.bodyStart + index + Math.max(0, directiveOffset),
                )
              : position(source, comment.start),
          });
        }
        index += raw.length;
      }
      for (const { value, start } of lines) {
        const biome = biomeDirective.exec(value);
        if (!biome) {
          continue;
        }
        const categories =
          /^[^:(]*(?:\([^)]*\)[^:(]*)*/.exec(biome[1])?.[0] ?? '';
        const target = [...categories.matchAll(pluginCategory)].find(
          (match) => !match[1] || knownRules.has(match[1]),
        );
        if (target) {
          suppressions.push({
            path,
            ruleId: target[0].trim().replace(/\([^)]*\)$/, ''),
            start,
            state: 'invalid',
            count: 0,
          });
        }
      }
      const doctors = lines.filter(({ value }) =>
        value.startsWith('design-doctor-ignore'),
      );
      for (const [doctorIndex, { value, start }] of doctors.entries()) {
        const parsed = directive.exec(value);
        const [, rawRuleId] = value.split(/\s+/, 2);
        const ruleId =
          parsed?.[1] ?? rawRuleId?.replace(/:$/, '') ?? '(invalid)';
        const reason = parsed?.[2].trim();
        const entry: Suppression = {
          path,
          ruleId,
          start,
          state: 'invalid',
          count: 0,
        };
        if (reason) {
          entry.reason = reason;
        }
        suppressions.push(entry);
        // A comment can suppress only one rule; all additional doctor lines
        // are invalid even if they name a known rule and have a reason.
        if (doctorIndex || !parsed || !reason || !knownRules.has(ruleId)) {
          continue;
        }
        const target = nodes.find((node) => node.start >= comment.end);
        const lineStart = text.lastIndexOf('\n', comment.start - 1) + 1;
        const leading = !text.slice(lineStart, comment.start).trim();
        let between = target ? text.slice(comment.end, target.start) : '';
        if (target) {
          // Other stacked comments are trivia; code between comments is not.
          for (const other of comments.filter(
            (item) => item.start >= comment.end && item.end <= target.start,
          )) {
            const relative = other.start - comment.end;
            between =
              between.slice(0, relative) +
              ' '.repeat(other.end - other.start) +
              between.slice(other.end - comment.end);
          }
        }
        const key = `${target?.start}:${target?.end}:${ruleId}`;
        if (
          !leading ||
          !target ||
          position(source, target.start).line <=
            position(source, comment.end).line ||
          between.trim() ||
          attached.has(key)
        ) {
          continue;
        }
        attached.add(key);
        for (const finding of byFile.get(path) ?? []) {
          if (
            finding.ruleId === ruleId &&
            finding.status !== 'suppressed' &&
            offset(source, finding.start) >= target.start &&
            offset(source, finding.end) <= target.end
          ) {
            finding.status = 'suppressed';
            entry.count++;
          }
        }
        entry.state = entry.count ? 'applied' : 'unused';
      }
    }
  }
  return suppressions.sort((a, b) => {
    if (a.path !== b.path) {
      return a.path < b.path ? -1 : 1;
    }
    return a.start.line - b.start.line || a.start.column - b.start.column;
  });
}
