package action

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const (
	queryRootTypeName    = "Query"
	mutationRootTypeName = "Mutation"
	deprecatedReason     = "No longer supported"
)

// Connector exposes and executes valid synchronous Hasura Actions.
type Connector struct {
	schemas            map[string]*graph.Schema
	outputTypeByAction map[string]string
	actions            map[string]runtimeAction
	typeKinds          map[string]customTypeKind
	enumValues         map[string]map[string]struct{}
	httpClient         *httpClient
}

type runtimeAction struct {
	name                 string
	operation            ast.Operation
	url                  string
	headers              map[string]string
	timeout              time.Duration
	forwardClientHeaders bool
}

type schemaOptions struct {
	occupiedRootFields map[string]map[string]struct{}
	occupiedTypeNames  map[string]map[string]struct{}
}

type schemaOption func(*schemaOptions)

func withOccupiedRootFields(fields map[string]map[string]struct{}) schemaOption {
	return func(opts *schemaOptions) {
		opts.occupiedRootFields = fields
	}
}

func withOccupiedTypeNames(names map[string]map[string]struct{}) schemaOption {
	return func(opts *schemaOptions) {
		opts.occupiedTypeNames = names
	}
}

// New creates the action connector from parsed metadata. occupiedRootFields and
// occupiedTypeNames describe fields/types already owned by database or remote
// schema connectors, keyed by role, so action conflicts can be filtered before
// composition drops a whole role. Passing nil doer uses the hardened default
// HTTP client.
func New(
	ctx context.Context,
	meta *metadata.Metadata,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
	doer HTTPDoer,
	occupiedRootFields map[string]map[string]struct{},
	occupiedTypeNames map[string]map[string]struct{},
) *Connector {
	return newConnectorWithDoer(
		ctx,
		meta,
		inconsistencies,
		logger,
		doer,
		withOccupiedRootFields(occupiedRootFields),
		withOccupiedTypeNames(occupiedTypeNames),
	)
}

func newConnector(
	ctx context.Context,
	meta *metadata.Metadata,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
	opts ...schemaOption,
) *Connector {
	return newConnectorWithDoer(ctx, meta, inconsistencies, logger, nil, opts...)
}

