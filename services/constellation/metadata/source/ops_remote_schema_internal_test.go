package source

import (
	"bytes"
	"context"
	stdjson "encoding/json"
	"errors"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// remoteSchemaSnapshotJSON seeds one source plus one remote schema "rs" with a
// single "user" permission, so remove/update/permission ops have something to
// act on.
const remoteSchemaSnapshotJSON = `{
  "version": 3,
  "sources": [
    {
      "name": "default",
      "kind": "postgres",
      "tables": [],
      "configuration": {
        "connection_info": {
          "database_url": {"from_env": "PG_URL"},
          "isolation_level": "read-committed",
          "use_prepared_statements": true
        }
      }
    }
  ],
  "remote_schemas": [
    {
      "name": "rs",
      "definition": {
        "url": "http://example.test/graphql",
        "timeout_seconds": 60,
        "customization": {},
        "forward_client_headers": true
      },
      "comment": "",
      "permissions": [
        {"role": "user", "definition": {"schema": "type Query { ping: String }"}}
      ]
    }
  ]
}`

func remoteSchemaStore(t *testing.T, w *fakeWriter) *Store {
	t.Helper()

	h, err := hasura.FromJSON([]byte(remoteSchemaSnapshotJSON))
	if err != nil {
		t.Fatalf("hasura.FromJSON: %v", err)
	}

	s := NewStore(w, nil, nil)
	if err := s.Bootstrap(h, 7); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}

	return s
}

// currentRemoteSchemas re-parses the live snapshot so a test can assert on the
// post-mutation remote schema slice.
func currentRemoteSchemas(t *testing.T, s *Store) []hasura.RemoteSchemaMetadata {
	t.Helper()

	raw, _ := s.HasuraSnapshotJSON()

	h, err := hasura.FromJSON(raw)
	if err != nil {
		t.Fatalf("re-parsing snapshot: %v", err)
	}

	return h.RemoteSchemas
}

// recordingValidator captures the remote schema passed to the validator and
// returns the configured error.
type recordingValidator struct {
	calls []string
	err   error
}

func (r *recordingValidator) validate(_ context.Context, rs *metadata.RemoteSchemaMetadata) error {
	r.calls = append(r.calls, rs.Name)

	return r.err
}

func TestAddRemoteSchema_AppendsAndValidates(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	v := &recordingValidator{}
	s.SetRemoteSchemaValidator(v.validate)

	rv, code, err := s.AddRemoteSchema(t.Context(), []byte(
		`{"name":"rs","definition":{"url":"http://example.test/graphql"}}`,
	))
	if err != nil {
		t.Fatalf("AddRemoteSchema: %v", err)
	}

	if code != "" {
		t.Errorf("code = %q, want empty", code)
	}

	if rv != 8 {
		t.Errorf("rv = %d, want 8", rv)
	}

	if len(v.calls) != 1 || v.calls[0] != "rs" {
		t.Errorf("validator calls = %v, want [rs]", v.calls)
	}

	rs := currentRemoteSchemas(t, s)
	if len(rs) != 1 || rs[0].Name != "rs" {
		t.Fatalf("remote schemas = %+v, want one named rs", rs)
	}
}

func TestAddRemoteSchema_AlreadyExistsSkipsValidation(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := remoteSchemaStore(t, w)

	v := &recordingValidator{}
	s.SetRemoteSchemaValidator(v.validate)

	rv, code, err := s.AddRemoteSchema(t.Context(), []byte(
		`{"name":"rs","definition":{"url":"http://example.test/graphql"}}`,
	))
	if err != nil {
		t.Fatalf("AddRemoteSchema: %v", err)
	}

	if code != CodeAlreadyExists {
		t.Errorf("code = %q, want %q", code, CodeAlreadyExists)
	}

	if rv != 7 {
		t.Errorf("rv = %d, want 7 (no bump on already-exists)", rv)
	}

	if len(v.calls) != 0 {
		t.Errorf(
			"validator called %d times, want 0 (already-exists short-circuits before introspection)",
			len(v.calls),
		)
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0", w.callCount())
	}
}

