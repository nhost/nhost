package protocol

import (
	"context"
	"crypto/sha256"
	"crypto/x509"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"github.com/go-webauthn/webauthn/metadata"
	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
)

// AuthenticatorAttestationResponse is the initial unpacked 'response' object received by the relying party. This
// contains the clientDataJSON object, which will be marshalled into CollectedClientData, and the 'attestationObject',
// which contains information about the authenticator, and the newly minted public key credential. The information in
// both objects are used to verify the authenticity of the ceremony and new credential.
//
// See: https://www.w3.org/TR/webauthn/#typedefdef-publickeycredentialjson
type AuthenticatorAttestationResponse struct {
	// The byte slice of clientDataJSON, which becomes CollectedClientData
	AuthenticatorResponse

	Transports []string `json:"transports,omitempty"`

	AuthenticatorData URLEncodedBase64 `json:"authenticatorData"`

	PublicKey URLEncodedBase64 `json:"publicKey"`

	PublicKeyAlgorithm int64 `json:"publicKeyAlgorithm"`

	// AttestationObject is the byte slice version of attestationObject.
	// This attribute contains an attestation object, which is opaque to, and
	// cryptographically protected against tampering by, the client. The
	// attestation object contains both authenticator data and an attestation
	// statement. The former contains the AAGUID, a unique credential ID, and
	// the credential public key. The contents of the attestation statement are
	// determined by the attestation statement format used by the authenticator.
	// It also contains any additional information that the Relying Party's server
	// requires to validate the attestation statement, as well as to decode and
	// validate the authenticator data along with the JSON-serialized client data.
	AttestationObject URLEncodedBase64 `json:"attestationObject"`
}

// ParsedAttestationResponse is the parsed version of AuthenticatorAttestationResponse.
type ParsedAttestationResponse struct {
	CollectedClientData CollectedClientData
	AttestationObject   AttestationObject
	Transports          []AuthenticatorTransport
}

// AttestationObject is the raw attestationObject.
//
// Authenticators SHOULD also provide some form of attestation, if possible. If an authenticator does, the basic
// requirement is that the authenticator can produce, for each credential public key, an attestation statement
// verifiable by the WebAuthn Relying Party. Typically, this attestation statement contains a signature by an
// attestation private key over the attested credential public key and a challenge, as well as a certificate or similar
// data providing provenance information for the attestation public key, enabling the Relying Party to make a trust
// decision. However, if an attestation key pair is not available, then the authenticator MAY either perform self
// attestation of the credential public key with the corresponding credential private key, or otherwise perform no
// attestation. All this information is returned by authenticators any time a new public key credential is generated, in
// the overall form of an attestation object.
//
// Specification: §6.5. Attestation (https://www.w3.org/TR/webauthn/#sctn-attestation)
type AttestationObject struct {
	// The authenticator data, including the newly created public key. See AuthenticatorData for more info
	AuthData AuthenticatorData

	// The byteform version of the authenticator data, used in part for signature validation
	RawAuthData []byte `json:"authData"`

	// The format of the Attestation data.
	Format string `json:"fmt"`

	// The attestation statement data sent back if attestation is requested.
	AttStatement map[string]any `json:"attStmt,omitempty"`
}

type attestationFormatValidationHandler func(AttestationObject, []byte, metadata.Provider) (string, []any, error)

var attestationRegistry = make(map[AttestationFormat]attestationFormatValidationHandler)

// RegisterAttestationFormat is a method to register attestation formats with the library. Generally using one of the
// locally registered attestation formats is sufficient.
func RegisterAttestationFormat(format AttestationFormat, handler attestationFormatValidationHandler) {
	attestationRegistry[format] = handler
}

// Parse the values returned in the authenticator response and perform attestation verification
// Step 8. This returns a fully decoded struct with the data put into a format that can be
// used to verify the user and credential that was created.
func (ccr *AuthenticatorAttestationResponse) Parse() (p *ParsedAttestationResponse, err error) {
	p = &ParsedAttestationResponse{}

	if err = json.Unmarshal(ccr.ClientDataJSON, &p.CollectedClientData); err != nil {
		return nil, ErrParsingData.WithInfo(err.Error())
	}

	if err = webauthncbor.Unmarshal(ccr.AttestationObject, &p.AttestationObject); err != nil {
		return nil, ErrParsingData.WithInfo(err.Error())
	}

	// Step 8. Perform CBOR decoding on the attestationObject field of the AuthenticatorAttestationResponse
	// structure to obtain the attestation statement format fmt, the authenticator data authData, and
	// the attestation statement attStmt.
	if err = p.AttestationObject.AuthData.Unmarshal(p.AttestationObject.RawAuthData); err != nil {
		return nil, fmt.Errorf("error decoding auth data: %v", err)
	}

	if !p.AttestationObject.AuthData.Flags.HasAttestedCredentialData() {
		return nil, ErrAttestationFormat.WithInfo("Attestation missing attested credential data flag")
	}

	for _, t := range ccr.Transports {
		p.Transports = append(p.Transports, AuthenticatorTransport(t))
	}

	return p, nil
}

// Verify performs Steps 9 through 14 of registration verification.
//
// Steps 9 through 12 are verified against the auth data. These steps are identical to 11 through 14 for assertion so we
// handle them with AuthData.
func (a *AttestationObject) Verify(relyingPartyID string, clientDataHash []byte, userVerificationRequired bool, mds metadata.Provider) (err error) {
	rpIDHash := sha256.Sum256([]byte(relyingPartyID))

	// Begin Step 9 through 12. Verify that the rpIdHash in authData is the SHA-256 hash of the RP ID expected by the RP.
	if err = a.AuthData.Verify(rpIDHash[:], nil, userVerificationRequired); err != nil {
		return err
	}

	return a.VerifyAttestation(clientDataHash, mds)
}

