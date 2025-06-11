package oauth1

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1" //nolint:gosec
	"encoding/base64"
	"net/url"
	"sort"
	"strings"
)

func nonce() string {
	b := make([]byte, 16) //nolint:mnd
	_, _ = rand.Read(b)
	return base64.StdEncoding.EncodeToString(b)
}

func createSignature(
	method, baseURL string, consumerSecret string,
	params map[string]string,
	tokenSecret string,
) string {
	// Create parameter string
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	paramPairs := make([]string, len(keys))
	for i, k := range keys {
		paramPairs[i] = url.QueryEscape(k) + "=" + url.QueryEscape(params[k])
	}
	paramString := strings.Join(paramPairs, "&")

	// Create signature base string
	signatureBase := method + "&" + url.QueryEscape(baseURL) + "&" + url.QueryEscape(paramString)

	// Create signing key
	signingKey := url.QueryEscape(consumerSecret) + "&" + url.QueryEscape(tokenSecret)

	// Create signature
	mac := hmac.New(sha1.New, []byte(signingKey))
	mac.Write([]byte(signatureBase))
	signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	return signature
}

func authHeader(params map[string]string) string {
	var pairs []string
	for k, v := range params {
		if strings.HasPrefix(k, "oauth_") {
			pairs = append(pairs, url.QueryEscape(k)+"=\""+url.QueryEscape(v)+"\"")
		}
	}
	sort.Strings(pairs)
	return "OAuth " + strings.Join(pairs, ", ")
}
