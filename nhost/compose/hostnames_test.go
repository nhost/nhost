package compose_test

import (
	"github.com/nhost/cli/internal/ports"
	"github.com/nhost/cli/nhost/compose"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestAuthHostname(t *testing.T) {
	tests := []struct {
		name string
		port uint32
		want string
	}{
		{
			name: "test with default 443 port",
			port: 443,
			want: "https://local.auth.nhost.run",
		},
		{
			name: "test with custom port",
			port: 444,
			want: "https://local.auth.nhost.run:444",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, compose.AuthHostname(tt.port), "AuthHostname(%v)", tt.port)
		})
	}
}

func TestDashboardHostname(t *testing.T) {
	tests := []struct {
		name string
		port uint32
		want string
	}{
		{
			name: "test",
			port: ports.DefaultDashboardPort,
			want: "http://localhost:3030",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, compose.DashboardHostname(tt.port), "DashboardHostname(%v)", tt.port)
		})
	}
}

func TestFunctionsHostname(t *testing.T) {
	tests := []struct {
		name string
		port uint32
		want string
	}{
		{
			name: "test with default 443 port",
			port: 443,
			want: "https://local.functions.nhost.run",
		},
		{
			name: "test with custom port",
			port: 444,
			want: "https://local.functions.nhost.run:444",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, compose.FunctionsHostname(tt.port), "FunctionsHostname(%v)", tt.port)
		})
	}
}

func TestHasuraGraphqlHostname(t *testing.T) {
	tests := []struct {
		name string
		port uint32
		want string
	}{
		{
			name: "test with default 443 port",
			port: 443,
			want: "https://local.graphql.nhost.run",
		},
		{
			name: "test with custom port",
			port: 444,
			want: "https://local.graphql.nhost.run:444",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, compose.HasuraGraphqlHostname(tt.port), "HasuraGraphqlHostname(%v)", tt.port)
		})
	}
}

func TestMinioHostname(t *testing.T) {
	tests := []struct {
		name string
		port uint32
		want string
	}{
		{
			name: "test",
			port: 9000,
			want: "http://localhost:9000",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, compose.MinioHostname(tt.port), "MinioHostname(%v)", tt.port)
		})
	}
}

func TestHasuraConsoleHostname(t *testing.T) {
	tests := []struct {
		name string
		port uint32
		want string
	}{
		{
			name: "test with 9695 port",
			port: 9695,
			want: "http://localhost:9695",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, compose.HasuraConsoleHostname(tt.port), "HasuraConsoleHostname(%v)", tt.port)
		})
	}
}

func TestMailEndpoint(t *testing.T) {
	tests := []struct {
		name string
		port uint32
		want string
	}{
		{
			name: "test with default 443 port",
			port: 443,
			want: "https://local.mailhog.nhost.run",
		},
		{
			name: "test with custom port",
			port: 444,
			want: "https://local.mailhog.nhost.run:444",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, compose.MailhogHostname(tt.port), "MailhogHostname(%v)", tt.port)
		})
	}
}

func TestStorageHostname(t *testing.T) {
	tests := []struct {
		name string
		port uint32
		want string
	}{
		{
			name: "test with default 443 port",
			port: 443,
			want: "https://local.storage.nhost.run",
		},
		{
			name: "test with custom port",
			port: 444,
			want: "https://local.storage.nhost.run:444",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, compose.StorageHostname(tt.port), "StorageHostname(%v)", tt.port)
		})
	}
}

func TestHasuraHostname(t *testing.T) {
	tests := []struct {
		name string
		port uint32
		want string
	}{
		{
			name: "test with default 443 port",
			port: 443,
			want: "https://local.hasura.nhost.run",
		},
		{
			name: "test with custom port",
			port: 444,
			want: "https://local.hasura.nhost.run:444",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, compose.HasuraHostname(tt.port), "HasuraHostname(%v)", tt.port)
		})
	}
}

func TestHasuraMigrationsAPIHostname(t *testing.T) {
	tests := []struct {
		name string
		port uint32
		want string
	}{
		{
			name: "test",
			port: 9693,
			want: "http://localhost:9693",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, compose.HasuraMigrationsAPIHostname(tt.port), "HasuraMigrationsAPIHostname(%v)", tt.port)
		})
	}
}
