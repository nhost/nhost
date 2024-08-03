package webauthncose

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"crypto/x509"
	"encoding/asn1"
	"encoding/pem"
	"fmt"
	"hash"
	"math/big"

	"github.com/google/go-tpm/legacy/tpm2"
	"golang.org/x/crypto/ed25519"

	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
)

// PublicKeyData The public key portion of a Relying Party-specific credential key pair, generated
// by an authenticator and returned to a Relying Party at registration time. We unpack this object
// using fxamacker's cbor library ("github.com/fxamacker/cbor/v2") which is why there are cbor tags
// included. The tag field values correspond to the IANA COSE keys that give their respective
// values.
//
// Specification: §6.4.1.1. Examples of credentialPublicKey Values Encoded in COSE_Key Format (https://www.w3.org/TR/webauthn/#sctn-encoded-credPubKey-examples)
type PublicKeyData struct {
	// Decode the results to int by default.
	_struct bool `cbor:",keyasint" json:"public_key"`

	// The type of key created. Should be OKP, EC2, or RSA.
	KeyType int64 `cbor:"1,keyasint" json:"kty"`

	// A COSEAlgorithmIdentifier for the algorithm used to derive the key signature.
	Algorithm int64 `cbor:"3,keyasint" json:"alg"`
}

type EC2PublicKeyData struct {
	PublicKeyData

	// If the key type is EC2, the curve on which we derive the signature from.
	Curve int64 `cbor:"-1,keyasint,omitempty" json:"crv"`

	// A byte string 32 bytes in length that holds the x coordinate of the key.
	XCoord []byte `cbor:"-2,keyasint,omitempty" json:"x"`

	// A byte string 32 bytes in length that holds the y coordinate of the key.
	YCoord []byte `cbor:"-3,keyasint,omitempty" json:"y"`
}

type RSAPublicKeyData struct {
	PublicKeyData

	// Represents the modulus parameter for the RSA algorithm.
	Modulus []byte `cbor:"-1,keyasint,omitempty" json:"n"`

	// Represents the exponent parameter for the RSA algorithm.
	Exponent []byte `cbor:"-2,keyasint,omitempty" json:"e"`
}

type OKPPublicKeyData struct {
	PublicKeyData

	Curve int64

	// A byte string that holds the x coordinate of the key.
	XCoord []byte `cbor:"-2,keyasint,omitempty" json:"x"`
}

// Verify Octet Key Pair (OKP) Public Key Signature.
func (k *OKPPublicKeyData) Verify(data []byte, sig []byte) (bool, error) {
	var key ed25519.PublicKey = make([]byte, ed25519.PublicKeySize)

	copy(key, k.XCoord)

	return ed25519.Verify(key, data, sig), nil
}

// Verify Elliptic Curve Public Key Signature.
func (k *EC2PublicKeyData) Verify(data []byte, sig []byte) (bool, error) {
	var curve elliptic.Curve

	switch COSEAlgorithmIdentifier(k.Algorithm) {
	case AlgES512: // IANA COSE code for ECDSA w/ SHA-512.
		curve = elliptic.P521()
	case AlgES384: // IANA COSE code for ECDSA w/ SHA-384.
		curve = elliptic.P384()
	case AlgES256: // IANA COSE code for ECDSA w/ SHA-256.
		curve = elliptic.P256()
	default:
		return false, ErrUnsupportedAlgorithm
	}

	pubkey := &ecdsa.PublicKey{
		Curve: curve,
		X:     big.NewInt(0).SetBytes(k.XCoord),
		Y:     big.NewInt(0).SetBytes(k.YCoord),
	}

	type ECDSASignature struct {
		R, S *big.Int
	}

	e := &ECDSASignature{}
	f := HasherFromCOSEAlg(COSEAlgorithmIdentifier(k.PublicKeyData.Algorithm))
	h := f()

	h.Write(data)

	_, err := asn1.Unmarshal(sig, e)
	if err != nil {
		return false, ErrSigNotProvidedOrInvalid
	}

	return ecdsa.Verify(pubkey, h.Sum(nil), e.R, e.S), nil
}

