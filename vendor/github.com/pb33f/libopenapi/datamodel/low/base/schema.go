package base

import (
	"context"
	"crypto/sha256"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/pb33f/libopenapi/datamodel/low"
	"github.com/pb33f/libopenapi/index"
	"github.com/pb33f/libopenapi/orderedmap"
	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

// SchemaDynamicValue is used to hold multiple possible values for a schema property. There are two values, a left
// value (A) and a right value (B). The left value (A) is a 3.0 schema property value, the right value (B) is a 3.1
// schema value.
//
// OpenAPI 3.1 treats a Schema as a real JSON schema, which means some properties become incompatible, or others
// now support more than one primitive type or structure.
// The N value is a bit to make it each to know which value (A or B) is used, this prevents having to
// if/else on the value to determine which one is set.
type SchemaDynamicValue[A any, B any] struct {
	N int // 0 == A, 1 == B
	A A
	B B
}

// IsA will return true if the 'A' or left value is set. (OpenAPI 3)
func (s *SchemaDynamicValue[A, B]) IsA() bool {
	return s.N == 0
}

// IsB will return true if the 'B' or right value is set (OpenAPI 3.1)
func (s *SchemaDynamicValue[A, B]) IsB() bool {
	return s.N == 1
}

// Hash will generate a stable hash of the SchemaDynamicValue
func (s *SchemaDynamicValue[A, B]) Hash() [32]byte {
	var hash string
	if s.IsA() {
		hash = low.GenerateHashString(s.A)
	} else {
		hash = low.GenerateHashString(s.B)
	}
	return sha256.Sum256([]byte(hash))
}

// Schema represents a JSON Schema that support Swagger, OpenAPI 3 and OpenAPI 3.1
//
// Until 3.1 OpenAPI had a strange relationship with JSON Schema. It's been a super-set/sub-set
// mix, which has been confusing. So, instead of building a bunch of different models, we have compressed
// all variations into a single model that makes it easy to support multiple spec types.
//
//   - v2 schema: https://swagger.io/specification/v2/#schemaObject
//   - v3 schema: https://swagger.io/specification/#schema-object
//   - v3.1 schema: https://spec.openapis.org/oas/v3.1.0#schema-object
type Schema struct {
	// Reference to the '$schema' dialect setting (3.1 only)
	SchemaTypeRef low.NodeReference[string]

	// In versions 2 and 3.0, this ExclusiveMaximum can only be a boolean.
	ExclusiveMaximum low.NodeReference[*SchemaDynamicValue[bool, float64]]

	// In versions 2 and 3.0, this ExclusiveMinimum can only be a boolean.
	ExclusiveMinimum low.NodeReference[*SchemaDynamicValue[bool, float64]]

	// In versions 2 and 3.0, this Type is a single value, so array will only ever have one value
	// in version 3.1, Type can be multiple values
	Type low.NodeReference[SchemaDynamicValue[string, []low.ValueReference[string]]]

	// Schemas are resolved on demand using a SchemaProxy
	AllOf low.NodeReference[[]low.ValueReference[*SchemaProxy]]

	// Polymorphic Schemas are only available in version 3+
	OneOf         low.NodeReference[[]low.ValueReference[*SchemaProxy]]
	AnyOf         low.NodeReference[[]low.ValueReference[*SchemaProxy]]
	Discriminator low.NodeReference[*Discriminator]

	// in 3.1 examples can be an array (which is recommended)
	Examples low.NodeReference[[]low.ValueReference[*yaml.Node]]
	// in 3.1 PrefixItems provides tuple validation using prefixItems.
	PrefixItems low.NodeReference[[]low.ValueReference[*SchemaProxy]]
	// in 3.1 Contains is used by arrays and points to a Schema.
	Contains    low.NodeReference[*SchemaProxy]
	MinContains low.NodeReference[int64]
	MaxContains low.NodeReference[int64]

	// items can be a schema in 2.0, 3.0 and 3.1 or a bool in 3.1
	Items low.NodeReference[*SchemaDynamicValue[*SchemaProxy, bool]]

	// 3.1 only
	If                    low.NodeReference[*SchemaProxy]
	Else                  low.NodeReference[*SchemaProxy]
	Then                  low.NodeReference[*SchemaProxy]
	DependentSchemas      low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*SchemaProxy]]]
	PatternProperties     low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*SchemaProxy]]]
	PropertyNames         low.NodeReference[*SchemaProxy]
	UnevaluatedItems      low.NodeReference[*SchemaProxy]
	UnevaluatedProperties low.NodeReference[*SchemaDynamicValue[*SchemaProxy, bool]]
	Anchor                low.NodeReference[string]

	// Compatible with all versions
	Title                low.NodeReference[string]
	MultipleOf           low.NodeReference[float64]
	Maximum              low.NodeReference[float64]
	Minimum              low.NodeReference[float64]
	MaxLength            low.NodeReference[int64]
	MinLength            low.NodeReference[int64]
	Pattern              low.NodeReference[string]
	Format               low.NodeReference[string]
	MaxItems             low.NodeReference[int64]
	MinItems             low.NodeReference[int64]
	UniqueItems          low.NodeReference[bool]
	MaxProperties        low.NodeReference[int64]
	MinProperties        low.NodeReference[int64]
	Required             low.NodeReference[[]low.ValueReference[string]]
	Enum                 low.NodeReference[[]low.ValueReference[*yaml.Node]]
	Not                  low.NodeReference[*SchemaProxy]
	Properties           low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*SchemaProxy]]]
	AdditionalProperties low.NodeReference[*SchemaDynamicValue[*SchemaProxy, bool]]
	Description          low.NodeReference[string]
	ContentEncoding      low.NodeReference[string]
	ContentMediaType     low.NodeReference[string]
	Default              low.NodeReference[*yaml.Node]
	Const                low.NodeReference[*yaml.Node]
	Nullable             low.NodeReference[bool]
	ReadOnly             low.NodeReference[bool]
	WriteOnly            low.NodeReference[bool]
	XML                  low.NodeReference[*XML]
	ExternalDocs         low.NodeReference[*ExternalDoc]
	Example              low.NodeReference[*yaml.Node]
	Deprecated           low.NodeReference[bool]
	Extensions           *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]

	// Parent Proxy refers back to the low level SchemaProxy that is proxying this schema.
	ParentProxy *SchemaProxy

	// Index is a reference to the SpecIndex that was used to build this schema.
	Index    *index.SpecIndex
	RootNode *yaml.Node
	index    *index.SpecIndex
	context  context.Context
	*low.Reference
	low.NodeMap
}

