// Copyright 2020 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package export

import (
	"fmt"
	"math/rand"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/eval"
	"cuelang.org/go/internal/core/walk"
)

const debug = false

type Profile struct {
	Simplify bool

	// Final reports incomplete errors as errors.
	Final bool

	// TakeDefaults is used in Value mode to drop non-default values.
	TakeDefaults bool

	ShowOptional    bool
	ShowDefinitions bool

	// ShowHidden forces the inclusion of hidden fields when these would
	// otherwise be omitted. Only hidden fields from the current package are
	// included.
	ShowHidden     bool
	ShowDocs       bool
	ShowAttributes bool

	// ShowErrors treats errors as values and will not percolate errors up.
	//
	// TODO: convert this option to an error level instead, showing only
	// errors below a certain severity.
	ShowErrors bool

	// Use unevaluated conjuncts for these error types
	// IgnoreRecursive

	// SelfContained exports a schema such that it does not rely on any imports.
	SelfContained bool

	// Fragment disables printing a value as self contained. To successfully
	// parse a fragment, the compiler needs to be given a scope with the value
	// from which the fragment was extracted.
	Fragment bool

	// AddPackage causes a package clause to be added.
	AddPackage bool

	// InlineImports expands references to non-builtin packages.
	InlineImports bool
}

var Simplified = &Profile{
	Simplify: true,
	ShowDocs: true,
}

var Final = &Profile{
	Simplify:     true,
	TakeDefaults: true,
	Final:        true,
}

var Raw = &Profile{
	ShowOptional:    true,
	ShowDefinitions: true,
	ShowHidden:      true,
	ShowDocs:        true,
	AddPackage:      true,
}

var All = &Profile{
	Simplify:        true,
	ShowOptional:    true,
	ShowDefinitions: true,
	ShowHidden:      true,
	ShowDocs:        true,
	ShowAttributes:  true,
	AddPackage:      true,
}

// Concrete

// Def exports v as a definition.
// It resolves references that point outside any of the vertices in v.
func Def(r adt.Runtime, pkgID string, v *adt.Vertex) (*ast.File, errors.Error) {
	return All.Def(r, pkgID, v)
}

// Def exports v as a definition.
// It resolves references that point outside any of the vertices in v.
func (p *Profile) Def(r adt.Runtime, pkgID string, v *adt.Vertex) (f *ast.File, err errors.Error) {
	e := newExporter(p, r, pkgID, v)
	e.initPivot(v)

	isDef := v.IsRecursivelyClosed()
	if isDef {
		e.inDefinition++
	}

	expr := e.expr(nil, v)

	switch isDef {
	case true:
		e.inDefinition--

		// This eliminates the need to wrap in _#def in the most common cases,
		// while ensuring only one level of _#def wrapping is ever used.
		if st, ok := expr.(*ast.StructLit); ok {
			for _, elem := range st.Elts {
				if d, ok := elem.(*ast.EmbedDecl); ok {
					if isDefinitionReference(d.Expr) {
						return e.finalize(v, expr)
					}
				}
			}
		}

		// TODO: embed an empty definition instead once we verify that this
		// preserves semantics.
		if v.Kind() == adt.StructKind && !p.Fragment {
			expr = ast.NewStruct(
				ast.Embed(ast.NewIdent("_#def")),
				ast.NewIdent("_#def"), expr,
			)
		}
	}

	return e.finalize(v, expr)
}

func isDefinitionReference(x ast.Expr) bool {
	switch x := x.(type) {
	case *ast.Ident:
		if internal.IsDef(x.Name) {
			return true
		}
	case *ast.SelectorExpr:
		if internal.IsDefinition(x.Sel) {
			return true
		}
		return isDefinitionReference(x.X)
	case *ast.IndexExpr:
		return isDefinitionReference(x.X)
	}
	return false
}

// Expr exports the given unevaluated expression (schema mode).
// It does not resolve references that point outside the given expression.
func Expr(r adt.Runtime, pkgID string, n adt.Expr) (ast.Expr, errors.Error) {
	return Simplified.Expr(r, pkgID, n)
}

// Expr exports the given unevaluated expression (schema mode).
// It does not resolve references that point outside the given expression.
func (p *Profile) Expr(r adt.Runtime, pkgID string, n adt.Expr) (ast.Expr, errors.Error) {
	e := newExporter(p, r, pkgID, nil)

	return e.expr(nil, n), nil
}

