package metadata

import (
	"crypto/x509"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"reflect"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/mitchellh/mapstructure"

	"github.com/go-webauthn/x/revoke"

	"github.com/go-webauthn/webauthn/protocol/webauthncose"
)

type PublicKeyCredentialParameters struct {
	Type string                               `json:"type"`
	Alg  webauthncose.COSEAlgorithmIdentifier `json:"alg"`
}

const (
	// https://secure.globalsign.com/cacert/root-r3.crt
	ProductionMDSRoot = "MIIDXzCCAkegAwIBAgILBAAAAAABIVhTCKIwDQYJKoZIhvcNAQELBQAwTDEgMB4GA1UECxMXR2xvYmFsU2lnbiBSb290IENBIC0gUjMxEzARBgNVBAoTCkdsb2JhbFNpZ24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMDkwMzE4MTAwMDAwWhcNMjkwMzE4MTAwMDAwWjBMMSAwHgYDVQQLExdHbG9iYWxTaWduIFJvb3QgQ0EgLSBSMzETMBEGA1UEChMKR2xvYmFsU2lnbjETMBEGA1UEAxMKR2xvYmFsU2lnbjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMwldpB5BngiFvXAg7aEyiie/QV2EcWtiHL8RgJDx7KKnQRfJMsuS+FggkbhUqsMgUdwbN1k0ev1LKMPgj0MK66X17YUhhB5uzsTgHeMCOFJ0mpiLx9e+pZo34knlTifBtc+ycsmWQ1z3rDI6SYOgxXG71uL0gRgykmmKPZpO/bLyCiR5Z2KYVc3rHQU3HTgOu5yLy6c+9C7v/U9AOEGM+iCK65TpjoWc4zdQQ4gOsC0p6Hpsk+QLjJg6VfLuQSSaGjlOCZgdbKfd/+RFO+uIEn8rUAVSNECMWEZXriX7613t2Saer9fwRPvm2L7DWzgVGkWqQPabumDk3F2xmmFghcCAwEAAaNCMEAwDgYDVR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFI/wS3+oLkUkrk1Q+mOai97i3Ru8MA0GCSqGSIb3DQEBCwUAA4IBAQBLQNvAUKr+yAzv95ZURUm7lgAJQayzE4aGKAczymvmdLm6AC2upArT9fHxD4q/c2dKg8dEe3jgr25sbwMpjjM5RcOO5LlXbKr8EpbsU8Yt5CRsuZRj+9xTaGdWPoO4zzUhw8lo/s7awlOqzJCK6fBdRoyV3XpYKBovHd7NADdBj+1EbddTKJd+82cEHhXXipa0095MJ6RMG3NzdvQXmcIfeg7jLQitChws/zyrVQ4PkX4268NXSb7hLi18YIvDQVETI53O9zJrlAGomecsMx86OyXShkDOOyyGeMlhLxS67ttVb9+E7gUJTb0o2HLO02JQZR7rkpeDMdmztcpHWD9f"
	// Production MDS URL
	ProductionMDSURL = "https://mds.fidoalliance.org"
	// https://mds3.fido.tools/pki/MDS3ROOT.crt
	ConformanceMDSRoot = "MIICaDCCAe6gAwIBAgIPBCqih0DiJLW7+UHXx/o1MAoGCCqGSM49BAMDMGcxCzAJBgNVBAYTAlVTMRYwFAYDVQQKDA1GSURPIEFsbGlhbmNlMScwJQYDVQQLDB5GQUtFIE1ldGFkYXRhIDMgQkxPQiBST09UIEZBS0UxFzAVBgNVBAMMDkZBS0UgUm9vdCBGQUtFMB4XDTE3MDIwMTAwMDAwMFoXDTQ1MDEzMTIzNTk1OVowZzELMAkGA1UEBhMCVVMxFjAUBgNVBAoMDUZJRE8gQWxsaWFuY2UxJzAlBgNVBAsMHkZBS0UgTWV0YWRhdGEgMyBCTE9CIFJPT1QgRkFLRTEXMBUGA1UEAwwORkFLRSBSb290IEZBS0UwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAASKYiz3YltC6+lmxhPKwA1WFZlIqnX8yL5RybSLTKFAPEQeTD9O6mOz+tg8wcSdnVxHzwnXiQKJwhrav70rKc2ierQi/4QUrdsPes8TEirZOkCVJurpDFbXZOgs++pa4XmjYDBeMAsGA1UdDwQEAwIBBjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBQGcfeCs0Y8D+lh6U5B2xSrR74eHTAfBgNVHSMEGDAWgBQGcfeCs0Y8D+lh6U5B2xSrR74eHTAKBggqhkjOPQQDAwNoADBlAjEA/xFsgri0xubSa3y3v5ormpPqCwfqn9s0MLBAtzCIgxQ/zkzPKctkiwoPtDzI51KnAjAmeMygX2S5Ht8+e+EQnezLJBJXtnkRWY+Zt491wgt/AwSs5PHHMv5QgjELOuMxQBc="
	// Example from https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html
	ExampleMDSRoot = "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"
)

// Metadata is a map of authenticator AAGUIDs to corresponding metadata statements
var Metadata = make(map[uuid.UUID]MetadataBLOBPayloadEntry)

// Conformance indicates if test metadata is currently being used
var Conformance = false

var MDSRoot = ProductionMDSRoot