// GetIndex will return the index.SpecIndex instance attached to the Schema object
func (s *Schema) GetIndex() *index.SpecIndex {
	return s.index
}

// GetContext will return the context.Context instance used when building the Schema object
func (s *Schema) GetContext() context.Context {
	return s.context
}

// Hash will calculate a SHA256 hash from the values of the schema, This allows equality checking against
// Schemas defined inside an OpenAPI document. The only way to know if a schema has changed, is to hash it.
func (s *Schema) Hash() [32]byte {
	if s == nil {
		return [32]byte{}
	}
	// calculate a hash from every property in the schema.
	var d []string
	if !s.SchemaTypeRef.IsEmpty() {
		d = append(d, fmt.Sprint(s.SchemaTypeRef.Value))
	}
	if !s.Title.IsEmpty() {
		d = append(d, fmt.Sprint(s.Title.Value))
	}
	if !s.MultipleOf.IsEmpty() {
		d = append(d, fmt.Sprint(s.MultipleOf.Value))
	}
	if !s.Maximum.IsEmpty() {
		d = append(d, fmt.Sprint(s.Maximum.Value))
	}
	if !s.Minimum.IsEmpty() {
		d = append(d, fmt.Sprint(s.Minimum.Value))
	}
	if !s.MaxLength.IsEmpty() {
		d = append(d, fmt.Sprint(s.MaxLength.Value))
	}
	if !s.MinLength.IsEmpty() {
		d = append(d, fmt.Sprint(s.MinLength.Value))
	}
	if !s.Pattern.IsEmpty() {
		d = append(d, fmt.Sprint(s.Pattern.Value))
	}
	if !s.Format.IsEmpty() {
		d = append(d, fmt.Sprint(s.Format.Value))
	}
	if !s.MaxItems.IsEmpty() {
		d = append(d, fmt.Sprint(s.MaxItems.Value))
	}
	if !s.MinItems.IsEmpty() {
		d = append(d, fmt.Sprint(s.MinItems.Value))
	}
	if !s.UniqueItems.IsEmpty() {
		d = append(d, fmt.Sprint(s.UniqueItems.Value))
	}
	if !s.MaxProperties.IsEmpty() {
		d = append(d, fmt.Sprint(s.MaxProperties.Value))
	}
	if !s.MinProperties.IsEmpty() {
		d = append(d, fmt.Sprint(s.MinProperties.Value))
	}
	if !s.AdditionalProperties.IsEmpty() {
		d = append(d, low.GenerateHashString(s.AdditionalProperties.Value))
	}
	if !s.Description.IsEmpty() {
		d = append(d, fmt.Sprint(s.Description.Value))
	}
	if !s.ContentEncoding.IsEmpty() {
		d = append(d, fmt.Sprint(s.ContentEncoding.Value))
	}
	if !s.ContentMediaType.IsEmpty() {
		d = append(d, fmt.Sprint(s.ContentMediaType.Value))
	}
	if !s.Default.IsEmpty() {
		d = append(d, low.GenerateHashString(s.Default.Value))
	}
	if !s.Const.IsEmpty() {
		d = append(d, low.GenerateHashString(s.Const.Value))
	}
	if !s.Nullable.IsEmpty() {
		d = append(d, fmt.Sprint(s.Nullable.Value))
	}
	if !s.ReadOnly.IsEmpty() {
		d = append(d, fmt.Sprint(s.ReadOnly.Value))
	}
	if !s.WriteOnly.IsEmpty() {
		d = append(d, fmt.Sprint(s.WriteOnly.Value))
	}
	if !s.Deprecated.IsEmpty() {
		d = append(d, fmt.Sprint(s.Deprecated.Value))
	}
	if !s.ExclusiveMaximum.IsEmpty() && s.ExclusiveMaximum.Value.IsA() {
		d = append(d, fmt.Sprint(s.ExclusiveMaximum.Value.A))
	}
	if !s.ExclusiveMaximum.IsEmpty() && s.ExclusiveMaximum.Value.IsB() {
		d = append(d, fmt.Sprint(s.ExclusiveMaximum.Value.B))
	}
	if !s.ExclusiveMinimum.IsEmpty() && s.ExclusiveMinimum.Value.IsA() {
		d = append(d, fmt.Sprint(s.ExclusiveMinimum.Value.A))
	}
	if !s.ExclusiveMinimum.IsEmpty() && s.ExclusiveMinimum.Value.IsB() {
		d = append(d, fmt.Sprint(s.ExclusiveMinimum.Value.B))
	}
	if !s.Type.IsEmpty() && s.Type.Value.IsA() {
		d = append(d, fmt.Sprint(s.Type.Value.A))
	}
	if !s.Type.IsEmpty() && s.Type.Value.IsB() {
		j := make([]string, len(s.Type.Value.B))
		for h := range s.Type.Value.B {
			j[h] = s.Type.Value.B[h].Value
		}
		sort.Strings(j)
		d = append(d, strings.Join(j, "|"))
	}

	keys := make([]string, len(s.Required.Value))
	for i := range s.Required.Value {
		keys[i] = s.Required.Value[i].Value
	}
	sort.Strings(keys)
	d = append(d, keys...)

	keys = make([]string, len(s.Enum.Value))
	for i := range s.Enum.Value {
		keys[i] = low.ValueToString(s.Enum.Value[i].Value)
	}
	sort.Strings(keys)
	d = append(d, keys...)

	d = low.AppendMapHashes(d, s.Properties.Value)
	if s.XML.Value != nil {
		d = append(d, low.GenerateHashString(s.XML.Value))
	}
	if s.ExternalDocs.Value != nil {
		d = append(d, low.GenerateHashString(s.ExternalDocs.Value))
	}
	if s.Discriminator.Value != nil {
		d = append(d, low.GenerateHashString(s.Discriminator.Value))
	}

	// hash polymorphic data
	if len(s.OneOf.Value) > 0 {
		oneOfKeys := make([]string, len(s.OneOf.Value))
		oneOfEntities := make(map[string]*SchemaProxy)
		z := 0
		for i := range s.OneOf.Value {
			g := s.OneOf.Value[i].Value
			r := low.GenerateHashString(g)
			oneOfEntities[r] = g
			oneOfKeys[z] = r
			z++

		}
		sort.Strings(oneOfKeys)
		for k := range oneOfKeys {
			d = append(d, low.GenerateHashString(oneOfEntities[oneOfKeys[k]]))
		}
	}

	if len(s.AllOf.Value) > 0 {
		allOfKeys := make([]string, len(s.AllOf.Value))
		allOfEntities := make(map[string]*SchemaProxy)
		z := 0
		for i := range s.AllOf.Value {
			g := s.AllOf.Value[i].Value
			r := low.GenerateHashString(g)
			allOfEntities[r] = g
			allOfKeys[z] = r
			z++

		}
		sort.Strings(allOfKeys)
		for k := range allOfKeys {
			d = append(d, low.GenerateHashString(allOfEntities[allOfKeys[k]]))
		}
	}

	if len(s.AnyOf.Value) > 0 {
		anyOfKeys := make([]string, len(s.AnyOf.Value))
		anyOfEntities := make(map[string]*SchemaProxy)
		z := 0
		for i := range s.AnyOf.Value {
			g := s.AnyOf.Value[i].Value
			r := low.GenerateHashString(g)
			anyOfEntities[r] = g
			anyOfKeys[z] = r
			z++

		}
		sort.Strings(anyOfKeys)
		for k := range anyOfKeys {
			d = append(d, low.GenerateHashString(anyOfEntities[anyOfKeys[k]]))
		}
	}

	if !s.Not.IsEmpty() {
		d = append(d, low.GenerateHashString(s.Not.Value))
	}

	// check if items is a schema or a bool.
	if !s.Items.IsEmpty() && s.Items.Value.IsA() {
		d = append(d, low.GenerateHashString(s.Items.Value.A))
	}
	if !s.Items.IsEmpty() && s.Items.Value.IsB() {
		d = append(d, fmt.Sprint(s.Items.Value.B))
	}
	// 3.1 only props
	if !s.If.IsEmpty() {
		d = append(d, low.GenerateHashString(s.If.Value))
	}
	if !s.Else.IsEmpty() {
		d = append(d, low.GenerateHashString(s.Else.Value))
	}
	if !s.Then.IsEmpty() {
		d = append(d, low.GenerateHashString(s.Then.Value))
	}
	if !s.PropertyNames.IsEmpty() {
		d = append(d, low.GenerateHashString(s.PropertyNames.Value))
	}
	if !s.UnevaluatedProperties.IsEmpty() {
		d = append(d, low.GenerateHashString(s.UnevaluatedProperties.Value))
	}
	if !s.UnevaluatedItems.IsEmpty() {
		d = append(d, low.GenerateHashString(s.UnevaluatedItems.Value))
	}
	if !s.Anchor.IsEmpty() {
		d = append(d, fmt.Sprint(s.Anchor.Value))
	}

	d = low.AppendMapHashes(d, orderedmap.SortAlpha(s.DependentSchemas.Value))
	d = low.AppendMapHashes(d, orderedmap.SortAlpha(s.PatternProperties.Value))

	if len(s.PrefixItems.Value) > 0 {
		itemsKeys := make([]string, len(s.PrefixItems.Value))
		itemsEntities := make(map[string]*SchemaProxy)
		z := 0
		for i := range s.PrefixItems.Value {
			g := s.PrefixItems.Value[i].Value
			r := low.GenerateHashString(g)
			itemsEntities[r] = g
			itemsKeys[z] = r
			z++
		}
		sort.Strings(itemsKeys)
		for k := range itemsKeys {
			d = append(d, low.GenerateHashString(itemsEntities[itemsKeys[k]]))
		}
	}

	d = append(d, low.HashExtensions(s.Extensions)...)
	if s.Example.Value != nil {
		d = append(d, low.GenerateHashString(s.Example.Value))
	}

	// contains
	if !s.Contains.IsEmpty() {
		d = append(d, low.GenerateHashString(s.Contains.Value))
	}
	if !s.MinContains.IsEmpty() {
		d = append(d, fmt.Sprint(s.MinContains.Value))
	}
	if !s.MaxContains.IsEmpty() {
		d = append(d, fmt.Sprint(s.MaxContains.Value))
	}
	if !s.Examples.IsEmpty() {
		for _, ex := range s.Examples.Value {
			d = append(d, low.GenerateHashString(ex.Value))
		}
	}
	return sha256.Sum256([]byte(strings.Join(d, "|")))
}

