// Command godoc-md generates Starlight markdown reference pages for the Nhost
// Go SDK. It is the Go analogue of the TypeDoc (nhost-js) and rustdoc
// (nhost-rust) reference generators: it discovers each public SDK package,
// parses its exported API with the standard library's go/doc, and emits one
// markdown page per package, grouping the package's exported functions, types
// (with their methods), constants, and variables with rendered signatures and
// doc comments.
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
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"unicode"
)

// page maps a package subdirectory to its output file and title. An empty dir
// is the root SDK package (github.com/nhost/nhost/packages/nhost-go).
type page struct {
	dir   string
	file  string
	title string
}

type noGoFilesError struct {
	dir string
}

func (e noGoFilesError) Error() string {
	return "no Go files found in " + e.dir
}

func main() {
	const requiredArgCount = 3

	if len(os.Args) != requiredArgCount {
		fmt.Fprintln(os.Stderr, "usage: godoc-md <sdk-package-dir> <output-dir>")
		os.Exit(1)
	}

	if err := generate(os.Args[1], os.Args[2], os.Stdout); err != nil {
		fatal(err)
	}
}

func generate(pkgDir, outDir string, stdout io.Writer) error {
	const outputDirMode = 0o755

	pages, err := discoverPages(pkgDir)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(outDir, outputDirMode); err != nil {
		return fmt.Errorf("creating output directory %s: %w", outDir, err)
	}

	for _, p := range pages {
		if err := writePage(pkgDir, outDir, p, stdout); err != nil {
			return err
		}
	}

	if err := removeStalePages(outDir, pages); err != nil {
		return err
	}

	return nil
}

func discoverPages(pkgDir string) ([]page, error) {
	entries, err := os.ReadDir(pkgDir)
	if err != nil {
		return nil, fmt.Errorf("reading SDK package directory %s: %w", pkgDir, err)
	}

	pages := []page{{dir: "", file: "main", title: "Main"}}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		dir := filepath.Join(pkgDir, entry.Name())

		hasGoFiles, err := containsGoFiles(dir)
		if err != nil {
			return nil, err
		}

		if !hasGoFiles {
			continue
		}

		name := entry.Name()
		pages = append(pages, page{dir: name, file: name, title: pageTitle(name)})
	}

	slices.SortFunc(pages[1:], func(a, b page) int {
		return strings.Compare(a.dir, b.dir)
	})

	return pages, nil
}

func containsGoFiles(dir string) (bool, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false, fmt.Errorf("reading package directory %s: %w", dir, err)
	}

	if slices.ContainsFunc(entries, isPackageFile) {
		return true, nil
	}

	return false, nil
}

func pageTitle(name string) string {
	runes := []rune(name)
	runes[0] = unicode.ToUpper(runes[0])

	return string(runes)
}

func writePage(pkgDir, outDir string, p page, stdout io.Writer) error {
	const outputFileMode = 0o644

	md, err := renderPackage(filepath.Join(pkgDir, p.dir), p.title)
	if err != nil {
		return fmt.Errorf("rendering %s: %w", p.file, err)
	}

	dest := filepath.Join(outDir, p.file+".md")
	// Generated documentation is intentionally readable by all users.
	if err := os.WriteFile(dest, []byte(md), outputFileMode); err != nil {
		return fmt.Errorf("writing %s: %w", dest, err)
	}

	fmt.Fprintf(stdout, "wrote %s\n", dest)

	return nil
}

func removeStalePages(outDir string, pages []page) error {
	entries, err := os.ReadDir(outDir)
	if err != nil {
		return fmt.Errorf("reading output directory %s: %w", outDir, err)
	}

	expected := make(map[string]struct{}, len(pages))
	for _, p := range pages {
		expected[p.file+".md"] = struct{}{}
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".md" {
			continue
		}

		if _, ok := expected[entry.Name()]; ok {
			continue
		}

		path := filepath.Join(outDir, entry.Name())
		if err := os.Remove(path); err != nil {
			return fmt.Errorf("removing stale page %s: %w", path, err)
		}
	}

	return nil
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}