// MetadataBLOBPayloadEntry - Represents the MetadataBLOBPayloadEntry
// https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#metadata-blob-payload-entry-dictionary
type MetadataBLOBPayloadEntry struct {
	// The Authenticator Attestation ID.
	Aaid string `json:"aaid"`
	// The Authenticator Attestation GUID.
	AaGUID string `json:"aaguid"`
	// A list of the attestation certificate public key identifiers encoded as hex string.
	AttestationCertificateKeyIdentifiers []string `json:"attestationCertificateKeyIdentifiers"`
	// The metadataStatement JSON object as defined in FIDOMetadataStatement.
	MetadataStatement MetadataStatement `json:"metadataStatement"`
	// Status of the FIDO Biometric Certification of one or more biometric components of the Authenticator
	BiometricStatusReports []BiometricStatusReport `json:"biometricStatusReports"`
	// An array of status reports applicable to this authenticator.
	StatusReports []StatusReport `json:"statusReports"`
	// ISO-8601 formatted date since when the status report array was set to the current value.
	TimeOfLastStatusChange string `json:"timeOfLastStatusChange"`
	// URL of a list of rogue (i.e. untrusted) individual authenticators.
	RogueListURL string `json:"rogueListURL"`
	// The hash value computed over the Base64url encoding of the UTF-8 representation of the JSON encoded rogueList available at rogueListURL (with type rogueListEntry[]).
	RogueListHash string `json:"rogueListHash"`
}

// https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#biometricstatusreport-dictionary
// BiometricStatusReport - Contains the current BiometricStatusReport of one of the authenticator's biometric component.
type BiometricStatusReport struct {
	// Achieved level of the biometric certification of this biometric component of the authenticator
	CertLevel uint16 `json:"certLevel"`
	// A single USER_VERIFY constant indicating the modality of the biometric component
	Modality string `json:"modality"`
	// ISO-8601 formatted date since when the certLevel achieved, if applicable. If no date is given, the status is assumed to be effective while present.
	EffectiveDate string `json:"effectiveDate"`
	// Describes the externally visible aspects of the Biometric Certification evaluation.
	CertificationDescriptor string `json:"certificationDescriptor"`
	// The unique identifier for the issued Biometric Certification.
	CertificateNumber string `json:"certificateNumber"`
	// The version of the Biometric Certification Policy the implementation is Certified to, e.g. "1.0.0".
	CertificationPolicyVersion string `json:"certificationPolicyVersion"`
	// The version of the Biometric Requirements [FIDOBiometricsRequirements] the implementation is certified to, e.g. "1.0.0".
	CertificationRequirementsVersion string `json:"certificationRequirementsVersion"`
}

// StatusReport - Contains the current BiometricStatusReport of one of the authenticator's biometric component.
// https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#statusreport-dictionary
type StatusReport struct {
	// Status of the authenticator. Additional fields MAY be set depending on this value.
	Status AuthenticatorStatus `json:"status"`
	// ISO-8601 formatted date since when the status code was set, if applicable. If no date is given, the status is assumed to be effective while present.
	EffectiveDate string `json:"effectiveDate"`
	// The authenticatorVersion that this status report relates to. In the case of FIDO_CERTIFIED* status values, the status applies to higher authenticatorVersions until there is a new statusReport.
	AuthenticatorVersion uint32 `json:"authenticatorVersion"`
	// Base64-encoded [RFC4648] (not base64url!) DER [ITU-X690-2008] PKIX certificate value related to the current status, if applicable.
	Certificate string `json:"certificate"`
	// HTTPS URL where additional information may be found related to the current status, if applicable.
	URL string `json:"url"`
	// Describes the externally visible aspects of the Authenticator Certification evaluation.
	CertificationDescriptor string `json:"certificationDescriptor"`
	// The unique identifier for the issued Certification.
	CertificateNumber string `json:"certificateNumber"`
	// The version of the Authenticator Certification Policy the implementation is Certified to, e.g. "1.0.0".
	CertificationPolicyVersion string `json:"certificationPolicyVersion"`
	// The Document Version of the Authenticator Security Requirements (DV) [FIDOAuthenticatorSecurityRequirements] the implementation is certified to, e.g. "1.2.0".
	CertificationRequirementsVersion string `json:"certificationRequirementsVersion"`
}

// AuthenticatorAttestationType - The ATTESTATION constants are 16 bit long integers indicating the specific attestation that authenticator supports.
// Each constant has a case-sensitive string representation (in quotes), which is used in the authoritative metadata for FIDO authenticators.
type AuthenticatorAttestationType string

const (
	// BasicFull - Indicates full basic attestation, based on an attestation private key shared among a class of authenticators (e.g. same model). Authenticators must provide its attestation signature during the registration process for the same reason. The attestation trust anchor is shared with FIDO Servers out of band (as part of the Metadata). This sharing process should be done according to [UAFMetadataService].
	BasicFull AuthenticatorAttestationType = "basic_full"
	// BasicSurrogate - Just syntactically a Basic Attestation. The attestation object self-signed, i.e. it is signed using the UAuth.priv key, i.e. the key corresponding to the UAuth.pub key included in the attestation object. As a consequence it does not provide a cryptographic proof of the security characteristics. But it is the best thing we can do if the authenticator is not able to have an attestation private key.
	BasicSurrogate AuthenticatorAttestationType = "basic_surrogate"
	// Ecdaa - Indicates use of elliptic curve based direct anonymous attestation as defined in [FIDOEcdaaAlgorithm]. Support for this attestation type is optional at this time. It might be required by FIDO Certification.
	Ecdaa AuthenticatorAttestationType = "ecdaa"
	// AttCA - Indicates PrivacyCA attestation as defined in [TCG-CMCProfile-AIKCertEnroll]. Support for this attestation type is optional at this time. It might be required by FIDO Certification.
	AttCA AuthenticatorAttestationType = "attca"
	// AnonCA In this case, the authenticator uses an Anonymization CA which dynamically generates per-credential attestation certificates such that the attestation statements presented to Relying Parties do not provide uniquely identifiable information, e.g., that might be used for tracking purposes. The applicable [WebAuthn] attestation formats "fmt" are Google SafetyNet Attestation "android-safetynet", Android Keystore Attestation "android-key", Apple Anonymous Attestation "apple", and Apple Application Attestation "apple-appattest".
	AnonCA AuthenticatorAttestationType = "anonca"
	// None - Indicates absence of attestation
	None AuthenticatorAttestationType = "none"
)

