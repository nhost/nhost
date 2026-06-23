// Package connector defines the Connector interface that every data source
// backend (SQL databases, remote GraphQL schemas) implements, and exposes
// BuildConnectorsFromMetadata as the sole entry point for instantiating those
// backends and producing role-scoped GraphQL schemas via the composer
// subpackage.
package connector

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/nhost/nhost/services/constellation/connector/action"
	actstore "github.com/nhost/nhost/services/constellation/connector/action/store"
	"github.com/nhost/nhost/services/constellation/connector/composer"
	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// Connector is the data source interface.
// Implementations introspect their data source, generate role-based schemas, and execute operations.
// They do not apply customization transforms or know about cross-connector relationships.
//
//go:generate mockgen -package mock -destination mock/connector.go . Connector
type Connector interface {
	// GetSchema returns the per-role graph schemas exposed by this connector.
	// The keys are role names; the admin role typically holds the full schema.
	GetSchema() (map[string]*graph.Schema, error)
	// Execute runs the given GraphQL operation against the connector for the
	// supplied role and session variables, returning the response data.
	Execute(
		ctx context.Context,
		operation *ast.OperationDefinition,
		fragments ast.FragmentDefinitionList,
		variables map[string]any,
		role string,
		sessionVariables map[string]any,
		logger *slog.Logger,
	) (map[string]any, error)
	// ValidateOperation runs the connector's pre-execution validation for the
	// given operation without producing any result or side effect, returning a
	// non-nil error when the operation is rejected. The controller calls it for
	// every connector a multi-connector request fans out to, and for
	// database-backed remote relationship queries, before executing any root
	// connector, so a structured argument failure aborts the whole request the way
	// Hasura does — no partial data, no mutation side effects from sibling
	// connectors. It is the connector's own concern which
	// failures it can detect before execution; connectors whose validation is
	// inseparable from execution (remote schemas, the in-memory connector)
	// return nil and report such failures from Execute instead.
	ValidateOperation(
		operation *ast.OperationDefinition,
		fragments ast.FragmentDefinitionList,
		variables map[string]any,
		role string,
		sessionVariables map[string]any,
	) error
	// GetTypeName returns the GraphQL type name for a given identifier
	// (e.g., a query field name for remote schemas, a table name for SQL).
	// Returns empty string if the identifier cannot be resolved.
	GetTypeName(identifier string) string
	// Close releases resources held by the connector (database pools, HTTP
	// clients, background pollers) and returns once they are released. It is
	// not safe to call concurrently with GetSchema or Execute; subsequent
	// calls after the first are permitted and behave as no-ops.
	Close()
}

// BuildResult is the output of BuildConnectorsFromMetadata: the composed
// per-role schemas and the live connectors map.
type BuildResult struct {
	composer.Result

	// Connectors maps connector name (database or remote schema name) to the
	// live, ready-to-use Connector. Sources that failed to build are absent
	// from this map and recorded in Inconsistencies.
	Connectors map[string]Connector

	// Inconsistencies is the snapshot of per-source / per-role failures
	// recorded while turning the metadata document into runtime state. It is
	// captured once, at the end of BuildConnectorsFromMetadata, so callers
	// cannot mutate the build-time collector after the fact. The server keeps
	// running with whatever did load; callers expose this list.
	Inconsistencies []metadata.Inconsistency
}

// DBFactory builds a database-backed Connector from its metadata entry. The
// supplied inconsistencies collector is used by the factory to record
// per-table / per-column / per-function / per-relationship reconciliation
// inconsistencies once introspection has run; pass through to
// sql.NewConnector unchanged.
type DBFactory func(
	ctx context.Context,
	dbMeta *metadata.DatabaseMetadata,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
) (Connector, error)

// RemoteSchemaFactory builds a remote-schema Connector from its metadata entry.
type RemoteSchemaFactory func(
	ctx context.Context,
	rsMeta *metadata.RemoteSchemaMetadata,
) (Connector, error)

