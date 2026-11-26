package mcp

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
)

// SchemaCache stores pre-computed JSON schemas for tool input/output types.
//
// SchemaCache is intended to amortise the cost of JSON-Schema reflection in
// stateless or serverless deployments (e.g., AWS Lambda, Google Cloud
// Functions) where servers are reconstructed on every invocation. Schemas can
// be warmed once at build time, persisted to disk via [SchemaCache.Save], and
// reloaded at start-up via [LoadSchemaCache]. Cached schemas are then consumed
// by [WithCachedInputSchema] and [WithCachedOutputSchema] in lieu of the
// reflection performed by [WithInputSchema] and [WithOutputSchema].
//
// SchemaCache is safe for concurrent use by multiple goroutines.
type SchemaCache struct {
	mu      sync.RWMutex
	schemas map[string]json.RawMessage
}

// NewSchemaCache creates a new empty SchemaCache.
func NewSchemaCache() *SchemaCache {
	return &SchemaCache{schemas: make(map[string]json.RawMessage)}
}

// Warm stores the JSON schema for the given type name. Schemas are typically
// produced by [SchemaFor]. Passing a nil schema removes any existing entry
// for typeName.
func (c *SchemaCache) Warm(typeName string, schema map[string]any) {
	if c == nil {
		return
	}
	if schema == nil {
		c.mu.Lock()
		delete(c.schemas, typeName)
		c.mu.Unlock()
		return
	}
	raw, err := json.Marshal(schema)
	if err != nil {
		return
	}
	c.WarmRaw(typeName, raw)
}

// WarmRaw stores a pre-marshaled JSON schema under the given type name.
// This avoids an unmarshal/marshal round-trip when callers already hold the
// schema as raw JSON. Passing a nil or empty schema removes any existing
// entry for typeName.
func (c *SchemaCache) WarmRaw(typeName string, schema json.RawMessage) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.schemas == nil {
		c.schemas = make(map[string]json.RawMessage)
	}
	if len(schema) == 0 {
		delete(c.schemas, typeName)
		return
	}
	// Copy to avoid aliasing the caller's slice.
	clone := make(json.RawMessage, len(schema))
	copy(clone, schema)
	c.schemas[typeName] = clone
}

// Get retrieves a cached schema by type name as a generic map. The second
// return value reports whether the entry was present.
func (c *SchemaCache) Get(typeName string) (map[string]any, bool) {
	raw, ok := c.GetRaw(typeName)
	if !ok {
		return nil, false
	}
	out := make(map[string]any)
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, false
	}
	return out, true
}

