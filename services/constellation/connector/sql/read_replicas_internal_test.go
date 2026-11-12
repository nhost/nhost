package sql //nolint:revive,nolintlint

import (
	"context"
	"log/slog"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type primaryOnlyDriver struct {
	primaryCalls int
}

func (d *primaryOnlyDriver) Introspect(
	context.Context, *metadata.DatabaseMetadata,
) (*introspection.Objects, error) {
	return nil, nil //nolint:nilnil
}

func (d *primaryOnlyDriver) ExecuteOperations(
	context.Context, []core.SQLOperation, *slog.Logger,
) (map[string]any, error) {
	d.primaryCalls++

	return map[string]any{}, nil
}

func (d *primaryOnlyDriver) ExecuteMultiplexedOperation(
	context.Context, string, []any, *slog.Logger,
) ([]core.MultiplexedResult, error) {
	return nil, nil
}

func (d *primaryOnlyDriver) Dialect() dialect.Dialect { //nolint:ireturn,nolintlint
	return dialect.NewPostgresDialect()
}

func (d *primaryOnlyDriver) Close() {}

type replicaDriver struct {
	primaryOnlyDriver

	readCalls int
}

func (d *replicaDriver) ExecuteReadOperations(
	context.Context, []core.SQLOperation, *slog.Logger,
) (map[string]any, error) {
	d.readCalls++

	return map[string]any{}, nil
}

func TestConnectorExecuteOperations_Routing(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		operation    *ast.OperationDefinition
		hasReplicas  bool
		wantPrimary  int
		wantReadPath int
	}{
		{
			name:         "query uses the read path",
			operation:    &ast.OperationDefinition{Operation: ast.Query},
			hasReplicas:  true,
			wantPrimary:  0,
			wantReadPath: 1,
		},
		{
			name:         "mutation uses the primary",
			operation:    &ast.OperationDefinition{Operation: ast.Mutation},
			hasReplicas:  true,
			wantPrimary:  1,
			wantReadPath: 0,
		},
		{
			name:         "subscription uses the primary",
			operation:    &ast.OperationDefinition{Operation: ast.Subscription},
			hasReplicas:  true,
			wantPrimary:  1,
			wantReadPath: 0,
		},
		{
			name:         "missing operation uses the primary",
			operation:    nil,
			hasReplicas:  true,
			wantPrimary:  1,
			wantReadPath: 0,
		},
		{
			name:         "query on a driver without a read path uses the primary",
			operation:    &ast.OperationDefinition{Operation: ast.Query},
			hasReplicas:  false,
			wantPrimary:  1,
			wantReadPath: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			withReplicas := &replicaDriver{}
			withoutReplicas := &primaryOnlyDriver{}

			c := &Connector{}
			if tt.hasReplicas {
				c.driver = withReplicas
			} else {
				c.driver = withoutReplicas
			}

			if _, err := c.executeOperations(
				t.Context(), tt.operation, nil, slog.New(slog.DiscardHandler),
			); err != nil {
				t.Fatalf("executeOperations: %v", err)
			}

			gotPrimary := withReplicas.primaryCalls + withoutReplicas.primaryCalls
			if gotPrimary != tt.wantPrimary || withReplicas.readCalls != tt.wantReadPath {
				t.Errorf(
					"primary calls = %d, read path calls = %d; want %d and %d",
					gotPrimary, withReplicas.readCalls, tt.wantPrimary, tt.wantReadPath,
				)
			}
		})
	}
}