const actionConnectorName = action.ConnectorName

// defaultDBFactories returns the production registry of database factories
// keyed by dbMeta.Kind.
func defaultDBFactories() map[string]DBFactory {
	return map[string]DBFactory{
		"postgres": newPostgresConnector,
		"sqlite":   newSQLiteConnector,
	}
}

// defaultRemoteSchemaFactory returns a RemoteSchemaFactory that delegates to
// remoteschema.New with the supplied HTTPDoer. Passing nil preserves the
// production default: remoteschema.New falls back to an *http.Client whose
// timeout is taken from meta.Definition.TimeoutSeconds.
func defaultRemoteSchemaFactory(doer remoteschema.HTTPDoer) RemoteSchemaFactory {
	return func(ctx context.Context, rsMeta *metadata.RemoteSchemaMetadata) (Connector, error) {
		return remoteschema.New(ctx, rsMeta, doer)
	}
}

// buildConfig collects the optional dependencies of BuildConnectorsFromMetadata.
type buildConfig struct {
	dbFactories         map[string]DBFactory
	remoteSchemaFactory RemoteSchemaFactory
	httpDoer            remoteschema.HTTPDoer
	actionHTTPDoer      action.HTTPDoer
	actionLogConfig     ActionLogConfig
	inconsistencies     *metadata.Inconsistencies
}

// Option customises BuildConnectorsFromMetadata. Production callers pass none;
// tests use these to inject fakes in place of real DB/remote-schema clients.
type Option func(*buildConfig)

// WithDBFactories overrides the per-kind database factory registry.
func WithDBFactories(factories map[string]DBFactory) Option {
	return func(c *buildConfig) {
		c.dbFactories = factories
	}
}

// WithRemoteSchemaFactory overrides the remote-schema factory. Setting this
// supersedes any HTTPDoer registered via WithHTTPDoer — the caller-provided
// factory is fully responsible for constructing its own HTTP client.
func WithRemoteSchemaFactory(f RemoteSchemaFactory) Option {
	return func(c *buildConfig) {
		c.remoteSchemaFactory = f
	}
}

// WithHTTPDoer sets the HTTPDoer used by the default remote-schema factory.
// It has no effect when WithRemoteSchemaFactory is also supplied. Passing nil
// is equivalent to omitting the option: remoteschema.New constructs its own
// *http.Client honouring meta.Definition.TimeoutSeconds.
func WithHTTPDoer(doer remoteschema.HTTPDoer) Option {
	return func(c *buildConfig) {
		c.httpDoer = doer
	}
}

// WithActionHTTPDoer sets the HTTPDoer used by the action connector for
// action webhook calls. Passing nil preserves the production default hardened
// HTTP client.
func WithActionHTTPDoer(doer action.HTTPDoer) Option {
	return func(c *buildConfig) {
		c.actionHTTPDoer = doer
	}
}

// ActionLogConfig configures the Hasura-compatible asynchronous action log.
type ActionLogConfig struct {
	Store               action.ActionLogStore
	DatabaseURL         string
	MetadataDatabaseURL string
	Schema              string
	Table               string
	CreateIfNotExists   bool
	WorkerEnabled       bool
	ExclusiveOwner      bool
	PollInterval        time.Duration
	BatchSize           int
	MaxConcurrency      int
	ShutdownTimeout     time.Duration
}

// WithActionLogConfig configures asynchronous action persistence and workers.
func WithActionLogConfig(config ActionLogConfig) Option {
	return func(c *buildConfig) {
		c.actionLogConfig = config
	}
}

// WithInconsistencies routes per-source / per-role build failures into the
// supplied collector instead of an internally-allocated one. The collector
// itself stays with the caller; BuildResult.Inconsistencies always exposes
// only a snapshot taken once the build has finished.
func WithInconsistencies(inc *metadata.Inconsistencies) Option {
	return func(c *buildConfig) {
		c.inconsistencies = inc
	}
}

