package session

import (
	"testing"
	"time"

	"github.com/nhost/nhost/packages/nhost-go/auth"
)

func TestNeedsRefresh(t *testing.T) {
	t.Parallel()

	now := time.Now().Unix()
	tests := []struct {
		name        string
		hasSession  bool
		exp         int64
		margin      int
		wantSession bool
		wantRefresh bool
		wantExpired bool
	}{
		{
			name:        "session absent",
			hasSession:  false,
			exp:         0,
			margin:      60,
			wantSession: false,
			wantRefresh: false,
			wantExpired: false,
		},
		{
			name:        "expiry absent",
			hasSession:  true,
			exp:         0,
			margin:      60,
			wantSession: true,
			wantRefresh: true,
			wantExpired: true,
		},
		{
			name:        "zero margin forces valid session refresh",
			hasSession:  true,
			exp:         now + 3600,
			margin:      0,
			wantSession: true,
			wantRefresh: true,
			wantExpired: false,
		},
		{
			name:        "zero margin preserves expired state",
			hasSession:  true,
			exp:         now - 1,
			margin:      0,
			wantSession: true,
			wantRefresh: true,
			wantExpired: true,
		},
		{
			name:        "outside margin",
			hasSession:  true,
			exp:         now + 120,
			margin:      60,
			wantSession: true,
			wantRefresh: false,
			wantExpired: false,
		},
		{
			name:        "inside margin",
			hasSession:  true,
			exp:         now + 30,
			margin:      60,
			wantSession: true,
			wantRefresh: true,
			wantExpired: false,
		},
		{
			name:        "expired",
			hasSession:  true,
			exp:         now - 1,
			margin:      60,
			wantSession: true,
			wantRefresh: true,
			wantExpired: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			backend := &MemoryStorage{}
			if tt.hasSession {
				backend.Set(StoredSession{
					Session:      auth.Session{RefreshToken: "refresh-token"},
					DecodedToken: DecodedToken{Exp: tt.exp},
				})
			}

			stored, refresh, expired := NewStorage(backend).needsRefresh(tt.margin)
			if (stored != nil) != tt.wantSession {
				t.Fatalf("session present = %v, want %v", stored != nil, tt.wantSession)
			}

			if refresh != tt.wantRefresh {
				t.Errorf("needs refresh = %v, want %v", refresh, tt.wantRefresh)
			}

			if expired != tt.wantExpired {
				t.Errorf("expired = %v, want %v", expired, tt.wantExpired)
			}
		})
	}
}
