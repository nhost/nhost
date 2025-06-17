package client

import (
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	urllib "net/url"
	"sort"
	"strings"
)

// RequestValidator is used to verify the Twilio Signature included with Twilio requests to webhooks.
// This ensures the request is actually coming from Twilio and helps with securing your webhooks.
type RequestValidator struct {
	signingKey []byte
}

// NewRequestValidator returns a new RequestValidator which uses the specified auth token when verifying
// Twilio signatures.
func NewRequestValidator(authToken string) RequestValidator {
	return RequestValidator{
		signingKey: []byte(authToken),
	}
}

// Validate can be used for Twilio Signatures sent with webhooks configured for GET calls. It returns true
// if the computed signature matches the expectedSignature. Params are a map of string to string containing
// all the query params Twilio added to the configured webhook URL.
func (rv *RequestValidator) Validate(url string, params map[string]string, expectedSignature string) bool {
	//sort the keys of query params then concatenated key+value strings
	var paramKeys []string
	for k := range params {
		paramKeys = append(paramKeys, k)
	}
	sort.Strings(paramKeys)
	var paramSlc []string
	for _, k := range paramKeys {
		paramSlc = append(paramSlc, fmt.Sprintf("%s%s", k, params[k]))
	}

	// check signature of testURL with and without port, since sig generation on back-end is inconsistent
	signatureWithPort := rv.getValidationSignature(addPort(url), paramSlc)
	signatureWithoutPort := rv.getValidationSignature(removePort(url), paramSlc)
	return compare(signatureWithPort, expectedSignature) ||
		compare(signatureWithoutPort, expectedSignature)
}

// ValidateBody can be used for Twilio Signatures sent with webhooks configured for POST calls. It returns true
// if the computed signature matches the expectedSignature. Body is the HTTP request body from the webhook call
// as a slice of bytes.
func (rv *RequestValidator) ValidateBody(url string, body []byte, expectedSignature string) bool {
	parsed, err := urllib.Parse(url)
	if err != nil {
		return false
	}

	bodySHA256 := parsed.Query().Get("bodySHA256")

	// For x-www-form-urlencoded Request body
	if len(bodySHA256) == 0 {
		parsedBody, err := urllib.ParseQuery(string(body))
		if err != nil {
			return false
		}
		params := make(map[string]string)
		for k, v := range parsedBody {
			//validate with first value of each key
			params[k] = v[0]
		}
		return rv.Validate(url, params, expectedSignature)
	}

	return rv.Validate(url, map[string]string{}, expectedSignature) &&
		rv.validateBody(body, bodySHA256)
}

func compare(x, y string) bool {
	return subtle.ConstantTimeCompare([]byte(x), []byte(y)) == 1
}

func (rv *RequestValidator) validateBody(body []byte, expectedSHA string) bool {
	hasher := sha256.New()
	_, err := hasher.Write(body)
	if err != nil {
		return false
	}
	sum := hasher.Sum(nil)
	return compare(fmt.Sprintf("%x", sum), expectedSHA)
}

func (rv *RequestValidator) getValidationSignature(url string, sortedConcatenatedParams []string) string {
	for _, param := range sortedConcatenatedParams {
		url += param
	}

	h := hmac.New(sha1.New, rv.signingKey)
	_, err := h.Write([]byte(url))
	if err != nil {
		return ""
	}
	sum := h.Sum(nil)
	return base64.StdEncoding.EncodeToString(sum)
}

func addPort(url string) string {
	parsed, err := urllib.Parse(url)
	if err != nil {
		return url
	}

	port := parsed.Port()
	if len(port) != 0 {
		return url // url already has port
	}

	if parsed.Scheme == "https" {
		return updatePort(url, 443)
	}
	return updatePort(url, 80)
}

func updatePort(url string, newPort int) string {
	parsed, err := urllib.Parse(url)
	if err != nil {
		return url
	}

	var newHost string
	if len(parsed.Port()) == 0 {
		// url didn't already have port, add it
		newHost = fmt.Sprintf("%s:%d", parsed.Host, newPort)
	} else {
		// url already had port, grab just the host and add new port
		oldHost := strings.Split(parsed.Host, ":")[0]
		newHost = fmt.Sprintf("%s:%d", oldHost, newPort)
	}

	parsed.Host = newHost
	return parsed.String()
}

func removePort(url string) string {
	parsed, err := urllib.Parse(url)
	if err != nil {
		return url
	}

	if len(parsed.Port()) == 0 {
		return url
	}

	newHost := strings.Split(parsed.Host, ":")[0]
	parsed.Host = newHost
	return parsed.String()
}
