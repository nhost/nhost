package openapi3

import (
	"encoding/json"
	"reflect"
	"slices"
	"strings"

	"github.com/oasdiff/yaml"
)

var originPtrType = reflect.TypeFor[*Origin]()

// Origin contains the origin of a collection.
// Key is the location of the collection itself.
// Fields holds the location of each scalar field in the collection.
// Sequences is a map of the location of each item in sequence-valued fields.
//
// Sequences stays a map although Fields is a slice, which is deliberate.
// FieldLocations drops the map because Location.Name already carries the key,
// so the map was storing information the value repeated. Here Location.Name
// holds the *item's* value (an enum member, a required property) while the key
// is the *field's* name ("enum", "required", "tags"), so a slice would need a
// wrapper type invented to hold it. The memory argument is also much weaker:
// only a collection with a sequence-valued field allocates one at all, which
// measured at 5% of collections on a large spec, and a nil map is free.
type Origin struct {
	Key       *Location             `json:"key,omitempty" yaml:"key,omitempty"`
	Fields    FieldLocations        `json:"fields,omitempty" yaml:"fields,omitempty"`
	Sequences map[string][]Location `json:"sequences,omitempty" yaml:"sequences,omitempty"`
}

// FieldLocations holds the locations of a collection's scalar fields, in the
// order they appear in the document.
//
// It is a slice rather than a map[string]Location because a collection carries
// only a handful of fields, while a Go map allocates a whole bucket per
// collection whatever it holds. On a large document that overhead dominated
// the retained size of a parsed spec. Each Location already carries its Name,
// so the lookup key costs nothing extra here.
type FieldLocations []Location

// Get returns the location of the named field, or the zero Location when the
// field has none. Use Lookup to tell an absent field from a zero location.
func (f FieldLocations) Get(name string) Location {
	loc, _ := f.Lookup(name)
	return loc
}

// Lookup returns the location of the named field and whether it was found.
// The scan is linear: collections have few fields, and a linear scan over a
// contiguous slice beats a map lookup at these sizes.
//
// Deliberately a hand-written loop rather than slices.IndexFunc: the closure
// does not inline, so IndexFunc pays a call per element. Measured on 3/6/12
// fields it is 5-100% slower on a hit and 2-3x slower on a miss, and misses
// are the common case here (most fields carry no recorded location).
func (f FieldLocations) Lookup(name string) (Location, bool) {
	for i := range f {
		if f[i].Name == name {
			return f[i], true
		}
	}
	return Location{}, false
}

// MarshalJSON keeps the serialized shape a name-keyed object, as it was when
// this was a map, so the change is invisible to anything reading the output.
func (f FieldLocations) MarshalJSON() ([]byte, error) {
	m := make(map[string]Location, len(f))
	for _, loc := range f {
		m[loc.Name] = loc
	}
	return json.Marshal(m)
}

// UnmarshalJSON reads the name-keyed object written by MarshalJSON. Entries are
// sorted by name, since a JSON object carries no order to restore.
func (f *FieldLocations) UnmarshalJSON(data []byte) error {
	var m map[string]Location
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	out := make(FieldLocations, 0, len(m))
	for name, loc := range m {
		if loc.Name == "" {
			loc.Name = name
		}
		out = append(out, loc)
	}
	slices.SortFunc(out, func(a, b Location) int { return strings.Compare(a.Name, b.Name) })
	*f = out
	return nil
}

// Location is a struct that contains the location of a field.
type Location struct {
	File   string `json:"file,omitempty" yaml:"file,omitempty"`
	Line   int    `json:"line,omitempty" yaml:"line,omitempty"`
	Column int    `json:"column,omitempty" yaml:"column,omitempty"`
	Name   string `json:"name,omitempty" yaml:"name,omitempty"`

	// EndLine and EndColumn mark the end of the block this location heads (set
	// only on Origin.Key). For an operation or schema this spans the whole
	// block, so a consumer can extract the entire element from its source.
	// Both are zero when the underlying YAML carried no end information.
	EndLine   int `json:"endLine,omitempty" yaml:"endLine,omitempty"`
	EndColumn int `json:"endColumn,omitempty" yaml:"endColumn,omitempty"`
}

