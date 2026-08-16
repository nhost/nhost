package action

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/nhost/nhost/services/constellation/connector/action/transform"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const (
	// ConnectorName is the reserved internal source name used for the action connector.
	ConnectorName             = "__constellation_internal_actions"
	queryRootTypeName         = "Query"
	mutationRootTypeName      = "Mutation"
	deprecatedReason          = "No longer supported"
	baseConnectorOptionCount  = 3
	asyncGeneratedScalarCount = 3
)

// Connector exposes and executes valid Hasura Actions.
type Connector struct {
	schemas            map[string]*graph.Schema
	outputTypeByAction map[string]string
	actions            map[string]runtimeAction
	typeKinds          map[string]customTypeKind
	enumValues         map[string]map[string]struct{}
	objectFieldTypes   map[string]map[string]*ast.Type
	asyncResultTypes   map[string]struct{}
	httpClient         *httpClient
	asyncStore         ActionLogStore
	asyncStoreOwned    bool
	asyncWorker        *asyncWorker
	hasAsyncActions    bool
}

type runtimeAction struct {
	name                 string
	operation            ast.Operation
	async                bool
	roles                map[string]struct{}
	url                  string
	headers              map[string]string
	timeout              time.Duration
	forwardClientHeaders bool
	requestTransform     *transform.Request
	responseTransform    *transform.Response
}

// RelationshipTargetKey identifies a database table that action custom object
// relationships may target.
type RelationshipTargetKey struct {
	Source string
	Schema string
	Table  string
}

// RelationshipTarget describes a relationship target table as exposed per role.
type RelationshipTarget struct {
	Roles map[string]RelationshipTargetRole
}

// RelationshipTargetRole describes the target fields visible to one role.
type RelationshipTargetRole struct {
	Fields map[string]struct{}
}

// RelationshipTargets is the set of database tables available to action
// custom object relationships, keyed by source/schema/table.
type RelationshipTargets map[RelationshipTargetKey]RelationshipTarget

type schemaOptions struct {
	occupiedRootFields  map[string]map[string]struct{}
	occupiedTypeNames   map[string]map[string]struct{}
	relationshipTargets RelationshipTargets
	asyncConfig         AsyncConfig
}

// Option customises action connector construction.
type Option func(*schemaOptions)

func withOccupiedRootFields(fields map[string]map[string]struct{}) Option {
	return func(opts *schemaOptions) {
		opts.occupiedRootFields = fields
	}
}

func withOccupiedTypeNames(names map[string]map[string]struct{}) Option {
	return func(opts *schemaOptions) {
		opts.occupiedTypeNames = names
	}
}

func withRelationshipTargets(targets RelationshipTargets) Option {
	return func(opts *schemaOptions) {
		opts.relationshipTargets = targets
	}
}

// WithAsyncConfig configures asynchronous action persistence and worker
// execution. Passing an empty config leaves asynchronous actions inconsistent.
func WithAsyncConfig(config AsyncConfig) Option {
	return func(opts *schemaOptions) {
		opts.asyncConfig = config
	}
}

// New creates the action connector from parsed metadata. relationshipTargets
// describes database tables that custom object relationships may target.
// occupiedRootFields and occupiedTypeNames describe fields/types already owned
// by database or remote schema connectors, keyed by role, so action conflicts
// can be filtered before composition drops a whole role. Passing nil doer uses
// the hardened default HTTP client.
func New(
	ctx context.Context,
	meta *metadata.Metadata,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
	doer HTTPDoer,
	relationshipTargets RelationshipTargets,
	occupiedRootFields map[string]map[string]struct{},
	occupiedTypeNames map[string]map[string]struct{},
	opts ...Option,
) *Connector {
	allOpts := make([]Option, 0, len(opts)+baseConnectorOptionCount)
	allOpts = append(
		allOpts,
		withRelationshipTargets(relationshipTargets),
		withOccupiedRootFields(occupiedRootFields),
		withOccupiedTypeNames(occupiedTypeNames),
	)
	allOpts = append(allOpts, opts...)

	return newConnectorWithDoer(
		ctx,
		meta,
		inconsistencies,
		logger,
		doer,
		allOpts...,
	)
}

func newConnector(
	ctx context.Context,
	meta *metadata.Metadata,
	inconsistencies *metadata.Inconsistencies,
	opts ...Option,
) *Connector {
	return newConnectorWithDoer(ctx, meta, inconsistencies, nil, nil, opts...)
}

func newConnectorWithDoer( //nolint:funlen // Constructor wiring keeps schema/async runtime fields adjacent.
	ctx context.Context,
	meta *metadata.Metadata,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
	doer HTTPDoer,
	opts ...Option,
) *Connector {
	if inconsistencies == nil {
		inconsistencies = metadata.NewInconsistencies()
	}

	options := schemaOptions{
		occupiedRootFields:  nil,
		occupiedTypeNames:   nil,
		relationshipTargets: nil,
		asyncConfig: AsyncConfig{
			Store:             nil,
			CloseStore:        false,
			UnavailableReason: "",
			WorkerEnabled:     false,
			PollInterval:      0,
			BatchSize:         0,
			MaxConcurrency:    0,
			ShutdownTimeout:   0,
		},
	}
	for _, opt := range opts {
		opt(&options)
	}

	builder := &schemaBuilder{
		meta:                meta,
		inconsistencies:     inconsistencies,
		logger:              logger,
		options:             options,
		typeDefs:            make(map[string]*typeDefinition),
		invalidTypes:        make(map[string]struct{}),
		reportedActions:     make(map[string]map[string]struct{}),
		reportedCustomTypes: make(map[string]map[string]struct{}),
	}

	schemas, outputTypeByAction, actions := builder.build(ctx)
	typeKinds, enumValues, objectFieldTypes := builder.runtimeTypeInfo(actions)

	asyncConfig := options.asyncConfig.withDefaults()
	conn := &Connector{
		schemas:            schemas,
		outputTypeByAction: outputTypeByAction,
		actions:            runtimeActionsByName(actions),
		typeKinds:          typeKinds,
		enumValues:         enumValues,
		objectFieldTypes:   objectFieldTypes,
		asyncResultTypes:   asyncResultTypes(actions),
		httpClient:         newHTTPClient(doer),
		asyncStore:         asyncConfig.Store,
		asyncStoreOwned:    asyncConfig.CloseStore,
		asyncWorker:        nil,
		hasAsyncActions:    hasAsyncActions(actions),
	}

	if asyncConfig.WorkerEnabled && asyncConfig.Store != nil && conn.hasAsyncActions {
		conn.asyncWorker = newAsyncWorker(conn, asyncConfig, logger)
		conn.asyncWorker.start(ctx)
	}

	return conn
}

func (c *Connector) GetSchema() (map[string]*graph.Schema, error) {
	return c.schemas, nil
}

func (c *Connector) ValidateOperation(
	*ast.OperationDefinition,
	ast.FragmentDefinitionList,
	map[string]any,
	string,
	map[string]any,
) error {
	return nil
}

func (c *Connector) GetTypeName(identifier string) string {
	return c.outputTypeByAction[identifier]
}