func (e *exporter) toFile(v *adt.Vertex, x ast.Expr) *ast.File {
	f := &ast.File{}

	if e.cfg.AddPackage {
		pkgName := ""
		pkg := &ast.Package{}
		v.VisitLeafConjuncts(func(c adt.Conjunct) bool {
			f, _ := c.Source().(*ast.File)
			if f == nil {
				return true
			}

			if name := f.PackageName(); name != "" {
				pkgName = name
			}

			if e.cfg.ShowDocs {
				if doc := internal.FileComment(f); doc != nil {
					ast.AddComment(pkg, doc)
				}
			}
			return true
		})

		if pkgName != "" {
			pkg.Name = ast.NewIdent(pkgName)
			f.Decls = append(f.Decls, pkg)
		}
	}

	switch st := x.(type) {
	case nil:
		panic("null input")

	case *ast.StructLit:
		f.Decls = append(f.Decls, st.Elts...)

	default:
		f.Decls = append(f.Decls, &ast.EmbedDecl{Expr: x})
	}

	return f
}

// Vertex exports evaluated values (data mode).
// It resolves incomplete references that point outside the current context.
func Vertex(r adt.Runtime, pkgID string, n *adt.Vertex) (*ast.File, errors.Error) {
	return Simplified.Vertex(r, pkgID, n)
}

// Vertex exports evaluated values (data mode).
// It resolves incomplete references that point outside the current context.
func (p *Profile) Vertex(r adt.Runtime, pkgID string, n *adt.Vertex) (f *ast.File, err errors.Error) {
	e := newExporter(p, r, pkgID, n)
	e.initPivot(n)

	v := e.value(n, n.Conjuncts...)
	return e.finalize(n, v)
}

// Value exports evaluated values (data mode).
// It does not resolve references that point outside the given Value.
func Value(r adt.Runtime, pkgID string, n adt.Value) (ast.Expr, errors.Error) {
	return Simplified.Value(r, pkgID, n)
}

// Value exports evaluated values (data mode).
//
// It does not resolve references that point outside the given Value.
//
// TODO: Should take context.
func (p *Profile) Value(r adt.Runtime, pkgID string, n adt.Value) (ast.Expr, errors.Error) {
	e := newExporter(p, r, pkgID, n)
	v := e.value(n)
	return v, e.errs
}

type exporter struct {
	cfg  *Profile // Make value todo
	errs errors.Error

	ctx *adt.OpContext

	index adt.StringIndexer
	rand  *rand.Rand

	// For resolving references.
	stack []frame

	inDefinition int // for close() wrapping.
	inExpression int // for inlining decisions.

	// hidden label handling
	pkgID string
	// pkgHash is used when mangling hidden identifiers of packages that are
	// inlined.
	pkgHash map[string]string

	// If a used feature maps to an expression, it means it is assigned to a
	// unique let expression.
	usedFeature map[adt.Feature]adt.Expr
	labelAlias  map[adt.Expr]adt.Feature
	valueAlias  map[*ast.Alias]*ast.Alias
	// fieldAlias is used to track original alias names of regular fields.
	fieldAlias map[*ast.Field]fieldAndScope
	letAlias   map[*ast.LetClause]*ast.LetClause
	references map[*adt.Vertex]*referenceInfo

	pivotter *pivotter
}

type fieldAndScope struct {
	field *ast.Field
	scope ast.Node // StructLit or File
}

// referenceInfo is used to track which Field.Value fields should be linked
// to Ident.Node fields. The Node field is used by astutil.Resolve to mark
// the value in the AST to which the respective identifier points.
// astutil.Sanitize, in turn, uses this information to determine whether
// a reference is shadowed  and apply fixes accordingly.
type referenceInfo struct {
	field      *ast.Field
	references []*ast.Ident
}

// linkField reports the Field that represents certain Vertex in the generated
// output. The Node fields for any references (*ast.Ident) that were already
// recorded as pointed to this vertex are updated accordingly.
func (e *exporter) linkField(v *adt.Vertex, f *ast.Field) {
	if v == nil {
		return
	}
	refs := e.references[v]
	if refs == nil {
		// TODO(perf): do a first sweep to only mark referenced arcs or keep
		// track of that information elsewhere.
		e.references[v] = &referenceInfo{field: f}
		return
	}
	for _, r := range refs.references {
		r.Node = f.Value
	}
	refs.references = refs.references[:0]
}