func TestAddRemoteSchema_ValidatorErrorBlocksPersist(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := bootstrappedStore(t, w)

	boom := errors.New("introspection failed")
	s.SetRemoteSchemaValidator((&recordingValidator{err: boom}).validate)

	_, _, err := s.AddRemoteSchema(t.Context(), []byte(
		`{"name":"rs","definition":{"url":"http://example.test/graphql"}}`,
	))
	if !errors.Is(err, boom) {
		t.Fatalf("err = %v, want introspection failure", err)
	}

	if w.callCount() != 0 {
		t.Errorf("writer calls = %d, want 0 (validation failed before write)", w.callCount())
	}

	if got := s.ResourceVersion(); got != 7 {
		t.Errorf("ResourceVersion = %d, want 7 (unchanged)", got)
	}
}

func TestAddRemoteSchema_RejectsMissingNameAndURL(t *testing.T) {
	t.Parallel()

	cases := map[string]string{
		"missing name":         `{"definition":{"url":"http://x.test"}}`,
		"missing url":          `{"name":"rs","definition":{}}`,
		"both url and fromEnv": `{"name":"rs","definition":{"url":"http://x.test","url_from_env":"X"}}`,
	}

	for name, args := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			s := bootstrappedStore(t, &fakeWriter{})

			if _, _, err := s.AddRemoteSchema(t.Context(), []byte(args)); !errors.Is(
				err, errMissingRequiredField,
			) {
				t.Fatalf("err = %v, want errMissingRequiredField", err)
			}
		})
	}
}

func TestRemoveRemoteSchema(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := remoteSchemaStore(t, w)

	rv, code, err := s.RemoveRemoteSchema(t.Context(), []byte(`{"name":"rs"}`))
	if err != nil {
		t.Fatalf("RemoveRemoteSchema: %v", err)
	}

	if code != "" || rv != 8 {
		t.Errorf("(code, rv) = (%q, %d), want (\"\", 8)", code, rv)
	}

	if rs := currentRemoteSchemas(t, s); len(rs) != 0 {
		t.Errorf("remote schemas = %+v, want empty", rs)
	}
}

func TestRemoveRemoteSchema_NotFound(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	if _, _, err := s.RemoveRemoteSchema(t.Context(), []byte(`{"name":"missing"}`)); !errors.Is(
		err, ErrRemoteSchemaNotFound,
	) {
		t.Fatalf("err = %v, want ErrRemoteSchemaNotFound", err)
	}
}

func TestUpdateRemoteSchema_ReplacesDefinitionPreservesPermissions(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := remoteSchemaStore(t, w)

	v := &recordingValidator{}
	s.SetRemoteSchemaValidator(v.validate)

	_, _, err := s.UpdateRemoteSchema(t.Context(), []byte(
		`{"name":"rs","definition":{"url":"http://updated.test/graphql","timeout_seconds":30}}`,
	))
	if err != nil {
		t.Fatalf("UpdateRemoteSchema: %v", err)
	}

	rs := currentRemoteSchemas(t, s)
	if len(rs) != 1 {
		t.Fatalf("remote schemas = %+v, want one", rs)
	}

	if u := rs[0].Definition.Url; u == nil || *u != "http://updated.test/graphql" {
		t.Errorf("url = %v, want updated", rs[0].Definition.Url)
	}

	if perms := sliceOf(rs[0].Permissions); len(perms) != 1 || perms[0].Role != "user" {
		t.Errorf("permissions = %+v, want preserved [user]", perms)
	}

	// Validator must see the merged final state: new URL, preserved permission.
	if len(v.calls) != 1 {
		t.Fatalf("validator calls = %v, want one", v.calls)
	}
}

func TestUpdateRemoteSchema_NotFound(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	if _, _, err := s.UpdateRemoteSchema(t.Context(), []byte(
		`{"name":"missing","definition":{"url":"http://x.test"}}`,
	)); !errors.Is(err, ErrRemoteSchemaNotFound) {
		t.Fatalf("err = %v, want ErrRemoteSchemaNotFound", err)
	}
}

func TestAddRemoteSchemaPermissions(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := remoteSchemaStore(t, w)

	v := &recordingValidator{}
	s.SetRemoteSchemaValidator(v.validate)

	rv, code, err := s.AddRemoteSchemaPermissions(t.Context(), []byte(
		`{"remote_schema":"rs","role":"manager","definition":{"schema":"type Query { ping: String }"}}`,
	))
	if err != nil {
		t.Fatalf("AddRemoteSchemaPermissions: %v", err)
	}

	if code != "" || rv != 8 {
		t.Errorf("(code, rv) = (%q, %d), want (\"\", 8)", code, rv)
	}

	rs := currentRemoteSchemas(t, s)
	if perms := sliceOf(rs[0].Permissions); len(perms) != 2 {
		t.Fatalf("permissions = %+v, want two roles", perms)
	}

	// The validator must receive the merged entry carrying the new role.
	if len(v.calls) != 1 {
		t.Errorf("validator calls = %v, want one", v.calls)
	}
}

