package dockercompose

import "fmt"

func URL(service string, port uint, useTLS bool) string {
	if useTLS && port == 443 {
		return fmt.Sprintf("https://local.%s.nhost.run", service)
	} else if !useTLS && port == 80 {
		return fmt.Sprintf("http://local.%s.nhost.run", service)
	}

	protocol := "http"
	if useTLS {
		protocol = "https"
	}
	return fmt.Sprintf("%s://local.%s.nhost.run:%d", protocol, service, port)
}
