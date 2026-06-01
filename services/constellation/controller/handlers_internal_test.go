package controller

import "testing"

// TestNormalizeMaxGraphQLRequestBodyBytes pins the safety guarantee documented
// on HandlerPostWithMaxBodyBytes: non-positive limits fall back to
// DefaultMaxGraphQLRequestBodyBytes so a direct caller cannot create an
// unbounded handler, while positive limits pass through untouched.
func TestNormalizeMaxGraphQLRequestBodyBytes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		maxBytes  int64
		wantBytes int64
	}{
		{
			name:      "negative falls back to default",
			maxBytes:  -1,
			wantBytes: DefaultMaxGraphQLRequestBodyBytes,
		},
		{
			name:      "zero falls back to default",
			maxBytes:  0,
			wantBytes: DefaultMaxGraphQLRequestBodyBytes,
		},
		{
			name:      "positive is returned unchanged",
			maxBytes:  16,
			wantBytes: 16,
		},
		{
			name:      "default value is returned unchanged",
			maxBytes:  DefaultMaxGraphQLRequestBodyBytes,
			wantBytes: DefaultMaxGraphQLRequestBodyBytes,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := normalizeMaxGraphQLRequestBodyBytes(tt.maxBytes); got != tt.wantBytes {
				t.Errorf(
					"normalizeMaxGraphQLRequestBodyBytes(%d) = %d, want %d",
					tt.maxBytes, got, tt.wantBytes,
				)
			}
		})
	}
}
