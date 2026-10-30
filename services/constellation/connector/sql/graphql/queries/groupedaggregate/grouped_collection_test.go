package groupedaggregate_test

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate/mock"
)

func TestOps_BuildGroupedCollectionSQL(t *testing.T) {
	t.Parallel()

	builderErr := errors.New("build failed") //nolint:err113 // test-only error identity
	wantOp := core.SQLOperation{Name: "users", SQL: "SELECT 1"}
	input := sampleInput()
	input.Role = "reader"
	input.JoinColumns = []string{"id", "tenant_id"}
	input.JoinTuples = [][]any{{1, 2}, {3, 4}}
	roots := map[string]core.Operation{}

	missing := input
	missing.TableName = "missing"

	tests := []struct {
		name          string
		input         groupedaggregate.BuildInput
		registered    bool
		builderOp     core.SQLOperation
		builderErr    error
		wantOp        core.SQLOperation
		wantErr       error
		wantErrorText string
	}{
		{
			name: "missing table", input: missing, registered: false,
			builderOp: core.SQLOperation{}, builderErr: nil,
			wantOp: core.SQLOperation{}, wantErr: groupedaggregate.ErrTableNotRegistered,
			wantErrorText: "public.missing",
		},
		{
			name: "builder failure", input: input, registered: true,
			builderOp: core.SQLOperation{}, builderErr: builderErr,
			wantOp: core.SQLOperation{}, wantErr: builderErr,
			wantErrorText: "public.users",
		},
		{
			name: "success", input: input, registered: true,
			builderOp: wantOp, builderErr: nil,
			wantOp: wantOp, wantErr: nil,
			wantErrorText: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			builder := mock.NewMockBuilder(gomock.NewController(t))

			builders := map[string]groupedaggregate.Builder{}
			if tt.registered {
				builder.EXPECT().BuildGroupedCollectionSQL(tt.input, roots).
					Return(tt.builderOp, tt.builderErr)
				builders[tt.input.TableSchema+"."+tt.input.TableName] = builder
			}

			got, err := groupedaggregate.New(builders).BuildGroupedCollectionSQL(tt.input, roots)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("error = %v, want errors.Is %v", err, tt.wantErr)
			}

			if tt.wantErrorText != "" &&
				(err == nil || !strings.Contains(err.Error(), tt.wantErrorText)) {
				t.Errorf("error = %v, want text %q", err, tt.wantErrorText)
			}

			if !reflect.DeepEqual(got, tt.wantOp) {
				t.Errorf("operation = %+v, want %+v", got, tt.wantOp)
			}
		})
	}
}
