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

	"github.com/nhost/nhost/services/constellation/connector/composer"
	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
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
	// live, ready-to-use Connector.
	Connectors map[string]Connector
}

// DBFactory builds a database-backed Connector from its metadata entry.
type DBFactory func(
	ctx context.Context,
	dbMeta *metadata.DatabaseMetadata,
) (Connector, error)

// RemoteSchemaFactory builds a remote-schema Connector from its metadata entry.
type RemoteSchemaFactory func(
	ctx context.Context,
	rsMeta *metadata.RemoteSchemaMetadata,
) (Connector, error)

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

// BuildConnectorsFromMetadata creates connectors from metadata configuration and builds
// validated GraphQL schemas for each role.
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
	}
	for _, opt := range opts {
		opt(cfg)
	}

	if cfg.remoteSchemaFactory == nil {
		cfg.remoteSchemaFactory = defaultRemoteSchemaFactory(cfg.httpDoer)
	}

	connectors := make(map[string]Connector)

	if err := cfg.buildRemoteSchemaConnectors(ctx, meta, connectors); err != nil {
		return nil, err
	}

	if err := cfg.buildDatabaseConnectors(ctx, meta, connectors); err != nil {
		return nil, err
	}

	providers := make(map[string]composer.SchemaProvider, len(connectors))
	for name, c := range connectors {
		providers[name] = c
	}

	result, err := composer.New(providers, meta).Compose(ctx, logger)
	if err != nil {
		return nil, fmt.Errorf("composing schemas: %w", err)
	}

	return &BuildResult{
		Result:     result,
		Connectors: connectors,
	}, nil
}

// buildRemoteSchemaConnectors instantiates every remote-schema connector,
// applies any schema customization, and registers it in connectors.
func (cfg *buildConfig) buildRemoteSchemaConnectors(
	ctx context.Context,
	meta *metadata.Metadata,
	connectors map[string]Connector,
) error {
	for i := range meta.RemoteSchemas {
		rsMeta := &meta.RemoteSchemas[i]

		backend, err := cfg.remoteSchemaFactory(ctx, rsMeta)
		if err != nil {
			return fmt.Errorf(
				"failed to create remote schema connector for %s: %w",
				rsMeta.Name,
				err,
			)
		}

		backend, err = applyCustomization(
			rsMeta.Name,
			backend,
			rsMeta.Definition.Customization,
			customization.FlavorRemoteSchema,
		)
		if err != nil {
			return err
		}

		connectors[rsMeta.Name] = backend
	}

	return nil
}

// buildDatabaseConnectors instantiates every database connector by kind,
// applies any source-level customization, and registers it in connectors.
func (cfg *buildConfig) buildDatabaseConnectors(
	ctx context.Context,
	meta *metadata.Metadata,
	connectors map[string]Connector,
) error {
	for i := range meta.Databases {
		dbMeta := &meta.Databases[i]

		factory, ok := cfg.dbFactories[dbMeta.Kind]
		if !ok {
			return fmt.Errorf("unsupported database kind: %s", dbMeta.Kind)
		}

		backend, err := factory(ctx, dbMeta)
		if err != nil {
			return fmt.Errorf("building database connector for %s: %w", dbMeta.Name, err)
		}

		backend, err = applyCustomization(
			dbMeta.Name,
			backend,
			dbMeta.Customization,
			customization.FlavorDatabase,
		)
		if err != nil {
			return err
		}

		connectors[dbMeta.Name] = backend
	}

	return nil
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
		return "", fmt.Errorf("database URL is not set for database %s", dbMeta.Name)
	}

	return dbURL, nil
}

func newPostgresConnector( //nolint:ireturn
	ctx context.Context,
	dbMeta *metadata.DatabaseMetadata,
) (Connector, error) {
	dbURL, err := resolveDBURL(dbMeta)
	if err != nil {
		return nil, fmt.Errorf("creating postgres connector for %s: %w", dbMeta.Name, err)
	}

	backend, err := postgres.New(ctx, dbURL, dbMeta)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to create postgres connector for %s: %w", dbMeta.Name, err,
		)
	}

	return backend, nil
}

func newSQLiteConnector( //nolint:ireturn
	ctx context.Context,
	dbMeta *metadata.DatabaseMetadata,
) (Connector, error) {
	dbURL, err := resolveDBURL(dbMeta)
	if err != nil {
		return nil, fmt.Errorf("creating sqlite connector for %s: %w", dbMeta.Name, err)
	}

	backend, err := sqlite.New(ctx, dbURL, dbMeta)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to create sqlite connector for %s: %w", dbMeta.Name, err,
		)
	}

	return backend, nil
}
