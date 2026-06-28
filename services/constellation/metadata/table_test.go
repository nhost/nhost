package metadata_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestExtractRemoteFieldPath(t *testing.T) {
	t.Parallel()

	t.Run("nil input returns nil", func(t *testing.T) {
		t.Parallel()

		if got := metadata.ExtractRemoteFieldPath(nil); got != nil {
			t.Errorf("expected nil, got %+v", got)
		}
	})

	t.Run("single field, no nesting", func(t *testing.T) {
		t.Parallel()

		in := map[string]metadata.RemoteFieldCall{
			"getUser": {
				Arguments: map[string]string{"id": "$user_id"},
				Field:     nil,
			},
		}

		want := []metadata.RemoteFieldPathEntry{
			{FieldName: "getUser", Arguments: map[string]string{"id": "$user_id"}},
		}

		got := metadata.ExtractRemoteFieldPath(in)

		if diff := cmp.Diff(want, got, cmpopts.EquateEmpty()); diff != "" {
			t.Errorf("mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("nested fields flatten depth-first", func(t *testing.T) {
		t.Parallel()

		in := map[string]metadata.RemoteFieldCall{
			"getUser": {
				Arguments: map[string]string{"id": "$user_id"},
				Field: map[string]metadata.RemoteFieldCall{
					"profile": {
						Arguments: map[string]string{},
						Field:     nil,
					},
				},
			},
		}

		got := metadata.ExtractRemoteFieldPath(in)

		if len(got) != 2 {
			t.Fatalf("expected 2 entries, got %d: %+v", len(got), got)
		}

		if got[0].FieldName != "getUser" {
			t.Errorf("got[0].FieldName = %q, want %q", got[0].FieldName, "getUser")
		}

		if got[1].FieldName != "profile" {
			t.Errorf("got[1].FieldName = %q, want %q", got[1].FieldName, "profile")
		}
	})

	t.Run("multi-key levels sort deterministically", func(t *testing.T) {
		t.Parallel()

		in := map[string]metadata.RemoteFieldCall{
			"charlie": {
				Arguments: map[string]string{"c": "1"},
				Field:     nil,
			},
			"alpha": {
				Arguments: map[string]string{"a": "1"},
				Field: map[string]metadata.RemoteFieldCall{
					"yankee": {
						Arguments: map[string]string{"y": "1"},
						Field:     nil,
					},
					"xray": {
						Arguments: map[string]string{"x": "1"},
						Field:     nil,
					},
				},
			},
			"bravo": {
				Arguments: map[string]string{"b": "1"},
				Field:     nil,
			},
		}

		want := []metadata.RemoteFieldPathEntry{
			{FieldName: "alpha", Arguments: map[string]string{"a": "1"}},
			{FieldName: "xray", Arguments: map[string]string{"x": "1"}},
			{FieldName: "yankee", Arguments: map[string]string{"y": "1"}},
			{FieldName: "bravo", Arguments: map[string]string{"b": "1"}},
			{FieldName: "charlie", Arguments: map[string]string{"c": "1"}},
		}

		// A single call could match by luck under randomised map iteration;
		// repeating the extraction is what proves the order is deterministic.
		for range 32 {
			got := metadata.ExtractRemoteFieldPath(in)

			if diff := cmp.Diff(want, got, cmpopts.EquateEmpty()); diff != "" {
				t.Fatalf("mismatch (-want +got):\n%s", diff)
			}
		}
	})
}