// BuildConnectorsFromMetadata creates connectors from metadata configuration
// and builds validated GraphQL schemas for each role. Per-source failures
// (unsupported kind, factory error, customization error, GetSchema error) and
// per-role composition failures are recorded as inconsistencies and skipped
// rather than aborting the build; the function only returns an error if the
// metadata document is unusable wholesale.
func BuildConnectorsFromMetadata(
	ctx context.Context,
	meta *metadata.Metadata,
	logger *slog.Logger,
	opts ...Option,
) (*BuildResult, error) {
	cfg := &buildConfig{
		dbFactories:         defaultDBFactories(),
		remoteSchemaFactory: nil,
		httpDoer:            nil,
		actionHTTPDoer:      nil,
		actionLogConfig: ActionLogConfig{
			Store:               nil,
			DatabaseURL:         "",
			MetadataDatabaseURL: "",
			Schema:              "",
			Table:               "",
			CreateIfNotExists:   false,
			WorkerEnabled:       false,
			ExclusiveOwner:      false,
			PollInterval:        0,
			BatchSize:           0,
			MaxConcurrency:      0,
			ShutdownTimeout:     0,
		},
		inconsistencies: nil,
	}
	for _, opt := range opts {
		opt(cfg)
	}

	if cfg.remoteSchemaFactory == nil {
		cfg.remoteSchemaFactory = defaultRemoteSchemaFactory(cfg.httpDoer)
	}

	if cfg.inconsistencies == nil {
		cfg.inconsistencies = metadata.NewInconsistencies()
	}

	cfg.recordLoadDiagnostics(ctx, meta, logger)

	// Materialize inherited roles into concrete per-role permissions before any
	// connector builds, so every connector treats an inherited role like any
	// other role (it keys schema generation and runtime permission lookups by
	// role name). Mutates meta in place; synthesized permissions live only in
	// this build-time copy and are never exported (exports go through the store's
	// Hasura metadata, which keeps the inherited_roles top-level key).
	metadata.ExpandInheritedRoles(ctx, meta, cfg.inconsistencies, logger)

	connectors := make(map[string]Connector)

	cfg.buildRemoteSchemaConnectors(ctx, meta, connectors, logger)
	cfg.buildDatabaseConnectors(ctx, meta, connectors, logger)
	cfg.buildActionConnector(ctx, meta, connectors, logger)

	providers := make(map[string]composer.SchemaProvider, len(connectors))
	for name, c := range connectors {
		providers[name] = c
	}

	result := composer.New(providers, meta, cfg.inconsistencies).Compose(ctx, logger)

	return &BuildResult{
		Result:          result,
		Connectors:      connectors,
		Inconsistencies: cfg.inconsistencies.Snapshot(),
	}, nil
}

func (cfg *buildConfig) recordLoadDiagnostics(
	ctx context.Context,
	meta *metadata.Metadata,
	logger *slog.Logger,
) {
	for _, diagnostic := range meta.LoadDiagnostics {
		cfg.inconsistencies.RecordLoadDiagnostic(ctx, logger, diagnostic)
	}
}

func (cfg *buildConfig) buildActionConnector(
	ctx context.Context,
	meta *metadata.Metadata,
	connectors map[string]Connector,
	logger *slog.Logger,
) {
	if !hasActionMetadata(meta) {
		return
	}

	if actionConnectorNameCollides(meta, connectors) {
		cfg.recordActionConnectorCollision(ctx, meta, logger)

		return
	}

	occupiedRootFields, occupiedTypeNames := occupiedActionNames(connectors)
	backend := action.New(
		ctx,
		meta,
		cfg.inconsistencies,
		logger,
		cfg.actionHTTPDoer,
		actionRelationshipTargets(meta, connectors),
		occupiedRootFields,
		occupiedTypeNames,
		action.WithAsyncConfig(cfg.resolveActionAsyncConfig(ctx, meta, logger)),
	)

	schemas, err := backend.GetSchema()
	if err != nil {
		backend.CloseWithContext(ctx)
		cfg.inconsistencies.RecordAction(
			ctx,
			logger,
			actionConnectorName,
			fmt.Sprintf("failed to get schema from action connector: %v", err),
		)

		return
	}

	if len(schemas) == 0 {
		backend.CloseWithContext(ctx)

		return
	}

	connectors[actionConnectorName] = backend
}