func (c *Connector) Close() {
	c.CloseWithContext(context.Background())
}

// CloseWithContext releases connector resources using ctx for bounded worker
// shutdown and requeue attempts.
func (c *Connector) CloseWithContext(ctx context.Context) {
	if c.asyncWorker != nil {
		c.asyncWorker.Close(ctx)
	}

	if c.asyncStore != nil && c.asyncStoreOwned {
		c.asyncStore.Close()
	}
}

type customTypeKind string

const (
	customTypeKindScalar customTypeKind = "scalar"
	customTypeKindEnum   customTypeKind = "enum"
	customTypeKindInput  customTypeKind = "input"
	customTypeKindObject customTypeKind = "object"
)

type typePosition string

const (
	typePositionInput  typePosition = "input"
	typePositionOutput typePosition = "output"
)

const (
	visitStateVisiting = 1
	visitStateDone     = 2
)

type parsedField struct {
	name        string
	description string
	typeRef     *graph.Type
	baseType    string
}

type typeDefinition struct {
	name    string
	kind    customTypeKind
	scalar  metadata.CustomScalarType
	enum    metadata.CustomEnumType
	input   metadata.CustomInputObjectType
	object  metadata.CustomObjectType
	fields  []parsedField
	refs    []string
	invalid bool
}

type actionDefinition struct {
	meta              metadata.ActionMetadata
	operation         ast.Operation
	async             bool
	arguments         []*graph.Argument
	outputType        *graph.Type
	outputBase        string
	responseTypeName  string
	reachableTypes    map[string]struct{}
	url               string
	headers           map[string]string
	timeout           time.Duration
	requestTransform  *transform.Request
	responseTransform *transform.Response
}

type schemaBuilder struct {
	meta                *metadata.Metadata
	inconsistencies     *metadata.Inconsistencies
	logger              *slog.Logger
	options             schemaOptions
	typeDefs            map[string]*typeDefinition
	invalidTypes        map[string]struct{}
	reportedActions     map[string]map[string]struct{}
	reportedCustomTypes map[string]map[string]struct{}
}

func (b *schemaBuilder) build(
	ctx context.Context,
) (map[string]*graph.Schema, map[string]string, []actionDefinition) {
	if b.meta == nil {
		return map[string]*graph.Schema{}, map[string]string{}, nil
	}

	b.collectCustomTypes(ctx)
	actions := b.collectActions(ctx)

	outputTypeByAction := make(map[string]string, len(actions))
	for _, action := range actions {
		outputTypeByAction[action.meta.Name] = action.outputBase
	}

	roles := rolesForActions(actions)

	schemas := make(map[string]*graph.Schema, len(roles))
	for _, role := range roles {
		schema := b.buildRoleSchema(ctx, role, actions)
		if schema != nil {
			schemas[role] = schema
		}
	}

	return schemas, outputTypeByAction, actions
}

func (b *schemaBuilder) runtimeTypeInfo(actions []actionDefinition) (
	map[string]customTypeKind,
	map[string]map[string]struct{},
	map[string]map[string]*ast.Type,
) {
	typeKinds := make(
		map[string]customTypeKind,
		len(b.typeDefs)+len(actions)+asyncGeneratedScalarCount,
	)
	enumValues := make(map[string]map[string]struct{})
	objectFieldTypes := make(map[string]map[string]*ast.Type)

	for name, def := range b.typeDefs {
		if def.invalid {
			continue
		}

		typeKinds[name] = def.kind
		switch def.kind {
		case customTypeKindEnum:
			values := make(map[string]struct{}, len(def.enum.Values))
			for _, value := range def.enum.Values {
				values[value.Value] = struct{}{}
			}

			enumValues[name] = values
		case customTypeKindObject:
			fields := make(map[string]*ast.Type, len(def.fields))
			for _, field := range def.fields {
				fields[field.name] = astTypeFromGraph(field.typeRef)
			}

			objectFieldTypes[name] = fields
		case customTypeKindScalar, customTypeKindInput:
			continue
		}
	}

	for _, action := range actions {
		if !action.async {
			continue
		}

		typeKinds[action.responseTypeName] = customTypeKindObject
		objectFieldTypes[action.responseTypeName] = map[string]*ast.Type{
			"id":         ast.NonNullNamedType(asyncScalarUUID, nil),
			"created_at": ast.NonNullNamedType(asyncScalarTimestamptz, nil),
			"errors":     ast.NamedType(asyncScalarJSONB, nil),
			"output":     astTypeFromGraph(asyncOutputType(action.outputType)),
		}
	}

	if hasAsyncActions(actions) {
		typeKinds[asyncScalarUUID] = customTypeKindScalar
		typeKinds[asyncScalarTimestamptz] = customTypeKindScalar
		typeKinds[asyncScalarJSONB] = customTypeKindScalar
	}

	return typeKinds, enumValues, objectFieldTypes
}

func runtimeActionsByName(actions []actionDefinition) map[string]runtimeAction {
	byName := make(map[string]runtimeAction, len(actions))
	for _, action := range actions {
		byName[action.meta.Name] = runtimeAction{
			name:                 action.meta.Name,
			operation:            action.operation,
			async:                action.async,
			roles:                rolesForAction(action.meta),
			url:                  action.url,
			headers:              action.headers,
			timeout:              action.timeout,
			forwardClientHeaders: action.meta.Definition.ForwardClientHeaders,
			requestTransform:     action.requestTransform,
			responseTransform:    action.responseTransform,
		}
	}

	return byName
}

func (b *schemaBuilder) collectCustomTypes(ctx context.Context) {
	defs := b.customTypeDefinitions()
	defsByName := make(map[string][]*typeDefinition, len(defs))

	for _, def := range defs {
		if !isGraphQLName(def.name) {
			b.invalidTypes[def.name] = struct{}{}
			b.recordCustomType(ctx, def.name, fmt.Sprintf("invalid GraphQL type name %q", def.name))

			continue
		}

		if isBuiltinScalar(def.name) || isRootTypeName(def.name) {
			b.invalidTypes[def.name] = struct{}{}
			b.recordCustomType(
				ctx,
				def.name,
				fmt.Sprintf("custom type name %q is reserved", def.name),
			)

			continue
		}

		defsByName[def.name] = append(defsByName[def.name], def)
	}

	for name, namedDefs := range defsByName {
		if len(namedDefs) > 1 {
			b.invalidTypes[name] = struct{}{}
			b.recordCustomType(ctx, name, "duplicate custom type name")

			continue
		}

		b.typeDefs[name] = namedDefs[0]
	}

	b.validateTypeDefinitions(ctx)
	b.invalidateCustomTypeCycles(ctx, customTypeKindInput)
	b.propagateInvalidTypeReferences(ctx)
}

func emptyCustomScalar() metadata.CustomScalarType {
	return metadata.CustomScalarType{
		Name:        "",
		Description: "",
	}
}

func emptyCustomEnum() metadata.CustomEnumType {
	return metadata.CustomEnumType{
		Name:        "",
		Description: "",
		Values:      nil,
	}
}