// AuthenticatorStatus - This enumeration describes the status of an authenticator model as identified by its AAID and potentially some additional information (such as a specific attestation key).
// https://fidoalliance.org/specs/mds/fido-metadata-service-v3.0-ps-20210518.html#authenticatorstatus-enum
type AuthenticatorStatus string

const (
	// NotFidoCertified - This authenticator is not FIDO certified.
	NotFidoCertified AuthenticatorStatus = "NOT_FIDO_CERTIFIED"
	// FidoCertified - This authenticator has passed FIDO functional certification. This certification scheme is phased out and will be replaced by FIDO_CERTIFIED_L1.
	FidoCertified AuthenticatorStatus = "FIDO_CERTIFIED"
	// UserVerificationBypass - Indicates that malware is able to bypass the user verification. This means that the authenticator could be used without the user's consent and potentially even without the user's knowledge.
	UserVerificationBypass AuthenticatorStatus = "USER_VERIFICATION_BYPASS"
	// AttestationKeyCompromise - Indicates that an attestation key for this authenticator is known to be compromised. Additional data should be supplied, including the key identifier and the date of compromise, if known.
	AttestationKeyCompromise AuthenticatorStatus = "ATTESTATION_KEY_COMPROMISE"
	// UserKeyRemoteCompromise - This authenticator has identified weaknesses that allow registered keys to be compromised and should not be trusted. This would include both, e.g. weak entropy that causes predictable keys to be generated or side channels that allow keys or signatures to be forged, guessed or extracted.
	UserKeyRemoteCompromise AuthenticatorStatus = "USER_KEY_REMOTE_COMPROMISE"
	// UserKeyPhysicalCompromise - This authenticator has known weaknesses in its key protection mechanism(s) that allow user keys to be extracted by an adversary in physical possession of the device.
	UserKeyPhysicalCompromise AuthenticatorStatus = "USER_KEY_PHYSICAL_COMPROMISE"
	// UpdateAvailable - A software or firmware update is available for the device. Additional data should be supplied including a URL where users can obtain an update and the date the update was published.
	UpdateAvailable AuthenticatorStatus = "UPDATE_AVAILABLE"
	// Revoked - The FIDO Alliance has determined that this authenticator should not be trusted for any reason, for example if it is known to be a fraudulent product or contain a deliberate backdoor.
	Revoked AuthenticatorStatus = "REVOKED"
	// SelfAssertionSubmitted - The authenticator vendor has completed and submitted the self-certification checklist to the FIDO Alliance. If this completed checklist is publicly available, the URL will be specified in StatusReport.url.
	SelfAssertionSubmitted AuthenticatorStatus = "SELF_ASSERTION_SUBMITTED"
	// FidoCertifiedL1 - The authenticator has passed FIDO Authenticator certification at level 1. This level is the more strict successor of FIDO_CERTIFIED.
	FidoCertifiedL1 AuthenticatorStatus = "FIDO_CERTIFIED_L1"
	// FidoCertifiedL1plus - The authenticator has passed FIDO Authenticator certification at level 1+. This level is the more than level 1.
	FidoCertifiedL1plus AuthenticatorStatus = "FIDO_CERTIFIED_L1plus"
	// FidoCertifiedL2 - The authenticator has passed FIDO Authenticator certification at level 2. This level is more strict than level 1+.
	FidoCertifiedL2 AuthenticatorStatus = "FIDO_CERTIFIED_L2"
	// FidoCertifiedL2plus - The authenticator has passed FIDO Authenticator certification at level 2+. This level is more strict than level 2.
	FidoCertifiedL2plus AuthenticatorStatus = "FIDO_CERTIFIED_L2plus"
	// FidoCertifiedL3 - The authenticator has passed FIDO Authenticator certification at level 3. This level is more strict than level 2+.
	FidoCertifiedL3 AuthenticatorStatus = "FIDO_CERTIFIED_L3"
	// FidoCertifiedL3plus - The authenticator has passed FIDO Authenticator certification at level 3+. This level is more strict than level 3.
	FidoCertifiedL3plus AuthenticatorStatus = "FIDO_CERTIFIED_L3plus"
)

// UndesiredAuthenticatorStatus is an array of undesirable authenticator statuses
var UndesiredAuthenticatorStatus = [...]AuthenticatorStatus{
	AttestationKeyCompromise,
	UserVerificationBypass,
	UserKeyRemoteCompromise,
	UserKeyPhysicalCompromise,
	Revoked,
}

// IsUndesiredAuthenticatorStatus returns whether the supplied authenticator status is desirable or not
func IsUndesiredAuthenticatorStatus(status AuthenticatorStatus) bool {
	for _, s := range UndesiredAuthenticatorStatus {
		if s == status {
			return true
		}
	}

	return false
}

