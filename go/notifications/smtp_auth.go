package notifications

import (
	"errors"
	"net/smtp"
)

// This is a copy of the smtp.PlainAuth function from the Go standard library.
// It is copied here because we want to allow mailhog to be used as a mail server
// without requiring TLS. The standard library's smtp.PlainAuth function requires
// TLS to be enabled unless the server is localhost.
type plainAuth struct {
	identity, username, password string
	host                         string
}

func PlainAuth(identity, username, password, host string) smtp.Auth {
	return &plainAuth{identity, username, password, host}
}

func isLocalhost(name string) bool {
	return name == "mailhog" || name == "localhost" || name == "127.0.0.1" || name == "::1"
}

func (a *plainAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	// Must have TLS, or else localhost server.
	// Note: If TLS is not true, then we can't trust ANYTHING in ServerInfo.
	// In particular, it doesn't matter if the server advertises PLAIN auth.
	// That might just be the attacker saying
	// "it's ok, you can trust me with your password."
	if !server.TLS && !isLocalhost(server.Name) {
		return "", nil, errors.New("unencrypted connection") //nolint:goerr113
	}
	if server.Name != a.host {
		return "", nil, errors.New("wrong host name") //nolint:goerr113
	}
	resp := []byte(a.identity + "\x00" + a.username + "\x00" + a.password)
	return "PLAIN", resp, nil
}

func (a *plainAuth) Next(_ []byte, more bool) ([]byte, error) {
	if more {
		// We've already sent everything.
		return nil, errors.New("unexpected server challenge") //nolint:goerr113
	}
	return nil, nil
}