func emptyCustomInputObject() metadata.CustomInputObjectType {
	return metadata.CustomInputObjectType{
		Name:        "",
		Description: "",
		Fields:      nil,
	}
}

func emptyCustomObject() metadata.CustomObjectType {
	return metadata.CustomObjectType{
		Name:          "",
		Description:   "",
		Fields:        nil,
		Relationships: nil,
	}
}

func emptyActionMetadata() metadata.ActionMetadata {
	return metadata.ActionMetadata{
		Name: "",
		Definition: metadata.ActionDefinition{
			Kind:                 "",
			Handler:              "",
			ForwardClientHeaders: false,
			Headers:              nil,
			Timeout:              0,
			Type:                 "",
			Arguments:            nil,
			OutputType:           "",
			RequestTransform:     nil,
			ResponseTransform:    nil,
		},
		Permissions: nil,
		Comment:     "",
	}
}

func (b *schemaBuilder) customTypeDefinitions() []*typeDefinition {
	customTypes := b.meta.CustomTypes
	defs := make(
		[]*typeDefinition,
		0,
		len(customTypes.Scalars)+len(customTypes.Enums)+
			len(customTypes.InputObjects)+len(customTypes.Objects),
	)

	defs = appendScalarDefinitions(defs, customTypes.Scalars)
	defs = appendEnumDefinitions(defs, customTypes.Enums)
	defs = appendInputDefinitions(defs, customTypes.InputObjects)
	defs = appendObjectDefinitions(defs, customTypes.Objects)

	return defs
}

func appendScalarDefinitions(
	defs []*typeDefinition,
	scalars []metadata.CustomScalarType,
) []*typeDefinition {
	for _, scalar := range scalars {
		defs = append(defs, &typeDefinition{
			name:    scalar.Name,
			kind:    customTypeKindScalar,
			scalar:  scalar,
			enum:    emptyCustomEnum(),
			input:   emptyCustomInputObject(),
			object:  emptyCustomObject(),
			fields:  nil,
			refs:    nil,
			invalid: false,
		})
	}

	return defs
}

func appendEnumDefinitions(
	defs []*typeDefinition,
	enums []metadata.CustomEnumType,
) []*typeDefinition {
	for _, enumType := range enums {
		defs = append(defs, &typeDefinition{
			name:    enumType.Name,
			kind:    customTypeKindEnum,
			scalar:  emptyCustomScalar(),
			enum:    enumType,
			input:   emptyCustomInputObject(),
			object:  emptyCustomObject(),
			fields:  nil,
			refs:    nil,
			invalid: false,
		})
	}

	return defs
}

func appendInputDefinitions(
	defs []*typeDefinition,
	inputs []metadata.CustomInputObjectType,
) []*typeDefinition {
	for _, input := range inputs {
		defs = append(defs, &typeDefinition{
			name:    input.Name,
			kind:    customTypeKindInput,
			scalar:  emptyCustomScalar(),
			enum:    emptyCustomEnum(),
			input:   input,
			object:  emptyCustomObject(),
			fields:  nil,
			refs:    nil,
			invalid: false,
		})
	}

	return defs
}

func appendObjectDefinitions(
	defs []*typeDefinition,
	objects []metadata.CustomObjectType,
) []*typeDefinition {
	for _, object := range objects {
		defs = append(defs, &typeDefinition{
			name:    object.Name,
			kind:    customTypeKindObject,
			scalar:  emptyCustomScalar(),
			enum:    emptyCustomEnum(),
			input:   emptyCustomInputObject(),
			object:  object,
			fields:  nil,
			refs:    nil,
			invalid: false,
		})
	}

	return defs
}

func (b *schemaBuilder) validateTypeDefinitions(ctx context.Context) {
	for _, def := range b.sortedTypeDefs() {
		if def.invalid {
			continue
		}

		switch def.kind {
		case customTypeKindScalar:
			continue
		case customTypeKindEnum:
			b.validateEnum(ctx, def)
		case customTypeKindInput:
			b.validateCustomFields(ctx, def, def.input.Fields, typePositionInput)
		case customTypeKindObject:
			b.validateCustomFields(ctx, def, def.object.Fields, typePositionOutput)

			if !def.invalid {
				b.validateCustomObjectRelationships(ctx, def)
			}
		}
	}
}

func (b *schemaBuilder) validateEnum(ctx context.Context, def *typeDefinition) {
	if len(def.enum.Values) == 0 {
		b.invalidateType(ctx, def.name, "enum must define at least one value")

		return
	}

	seen := make(map[string]struct{}, len(def.enum.Values))
	for _, value := range def.enum.Values {
		if !isGraphQLName(value.Value) {
			b.invalidateType(
				ctx,
				def.name,
				fmt.Sprintf("enum value %q is not a valid GraphQL name", value.Value),
			)

			return
		}

		if _, ok := seen[value.Value]; ok {
			b.invalidateType(ctx, def.name, fmt.Sprintf("duplicate enum value %q", value.Value))

			return
		}

		seen[value.Value] = struct{}{}
	}
}

func (b *schemaBuilder) validateCustomFields(
	ctx context.Context,
	def *typeDefinition,
	fields []metadata.CustomTypeField,
	position typePosition,
) {
	if len(fields) == 0 {
		b.invalidateType(ctx, def.name, "custom type must define at least one field")

		return
	}

	seen := make(map[string]struct{}, len(fields))
	parsedFields := make([]parsedField, 0, len(fields))
	refs := make([]string, 0, len(fields))

	for _, field := range fields {
		parsed, reason, ok := b.parseCustomField(field, seen, position)
		if !ok {
			b.invalidateType(ctx, def.name, reason)

			return
		}

		parsedFields = append(parsedFields, parsed)
		if !isBuiltinScalar(parsed.baseType) {
			refs = append(refs, parsed.baseType)
		}
	}

	def.fields = parsedFields
	def.refs = refs
}

func (b *schemaBuilder) validateCustomObjectRelationships(
	ctx context.Context,
	def *typeDefinition,
) {
	if len(def.object.Relationships) == 0 {
		return
	}

	fieldNames := make(map[string]struct{}, len(def.fields))
	for _, field := range def.fields {
		fieldNames[field.name] = struct{}{}
	}

	seen := make(map[string]struct{}, len(def.object.Relationships))
	for _, rel := range def.object.Relationships {
		if reason, ok := b.validateCustomObjectRelationship(def, rel, fieldNames, seen); !ok {
			b.invalidateType(ctx, def.name, reason)

			return
		}
	}
}

func (b *schemaBuilder) validateCustomObjectRelationship(
	def *typeDefinition,
	rel metadata.CustomObjectRelationship,
	fieldNames map[string]struct{},
	seen map[string]struct{},
) (string, bool) {
	if reason, ok := validateCustomObjectRelationshipName(rel, fieldNames, seen); !ok {
		return reason, false
	}

	if rel.Type != metadata.RelationshipTypeObject && rel.Type != metadata.RelationshipTypeArray {
		return fmt.Sprintf("relationship %q has invalid type %q", rel.Name, rel.Type), false
	}

	target, reason, ok := b.customObjectRelationshipTarget(rel)
	if !ok {
		return reason, false
	}

	return validateCustomObjectRelationshipMapping(def, rel, fieldNames, target)
}