// RogueListEntry - Contains a list of individual authenticators known to be rogue
type RogueListEntry struct {
	// Base64url encoding of the rogue authenticator's secret key
	Sk string `json:"sk"`
	// ISO-8601 formatted date since when this entry is effective.
	Date string `json:"date"`
}

// MetadataBLOBPayload - Represents the MetadataBLOBPayload
type MetadataBLOBPayload struct {
	// The legalHeader, if present, contains a legal guide for accessing and using metadata, which itself MAY contain URL(s) pointing to further information, such as a full Terms and Conditions statement.
	LegalHeader string `json:"legalHeader"`
	// The serial number of this UAF Metadata TOC Payload. Serial numbers MUST be consecutive and strictly monotonic, i.e. the successor TOC will have a no value exactly incremented by one.
	Number int `json:"no"`
	// ISO-8601 formatted date when the next update will be provided at latest.
	NextUpdate string `json:"nextUpdate"`
	// List of zero or more MetadataTOCPayloadEntry objects.
	Entries []MetadataBLOBPayloadEntry `json:"entries"`
}

// CodeAccuracyDescriptor describes the relevant accuracy/complexity aspects of passcode user verification methods.
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

// The BiometricAccuracyDescriptor describes relevant accuracy/complexity aspects in the case of a biometric user verification method.
type BiometricAccuracyDescriptor struct {
	// The false rejection rate [ISO19795-1] for a single template, i.e. the percentage of verification transactions with truthful claims of identity that are incorrectly denied.
	SelfAttestedFRR int64 `json:"selfAttestedFRR "`
	// The false acceptance rate [ISO19795-1] for a single template, i.e. the percentage of verification transactions with wrongful claims of identity that are incorrectly confirmed.
	SelfAttestedFAR int64 `json:"selfAttestedFAR "`
	// Maximum number of alternative templates from different fingers allowed.
	MaxTemplates uint16 `json:"maxTemplates"`
	// Maximum number of false attempts before the authenticator will block this method (at least for some time). 0 means it will never block.
	MaxRetries uint16 `json:"maxRetries"`
	// Enforced minimum number of seconds wait time after blocking (e.g. due to forced reboot or similar).
	// 0 means that this user verification method will be blocked either permanently or until an alternative user verification method succeeded.
	// All alternative user verification methods MUST be specified appropriately in the metadata in userVerificationDetails.
	BlockSlowdown uint16 `json:"blockSlowdown"`
}

// The PatternAccuracyDescriptor describes relevant accuracy/complexity aspects in the case that a pattern is used as the user verification method.
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

// VerificationMethodDescriptor - A descriptor for a specific base user verification method as implemented by the authenticator.
type VerificationMethodDescriptor struct {
	// a single USER_VERIFY constant (see [FIDORegistry]), not a bit flag combination. This value MUST be non-zero.
	UserVerificationMethod string `json:"userVerification"`
	// May optionally be used in the case of method USER_VERIFY_PASSCODE.
	CaDesc CodeAccuracyDescriptor `json:"caDesc"`
	// May optionally be used in the case of method USER_VERIFY_FINGERPRINT, USER_VERIFY_VOICEPRINT, USER_VERIFY_FACEPRINT, USER_VERIFY_EYEPRINT, or USER_VERIFY_HANDPRINT.
	BaDesc BiometricAccuracyDescriptor `json:"baDesc"`
	// May optionally be used in case of method USER_VERIFY_PATTERN.
	PaDesc PatternAccuracyDescriptor `json:"paDesc"`
}

// The rgbPaletteEntry is an RGB three-sample tuple palette entry
type rgbPaletteEntry struct {
	// Red channel sample value
	R uint16 `json:"r"`
	// Green channel sample value
	G uint16 `json:"g"`
	// Blue channel sample value
	B uint16 `json:"b"`
}

// The DisplayPNGCharacteristicsDescriptor describes a PNG image characteristics as defined in the PNG [PNG] spec for IHDR (image header) and PLTE (palette table)
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
	Plte []rgbPaletteEntry `json:"plte"`
}

// EcdaaTrustAnchor - In the case of ECDAA attestation, the ECDAA-Issuer's trust anchor MUST be specified in this field.
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

// ExtensionDescriptor - This descriptor contains an extension supported by the authenticator.
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

