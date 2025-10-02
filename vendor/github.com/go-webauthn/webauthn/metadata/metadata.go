package metadata

import (
	"crypto/x509"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Fetch creates a new HTTP client and gets the production metadata, decodes it, and parses it. This is an
// instrumentation simplification that makes it easier to either just grab the latest metadata or for implementers to
// see the rough process of retrieving it to implement any of their own logic.
func Fetch() (metadata *Metadata, err error) {
	var (
		decoder *Decoder
		payload *PayloadJSON
		res     *http.Response
	)

	if decoder, err = NewDecoder(WithIgnoreEntryParsingErrors()); err != nil {
		return nil, err
	}

	client := &http.Client{}

	if res, err = client.Get(ProductionMDSURL); err != nil {
		return nil, err
	}

	if payload, err = decoder.Decode(res.Body); err != nil {
		return nil, err
	}

	return decoder.Parse(payload)
}

type Metadata struct {
	Parsed   Parsed
	Unparsed []EntryError
}

func (m *Metadata) ToMap() (metadata map[uuid.UUID]*Entry) {
	metadata = make(map[uuid.UUID]*Entry)

	for _, entry := range m.Parsed.Entries {
		if entry.AaGUID != uuid.Nil {
			metadata[entry.AaGUID] = &entry
		}
	}

	return metadata
}

// Parsed is a structure representing the Parsed MDS3 dictionary.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#metadata-blob-payload-entry-dictionary
type Parsed struct {
	// The legalHeader, if present, contains a legal guide for accessing and using metadata, which itself MAY contain URL(s) pointing to further information, such as a full Terms and Conditions statement.
	LegalHeader string

	// The serial number of this UAF Metadata TOC Payload. Serial numbers MUST be consecutive and strictly monotonic, i.e. the successor TOC will have a no value exactly incremented by one.
	Number int

	// ISO-8601 formatted date when the next update will be provided at latest.
	NextUpdate time.Time

	// List of zero or more MetadataTOCPayloadEntry objects.
	Entries []Entry
}

// PayloadJSON is an intermediary JSON/JWT representation of the Parsed.
type PayloadJSON struct {
	LegalHeader string `json:"legalHeader"`
	Number      int    `json:"no"`
	NextUpdate  string `json:"nextUpdate"`

	Entries []EntryJSON `json:"entries"`
}

func (j PayloadJSON) Parse() (payload Parsed, err error) {
	var update time.Time

	if update, err = time.Parse(time.DateOnly, j.NextUpdate); err != nil {
		return payload, fmt.Errorf("error occurred parsing next update value '%s': %w", j.NextUpdate, err)
	}

	n := len(j.Entries)

	entries := make([]Entry, n)

	for i := 0; i < n; i++ {
		if entries[i], err = j.Entries[i].Parse(); err != nil {
			return payload, fmt.Errorf("error occurred parsing entry %d: %w", i, err)
		}
	}

	return Parsed{
		LegalHeader: j.LegalHeader,
		Number:      j.Number,
		NextUpdate:  update,
		Entries:     entries,
	}, nil
}

// Entry is a structure representing the Entry MDS3 dictionary.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#metadata-blob-payload-entry-dictionary
type Entry struct {
	// The Authenticator Attestation ID.
	Aaid string `json:"aaid"`

	// The Authenticator Attestation GUID.
	AaGUID uuid.UUID `json:"aaguid"`

	// A list of the attestation certificate public key identifiers encoded as hex string.
	AttestationCertificateKeyIdentifiers []string `json:"attestationCertificateKeyIdentifiers"`

	// The metadataStatement JSON object as defined in FIDOMetadataStatement.
	MetadataStatement Statement `json:"metadataStatement"`

	// Status of the FIDO Biometric Certification of one or more biometric components of the Authenticator
	BiometricStatusReports []BiometricStatusReport `json:"biometricStatusReports"`

	// An array of status reports applicable to this authenticator.
	StatusReports []StatusReport `json:"statusReports"`

	// ISO-8601 formatted date since when the status report array was set to the current value.
	TimeOfLastStatusChange time.Time

	// URL of a list of rogue (i.e. untrusted) individual authenticators.
	RogueListURL *url.URL

	// The hash value computed over the Base64url encoding of the UTF-8 representation of the JSON encoded rogueList available at rogueListURL (with type rogueListEntry[]).
	RogueListHash string
}

// EntryJSON is an intermediary JSON/JWT structure representing the Entry MDS3 dictionary.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#metadata-blob-payload-entry-dictionary
type EntryJSON struct {
	Aaid                                 string   `json:"aaid"`
	AaGUID                               string   `json:"aaguid"`
	AttestationCertificateKeyIdentifiers []string `json:"attestationCertificateKeyIdentifiers"`

	MetadataStatement      StatementJSON               `json:"metadataStatement"`
	BiometricStatusReports []BiometricStatusReportJSON `json:"biometricStatusReports"`
	StatusReports          []StatusReportJSON          `json:"statusReports"`

	TimeOfLastStatusChange string `json:"timeOfLastStatusChange"`
	RogueListURL           string `json:"rogueListURL"`
	RogueListHash          string `json:"rogueListHash"`
}

func (j EntryJSON) Parse() (entry Entry, err error) {
	var aaguid uuid.UUID

	if len(j.AaGUID) != 0 {
		if aaguid, err = uuid.Parse(j.AaGUID); err != nil {
			return entry, fmt.Errorf("error occurred parsing metadata entry with AAGUID '%s': error parsing AAGUID: %w", j.AaGUID, err)
		}
	}

	var statement Statement

	if statement, err = j.MetadataStatement.Parse(); err != nil {
		return entry, fmt.Errorf("error occurred parsing metadata entry with AAGUID '%s': %w", j.AaGUID, err)
	}

	var i, n int

	n = len(j.BiometricStatusReports)

	bsrs := make([]BiometricStatusReport, n)

	for i = 0; i < n; i++ {
		if bsrs[i], err = j.BiometricStatusReports[i].Parse(); err != nil {
			return entry, fmt.Errorf("error occurred parsing metadata entry with AAGUID '%s': error occurred parsing biometric status report %d: %w", j.AaGUID, i, err)
		}
	}

	n = len(j.StatusReports)

	srs := make([]StatusReport, n)

	for i = 0; i < n; i++ {
		if srs[i], err = j.StatusReports[i].Parse(); err != nil {
			return entry, fmt.Errorf("error occurred parsing metadata entry with AAGUID '%s': error occurred parsing status report %d: %w", j.AaGUID, i, err)
		}
	}

	var change time.Time

	if change, err = time.Parse(time.DateOnly, j.TimeOfLastStatusChange); err != nil {
		return entry, fmt.Errorf("error occurred parsing metadata entry with AAGUID '%s': error occurred parsing time of last status change value: %w", j.AaGUID, err)
	}

	var rogues *url.URL

	if len(j.RogueListURL) != 0 {
		if rogues, err = url.ParseRequestURI(j.RogueListURL); err != nil {
			return entry, fmt.Errorf("error occurred parsing metadata entry with AAGUID '%s': error occurred parsing rogue list URL value: %w", j.AaGUID, err)
		}

		if len(j.RogueListHash) == 0 {
			return entry, fmt.Errorf("error occurred parsing metadata entry with AAGUID '%s': error occurred validating rogue list URL value: the rogue list hash was absent", j.AaGUID)
		}
	}

	return Entry{
		Aaid:                                 j.Aaid,
		AaGUID:                               aaguid,
		AttestationCertificateKeyIdentifiers: j.AttestationCertificateKeyIdentifiers,
		MetadataStatement:                    statement,
		BiometricStatusReports:               bsrs,
		StatusReports:                        srs,
		TimeOfLastStatusChange:               change,
		RogueListURL:                         rogues,
		RogueListHash:                        j.RogueListHash,
	}, nil
}

// Statement is a structure representing the Statement MDS3 dictionary.
// Authenticator metadata statements are used directly by the FIDO server at a relying party, but the information
// contained in the authoritative statement is used in several other places.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.0-ps-20210518.html#metadata-keys
type Statement struct {
	// The legalHeader, if present, contains a legal guide for accessing and using metadata, which itself MAY contain URL(s) pointing to further information, such as a full Terms and Conditions statement.
	LegalHeader string

	// The Authenticator Attestation ID.
	Aaid string

	// The Authenticator Attestation GUID.
	AaGUID uuid.UUID

	// A list of the attestation certificate public key identifiers encoded as hex string.
	AttestationCertificateKeyIdentifiers []string

	// A human-readable, short description of the authenticator, in English.
	Description string

	// A list of human-readable short descriptions of the authenticator in different languages.
	AlternativeDescriptions map[string]string

	// Earliest (i.e. lowest) trustworthy authenticatorVersion meeting the requirements specified in this metadata statement.
	AuthenticatorVersion uint32

	// The FIDO protocol family. The values "uaf", "u2f", and "fido2" are supported.
	ProtocolFamily string

	// he Metadata Schema version.
	Schema uint16

	// The FIDO unified protocol version(s) (related to the specific protocol family) supported by this authenticator.
	Upv []Version

	// The list of authentication algorithms supported by the authenticator.
	AuthenticationAlgorithms []AuthenticationAlgorithm

	// The list of public key formats supported by the authenticator during registration operations.
	PublicKeyAlgAndEncodings []PublicKeyAlgAndEncoding

	// The supported attestation type(s).
	AttestationTypes AuthenticatorAttestationTypes

	// A list of alternative VerificationMethodANDCombinations.
	UserVerificationDetails [][]VerificationMethodDescriptor

	// A 16-bit number representing the bit fields defined by the KEY_PROTECTION constants in the FIDO Registry of Predefined Values
	KeyProtection []string

	// This entry is set to true or it is omitted, if the Uauth private key is restricted by the authenticator to only sign valid FIDO signature assertions.
	// This entry is set to false, if the authenticator doesn't restrict the Uauth key to only sign valid FIDO signature assertions.
	IsKeyRestricted bool

	// This entry is set to true or it is omitted, if Uauth key usage always requires a fresh user verification
	// This entry is set to false, if the Uauth key can be used without requiring a fresh user verification, e.g. without any additional user interaction, if the user was verified a (potentially configurable) caching time ago.
	IsFreshUserVerificationRequired bool

	// A 16-bit number representing the bit fields defined by the MATCHER_PROTECTION constants in the FIDO Registry of Predefined Values
	MatcherProtection []string

	// The authenticator's overall claimed cryptographic strength in bits (sometimes also called security strength or security level).
	CryptoStrength uint16

	// A 32-bit number representing the bit fields defined by the ATTACHMENT_HINT constants in the FIDO Registry of Predefined Values
	AttachmentHint []string

	// A 16-bit number representing a combination of the bit flags defined by the TRANSACTION_CONFIRMATION_DISPLAY constants in the FIDO Registry of Predefined Values
	TcDisplay []string

	// Supported MIME content type [RFC2049] for the transaction confirmation display, such as text/plain or image/png.
	TcDisplayContentType string

	// A list of alternative DisplayPNGCharacteristicsDescriptor. Each of these entries is one alternative of supported image characteristics for displaying a PNG image.
	TcDisplayPNGCharacteristics []DisplayPNGCharacteristicsDescriptor

	// Each element of this array represents a PKIX [RFC5280] X.509 certificate that is a valid trust anchor for this authenticator model.
	// Multiple certificates might be used for different batches of the same model.
	// The array does not represent a certificate chain, but only the trust anchor of that chain.
	// A trust anchor can be a root certificate, an intermediate CA certificate or even the attestation certificate itself.
	AttestationRootCertificates []*x509.Certificate

	// A list of trust anchors used for ECDAA attestation. This entry MUST be present if and only if attestationType includes ATTESTATION_ECDAA.
	EcdaaTrustAnchors []EcdaaTrustAnchor

	// A data: url [RFC2397] encoded PNG [PNG] icon for the Authenticator.
	Icon *url.URL

	// List of extensions supported by the authenticator.
	SupportedExtensions []ExtensionDescriptor

	// Describes supported versions, extensions, AAGUID of the device and its capabilities
	AuthenticatorGetInfo AuthenticatorGetInfo
}

func (s *Statement) Verifier(x5cis []*x509.Certificate) (opts x509.VerifyOptions) {
	roots := x509.NewCertPool()

	for _, root := range s.AttestationRootCertificates {
		roots.AddCert(root)
	}

	var intermediates *x509.CertPool

	if len(x5cis) > 0 {
		intermediates = x509.NewCertPool()

		for _, x5c := range x5cis {
			intermediates.AddCert(x5c)
		}
	}

	return x509.VerifyOptions{
		Roots:         roots,
		Intermediates: intermediates,
	}
}

// StatementJSON is an intermediary JSON/JWT structure representing the Statement MDS3 dictionary.
// Authenticator metadata statements are used directly by the FIDO server at a relying party, but the information
// contained in the authoritative statement is used in several other places.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.0-ps-20210518.html#metadata-keys
type StatementJSON struct {
	LegalHeader                          string                                `json:"legalHeader"`
	Aaid                                 string                                `json:"aaid"`
	AaGUID                               string                                `json:"aaguid"`
	AttestationCertificateKeyIdentifiers []string                              `json:"attestationCertificateKeyIdentifiers"`
	Description                          string                                `json:"description"`
	AlternativeDescriptions              map[string]string                     `json:"alternativeDescriptions"`
	AuthenticatorVersion                 uint32                                `json:"authenticatorVersion"`
	ProtocolFamily                       string                                `json:"protocolFamily"`
	Schema                               uint16                                `json:"schema"`
	Upv                                  []Version                             `json:"upv"`
	AuthenticationAlgorithms             []AuthenticationAlgorithm             `json:"authenticationAlgorithms"`
	PublicKeyAlgAndEncodings             []PublicKeyAlgAndEncoding             `json:"publicKeyAlgAndEncodings"`
	AttestationTypes                     []AuthenticatorAttestationType        `json:"attestationTypes"`
	UserVerificationDetails              [][]VerificationMethodDescriptor      `json:"userVerificationDetails"`
	KeyProtection                        []string                              `json:"keyProtection"`
	IsKeyRestricted                      bool                                  `json:"isKeyRestricted"`
	IsFreshUserVerificationRequired      bool                                  `json:"isFreshUserVerificationRequired"`
	MatcherProtection                    []string                              `json:"matcherProtection"`
	CryptoStrength                       uint16                                `json:"cryptoStrength"`
	AttachmentHint                       []string                              `json:"attachmentHint"`
	TcDisplay                            []string                              `json:"tcDisplay"`
	TcDisplayContentType                 string                                `json:"tcDisplayContentType"`
	TcDisplayPNGCharacteristics          []DisplayPNGCharacteristicsDescriptor `json:"tcDisplayPNGCharacteristics"`
	AttestationRootCertificates          []string                              `json:"attestationRootCertificates"`
	EcdaaTrustAnchors                    []EcdaaTrustAnchor                    `json:"ecdaaTrustAnchors"`
	Icon                                 string                                `json:"icon"`
	SupportedExtensions                  []ExtensionDescriptor                 `json:"supportedExtensions"`
	AuthenticatorGetInfo                 AuthenticatorGetInfoJSON              `json:"authenticatorGetInfo"`
}

func (j StatementJSON) Parse() (statement Statement, err error) {
	var aaguid uuid.UUID

	if len(j.AaGUID) != 0 {
		if aaguid, err = uuid.Parse(j.AaGUID); err != nil {
			return statement, fmt.Errorf("error occurred parsing statement with description '%s': error occurred parsing AAGUID value: %w", j.Description, err)
		}
	}

	n := len(j.AttestationRootCertificates)

	certificates := make([]*x509.Certificate, n)

	for i := 0; i < n; i++ {
		if certificates[i], err = mdsParseX509Certificate(j.AttestationRootCertificates[i]); err != nil {
			return statement, fmt.Errorf("error occurred parsing statement with description '%s': error occurred parsing attestation root certificate %d value: %w", j.Description, i, err)
		}
	}

	var icon *url.URL

	if len(j.Icon) != 0 {
		if icon, err = url.ParseRequestURI(j.Icon); err != nil {
			return statement, fmt.Errorf("error occurred parsing statement with description '%s': error occurred parsing icon value: %w", j.Description, err)
		}
	}

	var info AuthenticatorGetInfo

	if info, err = j.AuthenticatorGetInfo.Parse(); err != nil {
		return statement, fmt.Errorf("error occurred parsing statement with description '%s': error occurred parsing authenticator get info value: %w", j.Description, err)
	}

	return Statement{
		LegalHeader:                          j.LegalHeader,
		Aaid:                                 j.Aaid,
		AaGUID:                               aaguid,
		AttestationCertificateKeyIdentifiers: j.AttestationCertificateKeyIdentifiers,
		Description:                          j.Description,
		AlternativeDescriptions:              j.AlternativeDescriptions,
		AuthenticatorVersion:                 j.AuthenticatorVersion,
		ProtocolFamily:                       j.ProtocolFamily,
		Schema:                               j.Schema,
		Upv:                                  j.Upv,
		AuthenticationAlgorithms:             j.AuthenticationAlgorithms,
		PublicKeyAlgAndEncodings:             j.PublicKeyAlgAndEncodings,
		AttestationTypes:                     j.AttestationTypes,
		UserVerificationDetails:              j.UserVerificationDetails,
		KeyProtection:                        j.KeyProtection,
		IsKeyRestricted:                      j.IsKeyRestricted,
		IsFreshUserVerificationRequired:      j.IsFreshUserVerificationRequired,
		MatcherProtection:                    j.MatcherProtection,
		CryptoStrength:                       j.CryptoStrength,
		AttachmentHint:                       j.AttachmentHint,
		TcDisplay:                            j.TcDisplay,
		TcDisplayContentType:                 j.TcDisplayContentType,
		TcDisplayPNGCharacteristics:          j.TcDisplayPNGCharacteristics,
		AttestationRootCertificates:          certificates,
		EcdaaTrustAnchors:                    j.EcdaaTrustAnchors,
		Icon:                                 icon,
		SupportedExtensions:                  j.SupportedExtensions,
		AuthenticatorGetInfo:                 info,
	}, nil
}

// BiometricStatusReport is a structure representing the BiometricStatusReport MDS3 dictionary.
// Contains the current status of the authenticator's biometric component.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#biometricstatusreport-dictionary
type BiometricStatusReport struct {
	// Achieved level of the biometric certification of this biometric component of the authenticator
	CertLevel uint16

	// A single USER_VERIFY constant indicating the modality of the biometric component
	Modality string

	// ISO-8601 formatted date since when the certLevel achieved, if applicable. If no date is given, the status is assumed to be effective while present.
	EffectiveDate time.Time

	// Describes the externally visible aspects of the Biometric Certification evaluation.
	CertificationDescriptor string

	// The unique identifier for the issued Biometric Certification.
	CertificateNumber string

	// The version of the Biometric Certification Policy the implementation is Certified to, e.g. "1.0.0".
	CertificationPolicyVersion string

	// The version of the Biometric Requirements [FIDOBiometricsRequirements] the implementation is certified to, e.g. "1.0.0".
	CertificationRequirementsVersion string
}

// BiometricStatusReportJSON is a structure representing the BiometricStatusReport MDS3 dictionary.
// Contains the current status of the authenticator's biometric component.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#biometricstatusreport-dictionary
type BiometricStatusReportJSON struct {
	CertLevel               uint16 `json:"certLevel"`
	Modality                string `json:"modality"`
	EffectiveDate           string `json:"effectiveDate"`
	CertificationDescriptor string `json:"certificationDescriptor"`
	CertificateNumber       string `json:"certificateNumber"`

	CertificationPolicyVersion       string `json:"certificationPolicyVersion"`
	CertificationRequirementsVersion string `json:"certificationRequirementsVersion"`
}

func (j BiometricStatusReportJSON) Parse() (report BiometricStatusReport, err error) {
	var effective time.Time

	if effective, err = time.Parse(time.DateOnly, j.EffectiveDate); err != nil {
		return report, fmt.Errorf("error occurred parsing effective date value: %w", err)
	}

	return BiometricStatusReport{
		CertLevel:                        j.CertLevel,
		Modality:                         j.Modality,
		EffectiveDate:                    effective,
		CertificationDescriptor:          j.CertificationDescriptor,
		CertificateNumber:                j.CertificateNumber,
		CertificationPolicyVersion:       j.CertificationPolicyVersion,
		CertificationRequirementsVersion: j.CertificationRequirementsVersion,
	}, nil
}

// StatusReport is a structure representing the StatusReport MDS3 dictionary.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#statusreport-dictionary
type StatusReport struct {
	// Status of the authenticator. Additional fields MAY be set depending on this value.
	Status AuthenticatorStatus

	// ISO-8601 formatted date since when the status code was set, if applicable. If no date is given, the status is assumed to be effective while present.
	EffectiveDate time.Time

	// The authenticatorVersion that this status report relates to. In the case of FIDO_CERTIFIED* status values, the status applies to higher authenticatorVersions until there is a new statusReport.
	AuthenticatorVersion uint32

	// Base64-encoded [RFC4648] (not base64url!) DER [ITU-X690-2008] PKIX certificate value related to the current status, if applicable.
	Certificate *x509.Certificate

	// HTTPS URL where additional information may be found related to the current status, if applicable.
	URL *url.URL

	// Describes the externally visible aspects of the Authenticator Certification evaluation.
	CertificationDescriptor string

	// The unique identifier for the issued Certification.
	CertificateNumber string

	// The version of the Authenticator Certification Policy the implementation is Certified to, e.g. "1.0.0".
	CertificationPolicyVersion string

	// The Document Version of the Authenticator Security Requirements (DV) [FIDOAuthenticatorSecurityRequirements] the implementation is certified to, e.g. "1.2.0".
	CertificationRequirementsVersion string
}

// StatusReportJSON is an intermediary JSON/JWT structure representing the StatusReport MDS3 dictionary.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#statusreport-dictionary
type StatusReportJSON struct {
	Status                           AuthenticatorStatus `json:"status"`
	EffectiveDate                    string              `json:"effectiveDate"`
	AuthenticatorVersion             uint32              `json:"authenticatorVersion"`
	Certificate                      string              `json:"certificate"`
	URL                              string              `json:"url"`
	CertificationDescriptor          string              `json:"certificationDescriptor"`
	CertificateNumber                string              `json:"certificateNumber"`
	CertificationPolicyVersion       string              `json:"certificationPolicyVersion"`
	CertificationRequirementsVersion string              `json:"certificationRequirementsVersion"`
}

func (j StatusReportJSON) Parse() (report StatusReport, err error) {
	var certificate *x509.Certificate

	if len(j.Certificate) != 0 {
		if certificate, err = mdsParseX509Certificate(j.Certificate); err != nil {
			return report, fmt.Errorf("error occurred parsing certificate value: %w", err)
		}
	}

	var effective time.Time

	if effective, err = time.Parse(time.DateOnly, j.EffectiveDate); err != nil {
		return report, fmt.Errorf("error occurred parsing effective date value: %w", err)
	}

	var uri *url.URL

	if len(j.URL) != 0 {
		if uri, err = url.ParseRequestURI(j.URL); err != nil {
			if !strings.HasPrefix(j.URL, "http") {
				var e error

				if uri, e = url.ParseRequestURI(fmt.Sprintf("https://%s", j.URL)); e != nil {
					return report, fmt.Errorf("error occurred parsing URL value: %w", err)
				}
			}
		}
	}

	return StatusReport{
		Status:                           j.Status,
		EffectiveDate:                    effective,
		AuthenticatorVersion:             j.AuthenticatorVersion,
		Certificate:                      certificate,
		URL:                              uri,
		CertificationDescriptor:          j.CertificationDescriptor,
		CertificateNumber:                j.CertificateNumber,
		CertificationPolicyVersion:       j.CertificationPolicyVersion,
		CertificationRequirementsVersion: j.CertificationRequirementsVersion,
	}, nil
}

// RogueListEntry is a structure representing the RogueListEntry MDS3 dictionary.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#roguelistentry-dictionary
type RogueListEntry struct {
	// Base64url encoding of the rogue authenticator's secret key
	Sk string `json:"sk"`

	// ISO-8601 formatted date since when this entry is effective.
	Date string `json:"date"`
}

// CodeAccuracyDescriptor is a structure representing the CodeAccuracyDescriptor MDS3 dictionary.
// It describes the relevant accuracy/complexity aspects of passcode user verification methods.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.0-ps-20210518.html#codeaccuracydescriptor-dictionary
type CodeAccuracyDescriptor struct {
	// The numeric system base (radix) of the code, e.g. 10 in the case of decimal digits.
	Base uint16 `json:"base"`

	// The minimum number of digits of the given base required for that code, e.g. 4 in the case of 4 digits.
	MinLength uint16 `json:"minLength"`

	// Maximum number of false attempts before the authenticator will block this method (at least for some time). 0 means it will never block.
	MaxRetries uint16 `json:"maxRetries"`

	// Enforced minimum number of seconds wait time after blocking (e.g. due to forced reboot or similar).
	// 0 means this user verification method will be blocked, either permanently or until an alternative user verification method method succeeded.
	// All alternative user verification methods MUST be specified appropriately in the Metadata in userVerificationDetails.
	BlockSlowdown uint16 `json:"blockSlowdown"`
}

// BiometricAccuracyDescriptor is a structure representing the BiometricAccuracyDescriptor MDS3 dictionary.
// It describes relevant accuracy/complexity aspects in the case of a biometric user verification method.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.0-ps-20210518.html#biometricaccuracydescriptor-dictionary
type BiometricAccuracyDescriptor struct {
	// The false rejection rate [ISO19795-1] for a single template, i.e. the percentage of verification transactions with truthful claims of identity that are incorrectly denied.
	SelfAttestedFRR int64 `json:"selfAttestedFRR"`

	// The false acceptance rate [ISO19795-1] for a single template, i.e. the percentage of verification transactions with wrongful claims of identity that are incorrectly confirmed.
	SelfAttestedFAR int64 `json:"selfAttestedFAR"`

	// Maximum number of alternative templates from different fingers allowed.
	MaxTemplates uint16 `json:"maxTemplates"`

	// Maximum number of false attempts before the authenticator will block this method (at least for some time). 0 means it will never block.
	MaxRetries uint16 `json:"maxRetries"`

	// Enforced minimum number of seconds wait time after blocking (e.g. due to forced reboot or similar).
	// 0 means that this user verification method will be blocked either permanently or until an alternative user verification method succeeded.
	// All alternative user verification methods MUST be specified appropriately in the metadata in userVerificationDetails.
	BlockSlowdown uint16 `json:"blockSlowdown"`
}

// PatternAccuracyDescriptor is a structure representing the PatternAccuracyDescriptor MDS3 dictionary.
// It describes relevant accuracy/complexity aspects in the case that a pattern is used as the user verification method.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.0-ps-20210518.html#patternaccuracydescriptor-dictionary
type PatternAccuracyDescriptor struct {
	// Number of possible patterns (having the minimum length) out of which exactly one would be the right one, i.e. 1/probability in the case of equal distribution.
	MinComplexity uint32 `json:"minComplexity"`

	// Maximum number of false attempts before the authenticator will block authentication using this method (at least temporarily). 0 means it will never block.
	MaxRetries uint16 `json:"maxRetries"`

	// Enforced minimum number of seconds wait time after blocking (due to forced reboot or similar mechanism).
	// 0 means this user verification method will be blocked, either permanently or until an alternative user verification method method succeeded.
	// All alternative user verification methods MUST be specified appropriately in the metadata under userVerificationDetails.
	BlockSlowdown uint16 `json:"blockSlowdown"`
}

// VerificationMethodDescriptor is a structure representing the VerificationMethodDescriptor MDS3 dictionary.
// It describes a descriptor for a specific base user verification method as implemented by the authenticator.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.0-ps-20210518.html#verificationmethoddescriptor-dictionary
type VerificationMethodDescriptor struct {
	// a single USER_VERIFY constant (see [FIDORegistry]), not a bit flag combination. This value MUST be non-zero.
	UserVerificationMethod string `json:"userVerificationMethod"`

	// May optionally be used in the case of method USER_VERIFY_PASSCODE.
	CaDesc CodeAccuracyDescriptor `json:"caDesc"`

	// May optionally be used in the case of method USER_VERIFY_FINGERPRINT, USER_VERIFY_VOICEPRINT, USER_VERIFY_FACEPRINT, USER_VERIFY_EYEPRINT, or USER_VERIFY_HANDPRINT.
	BaDesc BiometricAccuracyDescriptor `json:"baDesc"`

	// May optionally be used in case of method USER_VERIFY_PATTERN.
	PaDesc PatternAccuracyDescriptor `json:"paDesc"`
}

// RGBPaletteEntry is a structure representing the RGBPaletteEntry MDS3 dictionary.
// It describes an RGB three-sample tuple palette entry.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.0-ps-20210518.html#rgbpaletteentry-dictionary
type RGBPaletteEntry struct {
	// Red channel sample value
	R uint16 `json:"r"`

	// Green channel sample value
	G uint16 `json:"g"`

	// Blue channel sample value
	B uint16 `json:"b"`
}

// DisplayPNGCharacteristicsDescriptor is a structure representing the DisplayPNGCharacteristicsDescriptor MDS3 dictionary.
// It describes a PNG image characteristics as defined in the PNG [PNG] spec for IHDR (image header) and PLTE (palette table)/
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.0-ps-20210518.html#displaypngcharacteristicsdescriptor-dictionary
type DisplayPNGCharacteristicsDescriptor struct {
	// image width
	Width uint32 `json:"width"`

	// image height
	Height uint32 `json:"height"`

	// Bit depth - bits per sample or per palette index.
	BitDepth byte `json:"bitDepth"`

	// Color type defines the PNG image type.
	ColorType byte `json:"colorType"`

	// Compression method used to compress the image data.
	Compression byte `json:"compression"`

	// Filter method is the preprocessing method applied to the image data before compression.
	Filter byte `json:"filter"`

	// Interlace method is the transmission order of the image data.
	Interlace byte `json:"interlace"`

	// 1 to 256 palette entries
	Plte []RGBPaletteEntry `json:"plte"`
}

// EcdaaTrustAnchor is a structure representing the EcdaaTrustAnchor MDS3 dictionary.
// In the case of ECDAA attestation, the ECDAA-Issuer's trust anchor MUST be specified in this field.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.0-ps-20210518.html#ecdaatrustanchor-dictionary
type EcdaaTrustAnchor struct {
	// base64url encoding of the result of ECPoint2ToB of the ECPoint2 X
	X string `json:"X"`

	// base64url encoding of the result of ECPoint2ToB of the ECPoint2 Y
	Y string `json:"Y"`

	// base64url encoding of the result of BigNumberToB(c)
	C string `json:"c"`

	// base64url encoding of the result of BigNumberToB(sx)
	SX string `json:"sx"`

	// base64url encoding of the result of BigNumberToB(sy)
	SY string `json:"sy"`

	// Name of the Barreto-Naehrig elliptic curve for G1. "BN_P256", "BN_P638", "BN_ISOP256", and "BN_ISOP512" are supported.
	G1Curve string `json:"G1Curve"`
}

// ExtensionDescriptor is a structure representing the ExtensionDescriptor MDS3 dictionary.
// This descriptor contains an extension supported by the authenticator.
//
// See: https://fidoalliance.org/specs/mds/fido-metadata-statement-v3.0-ps-20210518.html#extensiondescriptor-dictionary
type ExtensionDescriptor struct {
	// Identifies the extension.
	ID string `json:"id"`

	// The TAG of the extension if this was assigned. TAGs are assigned to extensions if they could appear in an assertion.
	Tag uint16 `json:"tag"`

	// Contains arbitrary data further describing the extension and/or data needed to correctly process the extension.
	Data string `json:"data"`

	// Indicates whether unknown extensions must be ignored (false) or must lead to an error (true) when the extension is to be processed by the FIDO Server, FIDO Client, ASM, or FIDO Authenticator.
	FailIfUnknown bool `json:"fail_if_unknown"`
}

// Version represents a generic version with major and minor fields.
type Version struct {
	// Major version.
	Major uint16 `json:"major"`

	// Minor version.
	Minor uint16 `json:"minor"`
}

type AuthenticatorGetInfo struct {
	// List of supported versions.
	Versions []string

	// List of supported extensions.
	Extensions []string

	// The claimed AAGUID.
	AaGUID uuid.UUID

	// List of supported options.
	Options map[string]bool

	// Maximum message size supported by the authenticator.
	MaxMsgSize uint

	// List of supported PIN/UV auth protocols in order of decreasing authenticator preference.
	PivUvAuthProtocols []uint

	// Maximum number of credentials supported in credentialID list at a time by the authenticator.
	MaxCredentialCountInList uint

	// Maximum Credential ID Length supported by the authenticator.
	MaxCredentialIdLength uint

	// List of supported transports.
	Transports []string

	// List of supported algorithms for credential generation, as specified in WebAuthn.
	Algorithms []PublicKeyCredentialParameters

	// The maximum size, in bytes, of the serialized large-blob array that this authenticator can store.
	MaxSerializedLargeBlobArray uint

	// If this member is present and set to true, the PIN must be changed.
	ForcePINChange bool

	// This specifies the current minimum PIN length, in Unicode code points, the authenticator enforces for ClientPIN.
	MinPINLength uint

	// Indicates the firmware version of the authenticator model identified by AAGUID.
	FirmwareVersion uint

	// Maximum credBlob length in bytes supported by the authenticator.
	MaxCredBlobLength uint

	// This specifies the max number of RP IDs that authenticator can set via setMinPINLength subcommand.
	MaxRPIDsForSetMinPINLength uint

	// This specifies the preferred number of invocations of the getPinUvAuthTokenUsingUvWithPermissions subCommand the platform may attempt before falling back to the getPinUvAuthTokenUsingPinWithPermissions subCommand or displaying an error.
	PreferredPlatformUvAttempts uint

	// This specifies the user verification modality supported by the authenticator via authenticatorClientPIN's getPinUvAuthTokenUsingUvWithPermissions subcommand.
	UvModality uint

	// This specifies a list of authenticator certifications.
	Certifications map[string]float64

	// If this member is present it indicates the estimated number of additional discoverable credentials that can be stored.
	RemainingDiscoverableCredentials uint

	// If present the authenticator supports the authenticatorConfig vendorPrototype subcommand, and its value is a list of authenticatorConfig vendorCommandId values supported, which MAY be empty.
	VendorPrototypeConfigCommands []uint
}

type AuthenticatorGetInfoJSON struct {
	Versions                         []string                        `json:"versions"`
	Extensions                       []string                        `json:"extensions"`
	AaGUID                           string                          `json:"aaguid"`
	Options                          map[string]bool                 `json:"options"`
	MaxMsgSize                       uint                            `json:"maxMsgSize"`
	PivUvAuthProtocols               []uint                          `json:"pinUvAuthProtocols"`
	MaxCredentialCountInList         uint                            `json:"maxCredentialCountInList"`
	MaxCredentialIdLength            uint                            `json:"maxCredentialIdLength"`
	Transports                       []string                        `json:"transports"`
	Algorithms                       []PublicKeyCredentialParameters `json:"algorithms"`
	MaxSerializedLargeBlobArray      uint                            `json:"maxSerializedLargeBlobArray"`
	ForcePINChange                   bool                            `json:"forcePINChange"`
	MinPINLength                     uint                            `json:"minPINLength"`
	FirmwareVersion                  uint                            `json:"firmwareVersion"`
	MaxCredBlobLength                uint                            `json:"maxCredBlobLength"`
	MaxRPIDsForSetMinPINLength       uint                            `json:"maxRPIDsForSetMinPINLength"`
	PreferredPlatformUvAttempts      uint                            `json:"preferredPlatformUvAttempts"`
	UvModality                       uint                            `json:"uvModality"`
	Certifications                   map[string]float64              `json:"certifications"`
	RemainingDiscoverableCredentials uint                            `json:"remainingDiscoverableCredentials"`
	VendorPrototypeConfigCommands    []uint                          `json:"vendorPrototypeConfigCommands"`
}

func (j AuthenticatorGetInfoJSON) Parse() (info AuthenticatorGetInfo, err error) {
	var aaguid uuid.UUID

	if len(j.AaGUID) != 0 {
		if aaguid, err = uuid.Parse(j.AaGUID); err != nil {
			return info, fmt.Errorf("error occurred parsing AAGUID value: %w", err)
		}
	}

	return AuthenticatorGetInfo{
		Versions:                         j.Versions,
		Extensions:                       j.Extensions,
		AaGUID:                           aaguid,
		Options:                          j.Options,
		MaxMsgSize:                       j.MaxMsgSize,
		PivUvAuthProtocols:               j.PivUvAuthProtocols,
		MaxCredentialCountInList:         j.MaxCredentialCountInList,
		MaxCredentialIdLength:            j.MaxCredentialIdLength,
		Transports:                       j.Transports,
		Algorithms:                       j.Algorithms,
		MaxSerializedLargeBlobArray:      j.MaxSerializedLargeBlobArray,
		ForcePINChange:                   j.ForcePINChange,
		MinPINLength:                     j.MinPINLength,
		FirmwareVersion:                  j.FirmwareVersion,
		MaxCredBlobLength:                j.MaxCredBlobLength,
		MaxRPIDsForSetMinPINLength:       j.MaxRPIDsForSetMinPINLength,
		PreferredPlatformUvAttempts:      j.PreferredPlatformUvAttempts,
		UvModality:                       j.UvModality,
		Certifications:                   j.Certifications,
		RemainingDiscoverableCredentials: j.RemainingDiscoverableCredentials,
		VendorPrototypeConfigCommands:    j.VendorPrototypeConfigCommands,
	}, nil
}

// MDSGetEndpointsRequest is the request sent to the conformance metadata getEndpoints endpoint.
type MDSGetEndpointsRequest struct {
	// The URL of the local server endpoint, e.g. https://webauthn.io/
	Endpoint string `json:"endpoint"`
}

// MDSGetEndpointsResponse is the response received from a conformance metadata getEndpoints request.
type MDSGetEndpointsResponse struct {
	// The status of the response.
	Status string `json:"status"`

	// An array of urls, each pointing to a MetadataTOCPayload.
	Result []string `json:"result"`
}

// DefaultUndesiredAuthenticatorStatuses returns a copy of the defaultUndesiredAuthenticatorStatus slice.
func DefaultUndesiredAuthenticatorStatuses() []AuthenticatorStatus {
	undesired := make([]AuthenticatorStatus, len(defaultUndesiredAuthenticatorStatus))

	copy(undesired, defaultUndesiredAuthenticatorStatus[:])

	return undesired
}

type EntryError struct {
	Error error
	EntryJSON
}
