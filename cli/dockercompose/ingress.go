package dockercompose

import (
	"fmt"
	"maps"
	"strconv"
	"strings"
)

// traefikHostMatch builds the traefik rule fragment matching both the
// per-subdomain host (<sub>.<name>.local.nhost.run) and the shared
// local.<name>.nhost.run host for a service.
func traefikHostMatch(name string) string {
	return fmt.Sprintf(
		"(HostRegexp(`^.+\\.%s\\.local\\.nhost\\.run$`) || Host(`local.%s.nhost.run`))", name, name,
	)
}

// valueTrue is the string form of a true flag used in generated traefik labels
// and container env values. Shared so the literal isn't repeated (goconst).
const valueTrue = "true"

type Ingresses []Ingress

func (i Ingresses) Labels() map[string]string {
	labels := make(map[string]string)
	labels["traefik.enable"] = valueTrue

	for _, ingress := range i {
		maps.Copy(labels, ingress.Labels())
	}

	return labels
}

type Ingress struct {
	Name    string
	TLS     bool
	Rule    string
	Port    uint
	Rewrite *Rewrite
	// AddPrefix, when non-empty, prepends the given path to the request before
	// it reaches the backend. The nhost-engine mounts each bundled service
	// under a path prefix (/auth, /storage), so the per-service host routers
	// add that prefix and the engine strips it again.
	AddPrefix string
}

type Rewrite struct {
	Regex       string
	Replacement string
}

func (i Ingress) Labels() map[string]string {
	labels := map[string]string{
		fmt.Sprintf("traefik.http.routers.%s.entrypoints", i.Name): "web",
		fmt.Sprintf("traefik.http.routers.%s.rule", i.Name):        i.Rule,
		fmt.Sprintf("traefik.http.routers.%s.service", i.Name):     i.Name,
		fmt.Sprintf("traefik.http.routers.%s.tls", i.Name):         strconv.FormatBool(i.TLS),
		fmt.Sprintf("traefik.http.services.%s.loadbalancer.server.port", i.Name): strconv.FormatUint(
			uint64(i.Port),
			10,
		),
	}

	var middlewares []string

	if i.Rewrite != nil {
		labels[fmt.Sprintf("traefik.http.middlewares.replace-%s.replacepathregex.regex", i.Name)] = i.Rewrite.Regex
		//nolint:lll
		labels[fmt.Sprintf("traefik.http.middlewares.replace-%s.replacepathregex.replacement", i.Name)] = i.Rewrite.Replacement
		middlewares = append(middlewares, "replace-"+i.Name)
	}

	if i.AddPrefix != "" {
		labels[fmt.Sprintf("traefik.http.middlewares.addprefix-%s.addprefix.prefix", i.Name)] = i.AddPrefix
		middlewares = append(middlewares, "addprefix-"+i.Name)
	}

	if len(middlewares) > 0 {
		labels["traefik.http.routers."+i.Name+".middlewares"] = strings.Join(middlewares, ",")
	}

	return labels
}