func validateCustomObjectRelationshipName(
	rel metadata.CustomObjectRelationship,
	fieldNames map[string]struct{},
	seen map[string]struct{},
) (string, bool) {
	if !isGraphQLName(rel.Name) {
		return fmt.Sprintf("relationship %q is not a valid GraphQL name", rel.Name), false
	}

	if _, duplicate := seen[rel.Name]; duplicate {
		return fmt.Sprintf("duplicate relationship %q", rel.Name), false
	}

	seen[rel.Name] = struct{}{}

	if _, conflicts := fieldNames[rel.Name]; conflicts {
		return fmt.Sprintf("relationship %q conflicts with a custom field", rel.Name), false
	}

	return "", true
}

func (b *schemaBuilder) customObjectRelationshipTarget(
	rel metadata.CustomObjectRelationship,
) (RelationshipTarget, string, bool) {
	if rel.Source == "" {
		return RelationshipTarget{Roles: nil},
			fmt.Sprintf("relationship %q is missing source", rel.Name),
			false
	}

	if rel.RemoteTable.Name == "" || rel.RemoteTable.Schema == "" {
		return RelationshipTarget{Roles: nil},
			fmt.Sprintf("relationship %q is missing remote_table", rel.Name),
			false
	}

	target, ok := b.options.relationshipTargets[RelationshipTargetKey{
		Source: rel.Source,
		Schema: rel.RemoteTable.Schema,
		Table:  rel.RemoteTable.Name,
	}]
	if !ok || len(target.Roles) == 0 {
		return RelationshipTarget{Roles: nil},
			fmt.Sprintf(
				"relationship %q target source/table %q.%q not found",
				rel.Name,
				rel.RemoteTable.Schema,
				rel.RemoteTable.Name,
			),
			false
	}

	return target, "", true
}

func validateCustomObjectRelationshipMapping(
	def *typeDefinition,
	rel metadata.CustomObjectRelationship,
	fieldNames map[string]struct{},
	target RelationshipTarget,
) (string, bool) {
	if len(rel.FieldMapping) == 0 {
		return fmt.Sprintf("relationship %q is missing field_mapping", rel.Name), false
	}

	for sourceField, targetField := range rel.FieldMapping {
		if _, exists := fieldNames[sourceField]; !exists {
			return fmt.Sprintf(
				"relationship %q source field %q not found on custom type %q",
				rel.Name,
				sourceField,
				def.name,
			), false
		}

		if targetField == "" {
			return fmt.Sprintf("relationship %q maps to an empty target field", rel.Name), false
		}

		if !relationshipTargetFieldVisible(target, targetField) {
			return fmt.Sprintf(
				"relationship %q target field %q not found on source/table %q.%q",
				rel.Name,
				targetField,
				rel.RemoteTable.Schema,
				rel.RemoteTable.Name,
			), false
		}
	}

	return "", true
}

func relationshipTargetFieldVisible(target RelationshipTarget, fieldName string) bool {
	for _, role := range target.Roles {
		if _, ok := role.Fields[fieldName]; ok {
			return true
		}
	}

	return false
}

func (b *schemaBuilder) parseCustomField(
	field metadata.CustomTypeField,
	seen map[string]struct{},
	position typePosition,
) (parsedField, string, bool) {
	if !isGraphQLName(field.Name) {
		return emptyParsedField(),
			fmt.Sprintf("field %q is not a valid GraphQL name", field.Name),
			false
	}

	if _, ok := seen[field.Name]; ok {
		return emptyParsedField(), fmt.Sprintf("duplicate field %q", field.Name), false
	}

	seen[field.Name] = struct{}{}

	typeRef, baseType, err := parseTypeRef(field.Type)
	if err != nil {
		return emptyParsedField(),
			fmt.Sprintf("field %q has invalid type reference: %v", field.Name, err),
			false
	}

	if err := b.validateTypeReference(baseType, position); err != nil {
		return emptyParsedField(),
			fmt.Sprintf("field %q has invalid %s type: %v", field.Name, position, err),
			false
	}

	return parsedField{
		name:        field.Name,
		description: field.Description,
		typeRef:     typeRef,
		baseType:    baseType,
	}, "", true
}

func emptyParsedField() parsedField {
	return parsedField{
		name:        "",
		description: "",
		typeRef:     nil,
		baseType:    "",
	}
}

func (b *schemaBuilder) validateTypeReference(baseType string, position typePosition) error {
	if isBuiltinScalar(baseType) {
		return nil
	}

	def, ok := b.typeDefs[baseType]
	if !ok {
		if _, invalid := b.invalidTypes[baseType]; invalid {
			return fmt.Errorf("%w %q", errInvalidCustomTypeRef, baseType)
		}

		return fmt.Errorf("%w %q", errUnknownTypeRef, baseType)
	}

	if def.invalid {
		return fmt.Errorf("%w %q", errInvalidCustomTypeRef, baseType)
	}

	switch position {
	case typePositionInput:
		if def.kind == customTypeKindObject {
			return fmt.Errorf("%w %q", errObjectTypeUsedAsInput, baseType)
		}
	case typePositionOutput:
		if def.kind == customTypeKindInput {
			return fmt.Errorf("%w %q", errInputObjectUsedAsOutput, baseType)
		}
	}

	return nil
}

func (b *schemaBuilder) invalidateCustomTypeCycles(ctx context.Context, kind customTypeKind) {
	state := make(map[string]int, len(b.typeDefs))
	stack := make([]string, 0)

	var visit func(string)

	visit = func(name string) {
		def, ok := b.typeDefs[name]
		if !ok || def.invalid || def.kind != kind {
			return
		}

		switch state[name] {
		case visitStateVisiting:
			cycleStart := slices.Index(stack, name)
			if cycleStart < 0 {
				return
			}

			cycle := slices.Clone(stack[cycleStart:])
			slices.Sort(cycle)

			for _, cycleType := range cycle {
				b.invalidateType(ctx, cycleType, "custom type cycle detected")
			}

			return
		case visitStateDone:
			return
		}

		state[name] = visitStateVisiting
		stack = append(stack, name)

		for _, refName := range def.refs {
			refDef, refOK := b.typeDefs[refName]
			if !refOK || refDef.kind != kind {
				continue
			}

			visit(refName)
		}

		stack = stack[:len(stack)-1]
		state[name] = visitStateDone
	}

	for _, def := range b.sortedTypeDefs() {
		if def.kind == kind {
			visit(def.name)
		}
	}
}

func (b *schemaBuilder) propagateInvalidTypeReferences(ctx context.Context) {
	for {
		changed := false

		for _, def := range b.sortedTypeDefs() {
			if def.invalid {
				continue
			}

			for _, refName := range def.refs {
				if _, invalid := b.invalidTypes[refName]; !invalid {
					continue
				}

				b.invalidateType(
					ctx,
					def.name,
					fmt.Sprintf("references invalid custom type %q", refName),
				)

				changed = true

				break
			}
		}

		if !changed {
			return
		}
	}
}

