package jwkset

import (
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
)

var (
	// ErrX509Infer is returned when the key type cannot be inferred from the PEM block type.
	ErrX509Infer = errors.New("failed to infer X509 key type")
)

// LoadCertificate loads an X509 certificate from a PEM block.
func LoadCertificate(pemBlock []byte) (*x509.Certificate, error) {
	cert, err := x509.ParseCertificate(pemBlock)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificates: %w", err)
	}
	switch cert.PublicKey.(type) {
	case *ecdsa.PublicKey, ed25519.PublicKey, *rsa.PublicKey:
	default:
		return nil, fmt.Errorf("%w: %T", ErrUnsupportedKey, cert.PublicKey)
	}
	return cert, nil
}

// LoadCertificates loads X509 certificates from raw PEM data. It can be useful in loading X5U remote resources.
func LoadCertificates(rawPEM []byte) ([]*x509.Certificate, error) {
	b := make([]byte, 0)
	for {
		block, rest := pem.Decode(rawPEM)
		if block == nil {
			break
		}
		rawPEM = rest
		if block.Type == "CERTIFICATE" {
			b = append(b, block.Bytes...)
		}
	}
	certs, err := x509.ParseCertificates(b)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificates: %w", err)
	}
	for _, cert := range certs {
		switch cert.PublicKey.(type) {
		case *ecdsa.PublicKey, ed25519.PublicKey, *rsa.PublicKey:
		default:
			return nil, fmt.Errorf("%w: %T", ErrUnsupportedKey, cert.PublicKey)
		}
	}
	return certs, nil
}

// LoadX509KeyInfer loads an X509 key from a PEM block.
func LoadX509KeyInfer(pemBlock *pem.Block) (key any, err error) {
	switch pemBlock.Type {
	case "EC PRIVATE KEY":
		key, err = loadECPrivate(pemBlock)
	case "RSA PRIVATE KEY":
		key, err = loadPKCS1Private(pemBlock)
	case "RSA PUBLIC KEY":
		key, err = loadPKCS1Public(pemBlock)
	case "PRIVATE KEY":
		key, err = loadPKCS8Private(pemBlock)
	case "PUBLIC KEY":
		key, err = loadPKIXPublic(pemBlock)
	default:
		return nil, ErrX509Infer
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load key from inferred format %q: %w", key, err)
	}
	return key, nil
}
func loadECPrivate(pemBlock *pem.Block) (priv *ecdsa.PrivateKey, err error) {
	priv, err = x509.ParseECPrivateKey(pemBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse EC private key: %w", err)
	}
	return priv, nil
}
func loadPKCS1Public(pemBlock *pem.Block) (pub *rsa.PublicKey, err error) {
	pub, err = x509.ParsePKCS1PublicKey(pemBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PKCS1 public key: %w", err)
	}
	return pub, nil
}
func loadPKCS1Private(pemBlock *pem.Block) (priv *rsa.PrivateKey, err error) {
	priv, err = x509.ParsePKCS1PrivateKey(pemBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PKCS1 private key: %w", err)
	}
	return priv, nil
}
func loadPKCS8Private(pemBlock *pem.Block) (priv any, err error) {
	priv, err = x509.ParsePKCS8PrivateKey(pemBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PKCS8 private key: %w", err)
	}
	switch priv.(type) {
	case *ecdh.PrivateKey, *ecdsa.PrivateKey, ed25519.PrivateKey, *rsa.PrivateKey:
	default:
		return nil, fmt.Errorf("%w: %T", ErrUnsupportedKey, priv)
	}
	return priv, nil
}
func loadPKIXPublic(pemBlock *pem.Block) (pub any, err error) {
	pub, err = x509.ParsePKIXPublicKey(pemBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PKIX public key: %w", err)
	}
	switch pub.(type) {
	case *ecdh.PublicKey, *ecdsa.PublicKey, ed25519.PublicKey, *rsa.PublicKey:
	default:
		return nil, fmt.Errorf("%w: %T", ErrUnsupportedKey, pub)
	}
	return pub, nil
}