// FindProperty will return a ValueReference pointer containing a SchemaProxy pointer
// from a property key name. if found
func (s *Schema) FindProperty(name string) *low.ValueReference[*SchemaProxy] {
	return low.FindItemInOrderedMap[*SchemaProxy](name, s.Properties.Value)
}

// FindDependentSchema will return a ValueReference pointer containing a SchemaProxy pointer
// from a dependent schema key name. if found (3.1+ only)
func (s *Schema) FindDependentSchema(name string) *low.ValueReference[*SchemaProxy] {
	return low.FindItemInOrderedMap[*SchemaProxy](name, s.DependentSchemas.Value)
}

// FindPatternProperty will return a ValueReference pointer containing a SchemaProxy pointer
// from a pattern property key name. if found (3.1+ only)
func (s *Schema) FindPatternProperty(name string) *low.ValueReference[*SchemaProxy] {
	return low.FindItemInOrderedMap[*SchemaProxy](name, s.PatternProperties.Value)
}

// GetExtensions returns all extensions for Schema
func (s *Schema) GetExtensions() *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]] {
	return s.Extensions
}

// GetRootNode will return the root yaml node of the Schema object
func (s *Schema) GetRootNode() *yaml.Node {
	return s.RootNode
}

// Build will perform a number of operations.
// Extraction of the following happens in this method:
//   - Extensions
//   - Type
//   - ExclusiveMinimum and ExclusiveMaximum
//   - Examples
//   - AdditionalProperties
//   - Discriminator
//   - ExternalDocs
//   - XML
//   - Properties
//   - AllOf, OneOf, AnyOf
//   - Not
//   - Items
//   - PrefixItems
//   - If
//   - Else
//   - Then
//   - DependentSchemas
//   - PatternProperties
//   - PropertyNames
//   - UnevaluatedItems
//   - UnevaluatedProperties
//   - Anchor
func (s *Schema) Build(ctx context.Context, root *yaml.Node, idx *index.SpecIndex) error {
	if root == nil {
		return fmt.Errorf("cannot build schema from a nil node")
	}
	root = utils.NodeAlias(root)
	utils.CheckForMergeNodes(root)
	s.Reference = new(low.Reference)
	no := low.ExtractNodes(ctx, root)
	s.Nodes = no
	s.Index = idx
	s.RootNode = root
	s.context = ctx
	s.index = idx

	if h, _, _ := utils.IsNodeRefValue(root); h {
		ref, _, err, fctx := low.LocateRefNodeWithContext(ctx, root, idx)
		if ref != nil {
			root = ref
			if fctx != nil {
				ctx = fctx
			}
			if err != nil {
				if !idx.AllowCircularReferenceResolving() {
					return fmt.Errorf("build schema failed: %s", err.Error())
				}
			}
		} else {
			return fmt.Errorf("build schema failed: reference cannot be found: '%s', line %d, col %d",
				root.Content[1].Value, root.Content[1].Line, root.Content[1].Column)
		}
	}

	// Build model using possibly dereferenced root
	if err := low.BuildModel(root, s); err != nil {
		return err
	}

	s.extractExtensions(root)

	// if the schema has required values, extract the nodes for them.
	if s.Required.Value != nil {
		for _, r := range s.Required.Value {
			s.AddNode(r.ValueNode.Line, r.ValueNode)
		}
	}

	// same thing with enums
	if s.Enum.Value != nil {
		for _, e := range s.Enum.Value {
			s.AddNode(e.ValueNode.Line, e.ValueNode)
		}
	}

	// determine schema type, singular (3.0) or multiple (3.1), use a variable value
	_, typeLabel, typeValue := utils.FindKeyNodeFullTop(TypeLabel, root.Content)
	if typeValue != nil {
		if utils.IsNodeStringValue(typeValue) {
			s.Type = low.NodeReference[SchemaDynamicValue[string, []low.ValueReference[string]]]{
				KeyNode:   typeLabel,
				ValueNode: typeValue,
				Value:     SchemaDynamicValue[string, []low.ValueReference[string]]{N: 0, A: typeValue.Value},
			}
		}
		if utils.IsNodeArray(typeValue) {

			var refs []low.ValueReference[string]
			for r := range typeValue.Content {
				refs = append(refs, low.ValueReference[string]{
					Value:     typeValue.Content[r].Value,
					ValueNode: typeValue.Content[r],
				})
			}
			s.Type = low.NodeReference[SchemaDynamicValue[string, []low.ValueReference[string]]]{
				KeyNode:   typeLabel,
				ValueNode: typeValue,
				Value:     SchemaDynamicValue[string, []low.ValueReference[string]]{N: 1, B: refs},
			}
		}
	}

	// determine exclusive minimum type, bool (3.0) or int (3.1)
	_, exMinLabel, exMinValue := utils.FindKeyNodeFullTop(ExclusiveMinimumLabel, root.Content)
	if exMinValue != nil {
		// if there is an index, determine if this a 3.0 or 3.1 schema
		if idx != nil {
			if idx.GetConfig().SpecInfo.VersionNumeric == 3.1 {
				val, _ := strconv.ParseFloat(exMinValue.Value, 64)
				s.ExclusiveMinimum = low.NodeReference[*SchemaDynamicValue[bool, float64]]{
					KeyNode:   exMinLabel,
					ValueNode: exMinValue,
					Value:     &SchemaDynamicValue[bool, float64]{N: 1, B: val},
				}
			}
			if idx.GetConfig().SpecInfo.VersionNumeric <= 3.0 {
				val, _ := strconv.ParseBool(exMinValue.Value)
				s.ExclusiveMinimum = low.NodeReference[*SchemaDynamicValue[bool, float64]]{
					KeyNode:   exMinLabel,
					ValueNode: exMinValue,
					Value:     &SchemaDynamicValue[bool, float64]{N: 0, A: val},
				}
			}
		} else {

			// there is no index, so we have to determine the type based on the value
			if utils.IsNodeBoolValue(exMinValue) {
				val, _ := strconv.ParseBool(exMinValue.Value)
				s.ExclusiveMinimum = low.NodeReference[*SchemaDynamicValue[bool, float64]]{
					KeyNode:   exMinLabel,
					ValueNode: exMinValue,
					Value:     &SchemaDynamicValue[bool, float64]{N: 0, A: val},
				}
			}
			if utils.IsNodeIntValue(exMinValue) {
				val, _ := strconv.ParseFloat(exMinValue.Value, 64)
				s.ExclusiveMinimum = low.NodeReference[*SchemaDynamicValue[bool, float64]]{
					KeyNode:   exMinLabel,
					ValueNode: exMinValue,
					Value:     &SchemaDynamicValue[bool, float64]{N: 1, B: val},
				}
			}
		}
	}

	// determine exclusive maximum type, bool (3.0) or int (3.1)
	_, exMaxLabel, exMaxValue := utils.FindKeyNodeFullTop(ExclusiveMaximumLabel, root.Content)
	if exMaxValue != nil {
		// if there is an index, determine if this a 3.0 or 3.1 schema
		if idx != nil {
			if idx.GetConfig().SpecInfo.VersionNumeric == 3.1 {
				val, _ := strconv.ParseFloat(exMaxValue.Value, 64)
				s.ExclusiveMaximum = low.NodeReference[*SchemaDynamicValue[bool, float64]]{
					KeyNode:   exMaxLabel,
					ValueNode: exMaxValue,
					Value:     &SchemaDynamicValue[bool, float64]{N: 1, B: val},
				}
			}
			if idx.GetConfig().SpecInfo.VersionNumeric <= 3.0 {
				val, _ := strconv.ParseBool(exMaxValue.Value)
				s.ExclusiveMaximum = low.NodeReference[*SchemaDynamicValue[bool, float64]]{
					KeyNode:   exMaxLabel,
					ValueNode: exMaxValue,
					Value:     &SchemaDynamicValue[bool, float64]{N: 0, A: val},
				}
			}
		} else {

			// there is no index, so we have to determine the type based on the value
			if utils.IsNodeBoolValue(exMaxValue) {
				val, _ := strconv.ParseBool(exMaxValue.Value)
				s.ExclusiveMaximum = low.NodeReference[*SchemaDynamicValue[bool, float64]]{
					KeyNode:   exMaxLabel,
					ValueNode: exMaxValue,
					Value:     &SchemaDynamicValue[bool, float64]{N: 0, A: val},
				}
			}
			if utils.IsNodeIntValue(exMaxValue) {
				val, _ := strconv.ParseFloat(exMaxValue.Value, 64)
				s.ExclusiveMaximum = low.NodeReference[*SchemaDynamicValue[bool, float64]]{
					KeyNode:   exMaxLabel,
					ValueNode: exMaxValue,
					Value:     &SchemaDynamicValue[bool, float64]{N: 1, B: val},
				}
			}
		}
	}

	// handle schema reference type if set. (3.1)
	_, schemaRefLabel, schemaRefNode := utils.FindKeyNodeFullTop(SchemaTypeLabel, root.Content)
	if schemaRefNode != nil {
		s.SchemaTypeRef = low.NodeReference[string]{
			Value: schemaRefNode.Value, KeyNode: schemaRefLabel, ValueNode: schemaRefNode,
		}
	}

	// handle anchor if set. (3.1)
	_, anchorLabel, anchorNode := utils.FindKeyNodeFullTop(AnchorLabel, root.Content)
	if anchorNode != nil {
		s.Anchor = low.NodeReference[string]{
			Value: anchorNode.Value, KeyNode: anchorLabel, ValueNode: anchorNode,
		}
	}

	// handle example if set. (3.0)
	_, expLabel, expNode := utils.FindKeyNodeFullTop(ExampleLabel, root.Content)
	if expNode != nil {
		s.Example = low.NodeReference[*yaml.Node]{Value: expNode, KeyNode: expLabel, ValueNode: expNode}

		// extract nodes for all value nodes down the tree.
		expChildNodes := low.ExtractNodesRecursive(ctx, expNode)
		// map to the local schema
		expChildNodes.Range(func(k, v interface{}) bool {
			if arr, ko := v.([]*yaml.Node); ko {
				if _, ok := s.Nodes.Load(k); !ok {
					s.Nodes.Store(k, arr)
				}
			}
			return true
		})
	}

	// handle examples if set.(3.1)
	_, expArrLabel, expArrNode := utils.FindKeyNodeFullTop(ExamplesLabel, root.Content)
	if expArrNode != nil {
		if utils.IsNodeArray(expArrNode) {
			var examples []low.ValueReference[*yaml.Node]
			for i := range expArrNode.Content {
				examples = append(examples, low.ValueReference[*yaml.Node]{Value: expArrNode.Content[i], ValueNode: expArrNode.Content[i]})
			}
			s.Examples = low.NodeReference[[]low.ValueReference[*yaml.Node]]{
				Value:     examples,
				ValueNode: expArrNode,
				KeyNode:   expArrLabel,
			}
			// extract nodes for all value nodes down the tree.
			expChildNodes := low.ExtractNodesRecursive(ctx, expArrNode)
			// map to the local schema
			expChildNodes.Range(func(k, v interface{}) bool {
				if arr, ko := v.([]*yaml.Node); ko {
					if _, ok := s.Nodes.Load(k); !ok {
						s.Nodes.Store(k, arr)
					}
				}
				return true
			})
		}
	}

	// check additionalProperties type for schema or bool
	addPropsIsBool := false
	addPropsBoolValue := true
	_, addPLabel, addPValue := utils.FindKeyNodeFullTop(AdditionalPropertiesLabel, root.Content)
	if addPValue != nil {
		if utils.IsNodeBoolValue(addPValue) {
			addPropsIsBool = true
			addPropsBoolValue, _ = strconv.ParseBool(addPValue.Value)
		}
	}
	if addPropsIsBool {
		s.AdditionalProperties = low.NodeReference[*SchemaDynamicValue[*SchemaProxy, bool]]{
			Value: &SchemaDynamicValue[*SchemaProxy, bool]{
				B: addPropsBoolValue,
				N: 1,
			},
			KeyNode:   addPLabel,
			ValueNode: addPValue,
		}
	}

	// handle discriminator if set.
	_, discLabel, discNode := utils.FindKeyNodeFullTop(DiscriminatorLabel, root.Content)
	if discNode != nil {
		var discriminator Discriminator
		_ = low.BuildModel(discNode, &discriminator)
		discriminator.KeyNode = discLabel
		discriminator.RootNode = discNode
		discriminator.Nodes = low.ExtractNodes(ctx, discNode)
		s.Discriminator = low.NodeReference[*Discriminator]{Value: &discriminator, KeyNode: discLabel, ValueNode: discNode}
		// add discriminator nodes, because there is no build method.
		dn := low.ExtractNodesRecursive(ctx, discNode)
		dn.Range(func(key, val any) bool {
			if n, ok := val.([]*yaml.Node); ok {
				for _, g := range n {
					discriminator.AddNode(key.(int), g)
				}
			}
			return true
		})
	}

	// handle externalDocs if set.
	_, extDocLabel, extDocNode := utils.FindKeyNodeFullTop(ExternalDocsLabel, root.Content)
	if extDocNode != nil {
		var exDoc ExternalDoc
		_ = low.BuildModel(extDocNode, &exDoc)
		_ = exDoc.Build(ctx, extDocLabel, extDocNode, idx) // throws no errors, can't check for one.
		exDoc.Nodes = low.ExtractNodes(ctx, extDocNode)
		s.ExternalDocs = low.NodeReference[*ExternalDoc]{Value: &exDoc, KeyNode: extDocLabel, ValueNode: extDocNode}
	}

	// handle xml if set.
	_, xmlLabel, xmlNode := utils.FindKeyNodeFullTop(XMLLabel, root.Content)
	if xmlNode != nil {
		var xml XML
		_ = low.BuildModel(xmlNode, &xml)
		// extract extensions if set.
		_ = xml.Build(xmlNode, idx) // returns no errors, can't check for one.
		xml.Nodes = low.ExtractNodes(ctx, xmlNode)
		s.XML = low.NodeReference[*XML]{Value: &xml, KeyNode: xmlLabel, ValueNode: xmlNode}
	}

	// handle properties
	props, err := buildPropertyMap(ctx, s, root, idx, PropertiesLabel)
	if err != nil {
		return err
	}
	if props != nil {
		s.Properties = *props
	}

	// handle dependent schemas
	props, err = buildPropertyMap(ctx, s, root, idx, DependentSchemasLabel)
	if err != nil {
		return err
	}
	if props != nil {
		s.DependentSchemas = *props
	}

	// handle pattern properties
	props, err = buildPropertyMap(ctx, s, root, idx, PatternPropertiesLabel)
	if err != nil {
		return err
	}
	if props != nil {
		s.PatternProperties = *props
	}

	// check items type for schema or bool (3.1 only)
	itemsIsBool := false
	itemsBoolValue := false
	_, itemsLabel, itemsValue := utils.FindKeyNodeFullTop(ItemsLabel, root.Content)
	if itemsValue != nil {
		if utils.IsNodeBoolValue(itemsValue) {
			itemsIsBool = true
			itemsBoolValue, _ = strconv.ParseBool(itemsValue.Value)
		}
	}
	if itemsIsBool {
		s.Items = low.NodeReference[*SchemaDynamicValue[*SchemaProxy, bool]]{
			Value: &SchemaDynamicValue[*SchemaProxy, bool]{
				B: itemsBoolValue,
				N: 1,
			},
			KeyNode:   itemsLabel,
			ValueNode: itemsValue,
		}
	}

	// check unevaluatedProperties type for schema or bool (3.1 only)
	unevalIsBool := false
	unevalBoolValue := true
	_, unevalLabel, unevalValue := utils.FindKeyNodeFullTop(UnevaluatedPropertiesLabel, root.Content)
	if unevalValue != nil {
		if utils.IsNodeBoolValue(unevalValue) {
			unevalIsBool = true
			unevalBoolValue, _ = strconv.ParseBool(unevalValue.Value)
		}
	}
	if unevalIsBool {
		s.UnevaluatedProperties = low.NodeReference[*SchemaDynamicValue[*SchemaProxy, bool]]{
			Value: &SchemaDynamicValue[*SchemaProxy, bool]{
				B: unevalBoolValue,
				N: 1,
			},
			KeyNode:   unevalLabel,
			ValueNode: unevalValue,
		}
	}

	var allOf, anyOf, oneOf, prefixItems []low.ValueReference[*SchemaProxy]
	var items, not, contains, sif, selse, sthen, propertyNames, unevalItems, unevalProperties, addProperties low.ValueReference[*SchemaProxy]

	_, allOfLabel, allOfValue := utils.FindKeyNodeFullTop(AllOfLabel, root.Content)
	_, anyOfLabel, anyOfValue := utils.FindKeyNodeFullTop(AnyOfLabel, root.Content)
	_, oneOfLabel, oneOfValue := utils.FindKeyNodeFullTop(OneOfLabel, root.Content)
	_, notLabel, notValue := utils.FindKeyNodeFullTop(NotLabel, root.Content)
	_, prefixItemsLabel, prefixItemsValue := utils.FindKeyNodeFullTop(PrefixItemsLabel, root.Content)
	_, containsLabel, containsValue := utils.FindKeyNodeFullTop(ContainsLabel, root.Content)
	_, sifLabel, sifValue := utils.FindKeyNodeFullTop(IfLabel, root.Content)
	_, selseLabel, selseValue := utils.FindKeyNodeFullTop(ElseLabel, root.Content)
	_, sthenLabel, sthenValue := utils.FindKeyNodeFullTop(ThenLabel, root.Content)
	_, propNamesLabel, propNamesValue := utils.FindKeyNodeFullTop(PropertyNamesLabel, root.Content)
	_, unevalItemsLabel, unevalItemsValue := utils.FindKeyNodeFullTop(UnevaluatedItemsLabel, root.Content)
	_, unevalPropsLabel, unevalPropsValue := utils.FindKeyNodeFullTop(UnevaluatedPropertiesLabel, root.Content)
	_, addPropsLabel, addPropsValue := utils.FindKeyNodeFullTop(AdditionalPropertiesLabel, root.Content)

	errorChan := make(chan error)
	allOfChan := make(chan schemaProxyBuildResult)
	anyOfChan := make(chan schemaProxyBuildResult)
	oneOfChan := make(chan schemaProxyBuildResult)
	itemsChan := make(chan schemaProxyBuildResult)
	prefixItemsChan := make(chan schemaProxyBuildResult)
	notChan := make(chan schemaProxyBuildResult)
	containsChan := make(chan schemaProxyBuildResult)
	ifChan := make(chan schemaProxyBuildResult)
	elseChan := make(chan schemaProxyBuildResult)
	thenChan := make(chan schemaProxyBuildResult)
	propNamesChan := make(chan schemaProxyBuildResult)
	unevalItemsChan := make(chan schemaProxyBuildResult)
	unevalPropsChan := make(chan schemaProxyBuildResult)
	addPropsChan := make(chan schemaProxyBuildResult)

	totalBuilds := countSubSchemaItems(allOfValue) +
		countSubSchemaItems(anyOfValue) +
		countSubSchemaItems(oneOfValue) +
		countSubSchemaItems(prefixItemsValue)

	if allOfValue != nil {
		go buildSchema(ctx, allOfChan, allOfLabel, allOfValue, errorChan, idx)
	}
	if anyOfValue != nil {
		go buildSchema(ctx, anyOfChan, anyOfLabel, anyOfValue, errorChan, idx)
	}
	if oneOfValue != nil {
		go buildSchema(ctx, oneOfChan, oneOfLabel, oneOfValue, errorChan, idx)
	}
	if prefixItemsValue != nil {
		go buildSchema(ctx, prefixItemsChan, prefixItemsLabel, prefixItemsValue, errorChan, idx)
	}
	if notValue != nil {
		totalBuilds++
		go buildSchema(ctx, notChan, notLabel, notValue, errorChan, idx)
	}
	if containsValue != nil {
		totalBuilds++
		go buildSchema(ctx, containsChan, containsLabel, containsValue, errorChan, idx)
	}
	if !itemsIsBool && itemsValue != nil {
		totalBuilds++
		go buildSchema(ctx, itemsChan, itemsLabel, itemsValue, errorChan, idx)
	}
	if sifValue != nil {
		totalBuilds++
		go buildSchema(ctx, ifChan, sifLabel, sifValue, errorChan, idx)
	}
	if selseValue != nil {
		totalBuilds++
		go buildSchema(ctx, elseChan, selseLabel, selseValue, errorChan, idx)
	}
	if sthenValue != nil {
		totalBuilds++
		go buildSchema(ctx, thenChan, sthenLabel, sthenValue, errorChan, idx)
	}
	if propNamesValue != nil {
		totalBuilds++
		go buildSchema(ctx, propNamesChan, propNamesLabel, propNamesValue, errorChan, idx)
	}
	if unevalItemsValue != nil {
		totalBuilds++
		go buildSchema(ctx, unevalItemsChan, unevalItemsLabel, unevalItemsValue, errorChan, idx)
	}
	if !unevalIsBool && unevalPropsValue != nil {
		totalBuilds++
		go buildSchema(ctx, unevalPropsChan, unevalPropsLabel, unevalPropsValue, errorChan, idx)
	}
	if !addPropsIsBool && addPropsValue != nil {
		totalBuilds++
		go buildSchema(ctx, addPropsChan, addPropsLabel, addPropsValue, errorChan, idx)
	}

	completeCount := 0
	for completeCount < totalBuilds {
		select {
		case e := <-errorChan:
			return e
		case r := <-allOfChan:
			completeCount++
			allOf = append(allOf, r.v)
		case r := <-anyOfChan:
			completeCount++
			anyOf = append(anyOf, r.v)
		case r := <-oneOfChan:
			completeCount++
			oneOf = append(oneOf, r.v)
		case r := <-itemsChan:
			completeCount++
			items = r.v
		case r := <-prefixItemsChan:
			completeCount++
			prefixItems = append(prefixItems, r.v)
		case r := <-notChan:
			completeCount++
			not = r.v
		case r := <-containsChan:
			completeCount++
			contains = r.v
		case r := <-ifChan:
			completeCount++
			sif = r.v
		case r := <-elseChan:
			completeCount++
			selse = r.v
		case r := <-thenChan:
			completeCount++
			sthen = r.v
		case r := <-propNamesChan:
			completeCount++
			propertyNames = r.v
		case r := <-unevalItemsChan:
			completeCount++
			unevalItems = r.v
		case r := <-unevalPropsChan:
			completeCount++
			unevalProperties = r.v
		case r := <-addPropsChan:
			completeCount++
			addProperties = r.v
		}
	}

	if len(anyOf) > 0 {
		s.AnyOf = low.NodeReference[[]low.ValueReference[*SchemaProxy]]{
			Value:     anyOf,
			KeyNode:   anyOfLabel,
			ValueNode: anyOfValue,
		}
	}
	if len(oneOf) > 0 {
		s.OneOf = low.NodeReference[[]low.ValueReference[*SchemaProxy]]{
			Value:     oneOf,
			KeyNode:   oneOfLabel,
			ValueNode: oneOfValue,
		}
	}
	if len(allOf) > 0 {
		s.AllOf = low.NodeReference[[]low.ValueReference[*SchemaProxy]]{
			Value:     allOf,
			KeyNode:   allOfLabel,
			ValueNode: allOfValue,
		}
	}
	if !not.IsEmpty() {
		s.Not = low.NodeReference[*SchemaProxy]{
			Value:     not.Value,
			KeyNode:   notLabel,
			ValueNode: notValue,
		}
	}
	if !itemsIsBool && !items.IsEmpty() {
		s.Items = low.NodeReference[*SchemaDynamicValue[*SchemaProxy, bool]]{
			Value: &SchemaDynamicValue[*SchemaProxy, bool]{
				A: items.Value,
			},
			KeyNode:   itemsLabel,
			ValueNode: itemsValue,
		}
	}
	if len(prefixItems) > 0 {
		s.PrefixItems = low.NodeReference[[]low.ValueReference[*SchemaProxy]]{
			Value:     prefixItems,
			KeyNode:   prefixItemsLabel,
			ValueNode: prefixItemsValue,
		}
	}
	if !contains.IsEmpty() {
		s.Contains = low.NodeReference[*SchemaProxy]{
			Value:     contains.Value,
			KeyNode:   containsLabel,
			ValueNode: containsValue,
		}
	}
	if !sif.IsEmpty() {
		s.If = low.NodeReference[*SchemaProxy]{
			Value:     sif.Value,
			KeyNode:   sifLabel,
			ValueNode: sifValue,
		}
	}
	if !selse.IsEmpty() {
		s.Else = low.NodeReference[*SchemaProxy]{
			Value:     selse.Value,
			KeyNode:   selseLabel,
			ValueNode: selseValue,
		}
	}
	if !sthen.IsEmpty() {
		s.Then = low.NodeReference[*SchemaProxy]{
			Value:     sthen.Value,
			KeyNode:   sthenLabel,
			ValueNode: sthenValue,
		}
	}
	if !propertyNames.IsEmpty() {
		s.PropertyNames = low.NodeReference[*SchemaProxy]{
			Value:     propertyNames.Value,
			KeyNode:   propNamesLabel,
			ValueNode: propNamesValue,
		}
	}
	if !unevalItems.IsEmpty() {
		s.UnevaluatedItems = low.NodeReference[*SchemaProxy]{
			Value:     unevalItems.Value,
			KeyNode:   unevalItemsLabel,
			ValueNode: unevalItemsValue,
		}
	}
	if !unevalIsBool && !unevalProperties.IsEmpty() {
		s.UnevaluatedProperties = low.NodeReference[*SchemaDynamicValue[*SchemaProxy, bool]]{
			Value: &SchemaDynamicValue[*SchemaProxy, bool]{
				A: unevalProperties.Value,
			},
			KeyNode:   unevalPropsLabel,
			ValueNode: unevalPropsValue,
		}
	}
	if !addPropsIsBool && !addProperties.IsEmpty() {
		s.AdditionalProperties = low.NodeReference[*SchemaDynamicValue[*SchemaProxy, bool]]{
			Value: &SchemaDynamicValue[*SchemaProxy, bool]{
				A: addProperties.Value,
			},
			KeyNode:   addPropsLabel,
			ValueNode: addPropsValue,
		}
	}
	return nil
}