func (b *schemaBuilder) collectActions(ctx context.Context) []actionDefinition {
	duplicateNames := duplicateActionNames(b.meta.Actions)
	actions := make([]actionDefinition, 0, len(b.meta.Actions))

	for _, action := range b.meta.Actions {
		if _, duplicate := duplicateNames[action.Name]; duplicate {
			b.recordAction(ctx, action.Name, "duplicate action definition")

			continue
		}

		parsedAction, ok := b.validateAction(ctx, action)
		if !ok {
			continue
		}

		// An asynchronous action emits an object type named after the action
		// (asyncResponseTypeName == action name). If a custom object/input/
		// scalar/enum type already claims that name, emitting both would put two
		// definitions of the same type into one role schema, which
		// BuildValidatedSchema rejects — dropping the ENTIRE action connector for
		// affected roles. Drop only the offending async action instead, keeping
		// the custom type, and record an inconsistency on the action.
		if parsedAction.async {
			if def, exists := b.typeDefs[parsedAction.responseTypeName]; exists && !def.invalid {
				b.recordAction(ctx, action.Name, fmt.Sprintf(
					"asynchronous action %q conflicts with a custom type of the same name",
					action.Name,
				))

				continue
			}
		}

		actions = append(actions, parsedAction)
	}

	return actions
}

func duplicateActionNames(actions []metadata.ActionMetadata) map[string]struct{} {
	counts := make(map[string]int, len(actions))
	for _, action := range actions {
		counts[action.Name]++
	}

	duplicates := make(map[string]struct{})
	for name, count := range counts {
		if count > 1 {
			duplicates[name] = struct{}{}
		}
	}

	return duplicates
}

//nolint:funlen // Action validation is a linear sequence with early inconsistency records.
func (b *schemaBuilder) validateAction(
	ctx context.Context,
	action metadata.ActionMetadata,
) (actionDefinition, bool) {
	if !isGraphQLName(action.Name) {
		b.recordAction(ctx, action.Name, fmt.Sprintf("invalid GraphQL field name %q", action.Name))

		return emptyActionDefinition(), false
	}

	operation, ok := b.validateActionOperation(ctx, action)
	if !ok {
		return emptyActionDefinition(), false
	}

	async, ok := b.validateActionKind(ctx, action, operation)
	if !ok {
		return emptyActionDefinition(), false
	}

	requestTransform, responseTransform, ok := b.validateActionTransforms(ctx, action)
	if !ok {
		return emptyActionDefinition(), false
	}

	handlerURL, ok := b.validateActionHandler(ctx, action)
	if !ok {
		return emptyActionDefinition(), false
	}

	headers, ok := b.validateActionHeaders(ctx, action)
	if !ok {
		return emptyActionDefinition(), false
	}

	timeout, ok := b.validateActionTimeout(ctx, action)
	if !ok {
		return emptyActionDefinition(), false
	}

	arguments, ok := b.validateActionArguments(ctx, action)
	if !ok {
		return emptyActionDefinition(), false
	}

	outputType, outputBase, ok := b.validateActionOutput(ctx, action)
	if !ok {
		return emptyActionDefinition(), false
	}

	reachableTypes := make(map[string]struct{})
	for _, argument := range arguments {
		b.collectReachableTypes(argument.Type, reachableTypes)
	}

	b.collectReachableTypes(outputType, reachableTypes)

	return actionDefinition{
		meta:              action,
		operation:         operation,
		async:             async,
		arguments:         arguments,
		outputType:        outputType,
		outputBase:        outputBase,
		responseTypeName:  asyncResponseTypeName(action.Name),
		reachableTypes:    reachableTypes,
		url:               handlerURL,
		headers:           headers,
		timeout:           timeout,
		requestTransform:  requestTransform,
		responseTransform: responseTransform,
	}, true
}

func (b *schemaBuilder) validateActionHandler(
	ctx context.Context,
	action metadata.ActionMetadata,
) (string, bool) {
	handlerURL, err := action.Definition.Handler.Resolve()
	if err != nil {
		b.recordAction(ctx, action.Name, fmt.Sprintf("resolving handler URL: %v", err))

		return "", false
	}

	if err := validateActionURL(handlerURL); err != nil {
		b.recordAction(ctx, action.Name, fmt.Sprintf("invalid handler URL: %v", err))

		return "", false
	}

	return handlerURL, true
}

func (b *schemaBuilder) validateActionHeaders(
	ctx context.Context,
	action metadata.ActionMetadata,
) (map[string]string, bool) {
	headers, err := buildActionHeaders(action)
	if err != nil {
		b.recordAction(ctx, action.Name, fmt.Sprintf("building headers: %v", err))

		return nil, false
	}

	return headers, true
}

func (b *schemaBuilder) validateActionTimeout(
	ctx context.Context,
	action metadata.ActionMetadata,
) (time.Duration, bool) {
	timeout := action.Definition.Timeout
	if timeout < 0 {
		b.recordAction(ctx, action.Name, fmt.Sprintf("invalid timeout %d", timeout))

		return 0, false
	}

	if timeout == 0 {
		timeout = defaultTimeoutSeconds
	}

	return time.Duration(timeout) * time.Second, true
}

func (b *schemaBuilder) validateActionOperation(
	ctx context.Context,
	action metadata.ActionMetadata,
) (ast.Operation, bool) {
	operation, ok := operationForAction(action.Definition.Type)
	if !ok {
		b.recordAction(
			ctx,
			action.Name,
			fmt.Sprintf("unsupported action operation %q", action.Definition.Type),
		)
	}

	return operation, ok
}

func (b *schemaBuilder) validateActionKind(
	ctx context.Context,
	action metadata.ActionMetadata,
	operation ast.Operation,
) (bool, bool) {
	switch action.Definition.Kind {
	case "", metadata.ActionKindSynchronous:
		return false, true
	case metadata.ActionKindAsynchronous:
		if operation != ast.Mutation {
			b.recordAction(ctx, action.Name, "asynchronous actions must be mutations")

			return false, false
		}

		if b.options.asyncConfig.Store == nil {
			reason := b.options.asyncConfig.UnavailableReason
			if reason == "" {
				reason = "asynchronous action log store is not configured"
			}

			b.recordAction(ctx, action.Name, reason)

			return false, false
		}

		return true, true
	default:
		b.recordAction(
			ctx,
			action.Name,
			fmt.Sprintf("unsupported action kind %q", action.Definition.Kind),
		)

		return false, false
	}
}

func (b *schemaBuilder) validateActionTransforms(
	ctx context.Context,
	action metadata.ActionMetadata,
) (*transform.Request, *transform.Response, bool) {
	requestTransform, err := transform.CompileRequest(action.Definition.RequestTransform)
	if err != nil {
		b.recordAction(ctx, action.Name, fmt.Sprintf("invalid request transform: %v", err))

		return nil, nil, false
	}

	responseTransform, err := transform.CompileResponse(action.Definition.ResponseTransform)
	if err != nil {
		b.recordAction(ctx, action.Name, fmt.Sprintf("invalid response transform: %v", err))

		return nil, nil, false
	}

	return requestTransform, responseTransform, true
}

