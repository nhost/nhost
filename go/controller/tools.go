package controller

import (
	"crypto/md5" //nolint:gosec
	"fmt"
	"net/url"
	"strings"
)

func GravatarURLFunc(enabled bool, def string, rating string) func(string) string {
	return func(email string) string {
		if !enabled {
			return ""
		}
		emailHash := md5.Sum([]byte(strings.ToLower(email))) //nolint:gosec
		return fmt.Sprintf("https://www.gravatar.com/avatar/%x?d=%s&r=%s", emailHash, def, rating)
	}
}

type LinkType string

const (
	LinkTypeEmailVerify        LinkType = "emailVerify"
	LinkTypeEmailConfirmChange LinkType = "emailConfirmChange"
	LinkTypePasswordlessEmail  LinkType = "passwordlessEmail"
	LinkTypePasswordReset      LinkType = "passwordReset"
)

func GenLink(serverURL url.URL, typ LinkType, ticket, redirectTo string) (string, error) {
	path, err := url.JoinPath(serverURL.Path, "verify")
	if err != nil {
		return "", fmt.Errorf("problem appending /verify to server url: %w", err)
	}
	serverURL.Path = path

	query := serverURL.Query()
	query.Add("type", string(typ))
	query.Add("ticket", ticket)
	query.Add("redirectTo", redirectTo)
	serverURL.RawQuery = query.Encode()

	return serverURL.String(), nil
}
