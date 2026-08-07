// Command godoc-md generates Starlight markdown reference pages for the Nhost
// Go SDK. It is the Go analogue of the TypeDoc (nhost-js) and rustdoc
// (nhost-rust) reference generators: it parses each public SDK package with the
// standard library's go/doc and emits one markdown page per package
// (main, auth, storage, graphql, functions, session, fetch, middleware),
// grouping the package's exported functions, types (with their methods),
// constants, and variables with rendered signatures and doc comments.
//
// Usage:
//
//	go run ./tools/godoc-md <sdk-package-dir> <output-dir>
//
// where <sdk-package-dir> is packages/nhost-go.
package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/doc"
	"go/parser"
	"go/printer"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// page maps a package subdirectory to its output file and title. An empty dir
// is the root SDK package (github.com/nhost/nhost/packages/nhost-go).
type page struct {
	dir   string
	file  string
	title string
}

var pages = []page{
	{"", "main", "Main"},
	{"auth", "auth", "Auth"},
	{"storage", "storage", "Storage"},
	{"graphql", "graphql", "Graphql"},
	{"functions", "functions", "Functions"},
	{"session", "session", "Session"},
	{"fetch", "fetch", "Fetch"},
	{"middleware", "middleware", "Middleware"},
}

func main() {
	if len(os.Args) != 3 { //nolint:mnd
		fmt.Fprintln(os.Stderr, "usage: godoc-md <sdk-package-dir> <output-dir>")
		os.Exit(1)
	}

	pkgDir, outDir := os.Args[1], os.Args[2]

	if err := os.MkdirAll(outDir, 0o755); err != nil { //nolint:mnd
		fatal(err)
	}

	for _, p := range pages {
		md, err := renderPackage(filepath.Join(pkgDir, p.dir), p.title)
		if err != nil {
			fatal(fmt.Errorf("rendering %s: %w", p.file, err))
		}

		dest := filepath.Join(outDir, p.file+".md")
		if err := os.WriteFile(dest, []byte(md), 0o644); err != nil { //nolint:mnd
			fatal(err)
		}

		fmt.Println("wrote", dest)
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}

func renderPackage(dir, title string) (string, error) {
	fset := token.NewFileSet()

	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}

	var files []*ast.File

	for _, e := range entries {
		name := e.Name()
		// Document only the public API: skip test files and non-Go files.
		if e.IsDir() || !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}

		f, err := parser.ParseFile(fset, filepath.Join(dir, name), nil, parser.ParseComments)
		if err != nil {
			return "", err
		}

		files = append(files, f)
	}

	if len(files) == 0 {
		return "", fmt.Errorf("no Go files found in %s", dir)
	}

	docPkg, err := doc.NewFromFiles(fset, files, "github.com/nhost/nhost/"+dir, doc.AllDecls)
	if err != nil {
		return "", err
	}

	var b strings.Builder

	fmt.Fprintf(&b, "---\ntitle: %s\n---\n\n", title)

	if docPkg.Doc != "" {
		b.WriteString(prose(docPkg.Doc))
		b.WriteString("\n\n")
	}

	if len(docPkg.Consts) > 0 || len(docPkg.Vars) > 0 {
		b.WriteString("## Constants and Variables\n\n")
		for _, c := range docPkg.Consts {
			writeValue(&b, fset, c)
		}

		for _, v := range docPkg.Vars {
			writeValue(&b, fset, v)
		}
	}

	if len(docPkg.Funcs) > 0 {
		b.WriteString("## Functions\n\n")
		for _, f := range docPkg.Funcs {
			writeFunc(&b, fset, f, 3)
		}
	}

	if len(docPkg.Types) > 0 {
		b.WriteString("## Types\n\n")
		for _, t := range docPkg.Types {
			writeType(&b, fset, t)
		}
	}

	return b.String(), nil
}

// renderDecl pretty-prints an AST declaration node as Go source.
func renderDecl(fset *token.FileSet, node ast.Node) string {
	var buf bytes.Buffer

	cfg := printer.Config{Mode: printer.UseSpaces | printer.TabIndent, Tabwidth: 4} //nolint:mnd
	if err := cfg.Fprint(&buf, fset, node); err != nil {
		return ""
	}

	return buf.String()
}

func codeBlock(src string) string {
	return "```go\n" + strings.TrimSpace(src) + "\n```\n\n"
}

// prose renders a godoc comment as markdown-safe text. godoc comments are plain
// text, so angle brackets (e.g. "<access_token>" placeholders) must be escaped
// or the markdown renderer treats them as raw HTML tags.
func prose(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")

	return s
}

func writeValue(b *strings.Builder, fset *token.FileSet, v *doc.Value) {
	b.WriteString(codeBlock(renderDecl(fset, v.Decl)))

	if v.Doc != "" {
		b.WriteString(prose(v.Doc))
		b.WriteString("\n\n")
	}
}

func writeFunc(b *strings.Builder, fset *token.FileSet, f *doc.Func, depth int) {
	fmt.Fprintf(b, "%s `%s`\n\n", strings.Repeat("#", depth), f.Name)
	// Print just the signature (drop the body) by nil-ing the function body.
	decl := *f.Decl
	decl.Body = nil
	b.WriteString(codeBlock(renderDecl(fset, &decl)))

	if f.Doc != "" {
		b.WriteString(prose(f.Doc))
		b.WriteString("\n\n")
	}
}

func writeType(b *strings.Builder, fset *token.FileSet, t *doc.Type) {
	fmt.Fprintf(b, "### `%s`\n\n", t.Name)
	b.WriteString(codeBlock(renderDecl(fset, t.Decl)))

	if t.Doc != "" {
		b.WriteString(prose(t.Doc))
		b.WriteString("\n\n")
	}

	// Constructors returning the type.
	for _, f := range t.Funcs {
		writeFunc(b, fset, f, 4)
	}

	// Methods on the type.
	for _, m := range t.Methods {
		writeFunc(b, fset, m, 4)
	}
}
