package hasura

import (
	"context"
	"errors"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
)

// TestFunctionMetadata_UnmarshalYAML_InlineObject covers the default-decoder
// branch where the YAML payload is a full FunctionMetadata mapping.
func TestFunctionMetadata_UnmarshalYAML_InlineObject(t *testing.T) {
	t.Parallel()

	input := []byte(`
function:
  name: search_users
  schema: public
configuration:
  exposed_as: query
  session_argument: hasura_session
  custom_root_fields:
    function: searchUsers
    function_aggregate: searchUsersAggregate
permissions:
  - role: user
`)

	var fn FunctionMetadata
	if err := yaml.Unmarshal(input, &fn); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if fn.Function.Name != "search_users" {
		t.Errorf("Function.Name = %q, want %q", fn.Function.Name, "search_users")
	}

	if fn.Function.Schema != "public" {
		t.Errorf("Function.Schema = %q, want %q", fn.Function.Schema, "public")
	}

	if fn.Configuration.ExposedAs != "query" {
		t.Errorf("ExposedAs = %q, want %q", fn.Configuration.ExposedAs, "query")
	}

	if fn.Configuration.SessionArgument != "hasura_session" {
		t.Errorf(
			"SessionArgument = %q, want %q",
			fn.Configuration.SessionArgument,
			"hasura_session",
		)
	}

	if fn.Configuration.CustomRootFields.Function != "searchUsers" {
		t.Errorf(
			"CustomRootFields.Function = %q, want %q",
			fn.Configuration.CustomRootFields.Function,
			"searchUsers",
		)
	}

	if len(fn.Permissions) != 1 || fn.Permissions[0].Role != "user" {
		t.Errorf("Permissions = %+v, want [{Role:user}]", fn.Permissions)
	}
}

// TestFunctionMetadata_UnmarshalYAML_IncludeBangInclude covers the
// "!include path" directive branch.
func TestFunctionMetadata_UnmarshalYAML_IncludeBangInclude(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(path string) ([]byte, error) {
		if filepath.ToSlash(path) == "/base/fn.yaml" {
			return []byte(`
function:
  name: included_fn
  schema: app
configuration:
  exposed_as: mutation
`), nil
		}

		return nil, &fs.PathError{Op: "open", Path: path, Err: fs.ErrNotExist}
	})

	ctx = withBaseDir(ctx, "/base")

	var fn FunctionMetadata
	if err := yaml.UnmarshalContext(ctx, []byte(`"!include fn.yaml"`), &fn); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if fn.Function.Name != "included_fn" {
		t.Errorf("Function.Name = %q, want %q", fn.Function.Name, "included_fn")
	}

	if fn.Function.Schema != "app" {
		t.Errorf("Function.Schema = %q, want %q", fn.Function.Schema, "app")
	}

	if fn.Configuration.ExposedAs != "mutation" {
		t.Errorf("ExposedAs = %q, want %q", fn.Configuration.ExposedAs, "mutation")
	}
}

// TestFunctionMetadata_UnmarshalYAML_IncludeBangOnly covers the bare "!path"
// directive branch (no space after the bang).
func TestFunctionMetadata_UnmarshalYAML_IncludeBangOnly(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(path string) ([]byte, error) {
		if filepath.ToSlash(path) == "/base/bang_only.yaml" {
			return []byte(`
function:
  name: bang_only_fn
  schema: app
`), nil
		}

		return nil, &fs.PathError{Op: "open", Path: path, Err: fs.ErrNotExist}
	})

	ctx = withBaseDir(ctx, "/base")

	var fn FunctionMetadata
	if err := yaml.UnmarshalContext(ctx, []byte(`"!bang_only.yaml"`), &fn); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if fn.Function.Name != "bang_only_fn" {
		t.Errorf("Function.Name = %q, want %q", fn.Function.Name, "bang_only_fn")
	}
}

// TestFunctionMetadata_UnmarshalYAML_IncludeMissing surfaces the wrap error
// returned when the referenced include file does not exist.
func TestFunctionMetadata_UnmarshalYAML_IncludeMissing(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(path string) ([]byte, error) {
		return nil, &fs.PathError{Op: "open", Path: path, Err: fs.ErrNotExist}
	})

	ctx = withBaseDir(ctx, "/base")

	var fn FunctionMetadata

	err := yaml.UnmarshalContext(ctx, []byte(`"!include missing.yaml"`), &fn)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("expected wrapped fs.ErrNotExist, got %v", err)
	}
}

// TestFunctionMetadata_UnmarshalYAML_MalformedInline exercises the wrap error
// emitted by the inline branch when the payload shape is wrong.
func TestFunctionMetadata_UnmarshalYAML_MalformedInline(t *testing.T) {
	t.Parallel()

	var fn FunctionMetadata

	err := yaml.Unmarshal([]byte(`
function:
  name: x
  schema: y
configuration: not_a_mapping
`), &fn)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "unmarshaling function metadata") {
		t.Errorf(
			"expected wrap context %q, got %v",
			"unmarshaling function metadata",
			err,
		)
	}
}