// linkIdentifier reports the Vertex to which indent points. Once the ast.Field
// for a corresponding Vertex is known, it is linked to ident.
func (e *exporter) linkIdentifier(v *adt.Vertex, ident *ast.Ident) {
	refs := e.references[v]
	if refs == nil {
		refs = &referenceInfo{}
		e.references[v] = refs
	}
	if refs.field == nil {
		refs.references = append(refs.references, ident)
		return
	}
	ident.Node = refs.field.Value
}

// newExporter creates and initializes an exporter.
func newExporter(p *Profile, r adt.Runtime, pkgID string, v adt.Value) *exporter {
	n, _ := v.(*adt.Vertex)
	e := &exporter{
		cfg:   p,
		ctx:   eval.NewContext(r, n),
		index: r,
		pkgID: pkgID,

		references: map[*adt.Vertex]*referenceInfo{},
	}

	e.markUsedFeatures(v)

	return e
}

// initPivot initializes the pivotter to allow aligning a configuration around
// a new root, if needed.
func (e *exporter) initPivot(n *adt.Vertex) {
	switch {
	case e.cfg.SelfContained, e.cfg.InlineImports:
		// Explicitly enabled.
	case n.Parent == nil, e.cfg.Fragment:
		return
	}
	e.initPivotter(n)
}

// finalize finalizes the result of an export. It is only needed for use cases
// that require conversion to a File, Sanitization, and self containment.
func (e *exporter) finalize(n *adt.Vertex, v ast.Expr) (f *ast.File, err errors.Error) {
	f = e.toFile(n, v)

	e.completePivot(f)

	if err := astutil.Sanitize(f); err != nil {
		err := errors.Promote(err, "export")
		return f, errors.Append(e.errs, err)
	}

	return f, nil
}

func (e *exporter) markUsedFeatures(x adt.Expr) {
	e.usedFeature = make(map[adt.Feature]adt.Expr)

	w := &walk.Visitor{}
	w.Before = func(n adt.Node) bool {
		switch x := n.(type) {
		case *adt.Vertex:
			if !x.IsData() {
				x.VisitLeafConjuncts(func(c adt.Conjunct) bool {
					w.Elem(c.Elem())
					return true
				})
			}

		case *adt.DynamicReference:
			if e.labelAlias == nil {
				e.labelAlias = make(map[adt.Expr]adt.Feature)
			}
			// TODO: add preferred label.
			e.labelAlias[x.Label] = adt.InvalidLabel

		case *adt.LabelReference:
		}
		return true
	}

	w.Feature = func(f adt.Feature, src adt.Node) {
		_, ok := e.usedFeature[f]

		switch x := src.(type) {
		case *adt.LetReference:
			if !ok {
				e.usedFeature[f] = x.X
			}

		default:
			e.usedFeature[f] = nil
		}
	}

	w.Elem(x)
}

func (e *exporter) getFieldAlias(f *ast.Field, name string) string {
	a, ok := f.Label.(*ast.Alias)
	if !ok {
		a = &ast.Alias{
			Ident: ast.NewIdent(e.uniqueAlias(name)),
			Expr:  f.Label.(ast.Expr),
		}
		f.Label = a
	}
	return a.Ident.Name
}

func setFieldAlias(f *ast.Field, name string) {
	if _, ok := f.Label.(*ast.Alias); !ok {
		x := f.Label.(ast.Expr)
		f.Label = &ast.Alias{
			Ident: ast.NewIdent(name),
			Expr:  x,
		}
		ast.SetComments(f.Label, ast.Comments(x))
		ast.SetComments(x, nil)
		// TODO: move position information.
	}
}

func (e *exporter) markLets(n ast.Node, scope *ast.StructLit) {
	if n == nil {
		return
	}
	ast.Walk(n, func(n ast.Node) bool {
		switch v := n.(type) {
		case *ast.StructLit:
			e.markLetDecls(v.Elts, scope)
		case *ast.File:
			e.markLetDecls(v.Decls, scope)
			// TODO: return true here and false for everything else?

		case *ast.Field,
			*ast.LetClause,
			*ast.IfClause,
			*ast.ForClause,
			*ast.Comprehension:
			return false
		}
		return true
	}, nil)
}

func (e *exporter) markLetDecls(decls []ast.Decl, scope *ast.StructLit) {
	for _, d := range decls {
		switch x := d.(type) {
		case *ast.Field:
			e.prepareAliasedField(x, scope)
		case *ast.LetClause:
			e.markLetAlias(x)
		}
	}
}