// MetadataStatement - Authenticator metadata statements are used directly by the FIDO server at a relying party, but the information contained in the authoritative statement is used in several other places.
type MetadataStatement struct {
	// The legalHeader, if present, contains a legal guide for accessing and using metadata, which itself MAY contain URL(s) pointing to further information, such as a full Terms and Conditions statement.
	LegalHeader string `json:"legalHeader"`
	// The Authenticator Attestation ID.
	Aaid string `json:"aaid"`
	// The Authenticator Attestation GUID.
	AaGUID string `json:"aaguid"`
	// A list of the attestation certificate public key identifiers encoded as hex string.
	AttestationCertificateKeyIdentifiers []string `json:"attestationCertificateKeyIdentifiers"`
	// A human-readable, short description of the authenticator, in English.
	Description string `json:"description"`
	// A list of human-readable short descriptions of the authenticator in different languages.
	AlternativeDescriptions map[string]string `json:"alternativeDescriptions"`
	// Earliest (i.e. lowest) trustworthy authenticatorVersion meeting the requirements specified in this metadata statement.
	AuthenticatorVersion uint32 `json:"authenticatorVersion"`
	// The FIDO protocol family. The values "uaf", "u2f", and "fido2" are supported.
	ProtocolFamily string `json:"protocolFamily"`
	// The FIDO unified protocol version(s) (related to the specific protocol family) supported by this authenticator.
	Upv []Version `json:"upv"`
	// The list of authentication algorithms supported by the authenticator.
	AuthenticationAlgorithms []AuthenticationAlgorithm `json:"authenticationAlgorithms"`
	// The list of public key formats supported by the authenticator during registration operations.
	PublicKeyAlgAndEncodings []PublicKeyAlgAndEncoding `json:"publicKeyAlgAndEncodings"`
	// The supported attestation type(s).
	AttestationTypes []AuthenticatorAttestationType `json:"attestationTypes"`
	// A list of alternative VerificationMethodANDCombinations.
	UserVerificationDetails [][]VerificationMethodDescriptor `json:"userVerificationDetails"`
	// A 16-bit number representing the bit fields defined by the KEY_PROTECTION constants in the FIDO Registry of Predefined Values
	KeyProtection []string `json:"keyProtection"`
	// This entry is set to true or it is omitted, if the Uauth private key is restricted by the authenticator to only sign valid FIDO signature assertions.
	// This entry is set to false, if the authenticator doesn't restrict the Uauth key to only sign valid FIDO signature assertions.
	IsKeyRestricted bool `json:"isKeyRestricted"`
	// This entry is set to true or it is omitted, if Uauth key usage always requires a fresh user verification
	// This entry is set to false, if the Uauth key can be used without requiring a fresh user verification, e.g. without any additional user interaction, if the user was verified a (potentially configurable) caching time ago.
	IsFreshUserVerificationRequired bool `json:"isFreshUserVerificationRequired"`
	// A 16-bit number representing the bit fields defined by the MATCHER_PROTECTION constants in the FIDO Registry of Predefined Values
	MatcherProtection []string `json:"matcherProtection"`
	// The authenticator's overall claimed cryptographic strength in bits (sometimes also called security strength or security level).
	CryptoStrength uint16 `json:"cryptoStrength"`
	// A 32-bit number representing the bit fields defined by the ATTACHMENT_HINT constants in the FIDO Registry of Predefined Values
	AttachmentHint []string `json:"attachmentHint"`
	// A 16-bit number representing a combination of the bit flags defined by the TRANSACTION_CONFIRMATION_DISPLAY constants in the FIDO Registry of Predefined Values
	TcDisplay []string `json:"tcDisplay"`
	// Supported MIME content type [RFC2049] for the transaction confirmation display, such as text/plain or image/png.
	TcDisplayContentType string `json:"tcDisplayContentType"`
	// A list of alternative DisplayPNGCharacteristicsDescriptor. Each of these entries is one alternative of supported image characteristics for displaying a PNG image.
	TcDisplayPNGCharacteristics []DisplayPNGCharacteristicsDescriptor `json:"tcDisplayPNGCharacteristics"`
	// Each element of this array represents a PKIX [RFC5280] X.509 certificate that is a valid trust anchor for this authenticator model.
	// Multiple certificates might be used for different batches of the same model.
	// The array does not represent a certificate chain, but only the trust anchor of that chain.
	// A trust anchor can be a root certificate, an intermediate CA certificate or even the attestation certificate itself.
	AttestationRootCertificates []string `json:"attestationRootCertificates"`
	// A list of trust anchors used for ECDAA attestation. This entry MUST be present if and only if attestationType includes ATTESTATION_ECDAA.
	EcdaaTrustAnchors []EcdaaTrustAnchor `json:"ecdaaTrustAnchors"`
	// A data: url [RFC2397] encoded PNG [PNG] icon for the Authenticator.
	Icon string `json:"icon"`
	// List of extensions supported by the authenticator.
	SupportedExtensions []ExtensionDescriptor `json:"supportedExtensions"`
	// Describes supported versions, extensions, AAGUID of the device and its capabilities
	AuthenticatorGetInfo AuthenticatorGetInfo `json:"authenticatorGetInfo"`
}

type AuthenticationAlgorithm string