func (b *schemaBuilder) validateActionOutput(
	ctx context.Context,
	action metadata.ActionMetadata,
) (*graph.Type, string, bool) {
	outputType, outputBase, err := parseTypeRef(action.Definition.OutputType)
	if err != nil {
		b.recordAction(ctx, action.Name, fmt.Sprintf("invalid output type: %v", err))

		return nil, "", false
	}

	if err := b.validateTypeReference(outputBase, typePositionOutput); err != nil {
		b.recordAction(ctx, action.Name, fmt.Sprintf("invalid output type: %v", err))

		return nil, "", false
	}

	return outputType, outputBase, true
}

func emptyActionDefinition() actionDefinition {
	return actionDefinition{
		meta:              emptyActionMetadata(),
		operation:         ast.Query,
		async:             false,
		arguments:         nil,
		outputType:        nil,
		outputBase:        "",
		responseTypeName:  "",
		reachableTypes:    nil,
		url:               "",
		headers:           nil,
		timeout:           0,
		requestTransform:  nil,
		responseTransform: nil,
	}
}

func (b *schemaBuilder) validateActionArguments(
	ctx context.Context,
	action metadata.ActionMetadata,
) ([]*graph.Argument, bool) {
	seen := make(map[string]struct{}, len(action.Definition.Arguments))
	arguments := make([]*graph.Argument, 0, len(action.Definition.Arguments))

	for _, argument := range action.Definition.Arguments {
		if !isGraphQLName(argument.Name) {
			b.recordAction(
				ctx,
				action.Name,
				fmt.Sprintf("argument %q is not a valid GraphQL name", argument.Name),
			)

			return nil, false
		}

		if _, ok := seen[argument.Name]; ok {
			b.recordAction(ctx, action.Name, fmt.Sprintf("duplicate argument %q", argument.Name))

			return nil, false
		}

		seen[argument.Name] = struct{}{}

		typeRef, baseType, err := parseTypeRef(argument.Type)
		if err != nil {
			b.recordAction(
				ctx,
				action.Name,
				fmt.Sprintf("argument %q has invalid type reference: %v", argument.Name, err),
			)

			return nil, false
		}

		if err := b.validateTypeReference(baseType, typePositionInput); err != nil {
			b.recordAction(
				ctx,
				action.Name,
				fmt.Sprintf("argument %q has invalid input type: %v", argument.Name, err),
			)

			return nil, false
		}

		arguments = append(arguments, &graph.Argument{
			Name:         argument.Name,
			Description:  argument.Description,
			Type:         typeRef,
			DefaultValue: nil,
			Directives:   nil,
		})
	}

	return arguments, true
}

func (b *schemaBuilder) collectReachableTypes(
	typeRef *graph.Type,
	reachable map[string]struct{},
) {
	baseType := graphBaseTypeName(typeRef)
	if baseType == "" || isBuiltinScalar(baseType) {
		return
	}

	def, ok := b.typeDefs[baseType]
	if !ok || def.invalid {
		return
	}

	if _, seen := reachable[baseType]; seen {
		return
	}

	reachable[baseType] = struct{}{}
	for _, refName := range def.refs {
		refDef, refOK := b.typeDefs[refName]
		if !refOK || refDef.invalid {
			continue
		}

		b.collectReachableTypes(graph.NewNamedType(refName), reachable)
	}
}

func rolesForActions(actions []actionDefinition) []string {
	if len(actions) == 0 {
		return nil
	}

	roles := map[string]struct{}{}
	for _, action := range actions {
		for role := range rolesForAction(action.meta) {
			roles[role] = struct{}{}
		}
	}

	result := make([]string, 0, len(roles))
	for role := range roles {
		result = append(result, role)
	}

	slices.Sort(result)

	return result
}

func rolesForAction(action metadata.ActionMetadata) map[string]struct{} {
	roles := map[string]struct{}{metadata.RoleAdmin: {}}
	for _, permission := range action.Permissions {
		if permission.Role == "" {
			continue
		}

		roles[permission.Role] = struct{}{}
	}

	return roles
}

func hasAsyncActions(actions []actionDefinition) bool {
	for _, action := range actions {
		if action.async {
			return true
		}
	}

	return false
}

func (b *schemaBuilder) buildRoleSchema(
	ctx context.Context,
	role string,
	actions []actionDefinition,
) *graph.Schema {
	queryFields, mutationFields, subscriptionFields, reachableTypes, asyncActions := b.collectRoleFields(
		ctx,
		role,
		actions,
	)
	if len(queryFields) == 0 && len(mutationFields) == 0 && len(subscriptionFields) == 0 {
		return nil
	}

	slices.SortFunc(queryFields, compareFields)
	slices.SortFunc(mutationFields, compareFields)
	slices.SortFunc(subscriptionFields, compareFields)

	schema := newEmptyGraphSchema()
	appendRootType(schema, ast.Query, queryRootTypeName, queryFields)
	appendRootType(schema, ast.Mutation, mutationRootTypeName, mutationFields)
	appendRootType(schema, ast.Subscription, "Subscription", subscriptionFields)
	b.appendReachableCustomTypes(schema, reachableTypes)
	appendAsyncTypes(schema, asyncActions)

	return schema
}

func (b *schemaBuilder) collectRoleFields(
	ctx context.Context,
	role string,
	actions []actionDefinition,
) ([]*graph.Field, []*graph.Field, []*graph.Field, map[string]struct{}, []actionDefinition) {
	queryFields := make([]*graph.Field, 0)
	mutationFields := make([]*graph.Field, 0)
	subscriptionFields := make([]*graph.Field, 0)
	reachableTypes := make(map[string]struct{})
	asyncActions := make([]actionDefinition, 0)

	for _, action := range actions {
		if !actionVisibleToRole(action.meta, role) || b.actionHasRoleConflict(ctx, role, action) {
			continue
		}

		if action.async {
			mutationFields = append(mutationFields, asyncMutationField(action))
			queryFields = append(queryFields, asyncResultField(action))
			subscriptionFields = append(subscriptionFields, asyncResultField(action))
			asyncActions = append(asyncActions, action)
		} else {
			field := actionField(action)
			switch action.operation {
			case ast.Query:
				queryFields = append(queryFields, field)
			case ast.Mutation:
				mutationFields = append(mutationFields, field)
			case ast.Subscription:
				continue
			}
		}

		for typeName := range action.reachableTypes {
			reachableTypes[typeName] = struct{}{}
		}
	}

	return queryFields, mutationFields, subscriptionFields, reachableTypes, asyncActions
}

func newEmptyGraphSchema() *graph.Schema {
	return &graph.Schema{
		Types:            nil,
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
		QueryType:        nil,
		MutationType:     nil,
		SubscriptionType: nil,
	}
}

