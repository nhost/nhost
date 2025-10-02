package revoke

import (
	"bytes"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"net/url"
)

// ParseCertificatePEM parses and returns a PEM-encoded certificate,
// can handle PEM encoded PKCS #7 structures.
func ParseCertificatePEM(certPEM []byte) (*x509.Certificate, error) {
	certPEM = bytes.TrimSpace(certPEM)
	cert, rest, err := ParseOneCertificateFromPEM(certPEM)
	if err != nil {
		// Log the actual parsing error but throw a default parse error message.
		return nil, NewError(CertificateError, ParseFailed)
	} else if cert == nil {
		return nil, NewError(CertificateError, DecodeFailed)
	} else if len(rest) > 0 {
		return nil, WrapError(CertificateError, ParseFailed, errors.New("the PEM file should contain only one object"))
	} else if len(cert) > 1 {
		return nil, WrapError(CertificateError, ParseFailed, errors.New("the PKCS7 object in the PEM file should contain only one certificate"))
	}

	return cert[0], nil
}

// ParseOneCertificateFromPEM attempts to parse one PEM encoded certificate object,
// either a raw x509 certificate or a PKCS #7 structure possibly containing
// multiple certificates, from the top of certsPEM, which itself may
// contain multiple PEM encoded certificate objects.
func ParseOneCertificateFromPEM(certsPEM []byte) ([]*x509.Certificate, []byte, error) {
	block, rest := pem.Decode(certsPEM)
	if block == nil {
		return nil, rest, nil
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		var pkcs7data *PKCS7

		if pkcs7data, err = ParsePKCS7(block.Bytes); err != nil {
			return nil, rest, err
		}

		if pkcs7data.ContentInfo != "SignedData" {
			return nil, rest, errors.New("only PKCS #7 Signed Data Content Info supported for certificate parsing")
		}

		certs := pkcs7data.Content.SignedData.Certificates
		if certs == nil {
			return nil, rest, errors.New("PKCS #7 structure contains no certificates")
		}

		return certs, rest, nil
	}

	return []*x509.Certificate{cert}, rest, nil
}

// We can't handle LDAP certificates, so this checks to see if the
// URL string points to an LDAP resource so that we can ignore it.
func ldapURL(uri string) bool {
	u, err := url.Parse(uri)
	if err != nil {
		return false
	}

	if u.Scheme == "ldap" {
		return true
	}

	return false
}