func TestAddRemoteSchemaPermissions_AlreadyExists(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := remoteSchemaStore(t, w)

	v := &recordingValidator{}
	s.SetRemoteSchemaValidator(v.validate)

	rv, code, err := s.AddRemoteSchemaPermissions(t.Context(), []byte(
		`{"remote_schema":"rs","role":"user","definition":{"schema":"type Query { ping: String }"}}`,
	))
	if err != nil {
		t.Fatalf("AddRemoteSchemaPermissions: %v", err)
	}

	if code != CodeAlreadyExists || rv != 7 {
		t.Errorf("(code, rv) = (%q, %d), want (%q, 7)", code, rv, CodeAlreadyExists)
	}

	if len(v.calls) != 0 {
		t.Errorf("validator called %d times, want 0 (idempotent role short-circuits)", len(v.calls))
	}
}

func TestAddRemoteSchemaPermissions_RemoteSchemaNotFound(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})
	s.SetRemoteSchemaValidator((&recordingValidator{}).validate)

	if _, _, err := s.AddRemoteSchemaPermissions(t.Context(), []byte(
		`{"remote_schema":"missing","role":"user","definition":{"schema":"type Query { ping: String }"}}`,
	)); !errors.Is(err, ErrRemoteSchemaNotFound) {
		t.Fatalf("err = %v, want ErrRemoteSchemaNotFound", err)
	}
}

func TestDropRemoteSchemaPermissions(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := remoteSchemaStore(t, w)

	rv, code, err := s.DropRemoteSchemaPermissions(t.Context(), []byte(
		`{"remote_schema":"rs","role":"user"}`,
	))
	if err != nil {
		t.Fatalf("DropRemoteSchemaPermissions: %v", err)
	}

	if code != "" || rv != 8 {
		t.Errorf("(code, rv) = (%q, %d), want (\"\", 8)", code, rv)
	}

	if rs := currentRemoteSchemas(t, s); len(sliceOf(rs[0].Permissions)) != 0 {
		t.Errorf("permissions = %+v, want empty", sliceOf(rs[0].Permissions))
	}
}

func TestDropRemoteSchemaPermissions_RoleNotFound(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	if _, _, err := s.DropRemoteSchemaPermissions(t.Context(), []byte(
		`{"remote_schema":"rs","role":"ghost"}`,
	)); !errors.Is(err, ErrRemoteSchemaPermissionNotFound) {
		t.Fatalf("err = %v, want ErrRemoteSchemaPermissionNotFound", err)
	}
}

func TestIntrospectRemoteSchema(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	const introspectionData = `{"__schema":{"queryType":{"name":"Query"}}}`

	var gotURL string
	s.SetRemoteSchemaIntrospector(
		func(_ context.Context, rs *metadata.RemoteSchemaMetadata) ([]byte, error) {
			url, _ := rs.Definition.URL.Resolve()
			gotURL = url

			return []byte(introspectionData), nil
		},
	)

	out, err := s.IntrospectRemoteSchema(t.Context(), []byte(`{"name":"rs"}`))
	if err != nil {
		t.Fatalf("IntrospectRemoteSchema: %v", err)
	}

	if gotURL != "http://example.test/graphql" {
		t.Errorf("introspected url = %q, want the rs definition url", gotURL)
	}

	raw, ok := out["data"].(stdjson.RawMessage)
	if !ok {
		t.Fatalf("data = %T, want json.RawMessage", out["data"])
	}

	if !bytes.Equal(raw, []byte(introspectionData)) {
		t.Errorf("data = %s, want %s", raw, introspectionData)
	}

	if got := s.ResourceVersion(); got != 7 {
		t.Errorf("ResourceVersion = %d, want 7 (read must not bump)", got)
	}
}

func TestIntrospectRemoteSchema_NotFound(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})
	s.SetRemoteSchemaIntrospector(
		func(context.Context, *metadata.RemoteSchemaMetadata) ([]byte, error) { return nil, nil },
	)

	if _, err := s.IntrospectRemoteSchema(t.Context(), []byte(`{"name":"missing"}`)); !errors.Is(
		err, ErrRemoteSchemaNotFound,
	) {
		t.Fatalf("err = %v, want ErrRemoteSchemaNotFound", err)
	}
}