func hasActionMetadata(meta *metadata.Metadata) bool {
	return len(meta.Actions) > 0 || !meta.CustomTypes.IsZero()
}

func hasAsyncActionMetadata(meta *metadata.Metadata) bool {
	for _, actionMeta := range meta.Actions {
		if actionMeta.Definition.Kind == metadata.ActionKindAsynchronous {
			return true
		}
	}

	return false
}

func (cfg *buildConfig) resolveActionAsyncConfig(
	ctx context.Context,
	meta *metadata.Metadata,
	_ *slog.Logger,
) action.AsyncConfig {
	if !hasAsyncActionMetadata(meta) {
		return action.AsyncConfig{
			Store:             nil,
			CloseStore:        false,
			UnavailableReason: "",
			WorkerEnabled:     false,
			PollInterval:      0,
			BatchSize:         0,
			MaxConcurrency:    0,
			ShutdownTimeout:   0,
		}
	}

	if cfg.actionLogConfig.WorkerEnabled && !cfg.actionLogConfig.ExclusiveOwner {
		return cfg.actionAsyncUnavailable(
			"asynchronous action worker requires exclusive action-log ownership",
		)
	}

	if cfg.actionLogConfig.Store != nil {
		return cfg.actionAsyncRuntimeConfig(cfg.actionLogConfig.Store, false)
	}

	databaseURL, err := cfg.resolveActionLogDatabaseURL(meta)
	if err != nil {
		return cfg.actionAsyncUnavailable(err.Error())
	}

	store, err := actstore.NewPostgres(ctx, actstore.PostgresConfig{
		DatabaseURL:       databaseURL,
		Schema:            cfg.actionLogConfig.Schema,
		Table:             cfg.actionLogConfig.Table,
		CreateIfNotExists: cfg.actionLogConfig.CreateIfNotExists,
	})
	if err != nil {
		return cfg.actionAsyncUnavailable(
			fmt.Sprintf("creating asynchronous action log store: %v", err),
		)
	}

	return cfg.actionAsyncRuntimeConfig(store, true)
}

func (cfg *buildConfig) actionAsyncUnavailable(reason string) action.AsyncConfig {
	return action.AsyncConfig{
		Store:             nil,
		CloseStore:        false,
		UnavailableReason: reason,
		WorkerEnabled:     false,
		PollInterval:      0,
		BatchSize:         0,
		MaxConcurrency:    0,
		ShutdownTimeout:   0,
	}
}

func (cfg *buildConfig) actionAsyncRuntimeConfig(
	store action.ActionLogStore,
	closeStore bool,
) action.AsyncConfig {
	return action.AsyncConfig{
		Store:             store,
		CloseStore:        closeStore,
		UnavailableReason: "",
		WorkerEnabled:     cfg.actionLogConfig.WorkerEnabled,
		PollInterval:      cfg.actionLogConfig.PollInterval,
		BatchSize:         cfg.actionLogConfig.BatchSize,
		MaxConcurrency:    cfg.actionLogConfig.MaxConcurrency,
		ShutdownTimeout:   cfg.actionLogConfig.ShutdownTimeout,
	}
}

func (cfg *buildConfig) resolveActionLogDatabaseURL(meta *metadata.Metadata) (string, error) {
	if cfg.actionLogConfig.DatabaseURL != "" {
		return cfg.actionLogConfig.DatabaseURL, nil
	}

	if cfg.actionLogConfig.MetadataDatabaseURL != "" {
		return cfg.actionLogConfig.MetadataDatabaseURL, nil
	}

	for i := range meta.Databases {
		dbMeta := &meta.Databases[i]
		if dbMeta.Kind != "postgres" {
			continue
		}

		dbURL, err := resolveDBURL(dbMeta)
		if err != nil {
			return "", fmt.Errorf("resolving default async action log database: %w", err)
		}

		return dbURL, nil
	}

	return "", ErrActionLogStoreNotConfigured
}