// prepareAliasField creates an aliased ast.Field. It is done so before
// recursively processing any of the fields so that a processed field that
// occurs earlier in a struct can already refer to it.
//
// It is assumed that the same alias names can be used. We rely on Sanitize
// to do any renaming of aliases in case of shadowing.
func (e *exporter) prepareAliasedField(f *ast.Field, scope ast.Node) {
	if _, ok := e.fieldAlias[f]; ok {
		return
	}

	alias, ok := f.Label.(*ast.Alias)
	if !ok {
		return // not aliased
	}
	field := &ast.Field{
		Label: &ast.Alias{
			Ident: ast.NewIdent(alias.Ident.Name),
			Expr:  alias.Expr,
		},
	}

	if e.fieldAlias == nil {
		e.fieldAlias = make(map[*ast.Field]fieldAndScope)
	}

	e.fieldAlias[f] = fieldAndScope{field: field, scope: scope}
}

func (e *exporter) getFixedField(f *adt.Field) *ast.Field {
	if f.Src != nil {
		if entry, ok := e.fieldAlias[f.Src]; ok {
			return entry.field
		}
	}
	return &ast.Field{
		Label: e.stringLabel(f.Label),
	}
}

// markLetAlias inserts an uninitialized let clause into the current scope.
// It gets initialized upon first usage.
func (e *exporter) markLetAlias(x *ast.LetClause) {
	// The created let clause is initialized upon first usage, and removed
	// later if never referenced.
	let := &ast.LetClause{}

	if e.letAlias == nil {
		e.letAlias = make(map[*ast.LetClause]*ast.LetClause)
	}
	e.letAlias[x] = let

	scope := e.top().scope
	scope.Elts = append(scope.Elts, let)
}

// In value mode, lets are only used if there wasn't an error.
func filterUnusedLets(s *ast.StructLit) {
	k := 0
	for i, d := range s.Elts {
		if let, ok := d.(*ast.LetClause); ok && let.Expr == nil {
			continue
		}
		s.Elts[k] = s.Elts[i]
		k++
	}
	s.Elts = s.Elts[:k]
}

// resolveLet actually parses the let expression.
// If there was no recorded let expression, it expands the expression in place.
func (e *exporter) resolveLet(env *adt.Environment, x *adt.LetReference) ast.Expr {
	letClause, _ := x.Src.Node.(*ast.LetClause)
	let := e.letAlias[letClause]

	switch {
	case let == nil:
		ref, _ := e.ctx.Lookup(env, x)
		if ref == nil {
			// This can happen if x.X does not resolve to a valid value. At this
			// point we will not get a valid configuration.

			// TODO: get rid of the use of x.X.
			// str := x.Label.IdentString(e.ctx)
			// ident := ast.NewIdent(str)
			// return ident

			return e.expr(env, x.X)
		}
		c, _ := ref.SingleConjunct()
		return e.expr(c.EnvExpr())

	case let.Expr == nil:
		label := e.uniqueLetIdent(x.Label, x.X)

		let.Ident = e.ident(label)
		let.Expr = e.expr(env, x.X)
	}

	ident := ast.NewIdent(let.Ident.Name)
	ident.Node = let
	// TODO: set scope?
	return ident
}

func (e *exporter) uniqueLetIdent(f adt.Feature, x adt.Expr) adt.Feature {
	if e.usedFeature[f] == x {
		return f
	}

	f, _ = e.uniqueFeature(f.IdentString(e.ctx))
	e.usedFeature[f] = x
	return f
}

func (e *exporter) uniqueAlias(name string) string {
	f := adt.MakeIdentLabel(e.ctx, name, "")

	if _, ok := e.usedFeature[f]; !ok {
		e.usedFeature[f] = nil
		return name
	}

	_, name = e.uniqueFeature(f.IdentString(e.ctx))
	return name
}

// A featureSet implements a set of Features. It only supports testing
// whether a given string is available as a Feature.
type featureSet interface {
	// intn returns a pseudo-random integer in [0..n).
	intn(n int) int

	// makeFeature converts s to f if it is available.
	makeFeature(s string) (f adt.Feature, ok bool)
}

func (e *exporter) intn(n int) int {
	return e.rand.Intn(n)
}