func newConnectorWithDoer(
	ctx context.Context,
	meta *metadata.Metadata,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
	doer HTTPDoer,
	opts ...schemaOption,
) *Connector {
	if inconsistencies == nil {
		inconsistencies = metadata.NewInconsistencies()
	}

	options := schemaOptions{
		occupiedRootFields: nil,
		occupiedTypeNames:  nil,
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
	typeKinds, enumValues := builder.runtimeTypeInfo()

	return &Connector{
		schemas:            schemas,
		outputTypeByAction: outputTypeByAction,
		actions:            runtimeActionsByName(actions),
		typeKinds:          typeKinds,
		enumValues:         enumValues,
		httpClient:         newHTTPClient(doer),
	}
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

func (c *Connector) Close() {}

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
	meta           metadata.ActionMetadata
	operation      ast.Operation
	arguments      []*graph.Argument
	outputType     *graph.Type
	outputBase     string
	reachableTypes map[string]struct{}
	url            string
	headers        map[string]string
	timeout        time.Duration
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

func (b *schemaBuilder) runtimeTypeInfo() (
	map[string]customTypeKind,
	map[string]map[string]struct{},
) {
	typeKinds := make(map[string]customTypeKind, len(b.typeDefs))
	enumValues := make(map[string]map[string]struct{})

	for name, def := range b.typeDefs {
		if def.invalid {
			continue
		}

		typeKinds[name] = def.kind
		if def.kind != customTypeKindEnum {
			continue
		}

		values := make(map[string]struct{}, len(def.enum.Values))
		for _, value := range def.enum.Values {
			values[value.Value] = struct{}{}
		}

		enumValues[name] = values
	}

	return typeKinds, enumValues
}

func runtimeActionsByName(actions []actionDefinition) map[string]runtimeAction {
	byName := make(map[string]runtimeAction, len(actions))
	for _, action := range actions {
		byName[action.meta.Name] = runtimeAction{
			name:                 action.meta.Name,
			operation:            action.operation,
			url:                  action.url,
			headers:              action.headers,
			timeout:              action.timeout,
			forwardClientHeaders: action.meta.Definition.ForwardClientHeaders,
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
			if len(def.object.Relationships) > 0 {
				b.invalidateType(ctx, def.name, "custom object relationships are not supported yet")

				continue
			}

			b.validateCustomFields(ctx, def, def.object.Fields, typePositionOutput)
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

func (b *schemaBuilder) validateAction(
	ctx context.Context,
	action metadata.ActionMetadata,
) (actionDefinition, bool) {
	if !isGraphQLName(action.Name) {
		b.recordAction(ctx, action.Name, fmt.Sprintf("invalid GraphQL field name %q", action.Name))

		return emptyActionDefinition(), false
	}

	operation, ok := b.validateActionOperation(ctx, action)
	if !ok || !b.validateActionKind(ctx, action) || !b.validateActionTransforms(ctx, action) {
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
		meta:           action,
		operation:      operation,
		arguments:      arguments,
		outputType:     outputType,
		outputBase:     outputBase,
		reachableTypes: reachableTypes,
		url:            handlerURL,
		headers:        headers,
		timeout:        timeout,
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
) bool {
	switch action.Definition.Kind {
	case "", metadata.ActionKindSynchronous:
		return true
	case metadata.ActionKindAsynchronous:
		b.recordAction(ctx, action.Name, "asynchronous actions are not supported yet")

		return false
	default:
		b.recordAction(
			ctx,
			action.Name,
			fmt.Sprintf("unsupported action kind %q", action.Definition.Kind),
		)

		return false
	}
}

func (b *schemaBuilder) validateActionTransforms(
	ctx context.Context,
	action metadata.ActionMetadata,
) bool {
	if len(action.Definition.RequestTransform) == 0 &&
		len(action.Definition.ResponseTransform) == 0 {
		return true
	}

	b.recordAction(ctx, action.Name, "action transforms are not supported yet")

	return false
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
		meta:           emptyActionMetadata(),
		operation:      ast.Query,
		arguments:      nil,
		outputType:     nil,
		outputBase:     "",
		reachableTypes: nil,
		url:            "",
		headers:        nil,
		timeout:        0,
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

	roles := map[string]struct{}{metadata.RoleAdmin: {}}
	for _, action := range actions {
		for _, permission := range action.meta.Permissions {
			if permission.Role == "" {
				continue
			}

			roles[permission.Role] = struct{}{}
		}
	}

	result := make([]string, 0, len(roles))
	for role := range roles {
		result = append(result, role)
	}

	slices.Sort(result)

	return result
}

func (b *schemaBuilder) buildRoleSchema(
	ctx context.Context,
	role string,
	actions []actionDefinition,
) *graph.Schema {
	queryFields, mutationFields, reachableTypes := b.collectRoleFields(ctx, role, actions)
	if len(queryFields) == 0 && len(mutationFields) == 0 {
		return nil
	}

	slices.SortFunc(queryFields, compareFields)
	slices.SortFunc(mutationFields, compareFields)

	schema := newEmptyGraphSchema()
	appendRootType(schema, ast.Query, queryRootTypeName, queryFields)
	appendRootType(schema, ast.Mutation, mutationRootTypeName, mutationFields)
	b.appendReachableCustomTypes(schema, reachableTypes)

	return schema
}

func (b *schemaBuilder) collectRoleFields(
	ctx context.Context,
	role string,
	actions []actionDefinition,
) ([]*graph.Field, []*graph.Field, map[string]struct{}) {
	queryFields := make([]*graph.Field, 0)
	mutationFields := make([]*graph.Field, 0)
	reachableTypes := make(map[string]struct{})

	for _, action := range actions {
		if !actionVisibleToRole(action.meta, role) || b.actionHasRoleConflict(ctx, role, action) {
			continue
		}

		field := actionField(action)
		switch action.operation {
		case ast.Query:
			queryFields = append(queryFields, field)
		case ast.Mutation:
			mutationFields = append(mutationFields, field)
		case ast.Subscription:
			continue
		}

		for typeName := range action.reachableTypes {
			reachableTypes[typeName] = struct{}{}
		}
	}

	return queryFields, mutationFields, reachableTypes
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
		key := schemamerge.FieldKey(action.operation, action.meta.Name)
		if _, occupied := occupiedFields[key]; occupied {
			b.recordAction(
				ctx,
				action.meta.Name,
				fmt.Sprintf("root field %q conflicts for role %q", action.meta.Name, role),
			)

			return true
		}
	}

	occupiedTypes := b.options.occupiedTypeNames[role]
	if len(occupiedTypes) == 0 {
		return false
	}

	for _, typeName := range sortedNames(action.reachableTypes) {
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

func actionField(action actionDefinition) *graph.Field {
	return &graph.Field{
		Name:        action.meta.Name,
		Description: action.meta.Comment,
		Type:        action.outputType,
		Arguments:   action.arguments,
		Directives:  nil,
	}
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