func actionConnectorNameCollides(
	meta *metadata.Metadata,
	connectors map[string]Connector,
) bool {
	if _, exists := connectors[actionConnectorName]; exists {
		return true
	}

	for _, db := range meta.Databases {
		if db.Name == actionConnectorName {
			return true
		}
	}

	for _, rs := range meta.RemoteSchemas {
		if rs.Name == actionConnectorName {
			return true
		}
	}

	return false
}

func (cfg *buildConfig) recordActionConnectorCollision(
	ctx context.Context,
	meta *metadata.Metadata,
	logger *slog.Logger,
) {
	reason := fmt.Sprintf(
		"action connector name %q conflicts with a database or remote schema",
		actionConnectorName,
	)

	for _, actionMeta := range meta.Actions {
		cfg.inconsistencies.RecordAction(ctx, logger, actionMeta.Name, reason)
	}

	for _, customTypeName := range customTypeNames(meta.CustomTypes) {
		cfg.inconsistencies.RecordCustomType(ctx, logger, customTypeName, reason)
	}
}

func actionRelationshipTargets(
	meta *metadata.Metadata,
	connectors map[string]Connector,
) action.RelationshipTargets {
	targets := make(action.RelationshipTargets)
	if meta == nil {
		return targets
	}

	for _, object := range meta.CustomTypes.Objects {
		for _, rel := range object.Relationships {
			key := action.RelationshipTargetKey{
				Source: rel.Source,
				Schema: rel.RemoteTable.Schema,
				Table:  rel.RemoteTable.Name,
			}
			if _, exists := targets[key]; exists {
				continue
			}

			if target, ok := actionRelationshipTarget(key, connectors); ok {
				targets[key] = target
			}
		}
	}

	return targets
}

func actionRelationshipTarget(
	key action.RelationshipTargetKey,
	connectors map[string]Connector,
) (action.RelationshipTarget, bool) {
	conn := connectors[key.Source]
	if conn == nil || key.Source == "" || key.Schema == "" || key.Table == "" {
		return action.RelationshipTarget{Roles: nil}, false
	}

	typeName := conn.GetTypeName(key.Schema + "." + key.Table)
	if typeName == "" {
		return action.RelationshipTarget{Roles: nil}, false
	}

	schemas, err := conn.GetSchema()
	if err != nil {
		return action.RelationshipTarget{Roles: nil}, false
	}

	roles := make(map[string]action.RelationshipTargetRole, len(schemas))
	for role, schema := range schemas {
		fields := objectFieldNames(schema, typeName)
		if len(fields) == 0 {
			continue
		}

		roles[role] = action.RelationshipTargetRole{Fields: fields}
	}

	if len(roles) == 0 {
		return action.RelationshipTarget{Roles: nil}, false
	}

	return action.RelationshipTarget{Roles: roles}, true
}

func objectFieldNames(schema *graph.Schema, typeName string) map[string]struct{} {
	if schema == nil {
		return nil
	}

	for _, typ := range schema.Types {
		if typ.Name != typeName {
			continue
		}

		fields := make(map[string]struct{}, len(typ.Fields))
		for _, field := range typ.Fields {
			fields[field.Name] = struct{}{}
		}

		return fields
	}

	return nil
}