func buildPropertyMap(ctx context.Context, parent *Schema, root *yaml.Node, idx *index.SpecIndex, label string) (*low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*SchemaProxy]]], error) {
	_, propLabel, propsNode := utils.FindKeyNodeFullTop(label, root.Content)
	if propsNode != nil {
		propertyMap := orderedmap.New[low.KeyReference[string], low.ValueReference[*SchemaProxy]]()
		var currentProp *yaml.Node
		for i, prop := range propsNode.Content {
			if i%2 == 0 {
				currentProp = prop
				parent.Nodes.Store(prop.Line, prop)
				continue
			}

			foundCtx := ctx
			foundIdx := idx
			// check our prop isn't reference
			refString := ""
			var refNode *yaml.Node
			if h, _, l := utils.IsNodeRefValue(prop); h {
				ref, fIdx, _, fctx := low.LocateRefNodeWithContext(foundCtx, prop, foundIdx)
				if ref != nil {

					refNode = prop
					prop = ref
					refString = l
					foundCtx = fctx
					foundIdx = fIdx
				} else {
					return nil, fmt.Errorf("schema properties build failed: cannot find reference %s, line %d, col %d",
						prop.Content[1].Value, prop.Content[1].Line, prop.Content[1].Column)
				}
			}

			sp := &SchemaProxy{ctx: foundCtx, kn: currentProp, vn: prop, idx: foundIdx}
			sp.SetReference(refString, refNode)

			propertyMap.Set(low.KeyReference[string]{
				KeyNode: currentProp,
				Value:   currentProp.Value,
			}, low.ValueReference[*SchemaProxy]{
				Value:     sp,
				ValueNode: prop,
			})
		}

		return &low.NodeReference[*orderedmap.Map[low.KeyReference[string], low.ValueReference[*SchemaProxy]]]{
			Value:     propertyMap,
			KeyNode:   propLabel,
			ValueNode: propsNode,
		}, nil
	}
	return nil, nil
}

