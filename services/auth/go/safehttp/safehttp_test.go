package safehttp_test

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/auth/go/safehttp"
)

func TestNewDeniesPrivateAndSpecialAddresses(t *testing.T) {
	t.Parallel()

	// The denylist runs in DialContext before any connection is made, so the
	// targets do not need to be reachable. https:// is used so the scheme
	// check does not short-circuit the IP check.
	tests := []struct {
		name string
		url  string
	}{
		{name: "loopback ipv4", url: "https://127.0.0.1/"},
		{name: "loopback name", url: "https://localhost/"},
		{name: "private 10.x", url: "https://10.0.0.1/"},
		{name: "private 172.16.x", url: "https://172.16.0.1/"},
		{name: "private 192.168.x", url: "https://192.168.1.1/"},
		{name: "link-local metadata", url: "https://169.254.169.254/"},
		{name: "ULA fd00::", url: "https://[fd00::1]/"},
		{name: "loopback ipv6", url: "https://[::1]/"},
		{name: "unspecified ipv4", url: "https://0.0.0.0/"},
		{name: "unspecified ipv6", url: "https://[::]/"},
		{name: "this-network 0.0.0.0/8", url: "https://0.1.2.3/"},
		{name: "cgnat base", url: "https://100.64.0.1/"},
		{name: "cgnat cloud metadata", url: "https://100.100.100.200/"},
		{name: "ietf protocol assignments", url: "https://192.0.0.1/"},
		{name: "benchmarking range", url: "https://198.18.0.1/"},
		{name: "multicast", url: "https://224.0.1.1/"},
		{name: "admin-scoped multicast", url: "https://239.1.2.3/"},
		{name: "reserved 240/4", url: "https://240.0.0.1/"},
		{name: "broadcast", url: "https://255.255.255.255/"},
		{name: "ipv4-mapped loopback", url: "https://[::ffff:127.0.0.1]/"},
		{name: "interface-local multicast", url: "https://[ff01::1]/"},
		{name: "site-local multicast", url: "https://[ff05::1]/"},
		{name: "deprecated ipv6 site-local", url: "https://[fec0::1]/"},
		{name: "nat64 embedding loopback", url: "https://[64:ff9b::7f00:1]/"},
		{name: "6to4 embedding loopback", url: "https://[2002:7f00:1::1]/"},
		{name: "ipv4-compatible loopback", url: "https://[::127.0.0.1]/"},
		{name: "ipv4-compatible private", url: "https://[::a00:1]/"},
		{name: "ipv4-compatible metadata", url: "https://[::169.254.169.254]/"},
		{name: "ipv4-translated loopback", url: "https://[::ffff:0:127.0.0.1]/"},
		{name: "teredo", url: "https://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/"},
		{name: "6to4 relay anycast", url: "https://192.88.99.1/"},
		{name: "orchidv2", url: "https://[2001:20::1]/"},
	}

	client := safehttp.New(safehttp.Config{})

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			resp, err := client.Get(tc.url) //nolint:noctx
			if err == nil {
				resp.Body.Close()
				t.Fatalf("expected error for %s, got response", tc.url)
			}

			if !errors.Is(err, safehttp.ErrDeniedIP) {
				t.Errorf("expected ErrDeniedIP for %s, got: %v", tc.url, err)
			}
		})
	}
}

func TestNewRejectsPlainHTTP(t *testing.T) {
	t.Parallel()

	client := safehttp.New(safehttp.Config{})

	resp, err := client.Get("http://example.com/") //nolint:noctx
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected error for plain http, got response")
	}

	if !errors.Is(err, safehttp.ErrNonHTTPSURL) {
		t.Errorf("expected ErrNonHTTPSURL, got: %v", err)
	}
}

func TestNewAllowPrivateIPsReachesLocalServers(t *testing.T) {
	t.Parallel()

	tlsSrv := httptest.NewTLSServer(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			fmt.Fprint(w, "ok")
		}),
	)
	defer tlsSrv.Close()

	plainSrv := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			fmt.Fprint(w, "ok")
		}),
	)
	defer plainSrv.Close()

	client := safehttp.New(safehttp.Config{AllowPrivateIPs: true, InsecureSkipTLSVerify: true})

	for _, u := range []string{tlsSrv.URL, plainSrv.URL} {
		resp, err := client.Get(u) //nolint:noctx
		if err != nil {
			t.Fatalf("expected %s to be reachable with AllowPrivateIPs: %v", u, err)
		}

		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200 from %s, got %d", u, resp.StatusCode)
		}
	}
}

