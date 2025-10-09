//go:build go1.19

package revoke

import (
	"crypto/x509"
	"time"
)

// CRLSet associates a PKIX certificate list with the URL the CRL is
// fetched from.
var (
	CRLSet = map[string]*x509.RevocationList{}
)

// fetchCRL fetches and parses a CRL.
func fetchCRL(url string) (*x509.RevocationList, error) {
	resp, err := HTTPClient.Get(url)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, ErrFailedGetCRL
	}

	body, err := crlRead(resp.Body)
	if err != nil {
		return nil, err
	}

	return x509.ParseRevocationList(body)
}

// check a cert against a specific CRL. Returns the same bool pair
// as revCheck, plus an error if one occurred.
func certIsRevokedCRL(cert *x509.Certificate, url string) (revoked, ok bool, err error) {
	var crl *x509.RevocationList

	crlLock.Lock()

	if crl, ok = CRLSet[url]; ok && crl == nil {
		ok = false

		delete(CRLSet, url)
	}

	crlLock.Unlock()

	var shouldFetchCRL = true

	if ok && time.Now().Before(crl.NextUpdate) {
		shouldFetchCRL = false
	}

	issuer := getIssuer(cert)

	if shouldFetchCRL {
		if crl, err = fetchCRL(url); err != nil {
			return false, false, err
		}

		// Check the CRL signature.
		if issuer != nil {
			if err = crl.CheckSignatureFrom(issuer); err != nil {
				return false, false, err
			}
		}

		crlLock.Lock()
		CRLSet[url] = crl
		crlLock.Unlock()
	}

	for _, rcert := range crl.RevokedCertificates {
		if cert.SerialNumber.Cmp(rcert.SerialNumber) == 0 {
			return true, true, err
		}
	}

	return false, true, err
}
