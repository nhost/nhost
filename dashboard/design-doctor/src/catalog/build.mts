import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import {
  type Catalog,
  type CatalogMeta,
  catalogMetaEntrySchema,
  catalogSchema,
} from '../contracts/catalog.mts';

type Export = { name: string; source: string; local: string };
type Parsed = {
  ast: ts.SourceFile;
  declarations: Map<string, ts.Node>;
  imports: Map<string, { package: string; typeOnly: boolean }>;
  localImports: Map<string, { module: string; imported: string }>;
  radixAliases: Map<string, { package: string; primitive: string }>;
  exports: Export[];
};

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const key = (node: ts.PropertyName | ts.BindingName): string | null =>
  ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)
    ? node.text
    : null;

function property(object: ts.ObjectLiteralExpression, name: string) {
  const match = object.properties.find(
    (entry) => ts.isPropertyAssignment(entry) && key(entry.name) === name,
  );
  return match && ts.isPropertyAssignment(match) ? match.initializer : null;
}

function recipe(name: string, call: ts.CallExpression) {
  const options = call.arguments.find(ts.isObjectLiteralExpression);
  if (!options) {
    return null;
  }
  const variants = property(options, 'variants');
  const defaults = property(options, 'defaultVariants');
  const choices: Record<string, string[]> = {};
  const defaultVariants: Record<string, string> = {};
  if (variants && ts.isObjectLiteralExpression(variants)) {
    for (const item of variants.properties) {
      if (
        !ts.isPropertyAssignment(item) ||
        !ts.isObjectLiteralExpression(item.initializer)
      ) {
        continue;
      }
      const variant = key(item.name);
      if (variant) {
        choices[variant] = item.initializer.properties
          .filter(ts.isPropertyAssignment)
          .map((value) => key(value.name))
          .filter((value): value is string => value !== null);
      }
    }
  }
  if (defaults && ts.isObjectLiteralExpression(defaults)) {
    for (const item of defaults.properties) {
      if (!ts.isPropertyAssignment(item)) {
        continue;
      }
      const variant = key(item.name);
      if (
        variant &&
        (ts.isStringLiteral(item.initializer) ||
          item.initializer.kind === ts.SyntaxKind.TrueKeyword ||
          item.initializer.kind === ts.SyntaxKind.FalseKeyword)
      ) {
        defaultVariants[variant] = ts.isStringLiteral(item.initializer)
          ? item.initializer.text
          : item.initializer.getText();
      }
    }
  }
  return {
    name,
    variants: choices,
    defaultVariants,
    conditionalDefaults: {} as Record<string, Record<string, string>>,
  };
}

