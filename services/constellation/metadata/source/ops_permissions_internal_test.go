package source //nolint:testpackage // exercises unexported builders + fakes

import (
	"errors"
	"testing"
)

// trackUsers tracks public.users on a freshly bootstrapped Store so a
// permission can be attached to it, and returns the Store at its post-track
// resource_version.
func trackUsers(t *testing.T) *Store {
	t.Helper()

	s := bootstrappedStore(t, &fakeWriter{}) // rv=7

	if _, _, err := s.PgTrackTable(t.Context(), []byte(
		`{"source":"default","table":{"schema":"public","name":"users"}}`,
	)); err != nil {
		t.Fatalf("PgTrackTable: %v", err)
	}

	return s
}

// TestCreatePermission_IdempotentUnmodeledKeyOrder is the regression guard for
// the create-permission idempotency check. The stored snapshot is re-marshalled
// deterministically after every Apply (MarshalHasura sorts object keys), so a
// permission's captured `,unknown` bytes are key-sorted in the store, while an
// incoming request carries them verbatim. A byte-wise comparison (the old
// reflect.DeepEqual) therefore reported a semantically-identical re-create that
// carries unmodeled sibling keys in non-sorted order as DIFFERENT, returning a
// spurious 400 already-exists instead of the idempotent 200. permissionsEqual
// re-marshals both sides through the config's deterministic MarshalJSON, so the
// comparison is order-insensitive.
func TestCreatePermission_IdempotentUnmodeledKeyOrder(t *testing.T) {
	t.Parallel()

	s := trackUsers(t)
	afterTrack := s.ResourceVersion()

	const tableRole = `"source":"default","table":{"schema":"public","name":"users"},"role":"user"`

	// Two unmodeled sibling keys in non-sorted order ("zeta" before "alpha").
	// After the first create round-trips through MarshalHasura they are stored
	// sorted; the re-create below sends them in this same non-sorted order.
	const perm = `{"columns":["id"],"filter":{},"zeta":1,"alpha":2}`

	// 1. First create: succeeds and bumps the version.
	if _, code, err := s.PgCreateSelectPermission(
		t.Context(), []byte(`{`+tableRole+`,"permission":`+perm+`}`),
	); err != nil {
		t.Fatalf("initial create: %v", err)
	} else if code != "" {
		t.Errorf("initial create code = %q, want empty", code)
	}

	afterCreate := s.ResourceVersion()
	if afterCreate != afterTrack+1 {
		t.Fatalf("rv after create = %d, want %d", afterCreate, afterTrack+1)
	}

	// 2. Identical re-create with the unmodeled keys in the same non-sorted
	// order: must be the idempotent already-exists 200 with no version bump.
	_, code, err := s.PgCreateSelectPermission(
		t.Context(), []byte(`{`+tableRole+`,"permission":`+perm+`}`),
	)
	if err != nil {
		t.Fatalf("idempotent re-create: %v", err)
	}

	if code != CodeAlreadyExists {
		t.Errorf("re-create code = %q, want %q", code, CodeAlreadyExists)
	}

	if rv := s.ResourceVersion(); rv != afterCreate {
		t.Errorf("rv after idempotent re-create = %d, want %d (no bump)", rv, afterCreate)
	}
}

// TestCreatePermission_DivergentDefinitionRejected covers the most error-prone
// branch of the create-permission ops: re-creating a permission for a role that
// already has one with a DIFFERENT definition must fail with ErrPermissionExists
// (the "already-exists" 400), whereas re-creating with an IDENTICAL definition
// is the idempotent CodeAlreadyExists 200. Every other permission test only
// exercises the identical (idempotent) arm, so a regression flipping the
// comparison or dropping the reject path would otherwise pass silently.
func TestCreatePermission_DivergentDefinitionRejected(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		create    func(s *Store, body string) (int64, IdempotencyCode, error)
		initial   string
		divergent string
	}{
		{
			name: "select",
			create: func(s *Store, body string) (int64, IdempotencyCode, error) {
				return s.PgCreateSelectPermission(t.Context(), []byte(body))
			},
			initial:   `{"columns":["id"],"filter":{}}`,
			divergent: `{"columns":["id","email"],"filter":{}}`,
		},
		{
			name: "delete",
			create: func(s *Store, body string) (int64, IdempotencyCode, error) {
				return s.PgCreateDeletePermission(t.Context(), []byte(body))
			},
			initial:   `{"filter":{}}`,
			divergent: `{"filter":{"id":{"_eq":"x"}}}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s := trackUsers(t)
			afterTrack := s.ResourceVersion()

			const tableRole = `"source":"default","table":{"schema":"public","name":"users"},"role":"user"`

			// 1. First create: succeeds, bumps the version, no idempotency code.
			_, code, err := tc.create(s, `{`+tableRole+`,"permission":`+tc.initial+`}`)
			if err != nil {
				t.Fatalf("initial create: %v", err)
			}

			if code != "" {
				t.Errorf("initial create code = %q, want empty", code)
			}

			afterCreate := s.ResourceVersion()
			if afterCreate != afterTrack+1 {
				t.Errorf("rv after create = %d, want %d", afterCreate, afterTrack+1)
			}

			// 2. Identical re-create: idempotent already-exists 200, no bump.
			_, code, err = tc.create(s, `{`+tableRole+`,"permission":`+tc.initial+`}`)
			if err != nil {
				t.Fatalf("identical re-create: %v", err)
			}

			if code != CodeAlreadyExists {
				t.Errorf("identical re-create code = %q, want %q", code, CodeAlreadyExists)
			}

			if rv := s.ResourceVersion(); rv != afterCreate {
				t.Errorf("rv after identical re-create = %d, want %d (no bump)", rv, afterCreate)
			}

			// 3. Divergent re-create: ErrPermissionExists, no bump.
			_, _, err = tc.create(s, `{`+tableRole+`,"permission":`+tc.divergent+`}`)
			if !errors.Is(err, ErrPermissionExists) {
				t.Fatalf("divergent re-create err = %v, want ErrPermissionExists", err)
			}

			if rv := s.ResourceVersion(); rv != afterCreate {
				t.Errorf("rv after divergent reject = %d, want %d (no write)", rv, afterCreate)
			}
		})
	}
}