func (e *exporter) makeFeature(s string) (f adt.Feature, ok bool) {
	f = adt.MakeIdentLabel(e.ctx, s, "")
	_, exists := e.usedFeature[f]
	if !exists {
		e.usedFeature[f] = nil
	}
	return f, !exists
}

// uniqueFeature returns a name for an identifier that uniquely identifies
// the given expression. If the preferred name is already taken, a new globally
// unique name of the form base_N ... base_NNNNNNNNNNNNNN is generated.
//
// It prefers short extensions over large ones, while ensuring the likelihood of
// fast termination is high. There are at least two digits to make it visually
// clearer this concerns a generated number.
func (e *exporter) uniqueFeature(base string) (f adt.Feature, name string) {
	if e.rand == nil {
		e.rand = rand.New(rand.NewSource(808))
	}
	return findUnique(e, base)
}

func findUnique(set featureSet, base string) (f adt.Feature, name string) {
	if f, ok := set.makeFeature(base); ok {
		return f, base
	}

	// Try the first few numbers in sequence.
	for i := 1; i < 5; i++ {
		name := fmt.Sprintf("%s_%01X", base, i)
		if f, ok := set.makeFeature(name); ok {
			return f, name
		}
	}

	const mask = 0xff_ffff_ffff_ffff // max bits; stay clear of int64 overflow
	const shift = 4                  // rate of growth
	digits := 1
	for n := int64(0x10); ; n = int64(mask&((n<<shift)-1)) + 1 {
		num := set.intn(int(n)-1) + 1
		name := fmt.Sprintf("%[1]s_%0[2]*[3]X", base, digits, num)
		if f, ok := set.makeFeature(name); ok {
			return f, name
		}
		digits++
	}
}

type frame struct {
	node *adt.Vertex

	scope *ast.StructLit

	docSources []adt.Conjunct

	// For resolving pattern constraints  fields labels
	field     *ast.Field
	labelExpr ast.Expr

	dynamicFields []*entry

	// for off-by-one handling
	upCount int32

	// labeled fields
	fields map[adt.Feature]entry

	// field to new field
	mapped map[adt.Node]ast.Node
}

type entry struct {
	alias      string
	field      *ast.Field
	node       ast.Node // How to reference. See astutil.Resolve
	references []*ast.Ident
}

func (e *exporter) addField(label adt.Feature, f *ast.Field, n ast.Node) {
	frame := e.top()
	entry := frame.fields[label]
	entry.field = f
	entry.node = n
	frame.fields[label] = entry
}

func (e *exporter) addEmbed(x ast.Expr) {
	frame := e.top()
	frame.scope.Elts = append(frame.scope.Elts, x)
}

func (e *exporter) pushFrame(src *adt.Vertex, conjuncts []adt.Conjunct) (s *ast.StructLit, saved []frame) {
	saved = e.stack
	s = &ast.StructLit{}
	e.stack = append(e.stack, frame{
		node:       src,
		scope:      s,
		mapped:     map[adt.Node]ast.Node{},
		fields:     map[adt.Feature]entry{},
		docSources: conjuncts,
	})
	return s, saved
}

func (e *exporter) popFrame(saved []frame) {
	top := e.stack[len(e.stack)-1]

	for _, f := range top.fields {
		node := f.node
		if f.alias != "" && f.field != nil {
			setFieldAlias(f.field, f.alias)
			node = f.field
		}
		if node != nil {
			for _, r := range f.references {
				r.Node = node
			}
		}
	}

	e.stack = saved
}

func (e *exporter) top() *frame {
	return &(e.stack[len(e.stack)-1])
}

func (e *exporter) node() *adt.Vertex {
	if len(e.stack) == 0 {
		return empty
	}
	n := e.stack[len(e.stack)-1].node
	if n == nil {
		return empty
	}
	return n
}

func (e *exporter) frame(upCount int32) *frame {
	for i := len(e.stack) - 1; i >= 0; i-- {
		f := &(e.stack[i])
		if upCount <= (f.upCount - 1) {
			return f
		}
		upCount -= f.upCount
	}
	if debug {
		// This may be valid when exporting incomplete references. These are
		// not yet handled though, so find a way to catch them when debugging
		// printing of values that are supposed to be complete.
		panic("unreachable reference")
	}

	return &frame{}
}

func (e *exporter) setDocs(x adt.Node) {
	f := e.stack[len(e.stack)-1]
	f.docSources = []adt.Conjunct{adt.MakeRootConjunct(nil, x)}
	e.stack[len(e.stack)-1] = f
}