export async function buildCatalog(
  root: string,
  meta: CatalogMeta,
  parsedFiles?: Set<string>,
): Promise<Catalog> {
  const cache = new Map<string, Parsed>();
  async function moduleFile(path: string, specifier: string): Promise<string> {
    const base = specifier.startsWith('@/')
      ? resolve(root, 'src', specifier.slice(2))
      : resolve(dirname(path), specifier);
    for (const candidate of [
      `${base}.tsx`,
      `${base}.ts`,
      join(base, 'index.ts'),
      join(base, 'index.tsx'),
    ]) {
      try {
        await readFile(candidate);
        return candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }
    throw new Error(`Cannot resolve catalog module ${specifier} from ${path}`);
  }
  async function parse(path: string): Promise<Parsed> {
    const cached = cache.get(path);
    if (cached) {
      return cached;
    }
    const content = await readFile(path, 'utf8');
    parsedFiles?.add(path);
    const ast = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const declarations = new Map<string, ts.Node>();
    const imports = new Map<string, { package: string; typeOnly: boolean }>();
    const localImports = new Map<
      string,
      { module: string; imported: string }
    >();
    const radixAliases = new Map<
      string,
      { package: string; primitive: string }
    >();
    const exports: Export[] = [];
    const result = {
      ast,
      declarations,
      imports,
      localImports,
      radixAliases,
      exports,
    };
    cache.set(path, result);
    const add = (name: string, local = name, source = path) =>
      exports.push({ name, local, source });
    for (const statement of ast.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const pkg = statement.moduleSpecifier.text;
        if (pkg.startsWith('.')) {
          const module = await moduleFile(path, pkg);
          const clause = statement.importClause;
          if (clause?.name) {
            localImports.set(clause.name.text, { module, imported: 'default' });
          }
          if (
            clause?.namedBindings &&
            ts.isNamedImports(clause.namedBindings)
          ) {
            for (const item of clause.namedBindings.elements) {
              localImports.set(item.name.text, {
                module,
                imported: item.propertyName?.text ?? item.name.text,
              });
            }
          }
        }
        if (!pkg.startsWith('@radix-ui/')) {
          continue;
        }
        const clause = statement.importClause;
        if (clause?.name) {
          imports.set(clause.name.text, {
            package: pkg,
            typeOnly: clause.isTypeOnly,
          });
        }
        if (clause?.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            imports.set(clause.namedBindings.name.text, {
              package: pkg,
              typeOnly: clause.isTypeOnly,
            });
          } else {
            for (const specifier of clause.namedBindings.elements) {
              imports.set(specifier.name.text, {
                package: pkg,
                typeOnly: clause.isTypeOnly || specifier.isTypeOnly,
              });
            }
          }
        }
      }
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (
            ts.isObjectBindingPattern(declaration.name) &&
            declaration.initializer &&
            ts.isIdentifier(declaration.initializer)
          ) {
            const imported = imports.get(declaration.initializer.text);
            for (const element of declaration.name.elements) {
              const name = key(element.name);
              if (!name) {
                continue;
              }
              declarations.set(name, declaration);
              if (
                imported &&
                !imported.typeOnly &&
                imported.package !== '@radix-ui/react-slot'
              ) {
                radixAliases.set(name, {
                  package: imported.package,
                  primitive: element.propertyName
                    ? (key(element.propertyName) ?? name)
                    : name,
                });
              }
              if (
                statement.modifiers?.some(
                  (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
                )
              ) {
                add(name);
              }
            }
            continue;
          }
          const name = key(declaration.name);
          if (!name) {
            continue;
          }
          declarations.set(name, declaration);
          if (
            statement.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
            )
          ) {
            add(name);
          }
        }
      }
      if (
        ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)
      ) {
        if (statement.name) {
          declarations.set(statement.name.text, statement);
          if (
            statement.modifiers?.some(
              (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
            )
          ) {
            add(statement.name.text);
          }
        }
        if (
          statement.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
          )
        ) {
          add('default', statement.name?.text ?? 'default');
          if (!statement.name) {
            declarations.set('default', statement);
          }
        }
      }
      if (ts.isExportAssignment(statement)) {
        const local = ts.isIdentifier(statement.expression)
          ? statement.expression.text
          : 'default';
        if (local === 'default') {
          declarations.set('default', statement);
        }
        add('default', local);
      }
      if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) {
        continue;
      }
      let target: string | null = null;
      if (statement.moduleSpecifier) {
        if (!ts.isStringLiteral(statement.moduleSpecifier)) {
          throw new Error(`Unsupported catalog re-export from ${path}`);
        }
        const specifier = statement.moduleSpecifier.text;
        if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
          throw new Error(
            `Unsupported catalog re-export ${specifier} from ${path}`,
          );
        }
        target = await moduleFile(path, specifier);
      }
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const item of statement.exportClause.elements) {
          if (item.isTypeOnly) {
            continue;
          }
          if (!target) {
            const local = item.propertyName?.text ?? item.name.text;
            const imported = localImports.get(local);
            const origin =
              imported &&
              (await parse(imported.module)).exports.find(
                (entry) => entry.name === imported.imported,
              );
            if (origin) {
              add(item.name.text, origin.local, origin.source);
            } else {
              add(item.name.text, local);
            }
            continue;
          }
          const origin = (await parse(target)).exports.find(
            (entry) =>
              entry.name === (item.propertyName?.text ?? item.name.text),
          );
          if (!origin) {
            throw new Error(
              `Unresolved catalog re-export: ${item.name.text} from ${target}`,
            );
          }
          add(item.name.text, origin.local, origin.source);
        }
      } else if (target && !statement.exportClause) {
        for (const entry of (await parse(target)).exports) {
          if (entry.name !== 'default') {
            add(entry.name, entry.local, entry.source);
          }
        }
      } else {
        throw new Error(`Unsupported catalog re-export from ${path}`);
      }
    }
    return result;
  }

  const ui = join(root, 'src/components/ui/v3');
  const paths = (await readdir(ui))
    .filter(
      (name) => name.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(name),
    )
    .map((name) => join(ui, name));
  for (const folder of ['form', 'common', 'presentational']) {
    const base = join(root, 'src/components', folder);
    for (const name of await readdir(base, { withFileTypes: true })) {
      if (name.isDirectory()) {
        const index = join(base, name.name, 'index.ts');
        try {
          await readFile(index);
          paths.push(index);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      }
    }
  }
  paths.sort(compare);
  const modules: Catalog['modules'] = [];
  const components: Catalog['components'] = [];
  for (const path of paths) {
    const importPath = `@/${relative(join(root, 'src'), path)
      .replaceAll('\\', '/')
      .replace(/(?:\/index)?\.tsx?$/, '')}`;
    const parsed = await parse(path);
    modules.push({
      importPath,
      exports: [...new Set(parsed.exports.map((entry) => entry.name))].sort(
        compare,
      ),
    });
    for (const entry of parsed.exports) {
      if (
        !/^[A-Z]/.test(entry.name) ||
        components.some(
          (component) =>
            component.importPath === importPath &&
            component.name === entry.name,
        )
      ) {
        continue;
      }
      const origin = await parse(entry.source);
      const node = origin.declarations.get(entry.local);
      const linked = new Map<string, ts.Node>();
      const visit = (name: string) => {
        if (linked.has(name)) {
          return;
        }
        const declaration = origin.declarations.get(name);
        if (!declaration) {
          return;
        }
        linked.set(name, declaration);
        const walk = (child: ts.Node) => {
          if (
            ts.isIdentifier(child) &&
            child !==
              (ts.isVariableDeclaration(declaration)
                ? declaration.name
                : undefined) &&
            origin.declarations.has(child.text) &&
            child.text !== name
          ) {
            visit(child.text);
          }
          ts.forEachChild(child, walk);
        };
        ts.forEachChild(declaration, walk);
      };
      if (node) {
        visit(entry.local);
      }
      const cva = [...linked]
        .flatMap(([name, declaration]) => {
          if (
            !ts.isVariableDeclaration(declaration) ||
            !declaration.initializer ||
            !ts.isCallExpression(declaration.initializer) ||
            !ts.isIdentifier(declaration.initializer.expression) ||
            declaration.initializer.expression.text !== 'cva'
          ) {
            return [];
          }
          const value = recipe(name, declaration.initializer);
          return value ? [value] : [];
        })
        .sort((a, b) => compare(a.name, b.name));
      for (const [name, declaration] of linked) {
        const match = /^default([A-Z][a-zA-Z]*)By([A-Z][a-zA-Z]*)$/.exec(name);
        if (
          !match ||
          !ts.isVariableDeclaration(declaration) ||
          !declaration.initializer ||
          !ts.isObjectLiteralExpression(declaration.initializer)
        ) {
          continue;
        }
        const target = `${match[1][0].toLowerCase()}${match[1].slice(1)}`;
        const condition = `${match[2][0].toLowerCase()}${match[2].slice(1)}`;
        for (const item of declaration.initializer.properties) {
          if (
            !ts.isPropertyAssignment(item) ||
            !ts.isStringLiteral(item.initializer)
          ) {
            continue;
          }
          const variant = key(item.name);
          if (!variant) {
            continue;
          }
          for (const value of cva) {
            if (
              value.variants[target]?.includes(item.initializer.text) &&
              value.variants[condition]?.includes(variant)
            ) {
              value.conditionalDefaults[`${target}By${match[2]}`] ??= {};
              value.conditionalDefaults[`${target}By${match[2]}`][variant] =
                item.initializer.text;
            }
          }
        }
      }
      let radix: { package: string; primitive: string } | null = null;
      if (node) {
        const found: { package: string; primitive: string }[] = [];
        const directAlias = origin.radixAliases.get(entry.local);
        if (directAlias) {
          found.push(directAlias);
        }
        const scan = (child: ts.Node) => {
          if (
            ts.isPropertyAccessExpression(child) &&
            ts.isIdentifier(child.expression)
          ) {
            const imported = origin.imports.get(child.expression.text);
            if (
              imported &&
              !imported.typeOnly &&
              imported.package !== '@radix-ui/react-slot'
            ) {
              found.push({
                package: imported.package,
                primitive: child.name.text,
              });
            }
          }
          ts.forEachChild(child, scan);
        };
        scan(node);
        if (!found.length) {
          for (const [name, declaration] of linked) {
            if (name !== entry.local) {
              const alias = origin.radixAliases.get(name);
              if (alias) {
                found.push(alias);
              }
              scan(declaration);
            }
          }
        }
        // The outer JSX element may be a Portal or Header helper, not the wrapped primitive.
        radix =
          found.find(({ primitive }) => entry.name.endsWith(primitive)) ??
          found.find(({ primitive }) => primitive === 'Root') ??
          found[0] ??
          null;
      }
      const id = `${importPath}#${entry.name}`;
      const documentation = meta[id];
      components.push({
        name: entry.name,
        importPath,
        source: relative(root, entry.source).replaceAll('\\', '/'),
        purpose: documentation?.purpose ?? null,
        replaces: documentation?.replaces ?? [],
        dropIn: documentation?.dropIn ?? false,
        cva,
        radix,
      });
    }
  }
  const known = new Set(
    components.map((component) => `${component.importPath}#${component.name}`),
  );
  for (const [id, details] of Object.entries(meta)) {
    catalogMetaEntrySchema.parse(details);
    if (!known.has(id)) {
      throw new Error(`Unresolved catalog metadata key: ${id}`);
    }
  }
  components.sort((a, b) =>
    compare(`${a.importPath}#${a.name}`, `${b.importPath}#${b.name}`),
  );
  return catalogSchema.parse({
    schemaVersion: 1,
    modules,
    components,
    undocumented: components
      .filter((component) => component.purpose === null)
      .map((component) => `${component.importPath}#${component.name}`),
  });
}
