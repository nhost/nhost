package getter

import "net/url"

// RedactURL is a port of url.Redacted from the standard library,
// which is like url.String but replaces any password with "xxxxx".
// Only the password in u.URL is redacted. This allows the library
// to maintain compatibility with go1.14.
func RedactURL(u *url.URL) string {
	if u == nil {
		return ""
	}

	ru := *u
	if _, has := ru.User.Password(); has {
		ru.User = url.UserPassword(ru.User.Username(), "xxxxx")
	}
	return ru.String()
}