func appendRootType(
	schema *graph.Schema,
	operation ast.Operation,
	rootName string,
	fields []*graph.Field,
) {
	if len(fields) == 0 {
		return
	}

	name := rootName
	switch operation {
	case ast.Query:
		schema.QueryType = &name
	case ast.Mutation:
		schema.MutationType = &name
	case ast.Subscription:
		schema.SubscriptionType = &name
	}

	schema.Types = append(schema.Types, &graph.ObjectType{
		Name:        name,
		Description: "",
		Fields:      fields,
		Interfaces:  nil,
		Directives:  nil,
	})
}

func actionVisibleToRole(action metadata.ActionMetadata, role string) bool {
	if role == metadata.RoleAdmin {
		return true
	}

	for _, permission := range action.Permissions {
		if permission.Role == role {
			return true
		}
	}

	return false
}

func (b *schemaBuilder) actionHasRoleConflict(
	ctx context.Context,
	role string,
	action actionDefinition,
) bool {
	if occupiedFields := b.options.occupiedRootFields[role]; len(occupiedFields) > 0 {
		for _, operation := range actionRootOperations(action) {
			key := schemamerge.FieldKey(operation, action.meta.Name)
			if _, occupied := occupiedFields[key]; occupied {
				b.recordAction(
					ctx,
					action.meta.Name,
					fmt.Sprintf("root field %q conflicts for role %q", action.meta.Name, role),
				)

				return true
			}
		}
	}

	occupiedTypes := b.options.occupiedTypeNames[role]
	if len(occupiedTypes) == 0 {
		return false
	}

	typeNames := make(map[string]struct{}, len(action.reachableTypes)+1)
	for typeName := range action.reachableTypes {
		typeNames[typeName] = struct{}{}
	}

	if action.async {
		typeNames[action.responseTypeName] = struct{}{}
	}

	for _, typeName := range sortedNames(typeNames) {
		if _, occupied := occupiedTypes[typeName]; !occupied {
			continue
		}

		b.recordCustomType(
			ctx,
			typeName,
			fmt.Sprintf("custom type %q conflicts for role %q", typeName, role),
		)
		b.recordAction(
			ctx,
			action.meta.Name,
			fmt.Sprintf("custom type %q conflicts for role %q", typeName, role),
		)

		return true
	}

	return false
}

func actionRootOperations(action actionDefinition) []ast.Operation {
	if action.async {
		return []ast.Operation{ast.Mutation, ast.Query, ast.Subscription}
	}

	return []ast.Operation{action.operation}
}

func actionField(action actionDefinition) *graph.Field {
	return &graph.Field{
		Name:        action.meta.Name,
		Description: action.meta.Comment,
		Type:        action.outputType,
		Arguments:   action.arguments,
		Directives:  nil,
	}
}

func asyncMutationField(action actionDefinition) *graph.Field {
	return &graph.Field{
		Name:        action.meta.Name,
		Description: action.meta.Comment,
		Type:        graph.NewNonNullType(asyncScalarUUID),
		Arguments:   action.arguments,
		Directives:  nil,
	}
}

func asyncResultField(action actionDefinition) *graph.Field {
	return &graph.Field{
		Name:        action.meta.Name,
		Description: action.meta.Comment,
		Type:        graph.NewNamedType(action.responseTypeName),
		Arguments: []*graph.Argument{
			{
				Name:         "id",
				Description:  "",
				Type:         graph.NewNonNullType(asyncScalarUUID),
				DefaultValue: nil,
				Directives:   nil,
			},
		},
		Directives: nil,
	}
}

func asyncResultTypes(actions []actionDefinition) map[string]struct{} {
	out := make(map[string]struct{})
	for _, action := range actions {
		if action.async {
			out[action.responseTypeName] = struct{}{}
		}
	}

	return out
}

func appendAsyncTypes(schema *graph.Schema, actions []actionDefinition) {
	if len(actions) == 0 {
		return
	}

	schema.Scalars = append(
		schema.Scalars,
		&graph.ScalarType{Name: asyncScalarUUID, Description: "", Directives: nil},
		&graph.ScalarType{Name: asyncScalarTimestamptz, Description: "", Directives: nil},
		&graph.ScalarType{Name: asyncScalarJSONB, Description: "", Directives: nil},
	)

	slices.SortFunc(actions, func(a, b actionDefinition) int {
		return strings.Compare(a.responseTypeName, b.responseTypeName)
	})

	for _, action := range actions {
		schema.Types = append(schema.Types, asyncResponseType(action))
	}
}

func asyncResponseType(action actionDefinition) *graph.ObjectType {
	return &graph.ObjectType{
		Name:        action.responseTypeName,
		Description: "",
		Fields: []*graph.Field{
			{
				Name:        "id",
				Description: "",
				Type:        graph.NewNonNullType(asyncScalarUUID),
				Arguments:   nil,
				Directives:  nil,
			},
			{
				Name:        "created_at",
				Description: "",
				Type:        graph.NewNonNullType(asyncScalarTimestamptz),
				Arguments:   nil,
				Directives:  nil,
			},
			{
				Name:        "errors",
				Description: "",
				Type:        graph.NewNamedType(asyncScalarJSONB),
				Arguments:   nil,
				Directives:  nil,
			},
			{
				Name:        "output",
				Description: "",
				Type:        asyncOutputType(action.outputType),
				Arguments:   nil,
				Directives:  nil,
			},
		},
		Interfaces: nil,
		Directives: nil,
	}
}

// asyncOutputType returns the async-result `output` field type: the action's
// declared output type with any top-level NonNull stripped. A pending async log
// has no payload and the runtime returns output:null, so the field must be
// nullable even when the action declares a non-null output type (e.g.
// "AsyncEchoOutput!"). Hasura makes the async result `output` nullable for the
// same reason; emitting null for a schema-declared non-null field would be a
// GraphQL contract violation.
func asyncOutputType(t *graph.Type) *graph.Type {
	if t == nil || !t.NonNull {
		return t
	}

	return &graph.Type{NamedType: t.NamedType, NonNull: false, Elem: t.Elem}
}

func asyncResponseTypeName(actionName string) string {
	return actionName
}

func compareFields(a, b *graph.Field) int {
	return strings.Compare(a.Name, b.Name)
}

func (b *schemaBuilder) appendReachableCustomTypes(
	schema *graph.Schema,
	reachableTypes map[string]struct{},
) {
	for _, typeName := range sortedNames(reachableTypes) {
		def, ok := b.typeDefs[typeName]
		if !ok || def.invalid {
			continue
		}

		switch def.kind {
		case customTypeKindScalar:
			schema.Scalars = append(schema.Scalars, graphScalar(def))
		case customTypeKindEnum:
			schema.Enums = append(schema.Enums, graphEnum(def))
		case customTypeKindInput:
			schema.Inputs = append(schema.Inputs, graphInput(def))
		case customTypeKindObject:
			schema.Types = append(schema.Types, graphObject(def))
		}
	}
}

func graphScalar(def *typeDefinition) *graph.ScalarType {
	return &graph.ScalarType{
		Name:        def.scalar.Name,
		Description: def.scalar.Description,
		Directives:  nil,
	}
}

