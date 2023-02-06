package compose

import (
	"fmt"
)

const (
	// backend service hosts
	hostLocalhost              = "localhost"
	HostLocalDashboardNhostRun = "local.nhost.run"
	HostLocalGraphqlNhostRun   = "local.graphql.nhost.run"
	hostHasuraConsole          = hostLocalhost
	hostMinio                  = hostLocalhost
	HostLocalAuthNhostRun      = "local.auth.nhost.run"
	HostLocalStorageNhostRun   = "local.storage.nhost.run"
	HostLocalFunctionsNhostRun = "local.functions.nhost.run"
	HostLocalMailNhostRun      = "local.mail.nhost.run"
)

func DashboardHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalDashboardNhostRun, port)
}

func HasuraGraphqlHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalGraphqlNhostRun, port)
}

func MinioHostname(port uint32) string {
	return httpHostnameWithPort(hostMinio, port)
}

func HasuraConsoleHostname(port uint32) string {
	return httpHostnameWithPort(hostHasuraConsole, port)
}

func HasuraMigrationsAPIHostname(port uint32) string {
	return httpHostnameWithPort(hostHasuraConsole, port)
}

func AuthHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalAuthNhostRun, port)
}

func StorageHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalStorageNhostRun, port)
}

func FunctionsHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalFunctionsNhostRun, port)
}

func MailHostname(port uint32) string {
	return sslHostnameWithPort(HostLocalMailNhostRun, port)
}

type endpointOpt func(string) string

func httpHostnameWithPort(hostname string, port uint32, opt ...endpointOpt) string {
	result := fmt.Sprintf("http://%s:%d", hostname, port)

	for _, o := range opt {
		result = o(result)
	}

	return result
}

func sslHostnameWithPort(hostname string, port uint32, opt ...endpointOpt) string {
	result := fmt.Sprintf("https://%s", hostname)

	if port != 443 {
		result = fmt.Sprintf("%s:%d", result, port)
	}

	for _, o := range opt {
		result = o(result)
	}

	return result
}
