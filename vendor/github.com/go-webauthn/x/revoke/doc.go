// Package revoke provides functionality for checking the validity of a cert. Specifically, the temporal validity of the
// certificate is checked first, then any CRL and OCSP url in the cert is checked. This is a fork of the
// github.com/cloudflare/cfssl/revoke package. It's used to lookup the revocation status of X.509 Certificates.
package revoke
