package groupedaggregate_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate/mock"
)

// sampleInput returns a BuildInput with reasonable defaults for "public.users".
// Per-subtest overrides happen on the returned value.
func sampleInput() groupedaggregate.BuildInput {
	return groupedaggregate.BuildInput{
		TableSchema:       "public",
		TableName:         "users",
		Field:             &ast.Field{Name: "agg"},
		Fragments:         nil,
		Variables:         nil,
		Role:              "admin",
		SessionVariables:  nil,
		JoinColumnSQLName: "id",
		JoinValues:        []any{1},
	}
}

func TestOps_BuildGroupedAggregateSQL(t *testing.T) {
	t.Parallel()

	stubErr := errors.New("builder failed")
	wantOp := core.SQLOperation{Name: "users_aggregate", SQL: "SELECT 1"}

	missingTable := sampleInput()
	missingTable.TableName = "missing"

	dispatchedInput := sampleInput()
	dispatchedInput.Variables = map[string]any{"v": 1}
	dispatchedInput.SessionVariables = map[string]any{"x-hasura-user-id": "u1"}
	dispatchedInput.JoinValues = []any{1, 2}

	tests := []struct {
		name             string
		registerBuilder  bool
		expectCall       bool
		builderReturnOp  core.SQLOperation
		builderReturnErr error
		input            groupedaggregate.BuildInput
		wantErrContains  string
		wantErrIs        error
		wantOpName       string
	}{
		{
			name:             "table not registered",
			registerBuilder:  false,
			expectCall:       false,
			builderReturnOp:  core.SQLOperation{},
			builderReturnErr: nil,
			input:            missingTable,
			wantErrContains:  "public.missing",
			wantErrIs:        nil,
			wantOpName:       "",
		},
		{
			name:             "dispatches to builder",
			registerBuilder:  true,
			expectCall:       true,
			builderReturnOp:  wantOp,
			builderReturnErr: nil,
			input:            dispatchedInput,
			wantErrContains:  "",
			wantErrIs:        nil,
			wantOpName:       wantOp.Name,
		},
		{
			name:             "propagates builder error",
			registerBuilder:  true,
			expectCall:       true,
			builderReturnOp:  core.SQLOperation{},
			builderReturnErr: stubErr,
			input:            sampleInput(),
			wantErrContains:  "public.users",
			wantErrIs:        stubErr,
			wantOpName:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			builder := mock.NewMockBuilder(ctrl)

			if tt.expectCall {
				builder.EXPECT().
					BuildGroupedAggregateSQL(tt.input).
					Return(tt.builderReturnOp, tt.builderReturnErr)
			}

			builders := map[string]groupedaggregate.Builder{}
			if tt.registerBuilder {
				builders[tt.input.TableSchema+"."+tt.input.TableName] = builder
			}

			ops := groupedaggregate.New(builders)

			got, err := ops.BuildGroupedAggregateSQL(tt.input)

			switch {
			case tt.wantErrIs != nil:
				if !errors.Is(err, tt.wantErrIs) {
					t.Errorf("err = %v, want errors.Is %v", err, tt.wantErrIs)
				}
			case tt.wantErrContains != "":
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tt.wantErrContains)
				}
			default:
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}

			if tt.wantErrContains != "" && err != nil &&
				!strings.Contains(err.Error(), tt.wantErrContains) {
				t.Errorf("error should contain %q, got: %v", tt.wantErrContains, err)
			}

			if tt.wantOpName != "" && got.Name != tt.wantOpName {
				t.Errorf("op.Name = %q, want %q", got.Name, tt.wantOpName)
			}
		})
	}
}

// TestOps_BuildGroupedAggregateSQL_IsolatesFromCallerMapMutation is kept
// separate because its setup (mutate the source map after New) is genuinely
// distinct from the dispatch-shape cases above and exercises the shape-
// isolation guarantee of New's maps.Clone.
func TestOps_BuildGroupedAggregateSQL_IsolatesFromCallerMapMutation(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	builder := mock.NewMockBuilder(ctrl)
	want := core.SQLOperation{Name: "users_aggregate", SQL: "SELECT 1"}

	builder.EXPECT().
		BuildGroupedAggregateSQL(gomock.Any()).
		Return(want, nil)

	src := map[string]groupedaggregate.Builder{"public.users": builder}
	ops := groupedaggregate.New(src)

	delete(src, "public.users")

	got, err := ops.BuildGroupedAggregateSQL(sampleInput())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got.Name != want.Name {
		t.Errorf("op = %+v, want %+v", got, want)
	}
}
