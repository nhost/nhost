// Package customization applies Hasura-style GraphQL schema customization
// (root-field namespacing, root-field prefix/suffix, type renaming and
// per-type field renaming) to a connector's schema, and reverses it on the
// execution path.
//
// The package is deliberately connector-agnostic: it operates only on
// graph.Schema and gqlparser operation/response values, driven by a normalized
// metadata.Customization. This lets a single decorator (see Wrap) apply the
// same transform to any connector — SQL, SQLite, in-memory, or remote schema.
//
// The transform has three directions, all derived from one metadata.Customization:
//
//   - Apply rewrites a connector's schema (forward): rename types, rename root
//     fields, and optionally wrap all root fields under a namespace field. Used
//     when GetSchema is composed into the role schema.
//   - ReverseOperation rewrites an incoming operation (inverse) from customized
//     names back to the connector's native names before execution.
//   - ForwardResult rewrites the connector's response (forward) back into
//     customized shape: re-wrapping the namespace and re-mapping __typename.
package customization

import (
	"strings"

	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// builtinScalars are the GraphQL spec scalars that must never be renamed when
// they appear as type references. Custom scalars defined by the connector are
// renamed like any other type; these five are not.
//
//nolint:gochecknoglobals // immutable lookup set
var builtinScalars = map[string]struct{}{
	"String":  {},
	"Int":     {},
	"Float":   {},
	"Boolean": {},
	"ID":      {},
}

// renamer holds the precomputed renaming rules and the set of type names the
// schema actually owns, so type references to builtin scalars are left intact
// while references to the connector's own types are renamed consistently.
type renamer struct {
	cfg        metadata.Customization
	flavor     Flavor
	owned      map[string]struct{}
	fieldRules map[string]metadata.FieldNameCustomization // parent type -> rule
	// noRename holds names that must not be renamed even though the schema
	// owns them. For database sources Hasura leaves scalars, the order_by
	// enum, and scalar comparison-expression inputs uncustomized so they
	// dedup across sources; we mirror that to keep the merged schema and the
	// Hasura diff aligned.
	noRename map[string]struct{}
	// createdWrappers holds the final names of namespace-wrapper types created
	// in rewriteRoots, so rewriteDefinitionNames knows not to rename them again
	// (they are minted already in final form).
	createdWrappers map[string]struct{}
}

func newRenamer(s *graph.Schema, cfg metadata.Customization, flavor Flavor) *renamer {
	owned := make(map[string]struct{})

	addOwned := func(name string) { owned[name] = struct{}{} }

	for _, t := range s.Types {
		addOwned(t.Name)
	}

	for _, t := range s.Scalars {
		addOwned(t.Name)
	}

	for _, t := range s.Enums {
		addOwned(t.Name)
	}

	for _, t := range s.Interfaces {
		addOwned(t.Name)
	}

	for _, t := range s.Unions {
		addOwned(t.Name)
	}

	for _, t := range s.Inputs {
		addOwned(t.Name)
	}

	fieldRules := make(map[string]metadata.FieldNameCustomization, len(cfg.FieldNames))
	for _, fn := range cfg.FieldNames {
		fieldRules[fn.ParentType] = fn
	}

	return &renamer{
		cfg:             cfg,
		flavor:          flavor,
		owned:           owned,
		fieldRules:      fieldRules,
		noRename:        sharedTypeNames(s, flavor),
		createdWrappers: make(map[string]struct{}),
	}
}

// sharedTypeNames returns the type names a database source shares with other
// sources and therefore leaves uncustomized, matching Hasura: every scalar,
// the order_by enum, and every scalar comparison-expression input
// (*_comparison_exp). Other flavors return an empty set.
func sharedTypeNames(s *graph.Schema, flavor Flavor) map[string]struct{} {
	shared := make(map[string]struct{})

	if flavor != FlavorDatabase {
		return shared
	}

	for _, sc := range s.Scalars {
		shared[sc.Name] = struct{}{}
	}

	for _, e := range s.Enums {
		if e.Name == "order_by" {
			shared[e.Name] = struct{}{}
		}
	}

	for _, in := range s.Inputs {
		if strings.HasSuffix(in.Name, "_comparison_exp") {
			shared[in.Name] = struct{}{}
		}
	}

	return shared
}

// typeName renames a type definition's own name. Mapping wins over
// prefix/suffix. Names in noRename (shared types under the database flavor)
// are returned unchanged.
func (r *renamer) typeName(name string) string {
	if _, ok := r.noRename[name]; ok {
		return name
	}

	if mapped, ok := r.cfg.TypeNamesMapping[name]; ok {
		return mapped
	}

	return r.cfg.TypeNamesPrefix + name + r.cfg.TypeNamesSuffix
}

// typeRef renames a type reference, leaving builtin scalars and any name the
// schema does not own (defensive) untouched.
func (r *renamer) typeRef(name string) string {
	if _, ok := builtinScalars[name]; ok {
		return name
	}

	if _, ok := r.owned[name]; !ok {
		return name
	}

	return r.typeName(name)
}

// renameTypeReference walks a (possibly list/non-null) type and renames its
// base named type in place.
func (r *renamer) renameTypeReference(t *graph.Type) {
	for t != nil {
		if t.Elem == nil {
			t.NamedType = r.typeRef(t.NamedType)

			return
		}

		t = t.Elem
	}
}

// fieldName renames a field on parentType (the field's original parent type
// name). isRoot adds the root-field prefix/suffix on top of any field_names
// rule, mirroring how a database namespace prefixes the wrapped root fields.
func (r *renamer) fieldName(parentType, name string, isRoot bool) string {
	out := name

	if rule, ok := r.fieldRules[parentType]; ok {
		if mapped, ok := rule.Mapping[name]; ok {
			out = mapped
		} else {
			out = rule.Prefix + name + rule.Suffix
		}
	}

	if isRoot {
		out = r.cfg.RootFieldsPrefix + out + r.cfg.RootFieldsSuffix
	}

	return out
}

// Flavor selects the source-specific naming Hasura applies to the namespace
// wrapper type. Database sources and remote schemas diverge here (see
// wrapperTypeName), so the connector layer — which knows which kind it is
// wrapping — passes the right flavor to New.
type Flavor int

const (
	// FlavorRemoteSchema names namespace wrappers like Hasura's remote-schema
	// customization: <namespace>Query / <namespace>Mutation /
	// <namespace>Subscription, with the type prefix/suffix NOT applied.
	FlavorRemoteSchema Flavor = iota
	// FlavorDatabase names namespace wrappers like Hasura's database
	// source customization: <namespace>_query / <namespace>_mutation_frontend
	// / <namespace>_subscription, with the type prefix/suffix applied on top.
	FlavorDatabase
)

// Customizer applies a customization to a connector's schemas (Apply) and
// reverses it on the execution path (ReverseOperation, ForwardResult). Apply
// records the type-name maps the reverse direction needs, so the same
// Customizer instance must drive both directions for one connector — that is
// what keeps the forward and inverse transforms in lockstep.
type Customizer struct {
	cfg    metadata.Customization
	flavor Flavor
	// typeForward maps a native type name to its customized name;
	// typeInverse is the reverse. Both are populated by Apply across every
	// role schema, excluding root operation types (which are never renamed).
	typeForward map[string]string
	typeInverse map[string]string
	// wrapperTypes holds the customized names of the namespace-wrapper types
	// minted in rewriteRoots (e.g. "league_subscription"). A named fragment
	// whose type condition is a wrapper type carries root fields, so the
	// reverse direction must treat such a fragment as root and strip the
	// root-field prefix/suffix from its selections. Populated by Apply.
	wrapperTypes map[string]struct{}
}

// New returns a Customizer for cfg with the given source flavor. The returned
// value must be reused for both Apply and the reverse-direction calls.
func New(cfg metadata.Customization, flavor Flavor) *Customizer {
	return &Customizer{
		cfg:          cfg,
		flavor:       flavor,
		typeForward:  make(map[string]string),
		typeInverse:  make(map[string]string),
		wrapperTypes: make(map[string]struct{}),
	}
}

// enabled reports whether the customization changes anything.
func (c *Customizer) enabled() bool {
	return !c.cfg.IsZero()
}

// Apply rewrites s in place to its customized form and returns it. The zero
// customization is a no-op. Type definitions and every reference to them are
// renamed consistently; root fields are renamed and, when a namespace is set,
// moved under a single namespace field on each root operation type.
//
// The merge step (schemamerge) later flattens each root operation type's
// fields onto query_root/mutation_root/subscription_root, so the root type's
// own name is irrelevant downstream — only its fields matter. The namespace
// wrapper type, by contrast, is a regular type that survives into the final
// schema, so its name must match what Hasura emits (see wrapperTypeName).
func (c *Customizer) Apply(s *graph.Schema) *graph.Schema {
	if c.cfg.IsZero() {
		return s
	}

	// Work on a private copy: connectors hand out shared schema pointers and
	// the passes below mutate names in place.
	s = cloneSchema(s)

	r := newRenamer(s, c.cfg, c.flavor)

	rootNames := rootTypeNames(s)

	c.recordTypeMaps(r, rootNames)

	// Pass A: rename every type reference, and rename field names on
	// non-root object/interface types. Root types are deferred to pass B
	// because their fields may be relocated under the namespace wrapper.
	r.rewriteReferencesAndFieldNames(s, rootNames)

	// Pass B: rename root fields and, if configured, wrap them under a
	// namespace field. Operates on original root type names.
	r.rewriteRoots(s)

	// Record the wrapper type names rewriteRoots minted so the reverse
	// direction can recognise a named fragment written on a wrapper type as
	// carrying root fields.
	for wrapper := range r.createdWrappers {
		c.wrapperTypes[wrapper] = struct{}{}
	}

	// Pass C: rename every non-root type definition name. Root operation
	// types are left untouched: schemamerge flattens their fields onto
	// query_root/mutation_root/subscription_root, so their names never reach
	// the final schema, and renaming them would collide with the namespace
	// wrapper (which Apply mints from the root type name).
	r.rewriteDefinitionNames(s, rootNames)

	return s
}

// recordTypeMaps records the native<->customized type-name mapping for every
// renamable (non-root, non-builtin) type the schema owns, so the execution
// path can reverse type conditions and re-map __typename values.
func (c *Customizer) recordTypeMaps(r *renamer, rootNames map[string]struct{}) {
	for name := range r.owned {
		if _, isRoot := rootNames[name]; isRoot {
			continue
		}

		customized := r.typeName(name)
		c.typeForward[name] = customized
		c.typeInverse[customized] = name
	}
}

func rootTypeNames(s *graph.Schema) map[string]struct{} {
	names := make(map[string]struct{}, 3) //nolint:mnd
	for _, p := range []*string{s.QueryType, s.MutationType, s.SubscriptionType} {
		if p != nil {
			names[*p] = struct{}{}
		}
	}

	return names
}

func (r *renamer) rewriteReferencesAndFieldNames(
	s *graph.Schema,
	rootNames map[string]struct{},
) {
	for _, obj := range s.Types {
		_, isRoot := rootNames[obj.Name]

		for _, f := range obj.Fields {
			r.renameTypeReference(f.Type)

			for _, a := range f.Arguments {
				r.renameTypeReference(a.Type)
			}

			if !isRoot {
				f.Name = r.fieldName(obj.Name, f.Name, false)
			}
		}

		for i, iface := range obj.Interfaces {
			obj.Interfaces[i] = r.typeRef(iface)
		}
	}

	for _, iface := range s.Interfaces {
		for _, f := range iface.Fields {
			r.renameTypeReference(f.Type)

			for _, a := range f.Arguments {
				r.renameTypeReference(a.Type)
			}

			f.Name = r.fieldName(iface.Name, f.Name, false)
		}

		for i, parent := range iface.Interfaces {
			iface.Interfaces[i] = r.typeRef(parent)
		}
	}

	for _, in := range s.Inputs {
		for _, f := range in.Fields {
			r.renameTypeReference(f.Type)
		}
	}

	for _, u := range s.Unions {
		for i, member := range u.Types {
			u.Types[i] = r.typeRef(member)
		}
	}
}

// rewriteRoots renames root fields and, when a namespace is configured, moves
// each root operation type's fields under a single namespace field. It is
// driven by the root pointers (not the type names) so the wrapper can be named
// after the operation kind — Query/Mutation/Subscription — which is what
// Hasura keys the wrapper name on (see wrapperTypeName).
func (r *renamer) rewriteRoots(s *graph.Schema) {
	roots := []struct {
		kind string
		name *string
	}{
		{kind: "Query", name: s.QueryType},
		{kind: "Mutation", name: s.MutationType},
		{kind: "Subscription", name: s.SubscriptionType},
	}

	for _, root := range roots {
		if root.name == nil {
			continue
		}

		obj := findObjectType(s, *root.name)
		if obj == nil {
			continue
		}

		for _, f := range obj.Fields {
			f.Name = r.fieldName(*root.name, f.Name, true)
		}

		if r.cfg.RootFieldsNamespace == "" {
			continue
		}

		wrapperName := r.wrapperTypeName(root.kind)
		r.createdWrappers[wrapperName] = struct{}{}

		s.Types = append(s.Types, &graph.ObjectType{
			Name:        wrapperName,
			Description: "",
			Fields:      obj.Fields,
			Interfaces:  nil,
			Directives:  nil,
		})

		// The namespace field is nullable, matching Hasura: `league: leagueQuery`.
		obj.Fields = []*graph.Field{
			{
				Name:        r.cfg.RootFieldsNamespace,
				Description: "",
				Type:        graph.NewNamedType(wrapperName),
				Arguments:   nil,
				Directives:  nil,
			},
		}
	}
}

func findObjectType(s *graph.Schema, name string) *graph.ObjectType {
	for _, obj := range s.Types {
		if obj.Name == name {
			return obj
		}
	}

	return nil
}

func (r *renamer) rewriteDefinitionNames(s *graph.Schema, rootNames map[string]struct{}) {
	for _, obj := range s.Types {
		if _, isRoot := rootNames[obj.Name]; isRoot {
			continue
		}

		if _, isWrapper := r.createdWrappers[obj.Name]; !isWrapper {
			obj.Name = r.typeName(obj.Name)
		}
	}

	for _, t := range s.Scalars {
		t.Name = r.typeName(t.Name)
	}

	for _, t := range s.Enums {
		t.Name = r.typeName(t.Name)
	}

	for _, t := range s.Interfaces {
		t.Name = r.typeName(t.Name)
	}

	for _, t := range s.Unions {
		t.Name = r.typeName(t.Name)
	}

	for _, t := range s.Inputs {
		t.Name = r.typeName(t.Name)
	}
}