// VerifyAttestation only verifies the attestation object excluding the AuthData values. If you wish to also verify the
// AuthData values you should use Verify.
func (a *AttestationObject) VerifyAttestation(clientDataHash []byte, mds metadata.Provider) (err error) {
	// Step 13. Determine the attestation statement format by performing a
	// USASCII case-sensitive match on fmt against the set of supported
	// WebAuthn Attestation Statement Format Identifier values. The up-to-date
	// list of registered WebAuthn Attestation Statement Format Identifier
	// values is maintained in the IANA registry of the same name
	// [WebAuthn-Registries] (https://www.w3.org/TR/webauthn/#biblio-webauthn-registries).

	// Since there is not an active registry yet, we'll check it against our internal
	// Supported types.

	// But first let's make sure attestation is present. If it isn't, we don't need to handle
	// any of the following steps
	if AttestationFormat(a.Format) == AttestationFormatNone {
		if len(a.AttStatement) != 0 {
			return ErrAttestationFormat.WithInfo("Attestation format none with attestation present")
		}

		return nil
	}

	formatHandler, valid := attestationRegistry[AttestationFormat(a.Format)]
	if !valid {
		return ErrAttestationFormat.WithInfo(fmt.Sprintf("Attestation format %s is unsupported", a.Format))
	}

	// Step 14. Verify that attStmt is a correct attestation statement, conveying a valid attestation signature, by using
	// the attestation statement format fmt’s verification procedure given attStmt, authData and the hash of the serialized
	// client data computed in step 7.
	attestationType, x5cs, err := formatHandler(*a, clientDataHash, mds)
	if err != nil {
		return err.(*Error).WithInfo(attestationType)
	}

	var (
		aaguid uuid.UUID
		entry  *metadata.Entry
	)

	if len(a.AuthData.AttData.AAGUID) != 0 {
		if aaguid, err = uuid.FromBytes(a.AuthData.AttData.AAGUID); err != nil {
			return ErrInvalidAttestation.WithInfo("Error occurred parsing AAGUID during attestation validation").WithDetails(err.Error())
		}
	}

	if mds == nil {
		return nil
	}

	ctx := context.Background()

	if entry, err = mds.GetEntry(ctx, aaguid); err != nil {
		return ErrInvalidAttestation.WithInfo(fmt.Sprintf("Error occurred retrieving metadata entry during attestation validation: %+v", err)).WithDetails(fmt.Sprintf("Error occurred looking up entry for AAGUID %s", aaguid.String()))
	}

	if entry == nil {
		if aaguid == uuid.Nil && mds.GetValidateEntryPermitZeroAAGUID(ctx) {
			return nil
		}

		if mds.GetValidateEntry(ctx) {
			return ErrInvalidAttestation.WithDetails(fmt.Sprintf("AAGUID %s not found in metadata during attestation validation", aaguid.String()))
		}

		return nil
	}

	if mds.GetValidateAttestationTypes(ctx) {
		found := false

		for _, atype := range entry.MetadataStatement.AttestationTypes {
			if string(atype) == attestationType {
				found = true

				break
			}
		}

		if !found {
			return ErrInvalidAttestation.WithDetails(fmt.Sprintf("Authenticator with invalid attestation type encountered during attestation validation. The attestation type '%s' is not known to be used by AAGUID '%s'", attestationType, aaguid.String()))
		}
	}

	if mds.GetValidateStatus(ctx) {
		if err = mds.ValidateStatusReports(ctx, entry.StatusReports); err != nil {
			return ErrInvalidAttestation.WithDetails(fmt.Sprintf("Authenticator with invalid status encountered during attestation validation. %s", err.Error()))
		}
	}

	if mds.GetValidateTrustAnchor(ctx) {
		if x5cs == nil {
			return nil
		}

		var (
			x5c *x509.Certificate
			raw []byte
			ok  bool
		)

		if len(x5cs) == 0 {
			return ErrInvalidAttestation.WithDetails("Unable to parse attestation certificate from x5c during attestation validation").WithInfo("The attestation had no certificates")
		}

		if raw, ok = x5cs[0].([]byte); !ok {
			return ErrInvalidAttestation.WithDetails("Unable to parse attestation certificate from x5c during attestation validation").WithInfo(fmt.Sprintf("The first certificate in the attestation was type '%T' but '[]byte' was expected", x5cs[0]))
		}

		if x5c, err = x509.ParseCertificate(raw); err != nil {
			return ErrInvalidAttestation.WithDetails("Unable to parse attestation certificate from x5c during attestation validation").WithInfo(fmt.Sprintf("Error returned from x509.ParseCertificate: %+v", err))
		}

		if x5c.Subject.CommonName != x5c.Issuer.CommonName {
			if !entry.MetadataStatement.AttestationTypes.HasBasicFull() {
				return ErrInvalidAttestation.WithDetails("Unable to validate attestation statement signature during attestation validation: attestation with full attestation from authenticator that does not support full attestation")
			}

			if _, err = x5c.Verify(entry.MetadataStatement.Verifier()); err != nil {
				return ErrInvalidAttestation.WithDetails(fmt.Sprintf("Unable to validate attestation signature statement during attestation validation: invalid certificate chain from MDS: %v", err))
			}
		}
	}

	return nil
}
