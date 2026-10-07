package groupedaggregate_test

import (
	"errors"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate/mock"
	"go.uber.org/mock/gomock"
)

type collectionBuilderStub struct{ err error }

func (s collectionBuilderStub) BuildGroupedAggregateSQL(
	_ groupedaggregate.BuildInput,
) (core.SQLOperation, error) {
	return core.SQLOperation{}, nil
}

func (s collectionBuilderStub) BuildGroupedCollectionSQL(
	_ groupedaggregate.BuildInput, _ map[string]core.Operation,
) (core.SQLOperation, error) {
	return core.SQLOperation{Name: "users", SQL: "SELECT 1"}, s.err
}

func TestOps_BuildGroupedCollectionSQL(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("build failed") //nolint:err113 // test-only error identity
	for _, tc := range []struct {
		name     string
		builders map[string]groupedaggregate.Builder
		wantErr  error
	}{
		{"missing table", nil, groupedaggregate.ErrTableNotRegistered},
		{"builder unavailable", map[string]groupedaggregate.Builder{
			"public.users": mock.NewMockBuilder(gomock.NewController(t)),
		}, groupedaggregate.ErrGroupedCollectionBuilderUnavailable},
		{"builder failure", map[string]groupedaggregate.Builder{
			"public.users": collectionBuilderStub{err: sentinel},
		}, sentinel},
		{"success", map[string]groupedaggregate.Builder{
			"public.users": collectionBuilderStub{},
		}, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := groupedaggregate.New(tc.builders).
				BuildGroupedCollectionSQL(sampleInput(), nil)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("error=%v; want errors.Is %v", err, tc.wantErr)
			}

			if tc.wantErr == nil && got.SQL != "SELECT 1" {
				t.Fatalf("operation=%+v", got)
			}
		})
	}
}
