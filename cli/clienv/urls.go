package clienv

import "fmt"

// NhostGraphqlURL returns the canonical GraphQL endpoint URL for an Nhost
// project: `https://<subdomain>.graphql.<region>.nhost.run/v1`.
func NhostGraphqlURL(subdomain, region string) string {
	return fmt.Sprintf("https://%s.graphql.%s.nhost.run/v1", subdomain, region)
}

// NhostHasuraURL returns the canonical Hasura endpoint base URL for an Nhost
// project: `https://<subdomain>.hasura.<region>.nhost.run`. Callers append
// the specific Hasura API path (e.g. `/v1/metadata`, `/v1/graphql`).
func NhostHasuraURL(subdomain, region string) string {
	return fmt.Sprintf("https://%s.hasura.%s.nhost.run", subdomain, region)
}

// NhostAuthURL returns the canonical Auth endpoint URL for an Nhost project:
// `https://<subdomain>.auth.<region>.nhost.run/v1`.
func NhostAuthURL(subdomain, region string) string {
	return fmt.Sprintf("https://%s.auth.%s.nhost.run/v1", subdomain, region)
}

// NhostStorageURL returns the canonical Storage endpoint URL for an Nhost
// project: `https://<subdomain>.storage.<region>.nhost.run/v1`.
func NhostStorageURL(subdomain, region string) string {
	return fmt.Sprintf("https://%s.storage.%s.nhost.run/v1", subdomain, region)
}