func TestNewCapsRedirects(t *testing.T) {
	t.Parallel()

	var srv *httptest.Server

	srv = httptest.NewTLSServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Redirect forever; the client must give up after the cap.
			http.Redirect(w, r, srv.URL+r.URL.Path+"r", http.StatusFound)
		}),
	)
	defer srv.Close()

	client := safehttp.New(safehttp.Config{AllowPrivateIPs: true, InsecureSkipTLSVerify: true})

	resp, err := client.Get(srv.URL) //nolint:noctx
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected redirect-cap error, got response")
	}

	if !errors.Is(err, safehttp.ErrTooManyRedirects) {
		t.Errorf("expected ErrTooManyRedirects, got: %v", err)
	}
}

func TestNewCapsResponseBodySize(t *testing.T) {
	t.Parallel()

	const bodyCap = 1024

	mux := http.NewServeMux()
	mux.HandleFunc("/at-cap", func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, strings.Repeat("x", bodyCap))
	})
	mux.HandleFunc("/past-cap", func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, strings.Repeat("x", bodyCap+1))
	})

	srv := httptest.NewTLSServer(mux)
	t.Cleanup(srv.Close)

	client := safehttp.New(
		safehttp.Config{
			AllowPrivateIPs:       true,
			InsecureSkipTLSVerify: true,
			MaxResponseSize:       bodyCap,
		},
	)

	tests := []struct {
		name    string
		path    string
		wantErr error
	}{
		{name: "body at the cap is allowed", path: "/at-cap", wantErr: nil},
		{
			name:    "body past the cap is rejected",
			path:    "/past-cap",
			wantErr: safehttp.ErrResponseTooLarge,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			resp, err := client.Get(srv.URL + tc.path) //nolint:noctx
			if err != nil {
				t.Fatalf("unexpected request error: %v", err)
			}
			defer resp.Body.Close()

			// Read through io.ReadAll — not ReadAllLimited — to prove the
			// transport itself enforces the bound for consumers that read
			// the body themselves.
			_, err = io.ReadAll(resp.Body)
			if tc.wantErr == nil {
				if err != nil {
					t.Fatalf("unexpected read error: %v", err)
				}

				return
			}

			if !errors.Is(err, tc.wantErr) {
				t.Errorf("expected %v, got: %v", tc.wantErr, err)
			}
		})
	}
}

func TestReadAllLimited(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		maxSize int64
		wantErr error
	}{
		{name: "under cap", input: "hello", maxSize: 10, wantErr: nil},
		{name: "exactly at cap", input: "hello", maxSize: 5, wantErr: nil},
		{name: "over cap", input: "hello!", maxSize: 5, wantErr: safehttp.ErrResponseTooLarge},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := safehttp.ReadAllLimited(strings.NewReader(tc.input), tc.maxSize)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected %v, got: %v", tc.wantErr, err)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if string(got) != tc.input {
				t.Errorf("expected %q, got %q", tc.input, got)
			}
		})
	}
}

// TestIsDeniedHost covers the advisory pre-flight export. It is the same
// policy the transport enforces at dial time, exposed so a caller that wants
// to reject a URL up front (oauth2.ValidateCIMDURL) does not keep a second,
// weaker copy of the address list.
func TestIsDeniedHost(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		host string
		want bool
	}{
		{name: "localhost", host: "localhost", want: true},
		{name: "loopback ipv4", host: "127.0.0.1", want: true},
		{name: "loopback ipv6", host: "::1", want: true},
		{name: "private 10.x", host: "10.0.0.1", want: true},
		{name: "private 192.168.x", host: "192.168.1.1", want: true},
		{name: "private 172.16.x", host: "172.16.0.1", want: true},
		{name: "link-local metadata", host: "169.254.169.254", want: true},
		// Ranges the four net.IP predicates this replaced did not cover.
		{name: "cgnat cloud metadata", host: "100.100.100.200", want: true},
		{name: "unspecified", host: "0.0.0.0", want: true},
		{name: "ipv4-compatible loopback", host: "::127.0.0.1", want: true},
		{name: "public IP", host: "8.8.8.8", want: false},
		// A host that does not resolve is a failed request, not a denied
		// address: the pre-flight check must not turn it into one.
		{name: "unresolvable hostname", host: "this-host-does-not-exist.invalid", want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := safehttp.IsDeniedHost(t.Context(), tc.host); got != tc.want {
				t.Errorf("IsDeniedHost(%q) = %v, want %v", tc.host, got, tc.want)
			}
		})
	}
}
