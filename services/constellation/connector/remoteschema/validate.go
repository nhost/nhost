package remoteschema

import (
	"fmt"
	"sort"
	"strings"

	"github.com/nhost/nhost/services/constellation/graph"
)

// RoleValidationFailure records why a single role's permission schema was
// rejected when validated against the upstream remote schema. The connector
// drops the offending role (matching Hasura, which marks the role-based schema
// inconsistent and keeps serving the other roles); the build path surfaces the
// failure as a per-role inconsistency.
type RoleValidationFailure struct {
	Role   string
	Errors []string
}

// upstreamIndex is a name-keyed view over the introspected (admin) remote
// schema, used to check that a role's permission schema only exposes types,
// fields, arguments, enum values and union members that exist upstream — and
// with matching types. Permission SDL is written against the *original* remote
// schema (customization/renaming is applied later by the connector wrapper, not
// here), so a direct name comparison against the introspection result is
// correct.
type upstreamIndex struct {
	objects    map[string]*graph.ObjectType
	interfaces map[string]*graph.InterfaceType
	unions     map[string]*graph.UnionType
	enums      map[string]*graph.EnumType
	inputs     map[string]*graph.InputObjectType
	scalars    map[string]struct{}
}

func newUpstreamIndex(s *graph.Schema) *upstreamIndex {
	idx := &upstreamIndex{
		objects:    make(map[string]*graph.ObjectType, len(s.Types)),
		interfaces: make(map[string]*graph.InterfaceType, len(s.Interfaces)),
		unions:     make(map[string]*graph.UnionType, len(s.Unions)),
		enums:      make(map[string]*graph.EnumType, len(s.Enums)),
		inputs:     make(map[string]*graph.InputObjectType, len(s.Inputs)),
		scalars:    make(map[string]struct{}, len(s.Scalars)),
	}

	for _, t := range s.Types {
		idx.objects[t.Name] = t
	}

	for _, t := range s.Interfaces {
		idx.interfaces[t.Name] = t
	}

	for _, t := range s.Unions {
		idx.unions[t.Name] = t
	}

	for _, t := range s.Enums {
		idx.enums[t.Name] = t
	}

	for _, t := range s.Inputs {
		idx.inputs[t.Name] = t
	}

	for _, t := range s.Scalars {
		idx.scalars[t.Name] = struct{}{}
	}

	return idx
}

// hasType reports whether name resolves to any user-defined or built-in type in
// the upstream schema, regardless of kind.
func (idx *upstreamIndex) hasType(name string) bool {
	if isBuiltinType(name) {
		return true
	}

	if _, ok := idx.objects[name]; ok {
		return true
	}

	if _, ok := idx.interfaces[name]; ok {
		return true
	}

	if _, ok := idx.unions[name]; ok {
		return true
	}

	if _, ok := idx.enums[name]; ok {
		return true
	}

	if _, ok := idx.inputs[name]; ok {
		return true
	}

	_, ok := idx.scalars[name]

	return ok
}

// renderType renders a graph.Type to its GraphQL SDL string (e.g. "[Country!]!")
// so type mismatches can be reported the way Hasura's showGT does.
func renderType(t *graph.Type) string {
	if t == nil {
		return "<nil>"
	}

	if t.Elem != nil {
		out := "[" + renderType(t.Elem) + "]"
		if t.NonNull {
			out += "!"
		}

		return out
	}

	out := t.NamedType
	if t.NonNull {
		out += "!"
	}

	return out
}