const (
	// An ECDSA signature on the NIST secp256r1 curve which must have raw R and S buffers, encoded in big-endian order.
	ALG_SIGN_SECP256R1_ECDSA_SHA256_RAW AuthenticationAlgorithm = "secp256r1_ecdsa_sha256_raw"
	// DER ITU-X690-2008 encoded ECDSA signature RFC5480 on the NIST secp256r1 curve.
	ALG_SIGN_SECP256R1_ECDSA_SHA256_DER AuthenticationAlgorithm = "secp256r1_ecdsa_sha256_der"
	// RSASSA-PSS RFC3447 signature must have raw S buffers, encoded in big-endian order RFC4055 RFC4056.
	ALG_SIGN_RSASSA_PSS_SHA256_RAW AuthenticationAlgorithm = "rsassa_pss_sha256_raw"
	// DER ITU-X690-2008 encoded OCTET STRING (not BIT STRING!) containing the RSASSA-PSS RFC3447 signature RFC4055 RFC4056.
	ALG_SIGN_RSASSA_PSS_SHA256_DER AuthenticationAlgorithm = "rsassa_pss_sha256_der"
	// An ECDSA signature on the secp256k1 curve which must have raw R and S buffers, encoded in big-endian order.
	ALG_SIGN_SECP256K1_ECDSA_SHA256_RAW AuthenticationAlgorithm = "secp256k1_ecdsa_sha256_raw"
	// DER ITU-X690-2008 encoded ECDSA signature RFC5480 on the secp256k1 curve.
	ALG_SIGN_SECP256K1_ECDSA_SHA256_DER AuthenticationAlgorithm = "secp256k1_ecdsa_sha256_der"
	// Chinese SM2 elliptic curve based signature algorithm combined with SM3 hash algorithm OSCCA-SM2 OSCCA-SM3.
	ALG_SIGN_SM2_SM3_RAW AuthenticationAlgorithm = "sm2_sm3_raw"
	// This is the EMSA-PKCS1-v1_5 signature as defined in RFC3447.
	ALG_SIGN_RSA_EMSA_PKCS1_SHA256_RAW AuthenticationAlgorithm = "rsa_emsa_pkcs1_sha256_raw"
	// DER ITU-X690-2008 encoded OCTET STRING (not BIT STRING!) containing the EMSA-PKCS1-v1_5 signature as defined in RFC3447.
	ALG_SIGN_RSA_EMSA_PKCS1_SHA256_DER AuthenticationAlgorithm = "rsa_emsa_pkcs1_sha256_der"
	// RSASSA-PSS RFC3447 signature must have raw S buffers, encoded in big-endian order RFC4055 RFC4056.
	ALG_SIGN_RSASSA_PSS_SHA384_RAW AuthenticationAlgorithm = "rsassa_pss_sha384_raw"
	// RSASSA-PSS RFC3447 signature must have raw S buffers, encoded in big-endian order RFC4055 RFC4056.
	ALG_SIGN_RSASSA_PSS_SHA512_RAW AuthenticationAlgorithm = "rsassa_pss_sha512_raw"
	// RSASSA-PKCS1-v1_5 RFC3447 with SHA256(aka RS256) signature must have raw S buffers, encoded in big-endian order RFC8017 RFC4056
	ALG_SIGN_RSASSA_PKCSV15_SHA256_RAW AuthenticationAlgorithm = "rsassa_pkcsv15_sha256_raw"
	// RSASSA-PKCS1-v1_5 RFC3447 with SHA384(aka RS384) signature must have raw S buffers, encoded in big-endian order RFC8017 RFC4056
	ALG_SIGN_RSASSA_PKCSV15_SHA384_RAW AuthenticationAlgorithm = "rsassa_pkcsv15_sha384_raw"
	// RSASSA-PKCS1-v1_5 RFC3447 with SHA512(aka RS512) signature must have raw S buffers, encoded in big-endian order RFC8017 RFC4056
	ALG_SIGN_RSASSA_PKCSV15_SHA512_RAW AuthenticationAlgorithm = "rsassa_pkcsv15_sha512_raw"
	// RSASSA-PKCS1-v1_5 RFC3447 with SHA1(aka RS1) signature must have raw S buffers, encoded in big-endian order RFC8017 RFC4056
	ALG_SIGN_RSASSA_PKCSV15_SHA1_RAW AuthenticationAlgorithm = "rsassa_pkcsv15_sha1_raw"
	// An ECDSA signature on the NIST secp384r1 curve with SHA384(aka: ES384) which must have raw R and S buffers, encoded in big-endian order.
	ALG_SIGN_SECP384R1_ECDSA_SHA384_RAW AuthenticationAlgorithm = "secp384r1_ecdsa_sha384_raw"
	// An ECDSA signature on the NIST secp512r1 curve with SHA512(aka: ES512) which must have raw R and S buffers, encoded in big-endian order.
	ALG_SIGN_SECP521R1_ECDSA_SHA512_RAW AuthenticationAlgorithm = "secp521r1_ecdsa_sha512_raw"
	// An EdDSA signature on the curve 25519, which must have raw R and S buffers, encoded in big-endian order.
	ALG_SIGN_ED25519_EDDSA_SHA512_RAW AuthenticationAlgorithm = "ed25519_eddsa_sha512_raw"
	// An EdDSA signature on the curve Ed448, which must have raw R and S buffers, encoded in big-endian order.
	ALG_SIGN_ED448_EDDSA_SHA512_RAW AuthenticationAlgorithm = "ed448_eddsa_sha512_raw"
)

// TODO: this goes away after webauthncose.CredentialPublicKey gets implemented
type algKeyCose struct {
	KeyType   webauthncose.COSEKeyType
	Algorithm webauthncose.COSEAlgorithmIdentifier
	Curve     webauthncose.COSEEllipticCurve
}

