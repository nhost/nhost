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

func URLNewFormat(host, service string, port uint, useTLS bool) string {
	if useTLS && port == 443 {
		return fmt.Sprintf("https://%s.%s.local.nhost.run", host, service)
	} else if !useTLS && port == 80 {
		return fmt.Sprintf("http://%s.%s.local.nhost.run", host, service)
	}

	protocol := "http"
	if useTLS {
		protocol = "https"
	}
	return fmt.Sprintf("%s://%s.%s.local.nhost.run:%d", protocol, host, service, port)
}
