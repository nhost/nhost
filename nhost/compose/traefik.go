package compose

import (
	"fmt"
	"strings"
)

type traefikSvcLabelOpts struct {
	svcName       string
	tls           bool
	port          int
	replacePath   string
	redirect      string
	rules         []string
	middlewares   []string
	stripPrefixes []string
	addPrefix     string
}

type traefikSvcLabelOptFunc func(*traefikSvcLabelOpts)
type traefikServiceLabels map[string]string

func (t traefikServiceLabels) AsMap() map[string]string {
	return t
}

func withTLS() traefikSvcLabelOptFunc {
	return func(o *traefikSvcLabelOpts) {
		o.tls = true
	}
}

func withStripPrefix(prefix ...string) traefikSvcLabelOptFunc {
	return func(o *traefikSvcLabelOpts) {
		if o.middlewares == nil {
			o.middlewares = []string{}
		}
		o.middlewares = append(o.middlewares, "strip-"+o.svcName+"@docker")
		o.stripPrefixes = prefix
	}
}

func withAddedPrefix(prefix string) traefikSvcLabelOptFunc {
	return func(o *traefikSvcLabelOpts) {
		if o.middlewares == nil {
			o.middlewares = []string{}
		}
		o.middlewares = append(o.middlewares, "add-"+o.svcName+"-prefix@docker")
		o.addPrefix = prefix
	}
}

func withPathPrefix(prefix ...string) traefikSvcLabelOptFunc {
	return func(o *traefikSvcLabelOpts) {
		if o.rules == nil {
			o.rules = []string{}
		}
		o.rules = append(o.rules, "PathPrefix(`"+strings.Join(prefix, "`, `")+"`)")
	}
}

func withPath(path string) traefikSvcLabelOptFunc {
	return func(o *traefikSvcLabelOpts) {
		if o.rules == nil {
			o.rules = []string{}
		}
		o.rules = append(o.rules, "Path(`"+path+"`)")
	}
}

func withHost(host string) traefikSvcLabelOptFunc {
	return func(o *traefikSvcLabelOpts) {
		if o.rules == nil {
			o.rules = []string{}
		}
		o.rules = append(o.rules, "Host(`"+host+"`)")
	}
}

func withMethod(method string) traefikSvcLabelOptFunc {
	return func(o *traefikSvcLabelOpts) {
		if o.rules == nil {
			o.rules = []string{}
		}
		o.rules = append(o.rules, "Method(`"+method+"`)")
	}
}

func withRedirect(path string) traefikSvcLabelOptFunc {
	return func(o *traefikSvcLabelOpts) {
		if o.middlewares == nil {
			o.middlewares = []string{}
		}
		o.middlewares = append(o.middlewares, "redirect-"+o.svcName+"@docker")
		o.redirect = path
	}
}

func withReplacePath(path string) traefikSvcLabelOptFunc {
	return func(o *traefikSvcLabelOpts) {
		if o.middlewares == nil {
			o.middlewares = []string{}
		}
		o.middlewares = append(o.middlewares, "replace-"+o.svcName+"-path@docker")
		o.replacePath = path
	}
}

func makeTraefikServiceLabels(svcName string, port int, opts ...traefikSvcLabelOptFunc) traefikServiceLabels {
	o := traefikSvcLabelOpts{
		svcName:     svcName,
		port:        port,
		tls:         false,
		middlewares: []string{svcName + "-cors@docker"},
	}

	for _, opt := range opts {
		opt(&o)
	}

	labels := traefikServiceLabels{"traefik.enable": "true"}

	labels["traefik.http.routers."+o.svcName+".service"] = o.svcName

	// cors
	labels["traefik.http.middlewares."+o.svcName+"-cors.headers.accessControlAllowOriginList"] = "*"
	labels["traefik.http.middlewares."+o.svcName+"-cors.headers.accessControlAllowHeaders"] = "*"
	labels["traefik.http.middlewares."+o.svcName+"-cors.headers.accessControlAllowMethods"] = "*"

	if o.tls {
		labels["traefik.http.routers."+o.svcName+".tls"] = "true"
		labels["traefik.http.routers."+o.svcName+".entrypoints"] = "web-secure"
	} else {
		labels["traefik.http.routers."+o.svcName+".entrypoints"] = "web"
	}

	if len(o.stripPrefixes) > 0 {
		labels["traefik.http.middlewares.strip-"+o.svcName+".stripprefix.prefixes"] = strings.Join(o.stripPrefixes, ",")
	}

	if o.addPrefix != "" {
		labels["traefik.http.middlewares.add-"+o.svcName+"-prefix.addprefix.prefix"] = o.addPrefix
	}

	if o.replacePath != "" {
		labels["traefik.http.middlewares.replace-"+o.svcName+"-path.replacepath.path"] = o.replacePath
	}

	if o.redirect != "" {
		labels["traefik.http.middlewares.redirect-"+o.svcName+".redirectregex.regex"] = "^(.*)$"
		labels["traefik.http.middlewares.redirect-"+o.svcName+".redirectregex.replacement"] = o.redirect
	}

	labels["traefik.http.services."+o.svcName+".loadbalancer.server.port"] = fmt.Sprint(o.port)

	labels["traefik.http.routers."+o.svcName+".rule"] = strings.Join(o.rules, " && ")
	labels["traefik.http.routers."+o.svcName+".middlewares"] = strings.Join(o.middlewares, ",")

	return labels
}

func mergeTraefikServiceLabels(labels ...traefikServiceLabels) traefikServiceLabels {
	merged := traefikServiceLabels{}

	for _, label := range labels {
		for k, v := range label {
			merged[k] = v
		}
	}

	return merged
}
