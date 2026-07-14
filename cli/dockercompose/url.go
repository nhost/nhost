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

// LocalPostgresDSN returns the local development Postgres connection string.
func LocalPostgresDSN(port uint) string {
	return fmt.Sprintf("postgres://postgres:postgres@localhost:%d/local", port)
}

// LocalServiceURL returns the local development URL shown for a known service.
func LocalServiceURL(host, service string, httpPort, postgresPort uint, useTLS bool) string {
	switch service {
	case "postgres":
		return fmt.Sprintf("localhost:%d", postgresPort)
	case "console", "hasura":
		return URL(host, "hasura", httpPort, useTLS)
	case "constellation":
		return URL(host, "graphql", httpPort, useTLS)
	case "graphql", "auth", "storage", "functions", "dashboard", "mailhog":
		return URL(host, service, httpPort, useTLS)
	default:
		return ""
	}
}

// WebsocketURL returns the ws(s):// variant of URL(host, service, port, useTLS).
func WebsocketURL(host, service string, port uint, useTLS bool) string {
	return strings.Replace(URL(host, service, port, useTLS), "http", "ws", 1)
}