func TestIntrospectRemoteSchema_IntrospectorUnset(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	if _, err := s.IntrospectRemoteSchema(t.Context(), []byte(`{"name":"rs"}`)); !errors.Is(
		err, ErrRemoteSchemaIntrospectionUnavailable,
	) {
		t.Fatalf("err = %v, want ErrRemoteSchemaIntrospectionUnavailable", err)
	}
}

func TestReloadRemoteSchema(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	called := false
	s.SetRemoteSchemaIntrospector(
		func(context.Context, *metadata.RemoteSchemaMetadata) ([]byte, error) {
			called = true

			return []byte(`{"__schema":{}}`), nil
		},
	)

	out, err := s.ReloadRemoteSchema(t.Context(), []byte(`{"name":"rs"}`))
	if err != nil {
		t.Fatalf("ReloadRemoteSchema: %v", err)
	}

	if !called {
		t.Error("reload did not re-introspect the upstream")
	}

	if msg, _ := out["message"].(string); msg != "success" {
		t.Errorf("message = %v, want success", out["message"])
	}
}

func TestReloadRemoteSchema_PropagatesIntrospectionError(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	boom := errors.New("endpoint down")
	s.SetRemoteSchemaIntrospector(
		func(context.Context, *metadata.RemoteSchemaMetadata) ([]byte, error) { return nil, boom },
	)

	if _, err := s.ReloadRemoteSchema(t.Context(), []byte(`{"name":"rs"}`)); !errors.Is(err, boom) {
		t.Fatalf("err = %v, want endpoint-down error", err)
	}
}

func TestUpdateRemoteSchema_DropsRemoteRelationships(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := remoteSchemaStore(t, w)

	v := &recordingValidator{}
	s.SetRemoteSchemaValidator(v.validate)

	// Seed a remote relationship, then update the definition only. Hasura drops
	// remote relationships on update_remote_schema while preserving permissions.
	if _, _, err := s.CreateRemoteSchemaRemoteRelationship(t.Context(), []byte(
		`{"remote_schema":"rs","type_name":"Team","name":"dept","definition":`+
			`{"to_source":{"source":"default","table":{"schema":"public","name":"departments"},`+
			`"relationship_type":"object","field_mapping":{"departmentId":"id"}}}}`,
	)); err != nil {
		t.Fatalf("seed CreateRemoteSchemaRemoteRelationship: %v", err)
	}

	if _, _, err := s.UpdateRemoteSchema(t.Context(), []byte(
		`{"name":"rs","definition":{"url":"http://updated.test/graphql","timeout_seconds":30}}`,
	)); err != nil {
		t.Fatalf("UpdateRemoteSchema: %v", err)
	}

	rs := currentRemoteSchemas(t, s)
	if len(rs) != 1 {
		t.Fatalf("remote schemas = %+v, want one", rs)
	}

	if len(sliceOf(rs[0].RemoteRelationships)) != 0 {
		t.Errorf("remote_relationships = %+v, want dropped", sliceOf(rs[0].RemoteRelationships))
	}

	if perms := sliceOf(rs[0].Permissions); len(perms) != 1 || perms[0].Role != "user" {
		t.Errorf("permissions = %+v, want preserved [user]", perms)
	}
}

func TestCreateRemoteSchemaRemoteRelationship_ToSource(t *testing.T) {
	t.Parallel()

	w := &fakeWriter{}
	s := remoteSchemaStore(t, w)

	rv, code, err := s.CreateRemoteSchemaRemoteRelationship(t.Context(), []byte(
		`{"remote_schema":"rs","type_name":"Team","name":"dept","definition":`+
			`{"to_source":{"source":"default","table":{"schema":"public","name":"departments"},`+
			`"relationship_type":"object","field_mapping":{"departmentId":"id"}}}}`,
	))
	if err != nil {
		t.Fatalf("CreateRemoteSchemaRemoteRelationship: %v", err)
	}

	if code != "" || rv != 8 {
		t.Errorf("(code, rv) = (%q, %d), want (\"\", 8)", code, rv)
	}

	rs := currentRemoteSchemas(t, s)
	typeRels := sliceOf(rs[0].RemoteRelationships)
	if len(typeRels) != 1 {
		t.Fatalf("remote_relationships = %+v, want one type block", typeRels)
	}

	tr := typeRels[0]
	rels := tr.Relationships
	if string(tr.TypeName) != "Team" || len(rels) != 1 || rels[0].Name != "dept" {
		t.Errorf("type block = %+v, want Team/dept", tr)
	}

	if hasSource, _ := hasura.RemoteSchemaRelationshipKind(rels[0].Definition); !hasSource {
		t.Error("expected to_source definition")
	}
}