// validateRoleAgainstUpstream checks a role's parsed permission schema against
// the upstream (admin) schema and returns one message per violation, mirroring
// Hasura's RoleBasedSchemaValidationError set. An empty slice means the role's
// schema is a valid subset of the upstream remote schema.
//
// gqlparser already rejects most in-SDL violations when parseSDL loads the
// permission schema — duplicate type names, duplicate field names and multiple
// schema definitions all surface there as parse errors (and are recorded as
// per-role failures by buildRoleSchemas). This function performs the checks
// gqlparser cannot or does not: cross-schema existence and type agreement
// against the upstream introspection, plus duplicate field arguments (which
// gqlparser accepts but Hasura rejects).
//
// One deliberate deviation from Hasura: a permission schema with no query root
// is not rejected here. Constellation supports permission SDLs that declare
// only a non-default mutation/subscription root (schema { mutation: ... }), so
// enforcing Hasura's MissingQueryRoot unconditionally would reject a supported
// shape.
func validateRoleAgainstUpstream(role, upstream *graph.Schema) []string {
	idx := newUpstreamIndex(upstream)

	var errs []string

	for _, obj := range role.Types {
		errs = append(errs, validateObject(idx, obj)...)
	}

	for _, iface := range role.Interfaces {
		errs = append(errs, validateInterface(idx, iface)...)
	}

	for _, input := range role.Inputs {
		errs = append(errs, validateInput(idx, input)...)
	}

	for _, enum := range role.Enums {
		errs = append(errs, validateEnum(idx, enum)...)
	}

	for _, union := range role.Unions {
		errs = append(errs, validateUnion(idx, union)...)
	}

	for _, scalar := range role.Scalars {
		if !idx.hasType(scalar.Name) {
			errs = append(errs, typeDoesNotExist("Scalar", scalar.Name))
		}
	}

	sort.Strings(errs)

	return errs
}

func validateObject(idx *upstreamIndex, obj *graph.ObjectType) []string {
	up, ok := idx.objects[obj.Name]
	if !ok {
		return []string{typeDoesNotExist("Object", obj.Name)}
	}

	var errs []string

	errs = append(errs, validateFields("Object", obj.Name, obj.Fields, up.Fields)...)

	// Implemented interfaces must exist upstream and be implemented by the
	// corresponding upstream object.
	upIfaces := make(map[string]struct{}, len(up.Interfaces))
	for _, name := range up.Interfaces {
		upIfaces[name] = struct{}{}
	}

	var missingIfaces []string

	for _, name := range obj.Interfaces {
		if _, ok := upIfaces[name]; !ok {
			missingIfaces = append(missingIfaces, name)
		}
	}

	if len(missingIfaces) > 0 {
		errs = append(errs, fmt.Sprintf(
			"object %q is trying to implement the following interfaces that do not "+
				"exist in the corresponding upstream remote object: %s",
			obj.Name, quoteList(missingIfaces),
		))
	}

	return errs
}

func validateInterface(idx *upstreamIndex, iface *graph.InterfaceType) []string {
	up, ok := idx.interfaces[iface.Name]
	if !ok {
		return []string{typeDoesNotExist("Interface", iface.Name)}
	}

	return validateFields("Interface", iface.Name, iface.Fields, up.Fields)
}

// validateFields checks that every field the role exposes on a parent type
// exists upstream with a matching type, and that each field argument exists
// upstream with a matching type.
func validateFields(
	parentKind, parentName string,
	roleFields, upstreamFields []*graph.Field,
) []string {
	upByName := make(map[string]*graph.Field, len(upstreamFields))
	for _, f := range upstreamFields {
		upByName[f.Name] = f
	}

	var errs []string

	for _, f := range roleFields {
		upField, ok := upByName[f.Name]
		if !ok {
			errs = append(errs, fmt.Sprintf(
				"field %q does not exist in the %s: %q", f.Name, parentKind, parentName,
			))

			continue
		}

		if got, want := renderType(f.Type), renderType(upField.Type); got != want {
			errs = append(errs, fmt.Sprintf(
				"expected type of %q(%q) to be %s but received %s",
				parentName, f.Name, want, got,
			))
		}

		errs = append(errs, duplicateArguments(f)...)
		errs = append(errs, validateArguments(parentName, f, upField)...)
	}

	return errs
}

