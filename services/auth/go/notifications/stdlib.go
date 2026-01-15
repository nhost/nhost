// Package notifications
// The contents of this file are modified contents from the Go standard library.
// The original code can be found at https://cs.opensource.google/go/go/+/refs/tags/go1.22.2:src/net/smtp/smtp.go;l=321
//
// Copyright belongs to the Go authors.
package notifications

import (
	"crypto/tls"
	"errors"
	"net"
	"net/smtp"
	"strconv"
	"strings"
)

const TLSPort = 465

func validateLine(line string) error {
	if strings.ContainsAny(line, "\n\r") {
		return errors.New("smtp: A line must not contain CR or LF") //nolint
	}

	return nil
}

func sendMail( //nolint:funlen,cyclop
	host string,
	port uint16,
	useTLSConnection bool,
	a smtp.Auth,
	from string,
	to []string,
	msg []byte,
) error {
	if err := validateLine(from); err != nil {
		return err
	}

	for _, recp := range to {
		if err := validateLine(recp); err != nil {
			return err
		}
	}

	addr := net.JoinHostPort(host, strconv.FormatUint(uint64(port), 10))

	var (
		conn net.Conn
		err  error
	)

	if useTLSConnection {
		tlsconfig := &tls.Config{ //nolint:gosec,exhaustruct
			InsecureSkipVerify: false,
			ServerName:         host,
		}

		conn, err = tls.Dial("tcp", addr, tlsconfig) //nolint
		if err != nil {
			return err //nolint:wrapcheck
		}
	} else {
		conn, err = net.Dial("tcp", addr) //nolint
		if err != nil {
			return err //nolint:wrapcheck
		}
	}

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return err //nolint:wrapcheck
	}
	defer c.Close()

	if err = c.Hello("nhost-auth"); err != nil {
		return err //nolint:wrapcheck
	}

	if ok, _ := c.Extension("STARTTLS"); ok {
		config := &tls.Config{ServerName: host} //nolint:gosec,exhaustruct
		if err = c.StartTLS(config); err != nil {
			return err //nolint:wrapcheck
		}
	}

	if err = c.Auth(a); err != nil {
		return err //nolint:wrapcheck
	}

	if err = c.Mail(from); err != nil {
		return err //nolint:wrapcheck
	}

	for _, addr := range to {
		if err = c.Rcpt(addr); err != nil {
			return err //nolint:wrapcheck
		}
	}

	w, err := c.Data()
	if err != nil {
		return err //nolint:wrapcheck
	}

	_, err = w.Write(msg)
	if err != nil {
		return err //nolint:wrapcheck
	}

	err = w.Close()
	if err != nil {
		return err //nolint:wrapcheck
	}

	return c.Quit() //nolint:wrapcheck
}

// This is a copy of the smtp.PlainAuth function from the Go standard library.
// It is copied here because we want to allow mailhog to be used as a mail server
// without requiring TLS. The standard library's smtp.PlainAuth function requires
// TLS to be enabled unless the server is localhost.
//
// Copyright belongs to the Go authors.
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
		return "", nil, errors.New("unencrypted connection") //nolint:err113
	}

	if server.Name != a.host {
		return "", nil, errors.New("wrong host name") //nolint:err113
	}

	resp := []byte(a.identity + "\x00" + a.username + "\x00" + a.password)

	return "PLAIN", resp, nil
}

func (a *plainAuth) Next(_ []byte, more bool) ([]byte, error) {
	if more {
		// We've already sent everything.
		return nil, errors.New("unexpected server challenge") //nolint:err113
	}

	return nil, nil
}