func TestCreateRemoteSchemaRemoteRelationship_ToRemoteSchema(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	_, _, err := s.CreateRemoteSchemaRemoteRelationship(t.Context(), []byte(
		`{"remote_schema":"rs","type_name":"Team","name":"weather","definition":`+
			`{"to_remote_schema":{"remote_schema":"weather_api","lhs_fields":["city"],`+
			`"remote_field":{"forecast":{"arguments":{"city":"$city"}}}}}}`,
	))
	if err != nil {
		t.Fatalf("CreateRemoteSchemaRemoteRelationship: %v", err)
	}

	rs := currentRemoteSchemas(t, s)
	rels := sliceOf(rs[0].RemoteRelationships)[0].Relationships

	// The generated GraphQLValueName union can't decode scalar remote_field
	// argument values, so read the to_remote_schema arm from the union's raw
	// JSON rather than the typed AsRelationshipToSchema accessor.
	raw, err := rels[0].Definition.MarshalJSON()
	if err != nil {
		t.Fatalf("definition MarshalJSON: %v", err)
	}

	var body struct {
		ToRemoteSchema *struct {
			RemoteSchema string   `json:"remote_schema"`
			LhsFields    []string `json:"lhs_fields"`
		} `json:"to_remote_schema"`
	}

	if err := stdjson.Unmarshal(raw, &body); err != nil {
		t.Fatalf("decode to_remote_schema: %v", err)
	}

	if body.ToRemoteSchema == nil {
		t.Fatal("expected to_remote_schema definition")
	}

	toRS := body.ToRemoteSchema
	if toRS.RemoteSchema != "weather_api" || len(toRS.LhsFields) != 1 ||
		toRS.LhsFields[0] != "city" {
		t.Errorf("to_remote_schema = %+v, want weather_api/[city]", toRS)
	}
}

func TestCreateRemoteSchemaRemoteRelationship_AlreadyExistsAndNotFound(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	rel := `{"remote_schema":"rs","type_name":"Team","name":"dept","definition":` +
		`{"to_source":{"source":"default","table":{"schema":"public","name":"departments"},` +
		`"relationship_type":"object","field_mapping":{"departmentId":"id"}}}}`

	if _, _, err := s.CreateRemoteSchemaRemoteRelationship(t.Context(), []byte(rel)); err != nil {
		t.Fatalf("first create: %v", err)
	}

	_, code, err := s.CreateRemoteSchemaRemoteRelationship(t.Context(), []byte(rel))
	if err != nil {
		t.Fatalf("second create: %v", err)
	}

	if code != CodeAlreadyExists {
		t.Errorf("code = %q, want %q", code, CodeAlreadyExists)
	}

	missing := `{"remote_schema":"ghost","type_name":"Team","name":"x","definition":` +
		`{"to_source":{"source":"default","table":{"schema":"public","name":"departments"},` +
		`"relationship_type":"object","field_mapping":{"a":"b"}}}}`
	if _, _, err := s.CreateRemoteSchemaRemoteRelationship(
		t.Context(),
		[]byte(missing),
	); !errors.Is(
		err,
		ErrRemoteSchemaNotFound,
	) {
		t.Fatalf("err = %v, want ErrRemoteSchemaNotFound", err)
	}
}

func TestCreateRemoteSchemaRemoteRelationship_RejectsBadDefinition(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	cases := map[string]string{
		"neither": `{"remote_schema":"rs","type_name":"Team","name":"x","definition":{}}`,
		"both": `{"remote_schema":"rs","type_name":"Team","name":"x","definition":` +
			`{"to_source":{"source":"default","table":{"schema":"public","name":"t"},` +
			`"relationship_type":"object","field_mapping":{}},` +
			`"to_remote_schema":{"remote_schema":"x","lhs_fields":["a"],"remote_field":{}}}}`,
	}

	for name, args := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if _, _, err := s.CreateRemoteSchemaRemoteRelationship(
				t.Context(), []byte(args),
			); !errors.Is(err, errMissingRequiredField) {
				t.Fatalf("err = %v, want errMissingRequiredField", err)
			}
		})
	}
}