func algKeyCoseDictionary() func(AuthenticationAlgorithm) algKeyCose {
	mapping := map[AuthenticationAlgorithm]algKeyCose{
		ALG_SIGN_SECP256R1_ECDSA_SHA256_RAW: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES256, Curve: webauthncose.P256},
		ALG_SIGN_SECP256R1_ECDSA_SHA256_DER: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES256, Curve: webauthncose.P256},
		ALG_SIGN_RSASSA_PSS_SHA256_RAW:      {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgPS256},
		ALG_SIGN_RSASSA_PSS_SHA256_DER:      {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgPS256},
		ALG_SIGN_SECP256K1_ECDSA_SHA256_RAW: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES256K, Curve: webauthncose.Secp256k1},
		ALG_SIGN_SECP256K1_ECDSA_SHA256_DER: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES256K, Curve: webauthncose.Secp256k1},
		ALG_SIGN_RSASSA_PSS_SHA384_RAW:      {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgPS384},
		ALG_SIGN_RSASSA_PSS_SHA512_RAW:      {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgPS512},
		ALG_SIGN_RSASSA_PKCSV15_SHA256_RAW:  {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgRS256},
		ALG_SIGN_RSASSA_PKCSV15_SHA384_RAW:  {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgRS384},
		ALG_SIGN_RSASSA_PKCSV15_SHA512_RAW:  {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgRS512},
		ALG_SIGN_RSASSA_PKCSV15_SHA1_RAW:    {KeyType: webauthncose.RSAKey, Algorithm: webauthncose.AlgRS1},
		ALG_SIGN_SECP384R1_ECDSA_SHA384_RAW: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES384, Curve: webauthncose.P384},
		ALG_SIGN_SECP521R1_ECDSA_SHA512_RAW: {KeyType: webauthncose.EllipticKey, Algorithm: webauthncose.AlgES512, Curve: webauthncose.P521},
		ALG_SIGN_ED25519_EDDSA_SHA512_RAW:   {KeyType: webauthncose.OctetKey, Algorithm: webauthncose.AlgEdDSA, Curve: webauthncose.Ed25519},
		ALG_SIGN_ED448_EDDSA_SHA512_RAW:     {KeyType: webauthncose.OctetKey, Algorithm: webauthncose.AlgEdDSA, Curve: webauthncose.Ed448},
	}

	return func(key AuthenticationAlgorithm) algKeyCose {
		return mapping[key]
	}
}

func AlgKeyMatch(key algKeyCose, algs []AuthenticationAlgorithm) bool {
	for _, alg := range algs {
		if reflect.DeepEqual(algKeyCoseDictionary()(alg), key) {
			return true
		}
	}

	return false
}

type PublicKeyAlgAndEncoding string

const (
	// Raw ANSI X9.62 formatted Elliptic Curve public key.
	ALG_KEY_ECC_X962_RAW PublicKeyAlgAndEncoding = "ecc_x962_raw"
	// DER ITU-X690-2008 encoded ANSI X.9.62 formatted SubjectPublicKeyInfo RFC5480 specifying an elliptic curve public key.
	ALG_KEY_ECC_X962_DER PublicKeyAlgAndEncoding = "ecc_x962_der"
	// Raw encoded 2048-bit RSA public key RFC3447.
	ALG_KEY_RSA_2048_RAW PublicKeyAlgAndEncoding = "rsa_2048_raw"
	// ASN.1 DER [ITU-X690-2008] encoded 2048-bit RSA RFC3447 public key RFC4055.
	ALG_KEY_RSA_2048_DER PublicKeyAlgAndEncoding = "rsa_2048_der"
	// COSE_Key format, as defined in Section 7 of RFC8152. This encoding includes its own field for indicating the public key algorithm.
	ALG_KEY_COSE PublicKeyAlgAndEncoding = "cose"
)

// Version - Represents a generic version with major and minor fields.
type Version struct {
	// Major version.
	Major uint16 `json:"major"`
	// Minor version.
	Minor uint16 `json:"minor"`
}

