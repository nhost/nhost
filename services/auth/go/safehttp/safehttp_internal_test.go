package safehttp

import (
	"context"
	"crypto/x509"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

// dialRecorder captures the addresses dialChecked asks the dialer for, which
// is what makes the package's anti-rebinding claim testable: the recorded
// address must be the vetted IP literal, never the hostname.
type dialRecorder struct {
	mu    sync.Mutex
	addrs []string
}

func (r *dialRecorder) record(addr string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.addrs = append(r.addrs, addr)
}

func (r *dialRecorder) snapshot() []string {
	r.mu.Lock()
	defer r.mu.Unlock()

	return append([]string(nil), r.addrs...)
}

// redirectingClient builds a production client (denylist active) whose DNS
// lookup and dialing are faked: "example.com" resolves to a public address
// that clears the denylist, and every allowed connection lands on the local
// TLS test server (whose httptest certificate is valid for example.com).
// Redirect targets go through the exact production re-validation path. The
// returned recorder holds every address the transport asked to dial.
func redirectingClient(srv *httptest.Server) (*http.Client, *dialRecorder) {
	pool := x509.NewCertPool()
	pool.AddCert(srv.Certificate())

	addr := srv.Listener.Addr().String()
	rec := &dialRecorder{mu: sync.Mutex{}, addrs: nil}

	client := New(Config{
		lookupIPAddr: func(_ context.Context, host string) ([]net.IPAddr, error) {
			if host == "example.com" {
				return []net.IPAddr{{IP: net.ParseIP("93.184.216.34"), Zone: ""}}, nil
			}

			// IP-literal targets (the redirect destinations) resolve to
			// themselves, exactly as the real resolver would.
			if ip := net.ParseIP(host); ip != nil {
				return []net.IPAddr{{IP: ip, Zone: ""}}, nil
			}

			return nil, &net.DNSError{Err: "no such host", Name: host}
		},
		dialContext: func(ctx context.Context, network, requested string) (net.Conn, error) {
			rec.record(requested)

			dialer := &net.Dialer{}

			return dialer.DialContext(ctx, network, addr)
		},
		rootCAs: pool,
	})

	return client, rec
}

// TestNewRevalidatesRedirectTargets locks the package's central redirect
// guarantee: every redirect hop is re-submitted through the transport, so
// the IP denylist and the HTTPS-only rule apply to redirect targets too —
// the classic SSRF-guard bypass.
func TestNewRevalidatesRedirectTargets(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/ok", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/to-loopback", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://127.0.0.1/secret", http.StatusFound)
	})
	mux.HandleFunc("/to-metadata", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://169.254.169.254/latest/meta-data/", http.StatusFound)
	})
	mux.HandleFunc("/to-http", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://example.com/insecure", http.StatusFound)
	})

	srv := httptest.NewTLSServer(mux)
	t.Cleanup(srv.Close)

	client, _ := redirectingClient(srv)

	// Sanity: the faked first hop clears the denylist, so the failures
	// asserted below can only come from re-validating the redirect target.
	resp, err := client.Get("https://example.com/ok") //nolint:noctx
	if err != nil {
		t.Fatalf("expected the first hop to succeed: %v", err)
	}

	resp.Body.Close()

	tests := []struct {
		name    string
		path    string
		wantErr error
	}{
		{name: "redirect to loopback is denied", path: "/to-loopback", wantErr: ErrDeniedIP},
		{
			name:    "redirect to link-local metadata is denied",
			path:    "/to-metadata",
			wantErr: ErrDeniedIP,
		},
		{name: "redirect to plain http is denied", path: "/to-http", wantErr: ErrNonHTTPSURL},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			resp, err := client.Get("https://example.com" + tc.path) //nolint:noctx
			if err == nil {
				resp.Body.Close()
				t.Fatal("expected the redirect target to be rejected")
			}

			if !errors.Is(err, tc.wantErr) {
				t.Errorf("expected %v, got: %v", tc.wantErr, err)
			}
		})
	}
}

