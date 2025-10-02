package revoke

import (
	"bytes"
	"crypto"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	"golang.org/x/crypto/ocsp"
)

// revCheck should check the certificate for any revocations. It
// returns a pair of booleans: the first indicates whether the certificate
// is revoked, the second indicates whether the revocations were
// successfully checked.. This leads to the following combinations:
//
//	false, false: an error was encountered while checking revocations.
//
//	false, true:  the certificate was checked successfully and
//	                it is not revoked.
//
//	true, true:   the certificate was checked successfully and
//	                it is revoked.
//
//	true, false:  failure to check revocation status causes
//	                verification to fail
func revCheck(cert *x509.Certificate) (revoked, ok bool, err error) {
	for _, uri := range cert.CRLDistributionPoints {
		if ldapURL(uri) {
			continue
		}

		if revoked, ok, err = certIsRevokedCRL(cert, uri); !ok {
			if HardFail {
				return true, false, err
			}
			return false, false, err
		} else if revoked {
			return true, true, err
		}
	}

	if revoked, ok, err = certIsRevokedOCSP(cert, HardFail); !ok {
		if HardFail {
			return true, false, err
		}

		return false, false, err
	} else if revoked {
		return true, true, err
	}

	return false, true, nil
}

func getIssuer(cert *x509.Certificate) (issuer *x509.Certificate) {
	var (
		uri string
		err error
	)

	for _, uri = range cert.IssuingCertificateURL {
		issuer, err = fetchRemote(uri)
		if err != nil {
			continue
		}
		break
	}

	return issuer
}

// VerifyCertificate ensures that the certificate passed in hasn't
// expired and checks the CRL for the server.
func VerifyCertificate(cert *x509.Certificate) (revoked, ok bool) {
	revoked, ok, _ = VerifyCertificateError(cert)

	return revoked, ok
}

// VerifyCertificateError ensures that the certificate passed in hasn't
// expired and checks the CRL for the server.
func VerifyCertificateError(cert *x509.Certificate) (revoked, ok bool, err error) {
	if !time.Now().Before(cert.NotAfter) {
		return true, true, fmt.Errorf("Certificate expired %s\n", cert.NotAfter)
	} else if !time.Now().After(cert.NotBefore) {
		return true, true, fmt.Errorf("Certificate isn't valid until %s\n", cert.NotBefore)
	}
	return revCheck(cert)
}

func fetchRemote(url string) (*x509.Certificate, error) {
	resp, err := HTTPClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	in, err := remoteRead(resp.Body)
	if err != nil {
		return nil, err
	}

	p, _ := pem.Decode(in)
	if p != nil {
		return ParseCertificatePEM(in)
	}

	return x509.ParseCertificate(in)
}

func certIsRevokedOCSP(leaf *x509.Certificate, strict bool) (revoked, ok bool, e error) {
	var err error

	ocspURLs := leaf.OCSPServer
	if len(ocspURLs) == 0 {
		// OCSP not enabled for this certificate.
		return false, true, nil
	}

	issuer := getIssuer(leaf)

	if issuer == nil {
		return false, false, nil
	}

	ocspRequest, err := ocsp.CreateRequest(leaf, issuer, &ocspOpts)
	if err != nil {
		return revoked, ok, err
	}

	for _, server := range ocspURLs {
		resp, err := sendOCSPRequest(server, ocspRequest, leaf, issuer)
		if err != nil {
			if strict {
				return revoked, ok, err
			}
			continue
		}

		// There wasn't an error fetching the OCSP status.
		ok = true

		if resp.Status != ocsp.Good {
			// The certificate was revoked.
			revoked = true
		}

		return revoked, ok, err
	}
	return revoked, ok, err
}

// sendOCSPRequest attempts to request an OCSP response from the
// server. The error only indicates a failure to *fetch* the
// certificate, and *does not* mean the certificate is valid.
func sendOCSPRequest(server string, req []byte, leaf, issuer *x509.Certificate) (r *ocsp.Response, err error) {
	var resp *http.Response

	if len(req) > 256 {
		buf := bytes.NewBuffer(req)
		resp, err = HTTPClient.Post(server, "application/ocsp-request", buf)
	} else {
		reqURL := server + "/" + url.QueryEscape(base64.StdEncoding.EncodeToString(req))
		resp, err = HTTPClient.Get(reqURL)
	}

	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to retrieve OSCP")
	}

	body, err := ocspRead(resp.Body)
	if err != nil {
		return nil, err
	}

	switch {
	case bytes.Equal(body, ocsp.UnauthorizedErrorResponse):
		return nil, errors.New("OSCP unauthorized")
	case bytes.Equal(body, ocsp.MalformedRequestErrorResponse):
		return nil, errors.New("OSCP malformed")
	case bytes.Equal(body, ocsp.InternalErrorErrorResponse):
		return nil, errors.New("OSCP internal error")
	case bytes.Equal(body, ocsp.TryLaterErrorResponse):
		return nil, errors.New("OSCP try later")
	case bytes.Equal(body, ocsp.SigRequredErrorResponse):
		return nil, errors.New("OSCP signature required")
	}

	return ocsp.ParseResponseForCert(body, leaf, issuer)
}

var (
	// HTTPClient is an instance of http.Client that will be used for all HTTP requests.
	HTTPClient = http.DefaultClient

	// HardFail determines whether the failure to check the revocation
	// status of a certificate (i.e. due to network failure) causes
	// verification to fail (a hard failure).
	HardFail = false

	crlRead    = io.ReadAll
	remoteRead = io.ReadAll
	ocspRead   = io.ReadAll

	ocspOpts = ocsp.RequestOptions{
		Hash: crypto.SHA1,
	}

	crlLock = new(sync.Mutex)
)

// SetCRLFetcher sets the function to use to read from the http response body
func SetCRLFetcher(fn func(io.Reader) ([]byte, error)) {
	crlRead = fn
}

// SetRemoteFetcher sets the function to use to read from the http response body
func SetRemoteFetcher(fn func(io.Reader) ([]byte, error)) {
	remoteRead = fn
}

// SetOCSPFetcher sets the function to use to read from the http response body
func SetOCSPFetcher(fn func(io.Reader) ([]byte, error)) {
	ocspRead = fn
}
