package hasura

import (
	"context"
	"errors"
	"io/fs"
	"strings"
	"testing"
)

func TestFromYAML_MissingDatabasesFile(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(_ string) ([]byte, error) {
		return nil, &fs.PathError{Op: "open", Path: "missing", Err: fs.ErrNotExist}
	})

	m, err := FromYAML(ctx, "anywhere/metadata.yaml")
	if err == nil {
		t.Fatalf("expected error, got metadata: %+v", m)
	}

	if !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("expected wrapped fs.ErrNotExist, got %v", err)
	}

	if !strings.Contains(err.Error(), "failed to read file") {
		t.Errorf("expected wrap context %q in error, got %v", "failed to read file", err)
	}
}

func TestFromYAML_MalformedDatabasesYAML(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(_ string) ([]byte, error) {
		return []byte("not: [valid yaml"), nil
	})

	m, err := FromYAML(ctx, "anywhere/metadata.yaml")
	if err == nil {
		t.Fatalf("expected error, got metadata: %+v", m)
	}

	if !strings.Contains(err.Error(), "failed to unmarshal yaml") {
		t.Errorf("expected unmarshal error context, got %v", err)
	}
}

func TestFromYAML_MalformedRemoteSchemasYAML(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(path string) ([]byte, error) {
		if strings.HasSuffix(path, "remote_schemas.yaml") {
			return []byte("not: [valid yaml"), nil
		}
		// databases.yaml: empty list is a valid databases array.
		return []byte("[]"), nil
	})

	m, err := FromYAML(ctx, "anywhere/metadata.yaml")
	if err == nil {
		t.Fatalf("expected error, got metadata: %+v", m)
	}

	if !strings.Contains(err.Error(), "failed to unmarshal remote schemas") {
		t.Errorf("expected unmarshal remote schemas context, got %v", err)
	}
}

func TestFromYAML_RemoteSchemasMissingIsNotAnError(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(path string) ([]byte, error) {
		if strings.HasSuffix(path, "remote_schemas.yaml") {
			return nil, &fs.PathError{Op: "open", Path: path, Err: fs.ErrNotExist}
		}

		return []byte("[]"), nil
	})

	m, err := FromYAML(ctx, "anywhere/metadata.yaml")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if m == nil {
		t.Fatalf("expected non-nil metadata")
	}

	if len(m.Databases) != 0 {
		t.Errorf("expected zero databases, got %d", len(m.Databases))
	}

	if len(m.RemoteSchemas) != 0 {
		t.Errorf("expected zero remote schemas, got %d", len(m.RemoteSchemas))
	}
}

// TestFromYAML_RemoteSchemasReadErrorIsSurfaced verifies that a present-but-
// unreadable remote_schemas.yaml (any error that is not fs.ErrNotExist) aborts
// loading with a wrapped error rather than being silently skipped.
func TestFromYAML_RemoteSchemasReadErrorIsSurfaced(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("permission denied")

	ctx := withReadFile(context.Background(), func(path string) ([]byte, error) {
		if strings.HasSuffix(path, "remote_schemas.yaml") {
			return nil, &fs.PathError{Op: "open", Path: path, Err: sentinel}
		}

		return []byte("[]"), nil
	})

	m, err := FromYAML(ctx, "anywhere/metadata.yaml")
	if err == nil {
		t.Fatalf("expected error, got metadata: %+v", m)
	}

	if errors.Is(err, fs.ErrNotExist) {
		t.Errorf("expected non-NotExist error, got wrapped fs.ErrNotExist: %v", err)
	}

	if !errors.Is(err, sentinel) {
		t.Errorf("expected wrapped sentinel error, got %v", err)
	}

	if !strings.Contains(err.Error(), "failed to read file") {
		t.Errorf("expected wrap context %q in error, got %v", "failed to read file", err)
	}
}

func TestLoadIncludedFile_MissingFile(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(_ string) ([]byte, error) {
		return nil, &fs.PathError{Op: "open", Path: "missing", Err: fs.ErrNotExist}
	})

	var dst []any

	err := loadIncludedFile(ctx, "missing.yaml", &dst)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}

	if !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("expected wrapped fs.ErrNotExist, got %v", err)
	}

	if !strings.Contains(err.Error(), "failed to read included file") {
		t.Errorf("expected wrap context %q in error, got %v", "failed to read included file", err)
	}
}

func TestLoadIncludedFile_MalformedYAML(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(_ string) ([]byte, error) {
		return []byte("not: [valid yaml"), nil
	})

	var dst []any

	err := loadIncludedFile(ctx, "anywhere.yaml", &dst)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "failed to unmarshal included file") {
		t.Errorf(
			"expected wrap context %q in error, got %v",
			"failed to unmarshal included file",
			err,
		)
	}
}
