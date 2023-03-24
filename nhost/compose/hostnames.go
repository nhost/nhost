package compose

import (
	"fmt"
)

const (
	// backend service hosts
	HostLocalhost = "localhost"

	HostLocalDbNhostRun        = "local.db.nhost.run"
	HostLocalGraphqlNhostRun   = "local.graphql.nhost.run"
	HostLocalHasuraNhostRun    = "local.hasura.nhost.run"
	hostHasuraConsole          = HostLocalhost
	hostMinio                  = HostLocalhost
	hostMailhog                = HostLocalhost
	HostLocalAuthNhostRun      = "local.auth.nhost.run"
	HostLocalStorageNhostRun   = "local.storage.nhost.run"
	HostLocalFunctionsNhostRun = "local.functions.nhost.run"
	HostLocalDashboardNhostRun = HostLocalhost

	SubdomainLocal = "local"
)

func DashboardHostname(port uint32) string {
	return httpHostnameWithPort(HostLocalDashboardNhostRun, port)
}

func HasuraGraphqlHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalGraphqlNhostRun, port)
}

func HasuraHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalHasuraNhostRun, port)
}

func MinioHostname(port uint32) string {
	return httpHostnameWithPort(hostMinio, port)
}

// This returns http://localhost:9695 - an instance of the hasura console which is running on the host machine.
func HasuraConsoleHostname(port uint32) string {
	return httpHostnameWithPort(hostHasuraConsole, port)
}

// https://local.hasura.nhost.run - all GET requests to "/" or "/console" are redirected to the hasura console running on the host machine.
func HasuraConsoleRedirectHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalHasuraNhostRun, port)
}

func AuthHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalAuthNhostRun, port)
}

func HTTPStorageHostname(port uint32) string {
	return httpHostnameWithPort(HostLocalDashboardNhostRun, port)
}

func StorageHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalStorageNhostRun, port)
}

func FunctionsHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalFunctionsNhostRun, port)
}

func MailhogHostname(port uint32) string {
	return httpHostnameWithPort(hostMailhog, port)
}

func HasuraMigrationsAPIHostname(port uint32) string {
	return httpHostnameWithPort(hostHasuraConsole, port)
}

func httpHostnameWithPort(hostname string, port uint32) string {
	result := fmt.Sprintf("http://%s:%d", hostname, port)

	return result
}

func sslHostnameWithPort(hostname string, port uint32) string {
	result := fmt.Sprintf("https://%s", hostname)

	if port != 443 {
		result = fmt.Sprintf("%s:%d", result, port)
	}

	return result
}