// GetRaw retrieves a cached schema by type name as raw JSON. The returned
// slice is a copy and may be safely mutated by the caller.
func (c *SchemaCache) GetRaw(typeName string) (json.RawMessage, bool) {
	if c == nil {
		return nil, false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	raw, ok := c.schemas[typeName]
	if !ok {
		return nil, false
	}
	clone := make(json.RawMessage, len(raw))
	copy(clone, raw)
	return clone, true
}

// Has reports whether a schema is cached under typeName.
func (c *SchemaCache) Has(typeName string) bool {
	if c == nil {
		return false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	_, ok := c.schemas[typeName]
	return ok
}

// Len returns the number of cached schemas.
func (c *SchemaCache) Len() int {
	if c == nil {
		return 0
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.schemas)
}

// Keys returns the cached type names in sorted order. The result is a fresh
// slice and may be modified by the caller.
func (c *SchemaCache) Keys() []string {
	if c == nil {
		return nil
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	keys := make([]string, 0, len(c.schemas))
	for k := range c.schemas {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// MarshalJSON serialises the cache as a JSON object whose keys are type
// names and whose values are the cached JSON schemas. Keys are emitted in
// sorted order so that the encoded form is deterministic and diff-friendly.
func (c *SchemaCache) MarshalJSON() ([]byte, error) {
	if c == nil {
		return []byte("{}"), nil
	}
	c.mu.RLock()
	defer c.mu.RUnlock()

	keys := make([]string, 0, len(c.schemas))
	for k := range c.schemas {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	buf := make([]byte, 0, 64+len(c.schemas)*64)
	buf = append(buf, '{')
	for i, k := range keys {
		if i > 0 {
			buf = append(buf, ',')
		}
		keyBytes, err := json.Marshal(k)
		if err != nil {
			return nil, fmt.Errorf("marshal schema cache key: %w", err)
		}
		buf = append(buf, keyBytes...)
		buf = append(buf, ':')
		buf = append(buf, c.schemas[k]...)
	}
	buf = append(buf, '}')
	return buf, nil
}

// UnmarshalJSON loads a previously serialised cache, replacing any existing
// contents. The input must be a JSON object whose values are themselves JSON
// schemas; values are stored verbatim as raw JSON.
func (c *SchemaCache) UnmarshalJSON(data []byte) error {
	if c == nil {
		return fmt.Errorf("mcp: SchemaCache.UnmarshalJSON on nil receiver")
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("decode schema cache: %w", err)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.schemas = make(map[string]json.RawMessage, len(raw))
	for k, v := range raw {
		clone := make(json.RawMessage, len(v))
		copy(clone, v)
		c.schemas[k] = clone
	}
	return nil
}

// Save writes the cache to a file as JSON. Parent directories are created if
// needed. The file is written atomically by writing to a temporary sibling
// and renaming it into place.
func (c *SchemaCache) Save(path string) error {
	if c == nil {
		return fmt.Errorf("mcp: SchemaCache.Save on nil receiver")
	}
	data, err := c.MarshalJSON()
	if err != nil {
		return err
	}
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create schema cache directory: %w", err)
		}
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".schema-cache-*.json")
	if err != nil {
		return fmt.Errorf("create temp schema cache file: %w", err)
	}
	tmpName := tmp.Name()
	cleanup := func() { _ = os.Remove(tmpName) }
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		cleanup()
		return fmt.Errorf("write schema cache: %w", err)
	}
	if err := tmp.Close(); err != nil {
		cleanup()
		return fmt.Errorf("close schema cache: %w", err)
	}
	if err := os.Rename(tmpName, path); err != nil {
		cleanup()
		return fmt.Errorf("rename schema cache into place: %w", err)
	}
	return nil
}

// LoadSchemaCache reads a cache from a file produced by [SchemaCache.Save].
func LoadSchemaCache(path string) (*SchemaCache, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read schema cache: %w", err)
	}
	c := NewSchemaCache()
	if err := c.UnmarshalJSON(data); err != nil {
		return nil, err
	}
	return c, nil
}

// TypeKey returns the canonical cache key for the Go type T as derived from
// reflection. Named types use their full import path, including inside
// pointers, slices, arrays, maps, and anonymous structs. Renaming or moving
// the type will change this key, so callers that need a stable identifier
// across refactors should pass an explicit key to [SchemaCache.Warm] and
// [WithCachedInputSchemaKey].
// Caches saved with the old package-name-only keys are still loadable; a
// lookup using the new key misses and regenerates the schema.
func TypeKey[T any]() string {
	return schemaTypeKey(reflect.TypeFor[T]())
}

func schemaTypeKey(t reflect.Type) string {
	if t.Name() != "" {
		if t.PkgPath() != "" {
			return t.PkgPath() + "." + t.Name()
		}
		return t.Name()
	}
	switch t.Kind() {
	case reflect.Pointer:
		return "*" + schemaTypeKey(t.Elem())
	case reflect.Slice:
		return "[]" + schemaTypeKey(t.Elem())
	case reflect.Array:
		return "[" + strconv.Itoa(t.Len()) + "]" + schemaTypeKey(t.Elem())
	case reflect.Map:
		return "map[" + schemaTypeKey(t.Key()) + "]" + schemaTypeKey(t.Elem())
	case reflect.Struct:
		var key strings.Builder
		key.WriteString("struct {")
		for i := range t.NumField() {
			field := t.Field(i)
			if i > 0 {
				key.WriteString(";")
			}
			key.WriteString(" ")
			if !field.Anonymous {
				if field.PkgPath != "" {
					key.WriteString(field.PkgPath)
					key.WriteString(".")
				}
				key.WriteString(field.Name)
				key.WriteString(" ")
			}
			key.WriteString(schemaTypeKey(field.Type))
			if field.Tag != "" {
				key.WriteString(" ")
				key.WriteString(strconv.Quote(string(field.Tag)))
			}
		}
		key.WriteString(" }")
		return key.String()
	default:
		return t.String()
	}
}

// SchemaFor returns the JSON schema generated for the Go type T, formatted as
// a generic map suitable for [SchemaCache.Warm]. It returns nil if reflection
// or marshalling fails. Use [SchemaForRaw] when an error is desired.
func SchemaFor[T any]() map[string]any {
	raw, err := SchemaForRaw[T]()
	if err != nil {
		return nil
	}
	out := make(map[string]any)
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil
	}
	return out
}

// SchemaForRaw returns the JSON schema generated for the Go type T as raw
// JSON. It is the lower-level building block underlying [SchemaFor],
// [WithInputSchema] and [WithOutputSchema].
func SchemaForRaw[T any]() (json.RawMessage, error) {
	return schemaForRawMessage[T]()
}

// WarmFor computes the schema for T via reflection and stores it in cache.
// If key is provided, the first non-empty entry is used as the cache key;
// otherwise [TypeKey] is used. WarmFor is a no-op when cache is nil. It
// returns an error only when schema generation itself fails.
func WarmFor[T any](cache *SchemaCache, key ...string) error {
	if cache == nil {
		return nil
	}
	raw, err := SchemaForRaw[T]()
	if err != nil {
		return err
	}
	k := TypeKey[T]()
	for _, candidate := range key {
		if candidate != "" {
			k = candidate
			break
		}
	}
	cache.WarmRaw(k, raw)
	return nil
}

// WithCachedInputSchema is a cache-aware variant of [WithInputSchema]. It
// looks up the schema for T in cache using [TypeKey]; on a miss it falls
// back to reflection and stores the freshly computed schema back into the
// cache so that subsequent invocations are served from memory. Passing a nil
// cache is equivalent to [WithInputSchema].
func WithCachedInputSchema[T any](cache *SchemaCache) ToolOption {
	return WithCachedInputSchemaKey[T](cache, TypeKey[T]())
}

// WithCachedInputSchemaKey is a variant of [WithCachedInputSchema] that uses
// an explicit cache key instead of one derived from T's type name. Use this
// when stability of the key across renames or package moves matters.
//
// An empty key disables the cache entirely for this call: the schema is
// always reflected fresh and never read from or written to cache. This
// mirrors [WarmFor] and prevents distinct types from colliding on a shared
// empty-string cache slot.
func WithCachedInputSchemaKey[T any](cache *SchemaCache, key string) ToolOption {
	return func(t *Tool) {
		var (
			raw json.RawMessage
			ok  bool
		)
		if key != "" {
			raw, ok = cache.GetRaw(key)
		}
		if !ok {
			fresh, err := SchemaForRaw[T]()
			if err != nil {
				return
			}
			raw = fresh
			if key != "" {
				cache.WarmRaw(key, fresh)
			}
		}
		t.InputSchema.Type = ""
		t.InputSchema.Types = nil
		t.RawInputSchema = raw
	}
}

// WithCachedOutputSchema is a cache-aware variant of [WithOutputSchema]. It
// looks up the schema for T in cache using [TypeKey]; on a miss it falls
// back to reflection and stores the freshly computed schema back into the
// cache. Passing a nil cache is equivalent to [WithOutputSchema].
func WithCachedOutputSchema[T any](cache *SchemaCache) ToolOption {
	return WithCachedOutputSchemaKey[T](cache, TypeKey[T]())
}

// WithCachedOutputSchemaKey is a variant of [WithCachedOutputSchema] that
// uses an explicit cache key instead of one derived from T's type name.
//
// An empty key disables the cache entirely for this call: the schema is
// always reflected fresh and never read from or written to cache. This
// mirrors [WarmFor] and prevents distinct types from colliding on a shared
// empty-string cache slot.
func WithCachedOutputSchemaKey[T any](cache *SchemaCache, key string) ToolOption {
	return func(t *Tool) {
		var (
			raw json.RawMessage
			ok  bool
		)
		if key != "" {
			raw, ok = cache.GetRaw(key)
		}
		if !ok {
			fresh, err := SchemaForRaw[T]()
			if err != nil {
				return
			}
			raw = fresh
			if key != "" {
				cache.WarmRaw(key, fresh)
			}
		}
		var outputSchema ToolOutputSchema
		if err := json.Unmarshal(raw, &outputSchema); err != nil {
			return
		}
		t.OutputSchema = outputSchema
		// Always set the type to "object" as of the current MCP spec.
		// https://modelcontextprotocol.io/specification/2025-06-18/server/tools#output-schema
		t.OutputSchema.Type = "object"
		// Decoding the generated schema recorded struct field order. Clear it
		// so these tools keep emitting properties sorted by name.
		t.OutputSchema.PropertyOrder = nil
	}
}
