// Package hasura models the Hasura v3 metadata shape (YAML and JSON) and
// loads it from disk or a hdb_metadata blob. It is consumed by the parent
// metadata package, which converts these types into the native configuration.
package hasura

import (
	"context"
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/goccy/go-yaml"
)

// Metadata is the Hasura v3 top-level envelope: database sources, remote
// GraphQL schemas, and optional action/custom-type metadata.
type Metadata struct {
	Databases       []DatabaseMetadata     `json:"databases"                 yaml:"databases"`
	RemoteSchemas   []RemoteSchemaMetadata `json:"remote_schemas,omitempty"  yaml:"remote_schemas,omitempty"`
	Actions         []ActionMetadata       `json:"actions,omitempty"         yaml:"actions,omitempty"`
	CustomTypes     CustomTypes            `json:"custom_types,omitzero"     yaml:"custom_types,omitempty"`
	InheritedRoles  []InheritedRole        `json:"inherited_roles,omitempty" yaml:"inherited_roles,omitempty"`
	LoadDiagnostics []LoadDiagnostic       `json:"-"                         yaml:"-"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// baseDirKey is the unexported key used to thread the current !include base
// directory through the goccy/go-yaml decoder via context.Context. The decoder
// passes the same context to every UnmarshalYAML(context.Context, ...) call,
// so nested includes can read it without any package-level state.
type baseDirKey struct{}

// withBaseDir returns a child context whose baseDirKey value is dir. It is
// used at every nesting level: FromYAML seeds the root directory, and
// loadIncludedFile derives a child context for each included file.
func withBaseDir(ctx context.Context, dir string) context.Context {
	return context.WithValue(ctx, baseDirKey{}, dir)
}

// baseDirFrom retrieves the current !include base directory from ctx. It
// returns the empty string if no directory has been set (e.g. when an
// UnmarshalYAML method is invoked without going through FromYAML).
func baseDirFrom(ctx context.Context) string {
	dir, _ := ctx.Value(baseDirKey{}).(string)
	return dir
}

// readFileFunc is the signature of the file-reading seam used by FromYAML and
// loadIncludedFile. It defaults to os.ReadFile and is overridable in tests to
// exercise error paths (missing files, permission errors, malformed bytes)
// without writing fixtures to disk.
type readFileFunc func(string) ([]byte, error)

// readFileKey is the unexported key used to thread the file-reading seam
// through the goccy/go-yaml decoder via context.Context, mirroring baseDirKey.
// The decoder passes the same context to every UnmarshalYAML(context.Context,
// ...) call, so nested includes read through the same seam without any
// package-level state.
type readFileKey struct{}

// withReadFile returns a child context whose readFileKey value is fn. It is the
// production seam used by FromYAML and loadIncludedFile and is overridden in
// tests to exercise read error paths without touching the filesystem.
func withReadFile(ctx context.Context, fn readFileFunc) context.Context {
	return context.WithValue(ctx, readFileKey{}, fn)
}

// readFileFrom retrieves the file-reading seam from ctx, defaulting to
// os.ReadFile when no seam has been set (e.g. when an UnmarshalYAML method is
// invoked without going through FromYAML).
func readFileFrom(ctx context.Context) readFileFunc {
	if fn, ok := ctx.Value(readFileKey{}).(readFileFunc); ok && fn != nil {
		return fn
	}

	return os.ReadFile
}

// FromYAML loads database metadata from the Hasura v3 directory layout and
// follows !include tags.
//
// metadataPath is a locator for the metadata directory: filepath.Dir is
// applied to it, and the resulting directory becomes the root for every
// subsequent read. Callers can either pass the directory itself (with a
// trailing path separator, so Dir returns the same directory) or a sentinel
// file inside it such as "<dir>/metadata.yaml" — the file itself is never
// opened. The loader resolves a fixed layout relative to the root:
//
//   - <root>/databases/databases.yaml (required) — the database list
//   - <root>/remote_schemas.yaml      (optional) — the remote schemas list
//
// Both files may use !include directives to pull in further YAML files; the
// include base directory travels through ctx so nested includes resolve
// against the including file's directory.
//
// The context is forwarded to the YAML decoder (which honours its cancellation
// only at coarse granularity) and carries the include base directory across
// nested UnmarshalYAML calls.
func FromYAML(ctx context.Context, metadataPath string) (*Metadata, error) {
	readFile := readFileFrom(ctx)

	baseDir := filepath.Dir(metadataPath)

	databasesPath := filepath.Join(baseDir, "databases", "databases.yaml")

	b, err := readFile(databasesPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file %s: %w", databasesPath, err)
	}

	ctx = withBaseDir(ctx, filepath.Join(baseDir, "databases"))

	var databases []DatabaseMetadata
	if err := yaml.UnmarshalContext(ctx, b, &databases); err != nil {
		return nil, fmt.Errorf("failed to unmarshal yaml: %w", err)
	}

	var remoteSchemas []RemoteSchemaMetadata

	remoteSchemasPath := filepath.Join(baseDir, "remote_schemas.yaml")

	data, err := readFile(remoteSchemasPath)

	switch {
	case err == nil:
		if err := yaml.UnmarshalContext(ctx, data, &remoteSchemas); err != nil {
			return nil, fmt.Errorf("failed to unmarshal remote schemas: %w", err)
		}
	case errors.Is(err, fs.ErrNotExist):
		// remote_schemas.yaml is optional; an absent file leaves remoteSchemas nil.
	default:
		return nil, fmt.Errorf("failed to read file %s: %w", remoteSchemasPath, err)
	}

	var inheritedRoles []InheritedRole

	inheritedRolesPath := filepath.Join(baseDir, "inherited_roles.yaml")

	inheritedData, err := readFile(inheritedRolesPath)

	switch {
	case err == nil:
		if err := yaml.UnmarshalContext(ctx, inheritedData, &inheritedRoles); err != nil {
			return nil, fmt.Errorf("failed to unmarshal inherited roles: %w", err)
		}
	case errors.Is(err, fs.ErrNotExist):
		// inherited_roles.yaml is optional; an absent file leaves inheritedRoles nil.
	default:
		return nil, fmt.Errorf("failed to read file %s: %w", inheritedRolesPath, err)
	}

	actions, customTypes, diagnostics := loadActionMetadataYAML(ctx, baseDir)

	return &Metadata{
		Databases:       databases,
		RemoteSchemas:   remoteSchemas,
		Actions:         actions,
		CustomTypes:     customTypes,
		InheritedRoles:  inheritedRoles,
		LoadDiagnostics: diagnostics,
		Unknown:         nil,
	}, nil
}

// parseIncludePath extracts the path from an include directive like "!include path" or "!path".
func parseIncludePath(s string) (string, bool) {
	s = strings.TrimSpace(s)

	if after, ok := strings.CutPrefix(s, "!include "); ok {
		return after, ok
	}

	if after, ok := strings.CutPrefix(s, "!"); ok {
		return after, ok
	}

	return "", false
}

// loadIncludedFile loads and unmarshals a file referenced by an include directive.
// It joins path against the !include base directory carried by ctx, then
// re-enters the decoder with a child context whose base directory is the
// included file's directory so nested includes resolve correctly.
func loadIncludedFile(ctx context.Context, path string, v any) error {
	fullPath := filepath.Join(baseDirFrom(ctx), path)

	data, err := readFileFrom(ctx)(fullPath)
	if err != nil {
		return fmt.Errorf("failed to read included file %s: %w", fullPath, err)
	}

	child := withBaseDir(ctx, filepath.Dir(fullPath))
	if err := yaml.UnmarshalContext(child, data, v); err != nil {
		return fmt.Errorf("failed to unmarshal included file %s: %w", fullPath, err)
	}

	return nil
}