type AuthenticatorGetInfo struct {
	// List of supported versions.
	Versions []string `json:"versions"`
	// List of supported extensions.
	Extensions []string `json:"extensions"`
	// The claimed AAGUID.
	AaGUID string `json:"aaguid"`
	// List of supported options.
	Options map[string]bool `json:"options"`
	// Maximum message size supported by the authenticator.
	MaxMsgSize uint `json:"maxMsgSize"`
	// List of supported PIN/UV auth protocols in order of decreasing authenticator preference.
	PivUvAuthProtocols []uint `json:"pinUvAuthProtocols"`
	// Maximum number of credentials supported in credentialID list at a time by the authenticator.
	MaxCredentialCountInList uint `json:"maxCredentialCountInList"`
	// Maximum Credential ID Length supported by the authenticator.
	MaxCredentialIdLength uint `json:"maxCredentialLength"`
	// List of supported transports.
	Transports []string `json:"transports"`
	// List of supported algorithms for credential generation, as specified in WebAuthn.
	Algorithms []PublicKeyCredentialParameters `json:"algorithms"`
	// The maximum size, in bytes, of the serialized large-blob array that this authenticator can store.
	MaxSerializedLargeBlobArray uint `json:"maxSerializedLargeBlobArray"`
	// If this member is present and set to true, the PIN must be changed.
	ForcePINChange bool `json:"forcePINChange"`
	// This specifies the current minimum PIN length, in Unicode code points, the authenticator enforces for ClientPIN.
	MinPINLength uint `json:"minPINLength"`
	// Indicates the firmware version of the authenticator model identified by AAGUID.
	FirmwareVersion uint `json:"firmwareVersion"`
	// Maximum credBlob length in bytes supported by the authenticator.
	MaxCredBlobLength uint `json:"maxCredBlobLength"`
	// This specifies the max number of RP IDs that authenticator can set via setMinPINLength subcommand.
	MaxRPIDsForSetMinPINLength uint `json:"maxRPIDsForSetMinPINLength"`
	// This specifies the preferred number of invocations of the getPinUvAuthTokenUsingUvWithPermissions subCommand the platform may attempt before falling back to the getPinUvAuthTokenUsingPinWithPermissions subCommand or displaying an error.
	PreferredPlatformUvAttempts uint `json:"preferredPlatformUvAttempts"`
	// This specifies the user verification modality supported by the authenticator via authenticatorClientPIN's getPinUvAuthTokenUsingUvWithPermissions subcommand.
	UvModality uint `json:"uvModality"`
	// This specifies a list of authenticator certifications.
	Certifications map[string]float64 `json:"certifications"`
	// If this member is present it indicates the estimated number of additional discoverable credentials that can be stored.
	RemainingDiscoverableCredentials uint `json:"remainingDiscoverableCredentials"`
	// If present the authenticator supports the authenticatorConfig vendorPrototype subcommand, and its value is a list of authenticatorConfig vendorCommandId values supported, which MAY be empty.
	VendorPrototypeConfigCommands []uint `json:"vendorPrototypeConfigCommands"`
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

func unmarshalMDSBLOB(body []byte, c http.Client) (MetadataBLOBPayload, error) {
	var payload MetadataBLOBPayload

	token, err := jwt.Parse(string(body), func(token *jwt.Token) (interface{}, error) {
		// 2. If the x5u attribute is present in the JWT Header, then
		if _, ok := token.Header["x5u"].([]interface{}); ok {
			// never seen an x5u here, although it is in the spec
			return nil, errors.New("x5u encountered in header of metadata TOC payload")
		}
		var chain []interface{}
		// 3. If the x5u attribute is missing, the chain should be retrieved from the x5c attribute.

		if x5c, ok := token.Header["x5c"].([]interface{}); !ok {
			// If that attribute is missing as well, Metadata TOC signing trust anchor is considered the TOC signing certificate chain.
			chain[0] = MDSRoot
		} else {
			chain = x5c
		}

		// The certificate chain MUST be verified to properly chain to the metadata TOC signing trust anchor.
		valid, err := validateChain(chain, c)
		if !valid || err != nil {
			return nil, err
		}

		// Chain validated, extract the TOC signing certificate from the chain. Create a buffer large enough to hold the
		// certificate bytes.
		o := make([]byte, base64.StdEncoding.DecodedLen(len(chain[0].(string))))

		// base64 decode the certificate into the buffer.
		n, err := base64.StdEncoding.Decode(o, []byte(chain[0].(string)))
		if err != nil {
			return nil, err
		}

		// Parse the certificate from the buffer.
		cert, err := x509.ParseCertificate(o[:n])
		if err != nil {
			return nil, err
		}

		// 4. Verify the signature of the Metadata TOC object using the TOC signing certificate chain
		// jwt.Parse() uses the TOC signing certificate public key internally to verify the signature.
		return cert.PublicKey, err
	})

	if err != nil {
		return payload, err
	}

	err = mapstructure.Decode(token.Claims, &payload)

	return payload, err
}

func validateChain(chain []interface{}, c http.Client) (bool, error) {
	oRoot := make([]byte, base64.StdEncoding.DecodedLen(len(MDSRoot)))

	nRoot, err := base64.StdEncoding.Decode(oRoot, []byte(MDSRoot))
	if err != nil {
		return false, err
	}

	rootcert, err := x509.ParseCertificate(oRoot[:nRoot])
	if err != nil {
		return false, err
	}

	roots := x509.NewCertPool()

	roots.AddCert(rootcert)

	o := make([]byte, base64.StdEncoding.DecodedLen(len(chain[1].(string))))

	n, err := base64.StdEncoding.Decode(o, []byte(chain[1].(string)))
	if err != nil {
		return false, err
	}

	intcert, err := x509.ParseCertificate(o[:n])
	if err != nil {
		return false, err
	}

	if revoked, ok := revoke.VerifyCertificate(intcert); !ok {
		issuer := intcert.IssuingCertificateURL

		if issuer != nil {
			return false, errCRLUnavailable
		}
	} else if revoked {
		return false, errIntermediateCertRevoked
	}

	ints := x509.NewCertPool()
	ints.AddCert(intcert)

	l := make([]byte, base64.StdEncoding.DecodedLen(len(chain[0].(string))))

	n, err = base64.StdEncoding.Decode(l, []byte(chain[0].(string)))
	if err != nil {
		return false, err
	}

	leafcert, err := x509.ParseCertificate(l[:n])
	if err != nil {
		return false, err
	}

	if revoked, ok := revoke.VerifyCertificate(leafcert); !ok {
		return false, errCRLUnavailable
	} else if revoked {
		return false, errLeafCertRevoked
	}

	opts := x509.VerifyOptions{
		Roots:         roots,
		Intermediates: ints,
	}

	_, err = leafcert.Verify(opts)

	return err == nil, err
}

type MetadataError struct {
	// Short name for the type of error that has occurred.
	Type string `json:"type"`
	// Additional details about the error.
	Details string `json:"error"`
	// Information to help debug the error.
	DevInfo string `json:"debug"`
}

var (
	errIntermediateCertRevoked = &MetadataError{
		Type:    "intermediate_revoked",
		Details: "Intermediate certificate is on issuers revocation list",
	}
	errLeafCertRevoked = &MetadataError{
		Type:    "leaf_revoked",
		Details: "Leaf certificate is on issuers revocation list",
	}
	errCRLUnavailable = &MetadataError{
		Type:    "crl_unavailable",
		Details: "Certificate revocation list is unavailable",
	}
)

func (err *MetadataError) Error() string {
	return err.Details
}

func PopulateMetadata(url string) error {
	c := &http.Client{
		Timeout: time.Second * 30,
	}

	res, err := c.Get(url)
	if err != nil {
		return err
	}

	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}

	blob, err := unmarshalMDSBLOB(body, *c)
	if err != nil {
		return err
	}

	for _, entry := range blob.Entries {
		aaguid, _ := uuid.Parse(entry.AaGUID)
		Metadata[aaguid] = entry
	}

	return err
}