// TestDialCheckedDialsVettedIPNotHostname pins the package's anti-rebinding
// guarantee: the connection is made to the address the denylist cleared, not
// to the hostname. Without this assertion, replacing dialChecked's dial with
// dial(ctx, network, addr) — reintroducing the second-resolution window —
// leaves every other test in the package green.
func TestDialCheckedDialsVettedIPNotHostname(t *testing.T) {
	t.Parallel()

	srv := httptest.NewTLSServer(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		},
	))
	t.Cleanup(srv.Close)

	client, rec := redirectingClient(srv)

	resp, err := client.Get("https://example.com/") //nolint:noctx
	if err != nil {
		t.Fatalf("expected the request to succeed: %v", err)
	}

	resp.Body.Close()

	addrs := rec.snapshot()
	if len(addrs) != 1 {
		t.Fatalf("expected exactly one dial, got %v", addrs)
	}

	if addrs[0] != "93.184.216.34:443" {
		t.Errorf(
			"expected the vetted IP literal to be dialed, got %q "+
				"(dialing the hostname reopens the DNS-rebinding window)",
			addrs[0],
		)
	}
}

// TestDialCheckedRejectsMixedResolution covers the "every resolved address
// must clear the denylist" rule with the payload it exists for: a host that
// resolves to one public and one internal address. The whole attempt must
// fail without a single dial.
func TestDialCheckedRejectsMixedResolution(t *testing.T) {
	t.Parallel()

	rec := &dialRecorder{mu: sync.Mutex{}, addrs: nil}

	client := New(Config{
		lookupIPAddr: func(_ context.Context, _ string) ([]net.IPAddr, error) {
			return []net.IPAddr{
				{IP: net.ParseIP("93.184.216.34"), Zone: ""},
				{IP: net.ParseIP("127.0.0.1"), Zone: ""},
			}, nil
		},
		dialContext: func(_ context.Context, _, addr string) (net.Conn, error) {
			rec.record(addr)

			return nil, errors.New("dialer must not be reached") //nolint:err113
		},
	})

	resp, err := client.Get("https://multi-homed.example/") //nolint:noctx
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected the mixed resolution to be rejected")
	}

	if !errors.Is(err, ErrDeniedIP) {
		t.Errorf("expected ErrDeniedIP, got: %v", err)
	}

	if addrs := rec.snapshot(); len(addrs) != 0 {
		t.Errorf("expected no dial attempt, got %v", addrs)
	}
}

// TestDialCheckedFailsClosedOnEmptyResolution pins the guard whose comment
// says an empty lookup result "must not reach the dial loop below and
// silently succeed".
func TestDialCheckedFailsClosedOnEmptyResolution(t *testing.T) {
	t.Parallel()

	client := New(Config{
		lookupIPAddr: func(_ context.Context, _ string) ([]net.IPAddr, error) {
			return nil, nil
		},
		dialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
			return nil, errors.New("dialer must not be reached") //nolint:err113
		},
	})

	resp, err := client.Get("https://empty.example/") //nolint:noctx
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected an empty resolution to be denied")
	}

	if !errors.Is(err, ErrDeniedIP) {
		t.Errorf("expected ErrDeniedIP, got: %v", err)
	}
}

// TestIsDeniedIPFailsClosedOnUnparseableAddress pins isDeniedIP's "the check
// must never fail open" branch: a net.IP that is neither 4 nor 16 bytes is
// denied rather than waved through.
func TestIsDeniedIPFailsClosedOnUnparseableAddress(t *testing.T) {
	t.Parallel()

	if !isDeniedIP(deniedPrefixes(), net.IP{1, 2, 3}) {
		t.Error("expected an unparseable address to be denied")
	}
}

// TestHardenedTransportHasNoProxy asserts the invariant the package doc calls
// load-bearing: with a proxy configured, DialContext would vet the proxy's
// address while the real target travelled unchecked in the CONNECT line,
// disabling the address denylist wherever HTTPS_PROXY is set.
func TestHardenedTransportHasNoProxy(t *testing.T) {
	t.Parallel()

	if tr := newHardenedTransport(Config{}, DefaultTimeout); tr.Proxy != nil {
		t.Error("Transport.Proxy must stay nil; a proxy bypasses the address denylist")
	}
}
