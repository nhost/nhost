// Finds the classes a file passes to design-system components: JSX elements whose tag is
// imported from @/components/ui/v3 (icons excluded), and the classes in their className.
// Readable values: string literals, the static parts of template literals (tokens glued to an
// interpolation are left to require-static-classes), cn/clsx/cx/twMerge/twJoin/classNames
// arguments, both branches of conditionals and logical operators, arrays, clsx object keys and
// same-file constants. With Radix asChild, the child element's classes merge into the component,
// so they count against it.

const UI_MODULE = /^@\/components\/ui\/v3\/(?!icons(?:\/|$))/;
const MERGE_FUNCTIONS = new Set(['cn', 'clsx', 'cx', 'twMerge', 'twJoin', 'classNames']);

export function findSites(ts, path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const position = (offset) => {
    const { line, character } = source.getLineAndCharacterOfPosition(offset);
    return { line: line + 1, column: character + 1 };
  };

  // Local name -> { component, module }; namespace name -> module.
  const named = new Map();
  const namespaces = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const module = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (!UI_MODULE.test(module) || !clause || clause.isTypeOnly) {
      continue;
    }
    if (clause.name) {
      named.set(clause.name.text, { component: clause.name.text, module });
    }
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.set(bindings.name.text, module);
    } else if (bindings) {
      for (const element of bindings.elements) {
        if (!element.isTypeOnly) {
          named.set(element.name.text, { component: (element.propertyName ?? element.name).text, module });
        }
      }
    }
  }
  if (named.size === 0 && namespaces.size === 0) {
    return [];
  }

  // Same-file constants by name (only names declared once, so the value is unambiguous).
  const declarations = new Map();
  const collectDeclarations = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const list = declarations.get(node.name.text) ?? [];
      list.push(node.initializer);
      declarations.set(node.name.text, list);
    }
    ts.forEachChild(node, collectDeclarations);
  };
  collectDeclarations(source);

  const recognized = (tag) => {
    if (ts.isIdentifier(tag)) {
      return named.get(tag.text) ?? null;
    }
    if (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression) && namespaces.has(tag.expression.text)) {
      return { component: tag.name.text, module: namespaces.get(tag.expression.text) };
    }
    return null;
  };

  // Every class token in a string, with its position.
  const tokensIn = (stringStart, value, { gluedStart = false, gluedEnd = false } = {}) => {
    const tokens = [];
    for (const match of value.matchAll(/\S+/g)) {
      const glued = (gluedStart && match.index === 0) || (gluedEnd && match.index + match[0].length === value.length);
      if (!glued) {
        tokens.push({ token: match[0], ...position(stringStart + match.index) });
      }
    }
    return tokens;
  };

  const classesOf = (node, seen = new Set()) => {
    if (!node) {
      return [];
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return tokensIn(node.getStart(source) + 1, node.text);
    }
    if (ts.isTemplateExpression(node)) {
      const out = tokensIn(node.head.getStart(source) + 1, node.head.text, { gluedEnd: true });
      node.templateSpans.forEach((span, index) => {
        const last = index === node.templateSpans.length - 1;
        const before = index === 0 ? node.head.text : node.templateSpans[index - 1].literal.text;
        const after = span.literal.text;
        // `flex ${cond ? 'a' : 'b'}` holds whole classes; `p-${size}` holds a fragment.
        const separated = (before === '' ? index === 0 : /\s$/.test(before)) && (after === '' ? last : /^\s/.test(after));
        if (separated) {
          out.push(...classesOf(span.expression, seen));
        }
        out.push(...tokensIn(span.literal.getStart(source) + 1, span.literal.text, { gluedStart: true, gluedEnd: !last }));
      });
      return out;
    }
    if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node) || ts.isNonNullExpression(node)) {
      return classesOf(node.expression, seen);
    }
    if (ts.isConditionalExpression(node)) {
      return [...classesOf(node.whenTrue, seen), ...classesOf(node.whenFalse, seen)];
    }
    if (ts.isBinaryExpression(node)) {
      const kind = node.operatorToken.kind;
      if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        return classesOf(node.right, seen);
      }
      if (kind === ts.SyntaxKind.BarBarToken || kind === ts.SyntaxKind.QuestionQuestionToken) {
        return [...classesOf(node.left, seen), ...classesOf(node.right, seen)];
      }
      return [];
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && MERGE_FUNCTIONS.has(node.expression.text)) {
      return node.arguments.flatMap((argument) => classesOf(argument, seen));
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.flatMap((element) => classesOf(element, seen));
    }
    if (ts.isObjectLiteralExpression(node)) {
      return node.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
          return [];
        }
        const name = property.name;
        if (ts.isStringLiteral(name)) {
          return tokensIn(name.getStart(source) + 1, name.text);
        }
        return ts.isIdentifier(name) ? tokensIn(name.getStart(source), name.text) : [];
      });
    }
    if (ts.isIdentifier(node) && !seen.has(node.text) && declarations.get(node.text)?.length === 1) {
      return classesOf(declarations.get(node.text)[0], new Set([...seen, node.text]));
    }
    return [];
  };

  const attribute = (element, name) =>
    element.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText(source) === name) ?? null;
  const isTrue = (attr) => attr && (!attr.initializer || (ts.isJsxExpression(attr.initializer) && attr.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword));
  const tagText = (element) => element.tagName.getText(source);

  const sites = [];
  const visit = (node) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    const found = opening ? recognized(opening.tagName) : null;
    if (found) {
      const className = attribute(opening, 'className');
      if (className?.initializer) {
        sites.push({ ...found, tag: tagText(opening), via: null, ...position(opening.getStart(source)), tokens: classesOf(className.initializer) });
      }
      if (ts.isJsxElement(node) && isTrue(attribute(opening, 'asChild'))) {
        const child = node.children.find((c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c));
        const childOpening = child && (ts.isJsxElement(child) ? child.openingElement : child);
        const childClass = childOpening && !recognized(childOpening.tagName) ? attribute(childOpening, 'className') : null;
        if (childClass?.initializer) {
          sites.push({ ...found, tag: tagText(opening), via: tagText(childOpening), ...position(childOpening.getStart(source)), tokens: classesOf(childClass.initializer) });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return sites;
}
