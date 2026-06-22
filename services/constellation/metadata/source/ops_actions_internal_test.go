package source

import (
	"errors"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// currentActions re-parses the live snapshot so a test can assert on the
// post-mutation action slice.
func currentActions(t *testing.T, s *Store) []hasura.ActionMetadata {
	t.Helper()

	raw, _ := s.HasuraSnapshotJSON()

	h, err := hasura.FromJSON(raw)
	if err != nil {
		t.Fatalf("re-parsing snapshot: %v", err)
	}

	return h.Actions
}

func currentCustomTypes(t *testing.T, s *Store) hasura.CustomTypes {
	t.Helper()

	raw, _ := s.HasuraSnapshotJSON()

	h, err := hasura.FromJSON(raw)
	if err != nil {
		t.Fatalf("re-parsing snapshot: %v", err)
	}

	return h.CustomTypes
}

const createActionArgs = `{
  "name": "sendEmail",
  "definition": {
    "kind": "synchronous",
    "type": "mutation",
    "handler": "http://handler.test/sendEmail",
    "output_type": "SendEmailOutput",
    "arguments": [{"name": "to", "type": "String!"}],
    "headers": [{"name": "x-api-key", "value_from_env": "API_KEY"}]
  },
  "comment": "sends an email"
}`

func TestCreateAction_AppendsAndIsIdempotent(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	rv, code, err := s.CreateAction(t.Context(), []byte(createActionArgs))
	if err != nil {
		t.Fatalf("CreateAction: %v", err)
	}

	if code != "" {
		t.Errorf("code = %q, want empty", code)
	}

	if rv == 0 {
		t.Error("resource version not bumped")
	}

	actions := currentActions(t, s)
	if len(actions) != 1 || actions[0].Name != "sendEmail" {
		t.Fatalf("actions = %+v, want one named sendEmail", actions)
	}

	if got := actions[0].Definition.Handler; got != "http://handler.test/sendEmail" {
		t.Errorf("handler = %q", got)
	}

	if hdrs := actions[0].Definition.Headers; len(hdrs) != 1 || hdrs[0].Value.FromEnv != "API_KEY" {
		t.Fatalf("header env not round-tripped: %+v", hdrs)
	}

	// Re-creating the same action is an idempotent no-op.
	_, code, err = s.CreateAction(t.Context(), []byte(createActionArgs))
	if err != nil {
		t.Fatalf("CreateAction (repeat): %v", err)
	}

	if code != CodeAlreadyExists {
		t.Errorf("code = %q, want %q", code, CodeAlreadyExists)
	}

	if got := currentActions(t, s); len(got) != 1 {
		t.Errorf("actions after repeat = %d, want 1", len(got))
	}
}

func TestCreateAction_RequiresNameAndHandler(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	for _, args := range []string{
		`{"definition":{"handler":"http://h.test"}}`,
		`{"name":"noHandler","definition":{}}`,
	} {
		if _, _, err := s.CreateAction(t.Context(), []byte(args)); !errors.Is(err, errMissingRequiredField) {
			t.Errorf("CreateAction(%s) err = %v, want missing-required-field", args, err)
		}
	}
}

func TestCreateAndUpdateAction_RejectReservedEnvVarHeader(t *testing.T) {
	t.Parallel()

	const reserved = `{"name":"leaky","definition":{"kind":"synchronous","type":"mutation",` +
		`"handler":"http://h.test","output_type":"Out",` +
		`"headers":[{"name":"x-client-id","value_from_env":"HASURA_GRAPHQL_CLIENT_NAME"}]}}`

	s := bootstrappedStore(t, &fakeWriter{})

	// create_action rejects a HASURA_GRAPHQL_* value_from_env header, matching
	// Hasura's parse-failed security guard.
	if _, _, err := s.CreateAction(t.Context(), []byte(reserved)); !errors.Is(err, ErrReservedEnvVarPrefix) {
		t.Errorf("CreateAction err = %v, want ErrReservedEnvVarPrefix", err)
	}

	// update_action enforces the same guard.
	if _, _, err := s.UpdateAction(t.Context(), []byte(reserved)); !errors.Is(err, ErrReservedEnvVarPrefix) {
		t.Errorf("UpdateAction err = %v, want ErrReservedEnvVarPrefix", err)
	}

	// A non-reserved value_from_env is still accepted.
	const allowed = `{"name":"ok","definition":{"kind":"synchronous","type":"mutation",` +
		`"handler":"http://h.test","output_type":"Out",` +
		`"headers":[{"name":"x-api-key","value_from_env":"API_KEY"}]}}`

	if _, _, err := s.CreateAction(t.Context(), []byte(allowed)); err != nil {
		t.Errorf("CreateAction(allowed) err = %v, want nil", err)
	}
}

func TestUpdateAction_ReplacesDefinitionPreservingPermissions(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	if _, _, err := s.CreateAction(t.Context(), []byte(createActionArgs)); err != nil {
		t.Fatalf("CreateAction: %v", err)
	}

	if _, _, err := s.CreateActionPermission(
		t.Context(), []byte(`{"action":"sendEmail","role":"user"}`),
	); err != nil {
		t.Fatalf("CreateActionPermission: %v", err)
	}

	_, _, err := s.UpdateAction(t.Context(), []byte(`{
		"name": "sendEmail",
		"definition": {"kind": "asynchronous", "type": "mutation", "handler": "http://new.test"}
	}`))
	if err != nil {
		t.Fatalf("UpdateAction: %v", err)
	}

	actions := currentActions(t, s)
	if len(actions) != 1 {
		t.Fatalf("actions = %d, want 1", len(actions))
	}

	if got := actions[0].Definition.Handler; got != "http://new.test" {
		t.Errorf("handler = %q, want updated", got)
	}

	if got := actions[0].Definition.Kind; got != hasura.ActionKindAsynchronous {
		t.Errorf("kind = %q, want asynchronous", got)
	}

	if perms := actions[0].Permissions; len(perms) != 1 || perms[0].Role != "user" {
		t.Errorf("permissions not preserved across update: %+v", perms)
	}
}

func TestUpdateAndDropAction_NotFound(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	_, _, err := s.UpdateAction(t.Context(), []byte(`{"name":"ghost","definition":{"handler":"http://h"}}`))
	if !errors.Is(err, ErrActionNotFound) {
		t.Errorf("UpdateAction err = %v, want ErrActionNotFound", err)
	}

	_, _, err = s.DropAction(t.Context(), []byte(`{"name":"ghost"}`))
	if !errors.Is(err, ErrActionNotFound) {
		t.Errorf("DropAction err = %v, want ErrActionNotFound", err)
	}
}

func TestDropAction_Removes(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	if _, _, err := s.CreateAction(t.Context(), []byte(createActionArgs)); err != nil {
		t.Fatalf("CreateAction: %v", err)
	}

	if _, _, err := s.DropAction(t.Context(), []byte(`{"name":"sendEmail","clear_data":true}`)); err != nil {
		t.Fatalf("DropAction: %v", err)
	}

	if got := currentActions(t, s); len(got) != 0 {
		t.Errorf("actions after drop = %d, want 0", len(got))
	}
}

func TestActionPermissions_AddDuplicateAndDrop(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	if _, _, err := s.CreateAction(t.Context(), []byte(createActionArgs)); err != nil {
		t.Fatalf("CreateAction: %v", err)
	}

	if _, _, err := s.CreateActionPermission(
		t.Context(), []byte(`{"action":"sendEmail","role":"user"}`),
	); err != nil {
		t.Fatalf("CreateActionPermission: %v", err)
	}

	_, code, err := s.CreateActionPermission(
		t.Context(), []byte(`{"action":"sendEmail","role":"user"}`),
	)
	if err != nil {
		t.Fatalf("CreateActionPermission (dup): %v", err)
	}

	if code != CodeAlreadyExists {
		t.Errorf("dup code = %q, want %q", code, CodeAlreadyExists)
	}

	if _, _, err := s.CreateActionPermission(
		t.Context(), []byte(`{"action":"ghost","role":"user"}`),
	); !errors.Is(err, ErrActionNotFound) {
		t.Errorf("CreateActionPermission(ghost) err = %v, want ErrActionNotFound", err)
	}

	if _, _, err := s.DropActionPermission(
		t.Context(), []byte(`{"action":"sendEmail","role":"user"}`),
	); err != nil {
		t.Fatalf("DropActionPermission: %v", err)
	}

	if perms := currentActions(t, s)[0].Permissions; len(perms) != 0 {
		t.Errorf("permissions after drop = %+v, want empty", perms)
	}

	if _, _, err := s.DropActionPermission(
		t.Context(), []byte(`{"action":"sendEmail","role":"user"}`),
	); !errors.Is(err, ErrActionPermissionNotFound) {
		t.Errorf("DropActionPermission(missing) err = %v, want ErrActionPermissionNotFound", err)
	}
}

func TestBuildMutation_RoutesActionOps(t *testing.T) {
	t.Parallel()

	for _, op := range []string{
		opCreateAction, opDropAction, opUpdateAction,
		opCreateActionPermission, opDropActionPermission, opSetCustomTypes,
	} {
		if _, err := BuildMutation(op, []byte(`{}`)); errors.Is(err, ErrUnknownMutationOp) {
			t.Errorf("BuildMutation(%q) returned ErrUnknownMutationOp; missing from bulk dispatch", op)
		}
	}
}

func TestBulkAtomic_RejectsActionOps(t *testing.T) {
	t.Parallel()

	// Actions are not part of Hasura's narrow bulk_atomic whitelist (neither are
	// remote-schema ops); they remain available via non-atomic bulk and single
	// ops only.
	for _, op := range []string{opCreateAction, opUpdateAction, opSetCustomTypes} {
		if BulkAtomicSupports(op) {
			t.Errorf("BulkAtomicSupports(%q) = true, want false", op)
		}
	}
}

func TestSetCustomTypes_Replaces(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	_, _, err := s.SetCustomTypes(t.Context(), []byte(`{
		"objects": [{"name": "SendEmailOutput", "fields": [{"name": "id", "type": "String!"}]}],
		"scalars": [{"name": "Email"}]
	}`))
	if err != nil {
		t.Fatalf("SetCustomTypes: %v", err)
	}

	ct := currentCustomTypes(t, s)
	if len(ct.Objects) != 1 || ct.Objects[0].Name != "SendEmailOutput" {
		t.Fatalf("objects = %+v", ct.Objects)
	}

	if len(ct.Scalars) != 1 || ct.Scalars[0].Name != "Email" {
		t.Fatalf("scalars = %+v", ct.Scalars)
	}

	// A second call fully replaces the previous registry.
	if _, _, err := s.SetCustomTypes(t.Context(), []byte(`{"enums":[{"name":"Color","values":[{"value":"RED"}]}]}`)); err != nil {
		t.Fatalf("SetCustomTypes (replace): %v", err)
	}

	ct = currentCustomTypes(t, s)
	if len(ct.Objects) != 0 || len(ct.Scalars) != 0 || len(ct.Enums) != 1 {
		t.Fatalf("custom types not replaced: %+v", ct)
	}
}