// originFromSeq parses the compact []any sequence produced by yaml3's addOrigin.
//
// Format: [file, key_name, key_line, key_col, nf, f1_name, f1_delta, f1_col, ..., ns, s1_name, s1_count, s1_l0_delta, s1_c0, ...]
func originFromSeq(s []any) *Origin {
	// Need at least: file, key_name, key_line, key_col, nf, ns
	if len(s) < 6 {
		return nil
	}
	file, _ := s[0].(string)
	keyName, _ := s[1].(string)
	keyLine := toInt(s[2])
	keyCol := toInt(s[3])

	o := &Origin{
		Key: &Location{
			File:   file,
			Line:   keyLine,
			Column: keyCol,
			Name:   keyName,
		},
	}

	idx := 4
	nf := toInt(s[idx])
	idx++
	if nf > 0 && idx+nf*3 <= len(s) {
		o.Fields = make(FieldLocations, 0, nf)
		for range nf {
			fname, _ := s[idx].(string)
			delta := toInt(s[idx+1])
			col := toInt(s[idx+2])
			o.Fields = append(o.Fields, Location{
				File:   file,
				Line:   keyLine + delta,
				Column: col,
				Name:   fname,
			})
			idx += 3
		}
	}

	if idx >= len(s) {
		return o
	}
	ns := toInt(s[idx])
	idx++
	if ns > 0 {
		o.Sequences = make(map[string][]Location, ns)
		for range ns {
			if idx >= len(s) {
				break
			}
			sname, _ := s[idx].(string)
			idx++
			if idx >= len(s) {
				break
			}
			count := toInt(s[idx])
			idx++
			locs := make([]Location, 0, count)
			for j := 0; j < count && idx+2 < len(s); j++ {
				name, _ := s[idx].(string)
				delta := toInt(s[idx+1])
				col := toInt(s[idx+2])
				locs = append(locs, Location{File: file, Line: keyLine + delta, Column: col, Name: name})
				idx += 3
			}
			o.Sequences[sname] = locs
		}
	}

	// Trailing block end (yaml3 >= the end-position release): end_delta, end_col.
	// Reconstruct the end of the whole block on Origin.Key so a consumer can
	// extract the entire element. Older origin sequences omit these, leaving
	// EndLine/EndColumn zero. end_col == 0 means no end information was recorded.
	if o.Key != nil && idx+1 < len(s) {
		if endCol := toInt(s[idx+1]); endCol > 0 {
			o.Key.EndLine = keyLine + toInt(s[idx])
			o.Key.EndColumn = endCol
		}
	}
	return o
}

// toInt converts numeric types to int. Handles int/uint64 from YAML decoding.
func toInt(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case uint64:
		return int(n)
	}
	return 0
}

// isScalarValuedMapField reports whether v is a non-empty map whose element
// type is a scalar (string, bool, or a numeric kind). Such a map decodes
// without an Origin field of its own, unlike a pointer- or struct-valued map
// whose elements each carry their own Origin.
func isScalarValuedMapField(v reflect.Value) bool {
	if v.Kind() != reflect.Map || v.IsNil() || v.Len() == 0 {
		return false
	}
	switch v.Type().Elem().Kind() {
	case reflect.String, reflect.Bool,
		reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64:
		return true
	}
	return false
}

// recordMapKeyLocations moves the map-key locations from a scalar-valued map's
// own subtree onto parentOrigin.Sequences[field], so each key is addressable by
// name (the same shape used for sequence items). It is a no-op when the child
// carries no origin data. Keys are sorted for deterministic output.
//
// childOrigin is discarded here, and nothing else holds its Fields, so the
// slice is sorted and handed over in place rather than copied.
func recordMapKeyLocations(parentOrigin *Origin, field string, childTree *yaml.OriginTree) {
	s, ok := childTree.Origin.([]any)
	if !ok {
		return
	}
	childOrigin := originFromSeq(s)
	if childOrigin == nil || len(childOrigin.Fields) == 0 {
		return
	}
	locs := childOrigin.Fields
	slices.SortFunc(locs, func(a, b Location) int { return strings.Compare(a.Name, b.Name) })
	if parentOrigin.Sequences == nil {
		parentOrigin.Sequences = make(map[string][]Location)
	}
	parentOrigin.Sequences[field] = locs
}

// applyOrigins walks a Go struct tree and a parallel OriginTree, setting
// Origin fields on each struct from the extracted origin data.
func applyOrigins(v any, tree *yaml.OriginTree) {
	if tree == nil {
		return
	}
	applyOriginsToValue(reflect.ValueOf(v), tree)
}

func applyOriginsToValue(val reflect.Value, tree *yaml.OriginTree) {
	// Keep track of the last pointer so we can pass it to struct handlers
	// (needed for calling methods like Map() on maplike types).
	var ptr reflect.Value
	for val.Kind() == reflect.Pointer || val.Kind() == reflect.Interface {
		if val.IsNil() {
			return
		}
		if val.Kind() == reflect.Pointer {
			ptr = val
		}
		val = val.Elem()
	}

	switch val.Kind() {
	case reflect.Struct:
		applyOriginsToStruct(val, ptr, tree)
	case reflect.Map:
		applyOriginsToMap(val, tree)
	case reflect.Slice:
		applyOriginsToSlice(val, tree)
	}
}

