package dockercompose

import (
	"fmt"
	"maps"
	"strconv"
)

type Ingresses []Ingress

func (i Ingresses) Labels() map[string]string {
	labels := make(map[string]string)
	labels["traefik.enable"] = "true"

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

	if i.Rewrite != nil {
		labels[fmt.Sprintf("traefik.http.middlewares.replace-%s.replacepathregex.regex", i.Name)] = i.Rewrite.Regex
		//nolint:lll
		labels[fmt.Sprintf("traefik.http.middlewares.replace-%s.replacepathregex.replacement", i.Name)] = i.Rewrite.Replacement
		labels["traefik.http.routers."+i.Name+".middlewares"] = "replace-" + i.Name
	}

	return labels
}