func graphEnum(def *typeDefinition) *graph.EnumType {
	values := make([]*graph.EnumValue, 0, len(def.enum.Values))
	for _, value := range def.enum.Values {
		directives := []*graph.Directive(nil)
		if value.IsDeprecated {
			reason := value.DeprecationReason
			if reason == "" {
				reason = deprecatedReason
			}

			directives = []*graph.Directive{
				{
					Name: "deprecated",
					Arguments: []*graph.DirectiveArgument{
						{
							Name:  "reason",
							Value: reason,
						},
					},
				},
			}
		}

		values = append(values, &graph.EnumValue{
			Name:        value.Value,
			Description: value.Description,
			Directives:  directives,
		})
	}

	return &graph.EnumType{
		Name:        def.enum.Name,
		Description: def.enum.Description,
		Values:      values,
		Directives:  nil,
	}
}

func graphInput(def *typeDefinition) *graph.InputObjectType {
	fields := make([]*graph.InputField, 0, len(def.fields))
	for _, field := range def.fields {
		fields = append(fields, &graph.InputField{
			Name:         field.name,
			Description:  field.description,
			Type:         field.typeRef,
			DefaultValue: nil,
			Directives:   nil,
		})
	}

	return &graph.InputObjectType{
		Name:        def.input.Name,
		Description: def.input.Description,
		Fields:      fields,
		Directives:  nil,
	}
}

func graphObject(def *typeDefinition) *graph.ObjectType {
	fields := make([]*graph.Field, 0, len(def.fields))
	for _, field := range def.fields {
		fields = append(fields, &graph.Field{
			Name:        field.name,
			Description: field.description,
			Type:        field.typeRef,
			Arguments:   nil,
			Directives:  nil,
		})
	}

	return &graph.ObjectType{
		Name:        def.object.Name,
		Description: def.object.Description,
		Fields:      fields,
		Interfaces:  nil,
		Directives:  nil,
	}
}

func (b *schemaBuilder) sortedTypeDefs() []*typeDefinition {
	names := make([]string, 0, len(b.typeDefs))
	for name := range b.typeDefs {
		names = append(names, name)
	}

	slices.Sort(names)

	defs := make([]*typeDefinition, 0, len(names))
	for _, name := range names {
		defs = append(defs, b.typeDefs[name])
	}

	return defs
}

func sortedNames(names map[string]struct{}) []string {
	result := make([]string, 0, len(names))
	for name := range names {
		result = append(result, name)
	}

	slices.Sort(result)

	return result
}

func (b *schemaBuilder) invalidateType(ctx context.Context, name, reason string) {
	if def, ok := b.typeDefs[name]; ok {
		def.invalid = true
	}

	b.invalidTypes[name] = struct{}{}
	b.recordCustomType(ctx, name, reason)
}

func (b *schemaBuilder) recordAction(ctx context.Context, name, reason string) {
	if b.hasReported(b.reportedActions, name, reason) {
		return
	}

	b.inconsistencies.RecordAction(ctx, b.logger, name, reason)
}

func (b *schemaBuilder) recordCustomType(ctx context.Context, name, reason string) {
	if b.hasReported(b.reportedCustomTypes, name, reason) {
		return
	}

	b.inconsistencies.RecordCustomType(ctx, b.logger, name, reason)
}

func (b *schemaBuilder) hasReported(
	reported map[string]map[string]struct{},
	name, reason string,
) bool {
	reasons := reported[name]
	if reasons == nil {
		reported[name] = map[string]struct{}{reason: {}}

		return false
	}

	if _, ok := reasons[reason]; ok {
		return true
	}

	reasons[reason] = struct{}{}

	return false
}

func operationForAction(operation string) (ast.Operation, bool) {
	switch operation {
	case metadata.ActionOperationQuery:
		return ast.Query, true
	case metadata.ActionOperationMutation:
		return ast.Mutation, true
	default:
		return ast.Query, false
	}
}

func parseTypeRef(raw string) (*graph.Type, string, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, "", errEmptyTypeReference
	}

	const (
		probeTypeName  = "__ActionTypeRefProbe"
		probeFieldName = "value"
	)

	doc, err := parser.ParseSchema(&ast.Source{
		Name:    "action_type_ref",
		Input:   fmt.Sprintf("type %s { %s: %s }", probeTypeName, probeFieldName, raw),
		BuiltIn: false,
	})
	if err != nil {
		return nil, "", fmt.Errorf("parsing GraphQL type reference %q: %w", raw, err)
	}

	if len(doc.Definitions) != 1 || doc.Definitions[0].Name != probeTypeName ||
		len(doc.Definitions[0].Fields) != 1 || doc.Definitions[0].Fields[0].Name != probeFieldName {
		return nil, "", fmt.Errorf("%w %q", errInvalidTypeReference, raw)
	}

	typeRef := graphTypeFromAST(doc.Definitions[0].Fields[0].Type)

	baseType := graphBaseTypeName(typeRef)
	if baseType == "" || !isGraphQLName(baseType) {
		return nil, "", fmt.Errorf("%w %q", errInvalidBaseType, baseType)
	}

	return typeRef, baseType, nil
}

func graphTypeFromAST(typeRef *ast.Type) *graph.Type {
	if typeRef == nil {
		return nil
	}

	if typeRef.Elem != nil {
		if typeRef.NonNull {
			return graph.NewNonNullListType(graphTypeFromAST(typeRef.Elem))
		}

		return graph.NewListType(graphTypeFromAST(typeRef.Elem))
	}

	if typeRef.NonNull {
		return graph.NewNonNullType(typeRef.NamedType)
	}

	return graph.NewNamedType(typeRef.NamedType)
}

func astTypeFromGraph(typeRef *graph.Type) *ast.Type {
	if typeRef == nil {
		return nil
	}

	if typeRef.Elem != nil {
		if typeRef.NonNull {
			return ast.NonNullListType(astTypeFromGraph(typeRef.Elem), nil)
		}

		return ast.ListType(astTypeFromGraph(typeRef.Elem), nil)
	}

	if typeRef.NonNull {
		return ast.NonNullNamedType(typeRef.NamedType, nil)
	}

	return ast.NamedType(typeRef.NamedType, nil)
}

func graphBaseTypeName(typeRef *graph.Type) string {
	if typeRef == nil {
		return ""
	}

	if typeRef.Elem != nil {
		return graphBaseTypeName(typeRef.Elem)
	}

	return typeRef.NamedType
}

func isBuiltinScalar(name string) bool {
	switch name {
	case "Boolean", "Float", "ID", "Int", "String":
		return true
	default:
		return false
	}
}

func isRootTypeName(name string) bool {
	switch name {
	case queryRootTypeName, mutationRootTypeName, "Subscription":
		return true
	default:
		return false
	}
}

func isGraphQLName(name string) bool {
	if name == "" || strings.HasPrefix(name, "__") {
		return false
	}

	for i, r := range name {
		if r == '_' || r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' {
			continue
		}

		if i > 0 && r >= '0' && r <= '9' {
			continue
		}

		return false
	}

	return true
}
