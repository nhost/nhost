package storage_test

import (
	"testing"
	"time"

	"github.com/nhost/nhost/internal/lib/nhostclient/storage"
)

func TestTime_MarshalUnmarshalRoundtrip(t *testing.T) {
	t.Parallel()

	original := storage.NewTime(
		time.Date(2025, time.March, 15, 10, 30, 0, 0, time.UTC),
	)

	data, err := original.MarshalText()
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var decoded storage.Time
	if err := decoded.UnmarshalText(data); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	reData, err := decoded.MarshalText()
	if err != nil {
		t.Fatalf("re-marshal: %v", err)
	}

	if string(data) != string(reData) {
		t.Fatalf("roundtrip mismatch: %q vs %q", data, reData)
	}
}

func TestTime_ZeroTime(t *testing.T) {
	t.Parallel()

	zero := storage.NewTime(time.Time{})

	data, err := zero.MarshalText()
	if err != nil {
		t.Fatalf("marshal zero: %v", err)
	}

	if string(data) != `""` {
		t.Fatalf("expected empty string for zero time, got %q", data)
	}
}

func TestTime_UnmarshalEmpty(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		input string
	}{
		{"empty bytes", ""},
		{"empty quoted", `""`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var dt storage.Time
			if err := dt.UnmarshalText([]byte(tc.input)); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			data, err := dt.MarshalText()
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}

			if string(data) != `""` {
				t.Fatalf("expected zero time after unmarshal, got %q", data)
			}
		})
	}
}

func TestTime_UnmarshalInvalidFormat(t *testing.T) {
	t.Parallel()

	var dt storage.Time

	err := dt.UnmarshalText([]byte("not-a-date"))
	if err == nil {
		t.Fatal("expected error for invalid format, got nil")
	}
}