// Verify RSA Public Key Signature.
func (k *RSAPublicKeyData) Verify(data []byte, sig []byte) (bool, error) {
	pubkey := &rsa.PublicKey{
		N: big.NewInt(0).SetBytes(k.Modulus),
		E: int(uint(k.Exponent[2]) | uint(k.Exponent[1])<<8 | uint(k.Exponent[0])<<16),
	}

	f := HasherFromCOSEAlg(COSEAlgorithmIdentifier(k.PublicKeyData.Algorithm))
	h := f()
	h.Write(data)

	var hash crypto.Hash

	switch COSEAlgorithmIdentifier(k.PublicKeyData.Algorithm) {
	case AlgRS1:
		hash = crypto.SHA1
	case AlgPS256, AlgRS256:
		hash = crypto.SHA256
	case AlgPS384, AlgRS384:
		hash = crypto.SHA384
	case AlgPS512, AlgRS512:
		hash = crypto.SHA512
	default:
		return false, ErrUnsupportedAlgorithm
	}

	switch COSEAlgorithmIdentifier(k.PublicKeyData.Algorithm) {
	case AlgPS256, AlgPS384, AlgPS512:
		err := rsa.VerifyPSS(pubkey, hash, h.Sum(nil), sig, nil)

		return err == nil, err
	case AlgRS1, AlgRS256, AlgRS384, AlgRS512:
		err := rsa.VerifyPKCS1v15(pubkey, hash, h.Sum(nil), sig)

		return err == nil, err
	default:
		return false, ErrUnsupportedAlgorithm
	}
}

// SigAlgFromCOSEAlg return which signature algorithm is being used from the COSE Key.
func SigAlgFromCOSEAlg(coseAlg COSEAlgorithmIdentifier) SignatureAlgorithm {
	for _, details := range SignatureAlgorithmDetails {
		if details.coseAlg == coseAlg {
			return details.algo
		}
	}

	return UnknownSignatureAlgorithm
}

// HasherFromCOSEAlg returns the Hashing interface to be used for a given COSE Algorithm.
func HasherFromCOSEAlg(coseAlg COSEAlgorithmIdentifier) func() hash.Hash {
	for _, details := range SignatureAlgorithmDetails {
		if details.coseAlg == coseAlg {
			return details.hasher
		}
	}
	// default to SHA256?  Why not.
	return crypto.SHA256.New
}

// ParsePublicKey figures out what kind of COSE material was provided and create the data for the new key.
func ParsePublicKey(keyBytes []byte) (any, error) {
	pk := PublicKeyData{}
	// TODO (james-d-elliott): investigate the ignored errors.
	webauthncbor.Unmarshal(keyBytes, &pk)

	switch COSEKeyType(pk.KeyType) {
	case OctetKey:
		var o OKPPublicKeyData

		webauthncbor.Unmarshal(keyBytes, &o)
		o.PublicKeyData = pk

		return o, nil
	case EllipticKey:
		var e EC2PublicKeyData

		webauthncbor.Unmarshal(keyBytes, &e)
		e.PublicKeyData = pk

		return e, nil
	case RSAKey:
		var r RSAPublicKeyData

		webauthncbor.Unmarshal(keyBytes, &r)
		r.PublicKeyData = pk

		return r, nil
	default:
		return nil, ErrUnsupportedKey
	}
}

// ParseFIDOPublicKey is only used when the appID extension is configured by the assertion response.
func ParseFIDOPublicKey(keyBytes []byte) (data EC2PublicKeyData, err error) {
	x, y := elliptic.Unmarshal(elliptic.P256(), keyBytes)

	if x == nil || y == nil {
		return data, fmt.Errorf("elliptic unmarshall returned a nil value")
	}

	return EC2PublicKeyData{
		PublicKeyData: PublicKeyData{
			Algorithm: int64(AlgES256),
		},
		XCoord: x.Bytes(),
		YCoord: y.Bytes(),
	}, nil
}

// COSEAlgorithmIdentifier is a number identifying a cryptographic algorithm. The algorithm identifiers SHOULD be values
// registered in the IANA COSE Algorithms registry [https://www.w3.org/TR/webauthn/#biblio-iana-cose-algs-reg], for
// instance, -7 for "ES256" and -257 for "RS256".
//
// Specification: §5.8.5. Cryptographic Algorithm Identifier (https://www.w3.org/TR/webauthn/#sctn-alg-identifier)
type COSEAlgorithmIdentifier int

