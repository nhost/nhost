package converter

import (
	"net/url"
	"strings"
)

var percentEncodingReplacer = strings.NewReplacer(
	" ", "%20",
	"[", "%5B",
	"]", "%5D",
	"(", "%28",
	")", "%29",
	"<", "%3C",
	">", "%3E",
)

func parseBaseDomain(rawDomain string) *url.URL {
	if rawDomain == "" {
		return nil
	}

	u1, err := url.Parse(rawDomain)
	if err == nil && u1.Host != "" {
		// Yes, we got valid domain (probably with a http/https scheme)
		return u1
	}

	u2, err := url.Parse("http://" + rawDomain)
	if err == nil && u2.Host != "" {
		// Yes, we got a valid domain (by choosing a fallback scheme)
		return u2
	}

	return nil
}
func defaultAssembleAbsoluteURL(tagName string, rawURL string, domain string) string {
	rawURL = strings.TrimSpace(rawURL)

	if rawURL == "#" {
		// Golangs url.Parse does not seem to distinguish between
		// no fragment and an empty fragment.
		return rawURL
	}

	// Increase the chance that the url will be parsed
	rawURL = strings.ReplaceAll(rawURL, "\n", "%0A")
	rawURL = strings.ReplaceAll(rawURL, "\t", "%09")

	u, err := url.Parse(rawURL)
	if err != nil {
		// We can't do anything with this url because it is invalid
		return percentEncodingReplacer.Replace(rawURL)
	}

	if u.Scheme == "data" {
		// This is a data uri (for example an inline base64 image)
		return percentEncodingReplacer.Replace(rawURL)
	}

	// The default Query().Encode() encodes the query parameters "sorted by key".
	// Instead we want to keep the original order, but still encode the parameters.
	u.RawQuery = ParseAndEncodeQuery(u.RawQuery)

	// For better compatibility (especially in regards to mailto links),
	// instead of encoding a space with a "+" we use ""%20" to prevent
	// e.g. the email reading "Hi+Johannes" instead of "Hi Johannes"
	u.RawQuery = strings.ReplaceAll(u.RawQuery, "+", "%20")

	if base := parseBaseDomain(domain); base != nil {
		// If a "domain" is provided, we use that to convert relative links
		// to absolute links.
		u = base.ResolveReference(u)
	}

	return percentEncodingReplacer.Replace(u.String())
}

// - - - - //

func decodeAndEncode(original string) string {
	s, err := url.QueryUnescape(original)
	if err != nil {
		return original
	}

	return url.QueryEscape(s)
}

func ParseAndEncodeQuery(rawQuery string) string {
	if rawQuery == "" {
		return ""
	}

	rawParts := strings.Split(rawQuery, "&")
	encodedParts := make([]string, len(rawParts))

	for i, part := range rawParts {
		splitted := strings.SplitN(part, "=", 2)

		if len(splitted) == 1 {
			// A: Just the key
			encodedParts[i] = decodeAndEncode(splitted[0])
		} else if splitted[1] == "" {
			// B: The key and the equal sign
			encodedParts[i] = decodeAndEncode(splitted[0]) + "="
		} else {
			// C: The key and the equal sign and the value
			encodedParts[i] = decodeAndEncode(splitted[0]) + "=" + decodeAndEncode(splitted[1])
		}
	}

	return strings.Join(encodedParts, "&")
}
