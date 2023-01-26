package compose

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_traefikLabels(t *testing.T) {
	tests := []struct {
		name    string
		svcName string
		opts    []traefikSvcLabelOptFunc
		want    traefikServiceLabels
	}{
		{
			name:    "test with tls, path prefix, strip prefix and host",
			svcName: "auth",
			opts: []traefikSvcLabelOptFunc{
				withTLS(),
				withPathPrefix("/v1"),
				withStripPrefix("/v1"),
				withHost("local.auth.nhost.run"),
			},
			want: traefikServiceLabels{
				"traefik.enable": "true",
				"traefik.http.middlewares.strip-auth.stripprefix.prefixes":                "/v1",
				"traefik.http.middlewares.auth-cors.headers.accessControlAllowOriginList": "*",
				"traefik.http.middlewares.auth-cors.headers.accessControlAllowHeaders":    "*",
				"traefik.http.middlewares.auth-cors.headers.accessControlAllowMethods":    "*",
				"traefik.http.routers.auth.tls":                                           "true",
				"traefik.http.routers.auth.entrypoints":                                   "web-secure",
				"traefik.http.routers.auth.middlewares":                                   "auth-cors@docker,strip-auth@docker",
				"traefik.http.routers.auth.rule":                                          "PathPrefix(`/v1`) && Host(`local.auth.nhost.run`)",
			},
		},
		{
			name:    "test with path prefix, host and port",
			svcName: "auth",
			opts: []traefikSvcLabelOptFunc{
				withPathPrefix("/v1"),
				withHost("local.auth.nhost.run"),
				withServiceListeningOnPort(3456),
			},
			want: traefikServiceLabels{
				"traefik.enable": "true",
				"traefik.http.middlewares.auth-cors.headers.accessControlAllowOriginList": "*",
				"traefik.http.middlewares.auth-cors.headers.accessControlAllowHeaders":    "*",
				"traefik.http.middlewares.auth-cors.headers.accessControlAllowMethods":    "*",
				"traefik.http.routers.auth.entrypoints":                                   "web",
				"traefik.http.routers.auth.middlewares":                                   "auth-cors@docker",
				"traefik.http.routers.auth.rule":                                          "PathPrefix(`/v1`) && Host(`local.auth.nhost.run`)",
				"traefik.http.services.auth.loadbalancer.server.port":                     "3456",
			},
		},
		{
			name:    "test with path prefix, host, added prefix and port",
			svcName: "graphql",
			opts: []traefikSvcLabelOptFunc{
				withPathPrefix("/v1"),
				withHost("local.graphql.nhost.run"),
				withAddedPrefix("/bla"),
				withServiceListeningOnPort(3456),
			},
			want: traefikServiceLabels{
				"traefik.enable": "true",
				"traefik.http.middlewares.graphql-cors.headers.accessControlAllowOriginList": "*",
				"traefik.http.middlewares.graphql-cors.headers.accessControlAllowHeaders":    "*",
				"traefik.http.middlewares.graphql-cors.headers.accessControlAllowMethods":    "*",
				"traefik.http.routers.graphql.entrypoints":                                   "web",
				"traefik.http.routers.graphql.middlewares":                                   "graphql-cors@docker,add-graphql-prefix@docker",
				"traefik.http.routers.graphql.rule":                                          "PathPrefix(`/v1`) && Host(`local.graphql.nhost.run`)",
				"traefik.http.middlewares.add-graphql-prefix.addprefix.prefix":               "/bla",
				"traefik.http.services.graphql.loadbalancer.server.port":                     "3456",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			o := makeTraefikServiceLabels(tt.svcName, tt.opts...)
			assert.Equalf(t, tt.want, o, "makeTraefikServiceLabels(%v, %v)", tt.svcName, tt.opts)
		})
	}
}

func Test_mergeTraefikServiceLabels(t *testing.T) {
	tests := []struct {
		name   string
		labels []traefikServiceLabels
		want   traefikServiceLabels
	}{
		{
			name:   "test",
			labels: []traefikServiceLabels{{"a": "b", "b": "c", "c": "d"}, {"b": "d"}, {"c": "e"}},
			want:   traefikServiceLabels{"a": "b", "b": "d", "c": "e"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, mergeTraefikServiceLabels(tt.labels...), "mergeTraefikServiceLabels(%v)", tt.labels)
		})
	}
}