func occupiedActionNames(
	connectors map[string]Connector,
) (map[string]map[string]struct{}, map[string]map[string]struct{}) {
	occupiedRootFields := make(map[string]map[string]struct{})
	occupiedTypeNames := make(map[string]map[string]struct{})

	for _, conn := range connectors {
		schemas, err := conn.GetSchema()
		if err != nil {
			continue
		}

		for role, schema := range schemas {
			collectOccupiedRootFields(occupiedRootFields, role, schema)
			collectOccupiedTypeNames(occupiedTypeNames, role, schema)
		}
	}

	return occupiedRootFields, occupiedTypeNames
}

func collectOccupiedRootFields(
	out map[string]map[string]struct{},
	role string,
	schema *graph.Schema,
) {
	if schema == nil {
		return
	}

	collectOccupiedRootOperation(out, role, schema, ast.Query, schema.QueryType, "Query")
	collectOccupiedRootOperation(out, role, schema, ast.Mutation, schema.MutationType, "Mutation")
	collectOccupiedRootOperation(
		out,
		role,
		schema,
		ast.Subscription,
		schema.SubscriptionType,
		"Subscription",
	)
}

func collectOccupiedRootOperation(
	out map[string]map[string]struct{},
	role string,
	schema *graph.Schema,
	operation ast.Operation,
	configuredRoot *string,
	defaultRoot string,
) {
	rootName := defaultRoot
	if configuredRoot != nil {
		rootName = *configuredRoot
	}

	for _, typ := range schema.Types {
		if typ.Name != rootName {
			continue
		}

		roleFields := out[role]
		if roleFields == nil {
			roleFields = make(map[string]struct{})
			out[role] = roleFields
		}

		for _, field := range typ.Fields {
			roleFields[schemamerge.FieldKey(operation, field.Name)] = struct{}{}
		}

		return
	}
}

func collectOccupiedTypeNames(
	out map[string]map[string]struct{},
	role string,
	schema *graph.Schema,
) {
	if schema == nil {
		return
	}

	roleTypes := out[role]
	if roleTypes == nil {
		roleTypes = make(map[string]struct{})
		out[role] = roleTypes
	}

	for _, typ := range schema.Types {
		roleTypes[typ.Name] = struct{}{}
	}

	for _, scalar := range schema.Scalars {
		roleTypes[scalar.Name] = struct{}{}
	}

	for _, enum := range schema.Enums {
		roleTypes[enum.Name] = struct{}{}
	}

	for _, input := range schema.Inputs {
		roleTypes[input.Name] = struct{}{}
	}

	for _, iface := range schema.Interfaces {
		roleTypes[iface.Name] = struct{}{}
	}

	for _, union := range schema.Unions {
		roleTypes[union.Name] = struct{}{}
	}
}

func customTypeNames(customTypes metadata.CustomTypes) []string {
	count := len(customTypes.InputObjects) + len(customTypes.Objects) +
		len(customTypes.Scalars) + len(customTypes.Enums)
	names := make([]string, 0, count)

	for _, input := range customTypes.InputObjects {
		names = append(names, input.Name)
	}

	for _, object := range customTypes.Objects {
		names = append(names, object.Name)
	}

	for _, scalar := range customTypes.Scalars {
		names = append(names, scalar.Name)
	}

	for _, enum := range customTypes.Enums {
		names = append(names, enum.Name)
	}

	return names
}

// buildRemoteSchemaConnectors instantiates every remote-schema connector,
// applies any schema customization, and registers it in connectors. Sources
// that fail to build are recorded in cfg.inconsistencies and skipped.
func (cfg *buildConfig) buildRemoteSchemaConnectors(
	ctx context.Context,
	meta *metadata.Metadata,
	connectors map[string]Connector,
	logger *slog.Logger,
) {
	for i := range meta.RemoteSchemas {
		rsMeta := &meta.RemoteSchemas[i]

		raw, err := cfg.remoteSchemaFactory(ctx, rsMeta)
		if err != nil {
			cfg.inconsistencies.RecordRemoteSchema(
				ctx, logger,
				rsMeta.Name,
				fmt.Sprintf("failed to create remote schema connector: %v", err),
			)

			continue
		}

		backend, err := applyCustomization(
			rsMeta.Name,
			raw,
			rsMeta.Definition.Customization,
			customization.FlavorRemoteSchema,
		)
		if err != nil {
			// applyCustomization failed before the wrapper took ownership
			// of raw, so we close the raw connector ourselves; otherwise
			// it would leak the resources the factory just acquired.
			raw.Close()
			cfg.inconsistencies.RecordRemoteSchema(
				ctx, logger,
				rsMeta.Name,
				err.Error(),
			)

			continue
		}

		connectors[rsMeta.Name] = backend
	}
}

