package appconfig

import (
	"strings"

	"golang.org/x/mod/semver"
)

func CompareVersions(a, b string) int {
	extractFromImage := func(s string) string {
		if strings.Contains(s, ":") {
			return strings.Split(s, ":")[1]
		}

		return s
	}

	addVPrefix := func(s string) string {
		if !strings.HasPrefix(s, "v") {
			return "v" + s
		}

		return s
	}

	a = addVPrefix(extractFromImage(a))
	b = addVPrefix(extractFromImage(b))

	// if semver isn't valid we assume
	// it's a dev version and we assume it
	// is the latest version
	if !semver.IsValid(a) {
		return 1
	}

	if !semver.IsValid(b) {
		return -1
	}

	return semver.Compare(a, b)
}