// count the number of sub-schemas in a node.
func countSubSchemaItems(node *yaml.Node) int {
	if utils.IsNodeMap(node) {
		return 1
	}
	if utils.IsNodeArray(node) {
		return len(node.Content)
	}
	return 0
}

// schema build result container used for async building.
type schemaProxyBuildResult struct {
	k low.KeyReference[string]
	v low.ValueReference[*SchemaProxy]
}

// extract extensions from schema
func (s *Schema) extractExtensions(root *yaml.Node) {
	s.Extensions = low.ExtractExtensions(root)
}

// build out a child schema for parent schema.
func buildSchema(ctx context.Context, schemas chan schemaProxyBuildResult, labelNode, valueNode *yaml.Node, errors chan error, idx *index.SpecIndex) {
	if valueNode != nil {
		type buildResult struct {
			res *low.ValueReference[*SchemaProxy]
			idx int
		}

		syncChan := make(chan buildResult)

		// build out a SchemaProxy for every sub-schema.
		build := func(pctx context.Context, fIdx *index.SpecIndex, kn, vn *yaml.Node, rf *yaml.Node, schemaIdx int, c chan buildResult,
			isRef bool, refLocation string,
		) buildResult {
			// a proxy design works best here. polymorphism, pretty much guarantees that a sub-schema can
			// take on circular references through polymorphism. Like the resolver, if we try and follow these
			// journey's through hyperspace, we will end up creating endless amounts of threads, spinning off
			// chasing down circles, that in turn spin up endless threads.
			// In order to combat this, we need a schema proxy that will only resolve the schema when asked, and then
			// it will only do it one level at a time.
			sp := new(SchemaProxy)
			sp.kn = kn
			sp.vn = vn
			sp.idx = fIdx
			sp.ctx = pctx
			if isRef {
				sp.SetReference(refLocation, rf)
			}
			res := &low.ValueReference[*SchemaProxy]{
				Value:     sp,
				ValueNode: vn,
			}
			return buildResult{
				res: res,
				idx: schemaIdx,
			}
		}

		isRef := false
		refLocation := ""
		var refNode *yaml.Node
		foundCtx := ctx
		foundIdx := idx
		if utils.IsNodeMap(valueNode) {
			h := false
			if h, _, refLocation = utils.IsNodeRefValue(valueNode); h {
				isRef = true
				ref, fIdx, _, fctx := low.LocateRefNodeWithContext(foundCtx, valueNode, foundIdx)
				if ref != nil {
					refNode = valueNode
					valueNode = ref
					foundCtx = fctx
					foundIdx = fIdx
				} else {
					errors <- fmt.Errorf("build schema failed: reference cannot be found: %s, line %d, col %d",
						valueNode.Content[1].Value, valueNode.Content[1].Line, valueNode.Content[1].Column)
				}
			}

			// this only runs once, however to keep things consistent, it makes sense to use the same async method
			// that arrays will use.
			r := build(foundCtx, foundIdx, labelNode, valueNode, refNode, -1, syncChan, isRef, refLocation)
			schemas <- schemaProxyBuildResult{
				k: low.KeyReference[string]{
					KeyNode: labelNode,
					Value:   labelNode.Value,
				},
				v: *r.res,
			}
		} else if utils.IsNodeArray(valueNode) {
			refBuilds := 0
			results := make([]*low.ValueReference[*SchemaProxy], len(valueNode.Content))

			for i, vn := range valueNode.Content {
				isRef = false
				h := false
				foundIdx = idx
				foundCtx = ctx
				if h, _, refLocation = utils.IsNodeRefValue(vn); h {
					isRef = true
					ref, fIdx, _, fctx := low.LocateRefNodeWithContext(foundCtx, vn, foundIdx)
					if ref != nil {
						refNode = vn
						vn = ref
						foundCtx = fctx
						foundIdx = fIdx
					} else {
						err := fmt.Errorf("build schema failed: reference cannot be found: %s, line %d, col %d",
							vn.Content[1].Value, vn.Content[1].Line, vn.Content[1].Column)
						errors <- err
						return
					}
				}
				refBuilds++
				r := build(foundCtx, foundIdx, vn, vn, refNode, i, syncChan, isRef, refLocation)
				results[r.idx] = r.res
			}

			for _, r := range results {
				schemas <- schemaProxyBuildResult{
					k: low.KeyReference[string]{
						KeyNode: labelNode,
						Value:   labelNode.Value,
					},
					v: *r,
				}
			}
		} else {
			errors <- fmt.Errorf("build schema failed: unexpected data type: '%s', line %d, col %d",
				utils.MakeTagReadable(valueNode), valueNode.Line, valueNode.Column)
		}
	}
}

