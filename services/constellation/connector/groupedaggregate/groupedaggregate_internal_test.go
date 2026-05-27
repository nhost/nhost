package groupedaggregate

import (
	"errors"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
)

// TestNewRequest is a white-box exercise of NewRequest's validation branches.
// The test lives in package groupedaggregate (not groupedaggregate_test) so
// any future helper that depends on unexported state can be exercised from the
// same place; today it only needs the public constructor and the package-local
// sentinel ErrInvalidRequest.
func TestNewRequest(t *testing.T) {
	t.Parallel()

	validField := &ast.Field{Name: "users_aggregate"}

	tests := []struct {
		name              string
		tableSchema       string
		tableName         string
		joinColumnSQLName string
		field             *ast.Field
		joinValues        []any
		fragments         ast.FragmentDefinitionList
		variables         map[string]any
		wantErrSubstr     string
	}{
		{
			name:              "all required fields",
			tableSchema:       "public",
			tableName:         "users",
			joinColumnSQLName: "owner_id",
			field:             validField,
			joinValues:        nil,
			fragments:         nil,
			variables:         nil,
			wantErrSubstr:     "",
		},
		{
			name:              "optional fields populated",
			tableSchema:       "public",
			tableName:         "users",
			joinColumnSQLName: "owner_id",
			field:             validField,
			joinValues:        []any{"u1", "u2"},
			fragments:         ast.FragmentDefinitionList{{Name: "F"}},
			variables:         map[string]any{"limit": 10},
			wantErrSubstr:     "",
		},
		{
			name:              "missing TableSchema",
			tableSchema:       "",
			tableName:         "users",
			joinColumnSQLName: "owner_id",
			field:             validField,
			joinValues:        nil,
			fragments:         nil,
			variables:         nil,
			wantErrSubstr:     "TableSchema is required",
		},
		{
			name:              "missing TableName",
			tableSchema:       "public",
			tableName:         "",
			joinColumnSQLName: "owner_id",
			field:             validField,
			joinValues:        nil,
			fragments:         nil,
			variables:         nil,
			wantErrSubstr:     "TableName is required",
		},
		{
			name:              "missing JoinColumnSQLName",
			tableSchema:       "public",
			tableName:         "users",
			joinColumnSQLName: "",
			field:             validField,
			joinValues:        nil,
			fragments:         nil,
			variables:         nil,
			wantErrSubstr:     "JoinColumnSQLName is required",
		},
		{
			name:              "missing Field",
			tableSchema:       "public",
			tableName:         "users",
			joinColumnSQLName: "owner_id",
			field:             nil,
			joinValues:        nil,
			fragments:         nil,
			variables:         nil,
			wantErrSubstr:     "Field is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req, err := NewRequest(Request{
				TableSchema:       tt.tableSchema,
				TableName:         tt.tableName,
				JoinColumnSQLName: tt.joinColumnSQLName,
				JoinValues:        tt.joinValues,
				Field:             tt.field,
				Fragments:         tt.fragments,
				Variables:         tt.variables,
			})

			if tt.wantErrSubstr != "" {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tt.wantErrSubstr)
				}

				if !errors.Is(err, ErrInvalidRequest) {
					t.Errorf("error %v does not wrap ErrInvalidRequest", err)
				}

				if !strings.Contains(err.Error(), tt.wantErrSubstr) {
					t.Errorf("error %q does not contain %q", err.Error(), tt.wantErrSubstr)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if req.TableSchema != tt.tableSchema ||
				req.TableName != tt.tableName ||
				req.JoinColumnSQLName != tt.joinColumnSQLName ||
				req.Field != tt.field {
				t.Errorf("fields not set correctly: %+v", req)
			}
		})
	}
}
