package jwt

import (
	"bytes"
	"context"
	"encoding/base64"
	"log/slog"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

// fakeJWKSProvider captures the context handed to the JWKS provider
// constructor so a test can observe its cancellation, and satisfies the
// unexported jwksProvider boundary interface.
type fakeJWKSProvider struct {
	ctx       context.Context //nolint:containedctx
	cancelled atomic.Bool
}

func (f *fakeJWKSProvider) Keyfunc(_ *gojwt.Token) (any, error) {
	return nil, nil //nolint:nilnil
}

func TestAuthenticatorCloseCancelsJWKSContext(t *testing.T) {
	t.Parallel()

	fake := &fakeJWKSProvider{ctx: nil}

	newJWKS := func(ctx context.Context, _ []string) (jwksProvider, error) {
		fake.ctx = ctx
		go func() {
			<-ctx.Done()
			fake.cancelled.Store(true)
		}()

		return fake, nil
	}

	auth, err := newAuthenticator(context.Background(), jwtconfig.Config{
		Secrets: []jwtconfig.Secret{{JWKURL: "https://example.test/jwks"}},
	}, slog.Default(), newJWKS)
	if err != nil {
		t.Fatalf("NewAuthenticator() error = %v", err)
	}

	if fake.ctx == nil {
		t.Fatal("expected newJWKSKeyfunc to capture a context, got nil")
	}

	if fake.cancelled.Load() {
		t.Fatal("context was cancelled before Close() was called")
	}

	auth.Close()

	deadline := time.Now().Add(time.Second)
	for !fake.cancelled.Load() {
		if time.Now().After(deadline) {
			t.Fatal("Close() did not cancel JWKS context within 1s")
		}

		time.Sleep(time.Millisecond)
	}

	if fake.ctx.Err() == nil {
		t.Errorf("expected fake.ctx.Err() != nil after Close(), got nil")
	}
}

// TestDecodeHMACKeyLogsInterpretation guards the M8 observability contract:
// decodeHMACKey must record at DEBUG which interpretation it chose (base64 vs
// raw bytes) with the documented attribute names, and must never log key
// material. A future refactor that renames the messages/attributes or drops
// the logging would break operators relying on it, so the shape is pinned here.
func TestDecodeHMACKeyLogsInterpretation(t *testing.T) {
	t.Parallel()

	base64Key := base64.StdEncoding.EncodeToString([]byte("supersecret"))

	tests := []struct {
		name     string
		key      string
		want     []byte
		wantMsg  string
		wantAttr []string
	}{
		{
			name:     "valid base64 decodes and logs base64 interpretation",
			key:      base64Key,
			want:     []byte("supersecret"),
			wantMsg:  "jwt hmac key interpreted as base64",
			wantAttr: []string{"encoded_len=16", "decoded_len=11"},
		},
		{
			name:     "non-base64 falls back to raw bytes and logs raw interpretation",
			key:      "my-hmac-signing-secret",
			want:     []byte("my-hmac-signing-secret"),
			wantMsg:  "jwt hmac key interpreted as raw bytes",
			wantAttr: []string{"key_len=22"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer

			logger := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{
				Level: slog.LevelDebug,
			}))

			got := decodeHMACKey(tt.key, logger)
			if !bytes.Equal(got, tt.want) {
				t.Errorf("decodeHMACKey() = %q, want %q", got, tt.want)
			}

			out := buf.String()
			if !strings.Contains(out, tt.wantMsg) {
				t.Errorf("log output %q does not contain message %q", out, tt.wantMsg)
			}

			for _, attr := range tt.wantAttr {
				if !strings.Contains(out, attr) {
					t.Errorf("log output %q does not contain attribute %q", out, attr)
				}
			}

			if strings.Contains(out, tt.key) {
				t.Errorf("log output %q leaked key material %q", out, tt.key)
			}
		})
	}
}

func TestDecodeHMACKeyNilLoggerDoesNotPanic(t *testing.T) {
	t.Parallel()

	got := decodeHMACKey("my-hmac-signing-secret", nil)
	if !bytes.Equal(got, []byte("my-hmac-signing-secret")) {
		t.Errorf("decodeHMACKey() = %q, want raw key bytes", got)
	}
}
