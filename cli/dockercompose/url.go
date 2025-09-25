package dockercompose

import "fmt"

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