func TestUpdateRemoteSchemaRemoteRelationship(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	create := `{"remote_schema":"rs","type_name":"Team","name":"dept","definition":` +
		`{"to_source":{"source":"default","table":{"schema":"public","name":"departments"},` +
		`"relationship_type":"object","field_mapping":{"departmentId":"id"}}}}`
	if _, _, err := s.CreateRemoteSchemaRemoteRelationship(
		t.Context(),
		[]byte(create),
	); err != nil {
		t.Fatalf("create: %v", err)
	}

	_, _, err := s.UpdateRemoteSchemaRemoteRelationship(t.Context(), []byte(
		`{"remote_schema":"rs","type_name":"Team","name":"dept","definition":`+
			`{"to_source":{"source":"default","table":{"schema":"public","name":"departments"},`+
			`"relationship_type":"array","field_mapping":{"departmentId":"id"}}}}`,
	))
	if err != nil {
		t.Fatalf("update: %v", err)
	}

	rs := currentRemoteSchemas(t, s)
	rels := sliceOf(rs[0].RemoteRelationships)[0].Relationships

	v, err := rels[0].Definition.AsRelationshipToSource()
	if err != nil {
		t.Fatalf("AsRelationshipToSource: %v", err)
	}

	if got := string(v.ToSource.RelationshipType); got != "array" {
		t.Errorf("relationship_type = %q, want array (updated)", got)
	}
}

func TestUpdateRemoteSchemaRemoteRelationship_NotFound(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	if _, _, err := s.UpdateRemoteSchemaRemoteRelationship(t.Context(), []byte(
		`{"remote_schema":"rs","type_name":"Team","name":"ghost","definition":`+
			`{"to_source":{"source":"default","table":{"schema":"public","name":"t"},`+
			`"relationship_type":"object","field_mapping":{"a":"b"}}}}`,
	)); !errors.Is(err, ErrRelationshipNotFound) {
		t.Fatalf("err = %v, want ErrRelationshipNotFound", err)
	}
}

func TestDeleteRemoteSchemaRemoteRelationship(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	create := `{"remote_schema":"rs","type_name":"Team","name":"dept","definition":` +
		`{"to_source":{"source":"default","table":{"schema":"public","name":"departments"},` +
		`"relationship_type":"object","field_mapping":{"departmentId":"id"}}}}`
	if _, _, err := s.CreateRemoteSchemaRemoteRelationship(
		t.Context(),
		[]byte(create),
	); err != nil {
		t.Fatalf("create: %v", err)
	}

	_, _, err := s.DeleteRemoteSchemaRemoteRelationship(t.Context(), []byte(
		`{"remote_schema":"rs","type_name":"Team","name":"dept"}`,
	))
	if err != nil {
		t.Fatalf("delete: %v", err)
	}

	// Hasura keeps the empty type block after the last relationship is removed,
	// so the type entry remains with an empty relationships slice.
	rs := currentRemoteSchemas(t, s)
	typeRels := sliceOf(rs[0].RemoteRelationships)
	if len(typeRels) != 1 || len(typeRels[0].Relationships) != 0 {
		t.Errorf("remote_relationships = %+v, want one empty Team block", typeRels)
	}
}

func TestDeleteRemoteSchemaRemoteRelationship_MissingIsIdempotent(t *testing.T) {
	t.Parallel()

	s := remoteSchemaStore(t, &fakeWriter{})

	// Hasura's delete_remote_schema_remote_relationship is idempotent: deleting
	// an absent relationship succeeds rather than erroring.
	if _, _, err := s.DeleteRemoteSchemaRemoteRelationship(t.Context(), []byte(
		`{"remote_schema":"rs","type_name":"Team","name":"ghost"}`,
	)); err != nil {
		t.Fatalf("delete of missing relationship should succeed, got: %v", err)
	}
}

func TestDropRemoteSchemaPermissions_SchemaNotFound(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	if _, _, err := s.DropRemoteSchemaPermissions(t.Context(), []byte(
		`{"remote_schema":"missing","role":"user"}`,
	)); !errors.Is(err, ErrRemoteSchemaNotFound) {
		t.Fatalf("err = %v, want ErrRemoteSchemaNotFound", err)
	}
}