const (
	// AlgES256 ECDSA with SHA-256.
	AlgES256 COSEAlgorithmIdentifier = -7

	// AlgES384 ECDSA with SHA-384.
	AlgES384 COSEAlgorithmIdentifier = -35

	// AlgES512 ECDSA with SHA-512.
	AlgES512 COSEAlgorithmIdentifier = -36

	// AlgRS1 RSASSA-PKCS1-v1_5 with SHA-1.
	AlgRS1 COSEAlgorithmIdentifier = -65535

	// AlgRS256 RSASSA-PKCS1-v1_5 with SHA-256.
	AlgRS256 COSEAlgorithmIdentifier = -257

	// AlgRS384 RSASSA-PKCS1-v1_5 with SHA-384.
	AlgRS384 COSEAlgorithmIdentifier = -258

	// AlgRS512 RSASSA-PKCS1-v1_5 with SHA-512.
	AlgRS512 COSEAlgorithmIdentifier = -259

	// AlgPS256 RSASSA-PSS with SHA-256.
	AlgPS256 COSEAlgorithmIdentifier = -37

	// AlgPS384 RSASSA-PSS with SHA-384.
	AlgPS384 COSEAlgorithmIdentifier = -38

	// AlgPS512 RSASSA-PSS with SHA-512.
	AlgPS512 COSEAlgorithmIdentifier = -39

	// AlgEdDSA EdDSA.
	AlgEdDSA COSEAlgorithmIdentifier = -8

	// AlgES256K is ECDSA using secp256k1 curve and SHA-256.
	AlgES256K COSEAlgorithmIdentifier = -47
)

// COSEKeyType is The Key type derived from the IANA COSE AuthData.
type COSEKeyType int

const (
	// KeyTypeReserved is a reserved value.
	KeyTypeReserved COSEKeyType = iota

	// OctetKey is an Octet Key.
	OctetKey

	// EllipticKey is an Elliptic Curve Public Key.
	EllipticKey

	// RSAKey is an RSA Public Key.
	RSAKey

	// Symmetric Keys.
	Symmetric

	// HSSLMS is the public key for HSS/LMS hash-based digital signature.
	HSSLMS
)

// COSEEllipticCurve is an enumerator that represents the COSE Elliptic Curves.
//
// Specification: https://www.iana.org/assignments/cose/cose.xhtml#elliptic-curves
type COSEEllipticCurve int

const (
	// EllipticCurveReserved is the COSE EC Reserved value.
	EllipticCurveReserved COSEEllipticCurve = iota

	// P256 represents NIST P-256 also known as secp256r1.
	P256

	// P384 represents NIST P-384 also known as secp384r1.
	P384

	// P521 represents NIST P-521 also known as secp521r1.
	P521

	// X25519 for use w/ ECDH only.
	X25519

	// X448 for use w/ ECDH only.
	X448

	// Ed25519 for use w/ EdDSA only.
	Ed25519

	// Ed448 for use w/ EdDSA only.
	Ed448

	// Secp256k1 is the SECG secp256k1 curve.
	Secp256k1
)

func (k *EC2PublicKeyData) TPMCurveID() tpm2.EllipticCurve {
	switch COSEEllipticCurve(k.Curve) {
	case P256:
		return tpm2.CurveNISTP256 // TPM_ECC_NIST_P256.
	case P384:
		return tpm2.CurveNISTP384 // TPM_ECC_NIST_P384.
	case P521:
		return tpm2.CurveNISTP521 // TPM_ECC_NIST_P521.
	default:
		return tpm2.EllipticCurve(0) // TPM_ECC_NONE.
	}
}

func VerifySignature(key any, data []byte, sig []byte) (bool, error) {
	switch k := key.(type) {
	case OKPPublicKeyData:
		return k.Verify(data, sig)
	case EC2PublicKeyData:
		return k.Verify(data, sig)
	case RSAPublicKeyData:
		return k.Verify(data, sig)
	default:
		return false, ErrUnsupportedKey
	}
}