// duplicateArguments reports arguments declared more than once on a single
// field. gqlparser's schema loader rejects duplicate type, field and enum-value
// names but, unlike Hasura, accepts duplicate argument names, so this check
// closes that gap (Hasura's DuplicateArguments).
func duplicateArguments(field *graph.Field) []string {
	seen := make(map[string]struct{}, len(field.Arguments))

	var dups []string

	for _, a := range field.Arguments {
		if _, ok := seen[a.Name]; ok {
			dups = append(dups, a.Name)

			continue
		}

		seen[a.Name] = struct{}{}
	}

	if len(dups) == 0 {
		return nil
	}

	return []string{fmt.Sprintf(
		"duplicate arguments: %s found in the field: %q", quoteList(dups), field.Name,
	)}
}

func validateArguments(parentName string, roleField, upField *graph.Field) []string {
	upArgs := make(map[string]*graph.Argument, len(upField.Arguments))
	for _, a := range upField.Arguments {
		upArgs[a.Name] = a
	}

	var errs []string

	for _, a := range roleField.Arguments {
		upArg, ok := upArgs[a.Name]
		if !ok {
			errs = append(errs, fmt.Sprintf(
				"argument %q does not exist in the field %q of %q",
				a.Name, roleField.Name, parentName,
			))

			continue
		}

		if got, want := renderType(a.Type), renderType(upArg.Type); got != want {
			errs = append(errs, fmt.Sprintf(
				"expected type of argument %q of field %q to be %s but received %s",
				a.Name, roleField.Name, want, got,
			))
		}
	}

	return errs
}

func validateInput(idx *upstreamIndex, input *graph.InputObjectType) []string {
	up, ok := idx.inputs[input.Name]
	if !ok {
		return []string{typeDoesNotExist("Input Object", input.Name)}
	}

	upByName := make(map[string]*graph.InputField, len(up.Fields))
	for _, f := range up.Fields {
		upByName[f.Name] = f
	}

	var errs []string

	for _, f := range input.Fields {
		upField, ok := upByName[f.Name]
		if !ok {
			errs = append(errs, fmt.Sprintf(
				"input argument %q does not exist in the input object: %q", f.Name, input.Name,
			))

			continue
		}

		if got, want := renderType(f.Type), renderType(upField.Type); got != want {
			errs = append(errs, fmt.Sprintf(
				"expected type of %q(%q) to be %s but received %s",
				input.Name, f.Name, want, got,
			))
		}
	}

	return errs
}

func validateEnum(idx *upstreamIndex, enum *graph.EnumType) []string {
	up, ok := idx.enums[enum.Name]
	if !ok {
		return []string{typeDoesNotExist("Enum", enum.Name)}
	}

	upValues := make(map[string]struct{}, len(up.Values))
	for _, v := range up.Values {
		upValues[v.Name] = struct{}{}
	}

	var missing []string

	for _, v := range enum.Values {
		if _, ok := upValues[v.Name]; !ok {
			missing = append(missing, v.Name)
		}
	}

	if len(missing) == 0 {
		return nil
	}

	return []string{fmt.Sprintf(
		"enum %q contains the following enum values that do not exist in the "+
			"corresponding upstream remote enum: %s",
		enum.Name, quoteList(missing),
	)}
}

func validateUnion(idx *upstreamIndex, union *graph.UnionType) []string {
	up, ok := idx.unions[union.Name]
	if !ok {
		return []string{typeDoesNotExist("Union", union.Name)}
	}

	upMembers := make(map[string]struct{}, len(up.Types))
	for _, m := range up.Types {
		upMembers[m] = struct{}{}
	}

	var missing []string

	for _, m := range union.Types {
		if _, ok := upMembers[m]; !ok {
			missing = append(missing, m)
		}
	}

	if len(missing) == 0 {
		return nil
	}

	return []string{fmt.Sprintf(
		"union %q contains members which do not exist in the members of the "+
			"remote schema union: %s",
		union.Name, quoteList(missing),
	)}
}

func typeDoesNotExist(kind, name string) string {
	return fmt.Sprintf("%s: %q does not exist in the upstream remote schema", kind, name)
}

func quoteList(names []string) string {
	quoted := make([]string, len(names))
	for i, n := range names {
		quoted[i] = fmt.Sprintf("%q", n)
	}

	return strings.Join(quoted, ", ")
}
