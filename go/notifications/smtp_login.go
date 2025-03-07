package notifications

import (
	"errors"
	"net/smtp"
)

type loginAuth struct {
	username, password string
	host               string
}

func LoginAuth(username, password, host string) smtp.Auth {
	return &loginAuth{username, password, host}
}

func (a *loginAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	// Same security checks as PLAIN auth
	if !server.TLS && !isLocalhost(server.Name) {
		return "", nil, errors.New("unencrypted connection") //nolint:goerr113
	}
	if server.Name != a.host {
		return "", nil, errors.New("wrong host name") //nolint:goerr113
	}

	return "LOGIN", nil, nil
}

func (a *loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if !more {
		return nil, nil
	}

	switch string(fromServer) {
	case "Username:", "User Name:", "Username", "User:": // various forms servers might use
		return []byte(a.username), nil
	case "Password:", "Password": // various forms servers might use
		return []byte(a.password), nil
	default:
		return nil, errors.New("unexpected server challenge") //nolint:goerr113
	}
}