func renderPackage(dir, title string) (string, error) {
	fset, files, err := parsePackage(dir)
	if err != nil {
		return "", err
	}

	docPkg, err := doc.NewFromFiles(fset, files, filepath.ToSlash(dir))
	if err != nil {
		return "", fmt.Errorf("building docs for %s: %w", dir, err)
	}

	var b strings.Builder

	fmt.Fprintf(&b, "---\ntitle: %s\n---\n\n", title)

	if docPkg.Doc != "" {
		b.WriteString(prose(docPkg.Doc))
		b.WriteString("\n\n")
	}

	writePackageValues(&b, fset, docPkg)
	writePackageFuncs(&b, fset, docPkg)
	writePackageTypes(&b, fset, docPkg)

	return b.String(), nil
}

func parsePackage(dir string) (*token.FileSet, []*ast.File, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, nil, fmt.Errorf("reading package directory %s: %w", dir, err)
	}

	fset := token.NewFileSet()
	files := make([]*ast.File, 0, len(entries))

	for _, entry := range entries {
		if !isPackageFile(entry) {
			continue
		}

		path := filepath.Join(dir, entry.Name())

		file, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
		if err != nil {
			return nil, nil, fmt.Errorf("parsing %s: %w", path, err)
		}

		files = append(files, file)
	}

	if len(files) == 0 {
		return nil, nil, noGoFilesError{dir: dir}
	}

	return fset, files, nil
}

func isPackageFile(entry os.DirEntry) bool {
	name := entry.Name()

	return !entry.IsDir() && strings.HasSuffix(name, ".go") && !strings.HasSuffix(name, "_test.go")
}

func writePackageValues(b *strings.Builder, fset *token.FileSet, pkg *doc.Package) {
	if len(pkg.Consts) == 0 && len(pkg.Vars) == 0 {
		return
	}

	b.WriteString("## Constants and Variables\n\n")
	writeValues(b, fset, pkg.Consts)
	writeValues(b, fset, pkg.Vars)
}

func writePackageFuncs(b *strings.Builder, fset *token.FileSet, pkg *doc.Package) {
	const headingDepth = 3

	if len(pkg.Funcs) == 0 {
		return
	}

	b.WriteString("## Functions\n\n")

	for _, f := range pkg.Funcs {
		writeFunc(b, fset, f, headingDepth)
	}
}

func writePackageTypes(b *strings.Builder, fset *token.FileSet, pkg *doc.Package) {
	if len(pkg.Types) == 0 {
		return
	}

	b.WriteString("## Types\n\n")

	for _, typ := range pkg.Types {
		writeType(b, fset, typ)
	}
}

// renderDecl pretty-prints an AST declaration node as Go source.
func renderDecl(fset *token.FileSet, node ast.Node) string {
	const tabWidth = 4

	var buf bytes.Buffer

	cfg := printer.Config{
		Mode:     printer.UseSpaces | printer.TabIndent,
		Tabwidth: tabWidth,
		Indent:   0,
	}
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

func writeValues(b *strings.Builder, fset *token.FileSet, values []*doc.Value) {
	for _, value := range values {
		writeValue(b, fset, value)
	}
}

func writeValue(b *strings.Builder, fset *token.FileSet, value *doc.Value) {
	b.WriteString(codeBlock(renderDecl(fset, value.Decl)))

	if value.Doc != "" {
		b.WriteString(prose(value.Doc))
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

func writeType(b *strings.Builder, fset *token.FileSet, typ *doc.Type) {
	const memberHeadingDepth = 4

	fmt.Fprintf(b, "### `%s`\n\n", typ.Name)
	b.WriteString(codeBlock(renderDecl(fset, typ.Decl)))

	if typ.Doc != "" {
		b.WriteString(prose(typ.Doc))
		b.WriteString("\n\n")
	}

	writeValues(b, fset, typ.Consts)
	writeValues(b, fset, typ.Vars)

	// Constructors returning the type.
	for _, f := range typ.Funcs {
		writeFunc(b, fset, f, memberHeadingDepth)
	}

	// Methods on the type.
	for _, method := range typ.Methods {
		writeFunc(b, fset, method, memberHeadingDepth)
	}
}
