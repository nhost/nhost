// Command configdocs generates the nhost.toml configuration reference page for
// the documentation site from the mimir CUE schema. It walks the parsed CUE AST
// so the rendered types, defaults, and explanations stay faithful to the schema
// source (including its doc comments) rather than an evaluated/flattened value.
package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/format"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
)

func main() {
	schemaPath := flag.String("schema", "", "path to the mimir schema.cue file")
	outPath := flag.String("out", "", "path to the .mdx file to write")

	flag.Parse()

	if *schemaPath == "" || *outPath == "" {
		fmt.Fprintln(os.Stderr, "usage: configdocs -schema <schema.cue> -out <reference.mdx>")
		os.Exit(2)
	}

	src, err := os.ReadFile(*schemaPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read schema: %v\n", err)
		os.Exit(1)
	}

	out, err := generate(*schemaPath, src)
	if err != nil {
		fmt.Fprintf(os.Stderr, "generate: %v\n", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(filepath.Dir(*outPath), 0o755); err != nil { //nolint:mnd // 0o755: standard directory permissions
		fmt.Fprintf(os.Stderr, "mkdir: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(*outPath, []byte(out), 0o644); err != nil { //nolint:mnd // 0o644: standard read/write file permissions
		fmt.Fprintf(os.Stderr, "write: %v\n", err)
		os.Exit(1)
	}
}

// generator renders a single configuration reference page from the CUE AST.
type generator struct {
	defs        map[string]*ast.Field // "#Name" -> definition field
	topLevel    map[string]bool       // "#Name" definitions surfaced as top-level config sections
	sharedSeen  map[string]bool       // "#Name" definitions queued/rendered in the shared section
	sharedQueue []string
}

type fieldInfo struct {
	name        string
	optional    bool
	conditional bool
	value       ast.Expr
	doc         string
}

func generate(filename string, src []byte) (string, error) {
	file, err := parser.ParseFile(filename, src, parser.ParseComments)
	if err != nil {
		return "", fmt.Errorf("parse cue: %w", err)
	}

	g := &generator{
		defs:       map[string]*ast.Field{},
		topLevel:   map[string]bool{},
		sharedSeen: map[string]bool{},
	}

	for _, d := range file.Decls {
		f, ok := d.(*ast.Field)
		if !ok {
			continue
		}

		name, isDef := defName(f.Label)
		if !isDef {
			continue
		}

		g.defs[name] = f
	}

	root, ok := g.defs["#Config"]
	if !ok {
		return "", errors.New("#Config definition not found")
	}

	rootStruct, ok := root.Value.(*ast.StructLit)
	if !ok {
		return "", errors.New("#Config is not a struct literal")
	}

	topFields, _ := g.collectFields(rootStruct)
	for _, fi := range topFields {
		if id, ok := fi.value.(*ast.Ident); ok && strings.HasPrefix(id.Name, "#") {
			g.topLevel[id.Name] = true
		}
	}

	var body strings.Builder
	body.WriteString("## Top-level structure\n\n")
	body.WriteString("The root of `nhost.toml` is made up of the following sections.\n\n")
	body.WriteString("| Section | Description |\n|---|---|\n")

	for _, fi := range topFields {
		fmt.Fprintf(&body, "| [`%s`](#%s) | %s |\n",
			fi.name, slug(fi.name), cell(resolveDoc(fi.doc, fi.name)))
	}

	body.WriteString("\n")

	for _, fi := range topFields {
		id, ok := fi.value.(*ast.Ident)
		if !ok || !strings.HasPrefix(id.Name, "#") {
			continue
		}

		doc := fi.doc
		if doc == "" {
			doc = docOf(g.defs[id.Name])
		}

		g.renderSection(&body, fi.name, id.Name, 2, fi.optional, doc)
	}

	if len(g.sharedQueue) > 0 {
		body.WriteString("## Shared types\n\n")
		body.WriteString("Types reused across multiple sections above.\n\n")

		// Rendering a shared type can enqueue further referenced types, so the
		// queue grows during iteration. Re-check len each step rather than ranging
		// over a fixed bound, which would drop types enqueued while rendering.
		i := 0
		for i < len(g.sharedQueue) {
			name := g.sharedQueue[i]
			title := strings.TrimPrefix(name, "#")
			g.renderSection(&body, title, name, 3, false, docOf(g.defs[name]))

			i++
		}
	}

	return frontmatter + body.String(), nil
}

const frontmatter = `---
title: Configuration Reference
description: Full reference for the nhost.toml configuration file, generated from the configuration schema.
head:
  - tag: title
    content: "nhost.toml Configuration Reference | Nhost Docs"
  - tag: style
    content: |
      .sl-markdown-content.sl-markdown-content h2:not(.sl-card-title) {
        font-size: 2rem !important;
        line-height: 1.2 !important;
        margin-top: 5rem !important;
        margin-bottom: 1.5rem !important;
      }
      .sl-markdown-content.sl-markdown-content h3:not(.sl-card-title),
      .sl-markdown-content.sl-markdown-content h4:not(.sl-card-title),
      .sl-markdown-content.sl-markdown-content h5:not(.sl-card-title),
      .sl-markdown-content.sl-markdown-content h6:not(.sl-card-title) {
        margin-top: 4rem !important;
      }
      .sl-markdown-content.sl-markdown-content table {
        margin-bottom: 4rem !important;
      }
      .right-sidebar-panel {
        padding-block-end: 5rem !important;
      }
sidebar:
  label: Configuration
---
{/*
  This page is generated from the configuration schema by tools/configdocs.
  Do not edit it by hand; run "pnpm generate" in the docs workspace instead.
*/}

This page documents every field available in your project's ` + "`nhost.toml`" + `, generated
directly from the configuration schema. For task-oriented guidance and copy-paste
examples, see the per-product documentation; this page is the exhaustive field reference.

`

// renderSection renders a single named definition under the given title.
func (g *generator) renderSection(b *strings.Builder, title, defName string, level int, optional bool, doc string) {
	f, ok := g.defs[defName]
	if !ok {
		return
	}

	doc = sanitizeHasura(doc)

	b.WriteString(strings.Repeat("#", level) + " " + title + "\n\n")

	if optional {
		doc = strings.TrimSpace("*Optional.* " + doc)
	}

	if doc != "" {
		b.WriteString(doc + "\n\n")
	}

	st, ok := f.Value.(*ast.StructLit)
	if !ok {
		// Non-struct definitions (disjunctions, aliases) are shown verbatim.
		b.WriteString("```cue\n" + formatExpr(f.Value) + "\n```\n\n")
		return
	}

	g.renderStruct(b, title, st, level)
}

// renderStruct renders the fields of a struct as a table, then recurses into any
// inline struct fields under their own heading (one level deeper than the
// parent) so nested objects read as distinct, well-spaced sub-sections.
func (g *generator) renderStruct(b *strings.Builder, prefix string, st *ast.StructLit, level int) {
	fields, embeds := g.collectFields(st)

	for _, em := range embeds {
		b.WriteString("Includes all fields from " + g.linkToDef(em) + ".\n\n")
	}

	if len(fields) > 0 {
		b.WriteString("| Field | Type | Default | Description |\n|---|---|---|---|\n")

		for _, fi := range fields {
			typeCell, def := g.renderType(fi.value)

			name := fi.name
			if fi.optional {
				name += "?"
			}

			desc := resolveDoc(fi.doc, fi.name)
			if fi.conditional {
				desc = strings.TrimSpace("*(conditional)* " + desc)
			}

			fmt.Fprintf(b, "| `%s` | %s | %s | %s |\n", name, typeCell, def, cell(desc))
		}

		b.WriteString("\n")
	}

	childLevel := min(level+1, 6)

	for _, fi := range fields {
		child, ok := fi.value.(*ast.StructLit)
		if !ok {
			continue
		}

		path := fi.name
		if prefix != "" {
			path = prefix + "." + fi.name
		}

		b.WriteString(strings.Repeat("#", childLevel) + " `" + path + "`\n\n")

		if fi.optional {
			b.WriteString("*Optional.*\n\n")
		}

		g.renderStruct(b, path, child, childLevel)
	}
}

// renderType returns the markdown for a field's type cell and its default value
// (empty if none). The default operand is marked with `*` in CUE and always
// populates the default column. When the disjunction is an enumeration of
// literal values (e.g. "GET" | *"POST"), the default is itself one of the
// allowed values, so it is also listed in the type column; for a broader-typed
// field (e.g. bool | *true) the default is shown only in the default column.
func (g *generator) renderType(expr ast.Expr) (typeCell, def string) {
	operands := splitDisjunction(expr)

	enum := true
	for _, op := range operands {
		v := op
		if u, ok := op.(*ast.UnaryExpr); ok && u.Op == token.MUL {
			v = u.X
		}

		if !isLiteralValue(v) {
			enum = false
			break
		}
	}

	parts := make([]string, 0, len(operands))
	for _, op := range operands {
		if u, ok := op.(*ast.UnaryExpr); ok && u.Op == token.MUL {
			def = "`" + formatExpr(u.X) + "`"
			if enum {
				parts = append(parts, g.typeAtom(u.X))
			}

			continue
		}

		parts = append(parts, g.typeAtom(op))
	}

	parts = dedupeStrings(parts)
	if len(parts) == 0 {
		parts = []string{"`" + formatExpr(expr) + "`"}
	}

	return strings.Join(parts, " \\| "), def
}

// typeAtom renders a single (non-disjunction) type expression, linking to named
// definitions where possible.
func (g *generator) typeAtom(expr ast.Expr) string {
	switch e := expr.(type) {
	case *ast.Ident:
		if strings.HasPrefix(e.Name, "#") {
			return g.linkToDef(e.Name)
		}

		return "`" + e.Name + "`"
	case *ast.StructLit:
		return "object"
	case *ast.ListLit:
		if elem := listElem(e); elem != nil {
			return "list of " + g.typeAtom(elem)
		}

		return "`" + formatExpr(e) + "`"
	case *ast.BinaryExpr:
		// Constraints such as `uint32 & >=1 & <=100`: link the leading type if it
		// is a definition, otherwise fall back to the formatted expression.
		if e.Op == token.AND {
			if id, ok := e.X.(*ast.Ident); ok && strings.HasPrefix(id.Name, "#") {
				return g.linkToDef(id.Name) + " `" + formatExpr(e.Y) + "`"
			}
		}

		return "`" + formatExpr(e) + "`"
	default:
		return "`" + formatExpr(expr) + "`"
	}
}

// linkToDef returns a markdown link to a definition's section, queuing it for the
// shared-types section if it is not a top-level config section.
func (g *generator) linkToDef(name string) string {
	bare := strings.TrimPrefix(name, "#")
	if _, ok := g.defs[name]; !ok {
		// Unknown definition (e.g. a builtin-looking alias not in this file).
		return "`" + name + "`"
	}

	if !g.topLevel[name] && !g.sharedSeen[name] {
		g.sharedSeen[name] = true
		g.sharedQueue = append(g.sharedQueue, name)
	}

	return fmt.Sprintf("[`%s`](#%s)", bare, slug(bare))
}

// collectFields extracts the documented fields of a struct, flattening fields
// declared inside conditional (`if ...`) comprehensions and recording embedded
// definitions. Hidden fields (leading underscore, used for validation) are
// skipped. Fields are de-duplicated by name, preserving first-seen order.
func (g *generator) collectFields(st *ast.StructLit) (fields []fieldInfo, embeds []string) {
	seen := map[string]bool{}

	var walk func(elts []ast.Decl, conditional bool)

	walk = func(elts []ast.Decl, conditional bool) {
		for _, d := range elts {
			switch e := d.(type) {
			case *ast.Field:
				name, isIdent := labelName(e.Label)
				if !isIdent || name == "" || strings.HasPrefix(name, "_") {
					continue
				}

				if strings.HasPrefix(name, "#") {
					continue
				}

				if seen[name] {
					continue
				}

				seen[name] = true
				fields = append(fields, fieldInfo{
					name:        name,
					optional:    e.Constraint == token.OPTION,
					conditional: conditional,
					value:       e.Value,
					doc:         docOf(e),
				})
			case *ast.Comprehension:
				if inner, ok := e.Value.(*ast.StructLit); ok {
					walk(inner.Elts, true)
				}
			case *ast.EmbedDecl:
				if id, ok := e.Expr.(*ast.Ident); ok && strings.HasPrefix(id.Name, "#") {
					embeds = append(embeds, id.Name)
				}
			}
		}
	}

	walk(st.Elts, false)

	return fields, embeds
}

// splitDisjunction flattens a `|` disjunction expression into its operands.
func splitDisjunction(expr ast.Expr) []ast.Expr {
	be, ok := expr.(*ast.BinaryExpr)
	if !ok || be.Op != token.OR {
		return []ast.Expr{expr}
	}

	return append(splitDisjunction(be.X), splitDisjunction(be.Y)...)
}

// isLiteralValue reports whether expr is a concrete value (a string, number, or
// the bool/null keywords) rather than a type. CUE parses all of these as
// *ast.BasicLit, so a disjunction whose operands are all literal values is an
// enumeration whose default is one of the allowed values.
func isLiteralValue(expr ast.Expr) bool {
	_, ok := expr.(*ast.BasicLit)
	return ok
}

// listElem returns the element type of a list written as `[...T]` or `[T]`.
func listElem(l *ast.ListLit) ast.Expr {
	for _, el := range l.Elts {
		if e, ok := el.(*ast.Ellipsis); ok && e.Type != nil {
			return e.Type
		}
	}

	if len(l.Elts) == 1 {
		if _, ok := l.Elts[0].(*ast.Ellipsis); !ok {
			return l.Elts[0]
		}
	}

	return nil
}

func defName(label ast.Label) (string, bool) {
	id, ok := label.(*ast.Ident)
	if !ok {
		return "", false
	}

	if !strings.HasPrefix(id.Name, "#") {
		return "", false
	}

	return id.Name, true
}

func labelName(label ast.Label) (string, bool) {
	switch l := label.(type) {
	case *ast.Ident:
		return l.Name, true
	case *ast.BasicLit:
		return strings.Trim(l.Value, `"`), true
	default:
		return "", false
	}
}

func docOf(n ast.Node) string {
	if n == nil {
		return ""
	}

	var parts []string
	for _, cg := range ast.Comments(n) {
		if cg.Line || cg.Position != 0 {
			continue
		}

		if t := strings.TrimSpace(cg.Text()); t != "" {
			parts = append(parts, t)
		}
	}

	return strings.Join(parts, " ")
}

func formatExpr(expr ast.Expr) string {
	b, err := format.Node(expr)
	if err != nil {
		return ""
	}

	return strings.TrimSpace(string(b))
}

func oneLine(s string) string {
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "|", "\\|")
	// Escape characters MDX would otherwise treat as JSX/expressions.
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "{", "\\{")
	s = strings.ReplaceAll(s, "}", "\\}")

	return strings.TrimSpace(strings.Join(strings.Fields(s), " "))
}

// cell formats a value for a markdown table cell, escaping MDX-sensitive
// characters and substituting "-" for empty values so columns never read blank.
func cell(s string) string {
	s = oneLine(s)
	if s == "" {
		return "-"
	}

	return s
}

// resolveDoc turns a raw schema comment into a human-readable description. It
// strips Hasura doc links; when a field has no comment it falls back to a
// humanized field name so no field is left blank. The mimir schema.cue is the
// single source of truth for these descriptions.
func resolveDoc(raw, name string) string {
	raw = sanitizeHasura(raw)
	if raw != "" {
		return raw
	}

	return humanizeName(name)
}

var camelRe = regexp.MustCompile(`([a-z0-9])([A-Z])`)

// humanizeName converts a camelCase field name into a readable sentence-case
// label, used as a last resort when no curated description exists.
func humanizeName(s string) string {
	s = strings.ToLower(camelRe.ReplaceAllString(s, "$1 $2"))
	if s == "" {
		return ""
	}

	return strings.ToUpper(s[:1]) + s[1:]
}

var hasuraDocRe = regexp.MustCompile(`(?i)\s*(see|reference:?)?\s*https?://[^\s)]*hasura\.io[^\s)]*`)

// sanitizeHasura removes links into Hasura's documentation; the engine config
// names themselves are retained, but we point readers at Nhost docs instead.
func sanitizeHasura(s string) string {
	return strings.TrimSpace(hasuraDocRe.ReplaceAllString(s, ""))
}

func dedupeStrings(in []string) []string {
	seen := map[string]bool{}

	out := in[:0]
	for _, s := range in {
		if seen[s] {
			continue
		}

		seen[s] = true
		out = append(out, s)
	}

	return out
}

// slug mirrors github-slugger (used by Starlight for heading anchors): lowercase,
// drop characters that are not alphanumeric/space/hyphen, spaces to hyphens.
func slug(s string) string {
	s = strings.ToLower(s)

	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-':
			b.WriteRune(r)
		case r == ' ':
			b.WriteRune('-')
		}
	}

	return b.String()
}