func applyOriginsToStruct(val reflect.Value, ptr reflect.Value, tree *yaml.OriginTree) {
	typ := val.Type()

	// Set Origin field for structs whose Origin field has a "-" json tag.
	var structOrigin *Origin
	if tree.Origin != nil {
		if sf, ok := typ.FieldByName("Origin"); ok && sf.Type == originPtrType {
			tag := sf.Tag.Get("json")
			if tag == "-" {
				if s, ok := tree.Origin.([]any); ok {
					structOrigin = originFromSeq(s)
					val.FieldByName("Origin").Set(reflect.ValueOf(structOrigin))
				}
			}
		}
	}

	// Recurse into exported struct fields using json tags
	for i := range typ.NumField() {
		sf := typ.Field(i)
		if !sf.IsExported() {
			continue
		}
		tag := jsonTagName(sf)
		if tag == "" || tag == "-" {
			continue
		}
		childTree := tree.Fields[tag]
		if childTree == nil {
			continue
		}
		// A scalar-valued map (e.g. OAuth scopes: map[string]string) decodes into
		// a Go map that has no Origin field of its own, so its per-key locations —
		// present in the child subtree — would otherwise be lost. Record them on
		// this struct's Origin as a named sequence so a consumer can locate each
		// entry by key. Object- or pointer-valued maps are excluded: their values
		// carry their own Origin via the recursion below.
		if structOrigin != nil && isScalarValuedMapField(val.Field(i)) {
			recordMapKeyLocations(structOrigin, tag, childTree)
		}
		applyOriginsToValue(val.Field(i), childTree)
	}

	// Handle wrapper types whose inner struct has no json tag:
	// - *Ref types (e.g. SchemaRef, ResponseRef) have a "Value" field
	// - BoolSchema (AdditionalProperties, UnevaluatedProperties, UnevaluatedItems) has a "Schema" field
	// The origin tree data applies to the inner struct, not a sub-key.
	for _, fieldName := range []string{"Value", "Schema"} {
		vf := val.FieldByName(fieldName)
		if !vf.IsValid() || vf.Kind() != reflect.Pointer || vf.IsNil() {
			continue
		}
		sf, _ := typ.FieldByName(fieldName)
		if sf.Tag.Get("json") == "" {
			applyOriginsToValue(vf, tree)
		}
	}

	// Handle "maplike" types (Paths, Responses, Callback) whose items are
	// stored in an unexported map accessible via a Map() method.
	// Use the original pointer (if available) since dereferenced values
	// are not addressable.
	receiver := val
	if ptr.IsValid() {
		receiver = ptr
	} else if val.CanAddr() {
		receiver = val.Addr()
	}
	if receiver.Kind() == reflect.Pointer {
		if mapMethod := receiver.MethodByName("Map"); mapMethod.IsValid() {
			results := mapMethod.Call(nil)
			if len(results) == 1 {
				applyOriginsToMap(results[0], tree)
			}
		}
	}
}

func applyOriginsToMap(val reflect.Value, tree *yaml.OriginTree) {
	if tree.Fields == nil {
		return
	}
	for _, key := range val.MapKeys() {
		childTree := tree.Fields[key.String()]
		if childTree == nil {
			continue
		}
		elem := val.MapIndex(key)
		// Map values are not addressable. For pointer-typed values we can
		// recurse directly. For value types we must copy, apply, and set back.
		if elem.Kind() == reflect.Pointer || elem.Kind() == reflect.Interface {
			applyOriginsToValue(elem, childTree)
		} else if elem.Kind() == reflect.Struct {
			// Copy to a settable value
			cp := reflect.New(elem.Type()).Elem()
			cp.Set(elem)
			applyOriginsToStruct(cp, reflect.Value{}, childTree)
			val.SetMapIndex(key, cp)
		}
	}
}

func applyOriginsToSlice(val reflect.Value, tree *yaml.OriginTree) {
	for i := 0; i < val.Len() && i < len(tree.Items); i++ {
		if tree.Items[i] != nil {
			applyOriginsToValue(val.Index(i), tree.Items[i])
		}
	}
}

// jsonTagName returns the JSON field name from a struct field's json tag.
func jsonTagName(f reflect.StructField) string {
	tag := f.Tag.Get("json")
	if tag == "" {
		return ""
	}
	name, _, _ := strings.Cut(tag, ",")
	return name
}

// originTree aliases the decoder-side origin tree, so the loader and marsh can
// carry it without referencing the yaml package directly.
type originTree = yaml.OriginTree
