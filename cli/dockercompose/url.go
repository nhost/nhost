package dockercompose

import (
	"fmt"
	"strings"
)

func URL(host, service string, port uint, useTLS bool) string {
	if useTLS && port == 443 {
		return fmt.Sprintf("https://%s.%s.local.nhost.run", host, service)
	} else if !useTLS && port == 80 {
		return fmt.Sprintf("http://%s.%s.local.nhost.run", host, service)
	}

	protocol := schemeHTTP
	if useTLS {
		protocol = schemeHTTPS
	}

	return fmt.Sprintf("%s://%s.%s.local.nhost.run:%d", protocol, host, service, port)
}

// WebsocketURL returns the ws(s):// variant of URL(host, service, port, useTLS).
func WebsocketURL(host, service string, port uint, useTLS bool) string {
	return strings.Replace(URL(host, service, port, useTLS), "http", "ws", 1)
}