// buildDatabaseConnectors instantiates every database connector by kind,
// applies any source-level customization, and registers it in connectors.
// Sources that fail to build are recorded in cfg.inconsistencies and skipped.
func (cfg *buildConfig) buildDatabaseConnectors(
	ctx context.Context,
	meta *metadata.Metadata,
	connectors map[string]Connector,
	logger *slog.Logger,
) {
	for i := range meta.Databases {
		dbMeta := &meta.Databases[i]

		factory, ok := cfg.dbFactories[dbMeta.Kind]
		if !ok {
			cfg.inconsistencies.RecordDatabase(
				ctx, logger,
				dbMeta.Name,
				fmt.Sprintf("%s: %s", ErrUnsupportedDatabaseKind, dbMeta.Kind),
			)

			continue
		}

		raw, err := factory(ctx, dbMeta, cfg.inconsistencies, logger)
		if err != nil {
			cfg.inconsistencies.RecordDatabase(
				ctx, logger,
				dbMeta.Name,
				fmt.Sprintf("building database connector: %v", err),
			)

			continue
		}

		backend, err := applyCustomization(
			dbMeta.Name,
			raw,
			dbMeta.Customization,
			customization.FlavorDatabase,
		)
		if err != nil {
			// applyCustomization failed before the wrapper took ownership
			// of raw, so we close the raw connector ourselves; otherwise
			// it would leak the resources the factory just acquired.
			raw.Close()
			cfg.inconsistencies.RecordDatabase(
				ctx, logger,
				dbMeta.Name,
				err.Error(),
			)

			continue
		}

		connectors[dbMeta.Name] = backend
	}
}

// resolveDBURL resolves the database URL from metadata and rejects empty
// values. The returned error already names the failing database so callers
// can return it without additional wrapping.
func resolveDBURL(dbMeta *metadata.DatabaseMetadata) (string, error) {
	dbURL, err := dbMeta.Configuration.ConnectionInfo.DatabaseURL.Resolve()
	if err != nil {
		return "", fmt.Errorf("resolving database URL for %s: %w", dbMeta.Name, err)
	}

	if dbURL == "" {
		return "", fmt.Errorf("%w for database %s", ErrDatabaseURLNotSet, dbMeta.Name)
	}

	return dbURL, nil
}

func newPostgresConnector( //nolint:ireturn,nolintlint
	ctx context.Context,
	dbMeta *metadata.DatabaseMetadata,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
) (Connector, error) {
	dbURL, err := resolveDBURL(dbMeta)
	if err != nil {
		return nil, fmt.Errorf("creating postgres connector for %s: %w", dbMeta.Name, err)
	}

	backend, err := postgres.New(ctx, dbURL, dbMeta, inconsistencies, logger)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to create postgres connector for %s: %w", dbMeta.Name, err,
		)
	}

	return backend, nil
}

func newSQLiteConnector( //nolint:ireturn,nolintlint
	ctx context.Context,
	dbMeta *metadata.DatabaseMetadata,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
) (Connector, error) {
	dbURL, err := resolveDBURL(dbMeta)
	if err != nil {
		return nil, fmt.Errorf("creating sqlite connector for %s: %w", dbMeta.Name, err)
	}

	backend, err := sqlite.New(ctx, dbURL, dbMeta, inconsistencies, logger)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to create sqlite connector for %s: %w", dbMeta.Name, err,
		)
	}

	return backend, nil
}