// ExtractSchema will return a pointer to a NodeReference that contains a *SchemaProxy if successful. The function
// will specifically look for a key node named 'schema' and extract the value mapped to that key. If the operation
// fails then no NodeReference is returned and an error is returned instead.
func ExtractSchema(ctx context.Context, root *yaml.Node, idx *index.SpecIndex) (*low.NodeReference[*SchemaProxy], error) {
	var schLabel, schNode *yaml.Node
	errStr := "schema build failed: reference '%s' cannot be found at line %d, col %d"

	refLocation := ""
	var refNode *yaml.Node

	foundIndex := idx
	foundCtx := ctx
	if rf, rl, _ := utils.IsNodeRefValue(root); rf {
		// locate reference in index.
		ref, fIdx, _, nCtx := low.LocateRefNodeWithContext(ctx, root, idx)
		if ref != nil {
			schNode = ref
			schLabel = rl
			foundCtx = nCtx
			foundIndex = fIdx
		} else {
			v := root.Content[1].Value
			if root.Content[1].Value == "" {
				v = "[empty]"
			}
			return nil, fmt.Errorf(errStr,
				v, root.Content[1].Line, root.Content[1].Column)
		}
	} else {
		_, schLabel, schNode = utils.FindKeyNodeFull(SchemaLabel, root.Content)
		if schNode != nil {
			h := false
			if h, _, refLocation = utils.IsNodeRefValue(schNode); h {
				ref, fIdx, _, nCtx := low.LocateRefNodeWithContext(foundCtx, schNode, foundIndex)
				if ref != nil {
					refNode = schNode
					schNode = ref
					if fIdx != nil {
						foundIndex = fIdx
					}
					foundCtx = nCtx
				} else {
					v := schNode.Content[1].Value
					if schNode.Content[1].Value == "" {
						v = "[empty]"
					}
					return nil, fmt.Errorf(errStr,
						v, schNode.Content[1].Line, schNode.Content[1].Column)
				}
			}
		}
	}

	if schNode != nil {
		// check if schema has already been built.
		schema := &SchemaProxy{kn: schLabel, vn: schNode, idx: foundIndex, ctx: foundCtx}
		schema.SetReference(refLocation, refNode)

		n := &low.NodeReference[*SchemaProxy]{
			Value:     schema,
			KeyNode:   schLabel,
			ValueNode: schNode,
		}
		n.SetReference(refLocation, refNode)
		return n, nil
	}
	return nil, nil
}
