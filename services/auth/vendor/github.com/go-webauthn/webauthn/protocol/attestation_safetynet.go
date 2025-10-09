package protocol

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mitchellh/mapstructure"

	"github.com/go-webauthn/webauthn/metadata"
)

func init() {
	RegisterAttestationFormat(AttestationFormatAndroidSafetyNet, verifySafetyNetFormat)
}

type SafetyNetResponse struct {
	Nonce                      string `json:"nonce"`
	TimestampMs                int64  `json:"timestampMs"`
	ApkPackageName             string `json:"apkPackageName"`
	ApkDigestSha256            string `json:"apkDigestSha256"`
	CtsProfileMatch            bool   `json:"ctsProfileMatch"`
	ApkCertificateDigestSha256 []any  `json:"apkCertificateDigestSha256"`
	BasicIntegrity             bool   `json:"basicIntegrity"`
}

// Thanks to @koesie10 and @herrjemand for outlining how to support this type really well

// When the authenticator in question is a platform-provided Authenticator on certain Android platforms, the attestation
// statement is based on the SafetyNet API. In this case the authenticator data is completely controlled by the caller of
// the SafetyNet API (typically an application running on the Android platform) and the attestation statement only provides
//
//	some statements about the health of the platform and the identity of the calling application. This attestation does not
//
// provide information regarding provenance of the authenticator and its associated data. Therefore platform-provided
// authenticators SHOULD make use of the Android Key Attestation when available, even if the SafetyNet API is also present.
//
// Specification: §8.5. Android SafetyNet Attestation Statement Format (https://www.w3.org/TR/webauthn/#sctn-android-safetynet-attestation)
func verifySafetyNetFormat(att AttestationObject, clientDataHash []byte, mds metadata.Provider) (string, []any, error) {
	// The syntax of an Android Attestation statement is defined as follows:
	//     $$attStmtType //= (
	//                           fmt: "android-safetynet",
	//                           attStmt: safetynetStmtFormat
	//                       )

	//     safetynetStmtFormat = {
	//                               ver: text,
	//                               response: bytes
	//                           }

	// §8.5.1 Verify that attStmt is valid CBOR conforming to the syntax defined above and perform CBOR decoding on it to extract
	// the contained fields.

	// We have done this
	// §8.5.2 Verify that response is a valid SafetyNet response of version ver.
	version, present := att.AttStatement[stmtVersion].(string)
	if !present {
		return "", nil, ErrAttestationFormat.WithDetails("Unable to find the version of SafetyNet")
	}

	if version == "" {
		return "", nil, ErrAttestationFormat.WithDetails("Not a proper version for SafetyNet")
	}

	// TODO: provide user the ability to designate their supported versions

	response, present := att.AttStatement["response"].([]byte)
	if !present {
		return "", nil, ErrAttestationFormat.WithDetails("Unable to find the SafetyNet response")
	}

	token, err := jwt.Parse(string(response), func(token *jwt.Token) (any, error) {
		chain := token.Header[stmtX5C].([]any)

		o := make([]byte, base64.StdEncoding.DecodedLen(len(chain[0].(string))))

		n, err := base64.StdEncoding.Decode(o, []byte(chain[0].(string)))
		if err != nil {
			return nil, err
		}

		cert, err := x509.ParseCertificate(o[:n])

		return cert.PublicKey, err
	})

	if err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Error finding cert issued to correct hostname: %+v", err)).WithError(err)
	}

	// marshall the JWT payload into the safetynet response json
	var safetyNetResponse SafetyNetResponse

	if err = mapstructure.Decode(token.Claims, &safetyNetResponse); err != nil {
		return "", nil, ErrAttestationFormat.WithDetails(fmt.Sprintf("Error parsing the SafetyNet response: %+v", err)).WithError(err)
	}

	// §8.5.3 Verify that the nonce in the response is identical to the Base64 encoding of the SHA-256 hash of the concatenation
	// of authenticatorData and clientDataHash.
	nonceBuffer := sha256.Sum256(append(att.RawAuthData, clientDataHash...))

	nonceBytes, err := base64.StdEncoding.DecodeString(safetyNetResponse.Nonce)
	if !bytes.Equal(nonceBuffer[:], nonceBytes) || err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails("Invalid nonce for in SafetyNet response").WithError(err)
	}

	// §8.5.4 Let attestationCert be the attestation certificate (https://www.w3.org/TR/webauthn/#attestation-certificate)
	certChain := token.Header[stmtX5C].([]any)
	l := make([]byte, base64.StdEncoding.DecodedLen(len(certChain[0].(string))))

	n, err := base64.StdEncoding.Decode(l, []byte(certChain[0].(string)))
	if err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Error finding cert issued to correct hostname: %+v", err)).WithError(err)
	}

	attestationCert, err := x509.ParseCertificate(l[:n])
	if err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Error finding cert issued to correct hostname: %+v", err)).WithError(err)
	}

	// §8.5.5 Verify that attestationCert is issued to the hostname "attest.android.com"
	err = attestationCert.VerifyHostname("attest.android.com")
	if err != nil {
		return "", nil, ErrInvalidAttestation.WithDetails(fmt.Sprintf("Error finding cert issued to correct hostname: %+v", err)).WithError(err)
	}

	// §8.5.6 Verify that the ctsProfileMatch attribute in the payload of response is true.
	if !safetyNetResponse.CtsProfileMatch {
		return "", nil, ErrInvalidAttestation.WithDetails("ctsProfileMatch attribute of the JWT payload is false")
	}

	if t := time.Unix(safetyNetResponse.TimestampMs/1000, 0); t.After(time.Now()) {
		// Zero tolerance for post-dated timestamps.
		return "", nil, ErrInvalidAttestation.WithDetails("SafetyNet response with timestamp after current time")
	} else if t.Before(time.Now().Add(-time.Minute)) {
		// Small tolerance for pre-dated timestamps.
		if mds != nil && mds.GetValidateEntry(context.Background()) {
			return "", nil, ErrInvalidAttestation.WithDetails("SafetyNet response with timestamp before one minute ago")
		}
	}

	// §8.5.7 If successful, return implementation-specific values representing attestation type Basic and attestation
	// trust path attestationCert.
	return string(metadata.BasicFull), nil, nil
}