func DisplayPublicKey(cpk []byte) string {
	parsedKey, err := ParsePublicKey(cpk)
	if err != nil {
		return keyCannotDisplay
	}

	switch k := parsedKey.(type) {
	case RSAPublicKeyData:
		rKey := &rsa.PublicKey{
			N: big.NewInt(0).SetBytes(k.Modulus),
			E: int(uint(k.Exponent[2]) | uint(k.Exponent[1])<<8 | uint(k.Exponent[0])<<16),
		}

		data, err := x509.MarshalPKIXPublicKey(rKey)
		if err != nil {
			return keyCannotDisplay
		}

		pemBytes := pem.EncodeToMemory(&pem.Block{
			Type:  "RSA PUBLIC KEY",
			Bytes: data,
		})

		return string(pemBytes)
	case EC2PublicKeyData:
		var curve elliptic.Curve

		switch COSEAlgorithmIdentifier(k.Algorithm) {
		case AlgES256:
			curve = elliptic.P256()
		case AlgES384:
			curve = elliptic.P384()
		case AlgES512:
			curve = elliptic.P521()
		default:
			return keyCannotDisplay
		}

		eKey := &ecdsa.PublicKey{
			Curve: curve,
			X:     big.NewInt(0).SetBytes(k.XCoord),
			Y:     big.NewInt(0).SetBytes(k.YCoord),
		}

		data, err := x509.MarshalPKIXPublicKey(eKey)
		if err != nil {
			return keyCannotDisplay
		}

		pemBytes := pem.EncodeToMemory(&pem.Block{
			Type:  "PUBLIC KEY",
			Bytes: data,
		})

		return string(pemBytes)
	case OKPPublicKeyData:
		if len(k.XCoord) != ed25519.PublicKeySize {
			return keyCannotDisplay
		}

		var oKey ed25519.PublicKey = make([]byte, ed25519.PublicKeySize)

		copy(oKey, k.XCoord)

		data, err := marshalEd25519PublicKey(oKey)
		if err != nil {
			return keyCannotDisplay
		}

		pemBytes := pem.EncodeToMemory(&pem.Block{
			Type:  "PUBLIC KEY",
			Bytes: data,
		})

		return string(pemBytes)

	default:
		return "Cannot display key of this type"
	}
}

// SignatureAlgorithm represents algorithm enumerations used for COSE signatures.
type SignatureAlgorithm int

const (
	UnknownSignatureAlgorithm SignatureAlgorithm = iota
	MD2WithRSA
	MD5WithRSA
	SHA1WithRSA
	SHA256WithRSA
	SHA384WithRSA
	SHA512WithRSA
	DSAWithSHA1
	DSAWithSHA256
	ECDSAWithSHA1
	ECDSAWithSHA256
	ECDSAWithSHA384
	ECDSAWithSHA512
	SHA256WithRSAPSS
	SHA384WithRSAPSS
	SHA512WithRSAPSS
)

var SignatureAlgorithmDetails = []struct {
	algo    SignatureAlgorithm
	coseAlg COSEAlgorithmIdentifier
	name    string
	hasher  func() hash.Hash
}{
	{SHA1WithRSA, AlgRS1, "SHA1-RSA", crypto.SHA1.New},
	{SHA256WithRSA, AlgRS256, "SHA256-RSA", crypto.SHA256.New},
	{SHA384WithRSA, AlgRS384, "SHA384-RSA", crypto.SHA384.New},
	{SHA512WithRSA, AlgRS512, "SHA512-RSA", crypto.SHA512.New},
	{SHA256WithRSAPSS, AlgPS256, "SHA256-RSAPSS", crypto.SHA256.New},
	{SHA384WithRSAPSS, AlgPS384, "SHA384-RSAPSS", crypto.SHA384.New},
	{SHA512WithRSAPSS, AlgPS512, "SHA512-RSAPSS", crypto.SHA512.New},
	{ECDSAWithSHA256, AlgES256, "ECDSA-SHA256", crypto.SHA256.New},
	{ECDSAWithSHA384, AlgES384, "ECDSA-SHA384", crypto.SHA384.New},
	{ECDSAWithSHA512, AlgES512, "ECDSA-SHA512", crypto.SHA512.New},
	{UnknownSignatureAlgorithm, AlgEdDSA, "EdDSA", crypto.SHA512.New},
}

type Error struct {
	// Short name for the type of error that has occurred.
	Type string `json:"type"`
	// Additional details about the error.
	Details string `json:"error"`
	// Information to help debug the error.
	DevInfo string `json:"debug"`
}

var (
	ErrUnsupportedKey = &Error{
		Type:    "invalid_key_type",
		Details: "Unsupported Public Key Type",
	}
	ErrUnsupportedAlgorithm = &Error{
		Type:    "unsupported_key_algorithm",
		Details: "Unsupported public key algorithm",
	}
	ErrSigNotProvidedOrInvalid = &Error{
		Type:    "signature_not_provided_or_invalid",
		Details: "Signature invalid or not provided",
	}
)

func (err *Error) Error() string {
	return err.Details
}

func (passedError *Error) WithDetails(details string) *Error {
	err := *passedError
	err.Details = details

	return &err
}
