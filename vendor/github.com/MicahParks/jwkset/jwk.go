package jwkset

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"slices"
	"time"
)

var (
	// ErrPadding indicates that there is invalid padding.
	ErrPadding = errors.New("padding error")
)

// JWK represents a JSON Web Key.
type JWK struct {
	key     any
	marshal JWKMarshal
	options JWKOptions
}

// JWKMarshalOptions are used to specify options for JSON marshaling a JWK.
type JWKMarshalOptions struct {
	// Private is used to indicate that the JWK's private key material should be JSON marshaled and unmarshalled. This
	// includes symmetric and asymmetric keys. Setting this to true is the only way to marshal and unmarshal symmetric
	// keys.
	Private bool
}

// JWKX509Options holds the X.509 certificate information for a JWK. This data structure is not used for JSON marshaling.
type JWKX509Options struct {
	// X5C contains a chain of one or more PKIX certificates. The PKIX certificate containing the key value MUST be the
	// first certificate.
	X5C []*x509.Certificate // The PKIX certificate containing the key value MUST be the first certificate.

	// X5T is calculated automatically.
	// X5TS256 is calculated automatically.

	// X5U Is a URI that refers to a resource for an X.509 public key certificate or certificate chain.
	X5U string // https://www.rfc-editor.org/rfc/rfc7517#section-4.6
}

// JWKValidateOptions are used to specify options for validating a JWK.
type JWKValidateOptions struct {
	/*
		This package intentionally does not confirm if certificate's usage or compare that to the JWK's use parameter.
		Please open a GitHub issue if you think this should be an option.
	*/
	// CheckX509ValidTime is used to indicate that the X.509 certificate's valid time should be checked.
	CheckX509ValidTime bool
	// GetX5U is used to get and validate the X.509 certificate from the X5U URI. Use DefaultGetX5U for the default
	// behavior.
	GetX5U func(x5u *url.URL) ([]*x509.Certificate, error)
	// SkipAll is used to skip all validation.
	SkipAll bool
	// SkipKeyOps is used to skip validation of the key operations (key_ops).
	SkipKeyOps bool
	// SkipMetadata skips checking if the JWKMetadataOptions match the JWKMarshal.
	SkipMetadata bool
	// SkipUse is used to skip validation of the key use (use).
	SkipUse bool
	// SkipX5UScheme is used to skip checking if the X5U URI scheme is https.
	SkipX5UScheme bool
	// StrictPadding is used to indicate that the JWK should be validated with strict padding.
	StrictPadding bool
}

// JWKMetadataOptions are direct passthroughs into the JWKMarshal.
type JWKMetadataOptions struct {
	// ALG is the algorithm (alg).
	ALG ALG
	// KID is the key ID (kid).
	KID string
	// KEYOPS is the key operations (key_ops).
	KEYOPS []KEYOPS
	// USE is the key use (use).
	USE USE
}

// JWKOptions are used to specify options for marshaling a JSON Web Key.
type JWKOptions struct {
	Marshal  JWKMarshalOptions
	Metadata JWKMetadataOptions
	Validate JWKValidateOptions
	X509     JWKX509Options
}

// NewJWKFromKey uses the given key and options to create a JWK. It is possible to provide a private key with an X.509
// certificate, which will be validated to contain the correct public key.
func NewJWKFromKey(key any, options JWKOptions) (JWK, error) {
	marshal, err := keyMarshal(key, options)
	if err != nil {
		return JWK{}, fmt.Errorf("failed to marshal JSON Web Key: %w", err)
	}
	switch key.(type) {
	case ed25519.PrivateKey, ed25519.PublicKey:
		if options.Metadata.ALG == "" {
			options.Metadata.ALG = AlgEdDSA
		} else if options.Metadata.ALG != AlgEdDSA {
			return JWK{}, fmt.Errorf("%w: invalid ALG for Ed25519 key: %q", ErrOptions, options.Metadata.ALG)
		}
	}
	j := JWK{
		key:     key,
		marshal: marshal,
		options: options,
	}
	err = j.Validate()
	if err != nil {
		return JWK{}, fmt.Errorf("failed to validate JSON Web Key: %w", err)
	}
	return j, nil
}

// NewJWKFromRawJSON uses the given raw JSON to create a JWK.
func NewJWKFromRawJSON(j json.RawMessage, marshalOptions JWKMarshalOptions, validateOptions JWKValidateOptions) (JWK, error) {
	marshal := JWKMarshal{}
	err := json.Unmarshal(j, &marshal)
	if err != nil {
		return JWK{}, fmt.Errorf("failed to unmarshal JSON Web Key: %w", err)
	}
	return NewJWKFromMarshal(marshal, marshalOptions, validateOptions)
}

// NewJWKFromMarshal transforms a JWKMarshal into a JWK.
func NewJWKFromMarshal(marshal JWKMarshal, marshalOptions JWKMarshalOptions, validateOptions JWKValidateOptions) (JWK, error) {
	j, err := keyUnmarshal(marshal, marshalOptions, validateOptions)
	if err != nil {
		return JWK{}, fmt.Errorf("failed to unmarshal JSON Web Key: %w", err)
	}
	err = j.Validate()
	if err != nil {
		return JWK{}, fmt.Errorf("failed to validate JSON Web Key: %w", err)
	}
	return j, nil
}

// NewJWKFromX5C uses the X.509 X5C information in the options to create a JWK.
func NewJWKFromX5C(options JWKOptions) (JWK, error) {
	if len(options.X509.X5C) == 0 {
		return JWK{}, fmt.Errorf("%w: no X.509 certificates provided", ErrOptions)
	}
	cert := options.X509.X5C[0]
	marshal, err := keyMarshal(cert.PublicKey, options)
	if err != nil {
		return JWK{}, fmt.Errorf("failed to marshal JSON Web Key: %w", err)
	}

	if cert.PublicKeyAlgorithm == x509.Ed25519 {
		if options.Metadata.ALG != "" && options.Metadata.ALG != AlgEdDSA {
			return JWK{}, fmt.Errorf("%w: ALG in metadata does not match ALG in X.509 certificate", errors.Join(ErrOptions, ErrX509Mismatch))
		}
		options.Metadata.ALG = AlgEdDSA
	}

	j := JWK{
		key:     options.X509.X5C[0].PublicKey,
		marshal: marshal,
		options: options,
	}
	err = j.Validate()
	if err != nil {
		return JWK{}, fmt.Errorf("failed to validate JSON Web Key: %w", err)
	}
	return j, nil
}

// NewJWKFromX5U uses the X.509 X5U information in the options to create a JWK.
func NewJWKFromX5U(options JWKOptions) (JWK, error) {
	if options.X509.X5U == "" {
		return JWK{}, fmt.Errorf("%w: no X.509 URI provided", ErrOptions)
	}
	u, err := url.ParseRequestURI(options.X509.X5U)
	if err != nil {
		return JWK{}, fmt.Errorf("failed to parse X5U URI: %w", errors.Join(ErrOptions, err))
	}
	if !options.Validate.SkipX5UScheme && u.Scheme != "https" {
		return JWK{}, fmt.Errorf("%w: X5U URI scheme must be https", errors.Join(ErrOptions))
	}
	get := options.Validate.GetX5U
	if get == nil {
		get = DefaultGetX5U
	}
	certs, err := get(u)
	if err != nil {
		return JWK{}, fmt.Errorf("failed to get X5U URI: %w", err)
	}
	options.X509.X5C = certs
	jwk, err := NewJWKFromX5C(options)
	if err != nil {
		return JWK{}, fmt.Errorf("failed to create JWK from fetched X5U assets: %w", err)
	}
	return jwk, nil
}

// Key returns the public or private cryptographic key associated with the JWK.
func (j JWK) Key() any {
	return j.key
}

// Marshal returns Go type that can be marshalled into JSON.
func (j JWK) Marshal() JWKMarshal {
	return j.marshal
}

// X509 returns the X.509 certificate information for the JWK.
func (j JWK) X509() JWKX509Options {
	return j.options.X509
}

// Validate validates the JWK. The JWK is automatically validated when created from a function in this package.
func (j JWK) Validate() error {
	if j.options.Validate.SkipAll {
		return nil
	}
	if !j.marshal.KTY.IANARegistered() {
		return fmt.Errorf("%w: invalid or unsupported key type %q", ErrJWKValidation, j.marshal.KTY)
	}

	if !j.options.Validate.SkipUse && !j.marshal.USE.IANARegistered() {
		return fmt.Errorf("%w: invalid or unsupported key use %q", ErrJWKValidation, j.marshal.USE)
	}

	if !j.options.Validate.SkipKeyOps {
		for _, o := range j.marshal.KEYOPS {
			if !o.IANARegistered() {
				return fmt.Errorf("%w: invalid or unsupported key_opt %q", ErrJWKValidation, o)
			}
		}
	}

	if !j.options.Validate.SkipMetadata {
		if j.marshal.ALG != j.options.Metadata.ALG {
			return fmt.Errorf("%w: ALG in marshal does not match ALG in options", errors.Join(ErrJWKValidation, ErrOptions))
		}
		if j.marshal.KID != j.options.Metadata.KID {
			return fmt.Errorf("%w: KID in marshal does not match KID in options", errors.Join(ErrJWKValidation, ErrOptions))
		}
		if !slices.Equal(j.marshal.KEYOPS, j.options.Metadata.KEYOPS) {
			return fmt.Errorf("%w: KEYOPS in marshal does not match KEYOPS in options", errors.Join(ErrJWKValidation, ErrOptions))
		}
		if j.marshal.USE != j.options.Metadata.USE {
			return fmt.Errorf("%w: USE in marshal does not match USE in options", errors.Join(ErrJWKValidation, ErrOptions))
		}
	}

	if len(j.options.X509.X5C) > 0 {
		cert := j.options.X509.X5C[0]
		i := cert.PublicKey
		switch k := j.key.(type) {
		// ECDH keys are not used to sign certificates.
		case *ecdsa.PublicKey:
			pub, ok := i.(*ecdsa.PublicKey)
			if !ok {
				return fmt.Errorf("%w: Golang key is type *ecdsa.Public but X.509 public key was of type %T", errors.Join(ErrJWKValidation, ErrX509Mismatch), i)
			}
			if !k.Equal(pub) {
				return fmt.Errorf("%w: Golang *ecdsa.PublicKey does not match the X.509 public key", errors.Join(ErrJWKValidation, ErrX509Mismatch))
			}
		case ed25519.PublicKey:
			pub, ok := i.(ed25519.PublicKey)
			if !ok {
				return fmt.Errorf("%w: Golang key is type ed25519.PublicKey but X.509 public key was of type %T", errors.Join(ErrJWKValidation, ErrX509Mismatch), i)
			}
			if !bytes.Equal(k, pub) {
				return fmt.Errorf("%w: Golang ed25519.PublicKey does not match the X.509 public key", errors.Join(ErrJWKValidation, ErrX509Mismatch))
			}
		case *rsa.PublicKey:
			pub, ok := i.(*rsa.PublicKey)
			if !ok {
				return fmt.Errorf("%w: Golang key is type *rsa.PublicKey but X.509 public key was of type %T", errors.Join(ErrJWKValidation, ErrX509Mismatch), i)
			}
			if !k.Equal(pub) {
				return fmt.Errorf("%w: Golang *rsa.PublicKey does not match the X.509 public key", errors.Join(ErrJWKValidation, ErrX509Mismatch))
			}
		default:
			return fmt.Errorf("%w: Golang key is type %T, which is not supported, so it cannot be compared to given X.509 certificates", errors.Join(ErrJWKValidation, ErrUnsupportedKey, ErrX509Mismatch), j.key)
		}
		if cert.PublicKeyAlgorithm == x509.Ed25519 {
			if j.marshal.ALG != AlgEdDSA {
				return fmt.Errorf("%w: ALG in marshal does not match ALG in X.509 certificate", errors.Join(ErrJWKValidation, ErrX509Mismatch))
			}
		}
		if j.options.Validate.CheckX509ValidTime {
			now := time.Now()
			if now.Before(cert.NotBefore) {
				return fmt.Errorf("%w: X.509 certificate is not yet valid", ErrJWKValidation)
			}
			if now.After(cert.NotAfter) {
				return fmt.Errorf("%w: X.509 certificate is expired", ErrJWKValidation)
			}
		}
	}

	marshalled, err := keyMarshal(j.key, j.options)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON Web Key: %w", errors.Join(ErrJWKValidation, err))
	}

	// Remove automatically computed thumbprints if not set in given JWK.
	if j.marshal.X5T == "" {
		marshalled.X5T = ""
	}
	if j.marshal.X5TS256 == "" {
		marshalled.X5TS256 = ""
	}

	canComputeThumbprint := len(j.marshal.X5C) > 0
	if j.marshal.X5T != marshalled.X5T && canComputeThumbprint {
		return fmt.Errorf("%w: X5T in marshal does not match X5T in marshalled", ErrJWKValidation)
	}
	if j.marshal.X5TS256 != marshalled.X5TS256 && canComputeThumbprint {
		return fmt.Errorf("%w: X5TS256 in marshal does not match X5TS256 in marshalled", ErrJWKValidation)
	}
	if j.marshal.CRV != marshalled.CRV {
		return fmt.Errorf("%w: CRV in marshal does not match CRV in marshalled", ErrJWKValidation)
	}
	switch j.marshal.KTY {
	case KtyEC:
		err = cmpBase64Int(j.marshal.X, marshalled.X, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: X in marshal does not match X in marshalled", errors.Join(ErrJWKValidation, err))
		}
		err = cmpBase64Int(j.marshal.Y, marshalled.Y, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: Y in marshal does not match Y in marshalled", errors.Join(ErrJWKValidation, err))
		}
		err = cmpBase64Int(j.marshal.D, marshalled.D, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: D in marshal does not match D in marshalled", errors.Join(ErrJWKValidation, err))
		}
	case KtyOKP:
		if j.marshal.X != marshalled.X {
			return fmt.Errorf("%w: X in marshal does not match X in marshalled", ErrJWKValidation)
		}
		if j.marshal.D != marshalled.D {
			return fmt.Errorf("%w: D in marshal does not match D in marshalled", ErrJWKValidation)
		}
	case KtyRSA:
		err = cmpBase64Int(j.marshal.D, marshalled.D, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: D in marshal does not match D in marshalled", errors.Join(ErrJWKValidation, err))
		}
		err = cmpBase64Int(j.marshal.N, marshalled.N, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: N in marshal does not match N in marshalled", errors.Join(ErrJWKValidation, err))
		}
		err = cmpBase64Int(j.marshal.E, marshalled.E, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: E in marshal does not match E in marshalled", errors.Join(ErrJWKValidation, err))
		}
		err = cmpBase64Int(j.marshal.P, marshalled.P, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: P in marshal does not match P in marshalled", errors.Join(ErrJWKValidation, err))
		}
		err = cmpBase64Int(j.marshal.Q, marshalled.Q, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: Q in marshal does not match Q in marshalled", errors.Join(ErrJWKValidation, err))
		}
		err = cmpBase64Int(j.marshal.DP, marshalled.DP, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: DP in marshal does not match DP in marshalled", errors.Join(ErrJWKValidation, err))
		}
		err = cmpBase64Int(j.marshal.DQ, marshalled.DQ, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: DQ in marshal does not match DQ in marshalled", errors.Join(ErrJWKValidation, err))
		}
		if len(j.marshal.OTH) != len(marshalled.OTH) {
			return fmt.Errorf("%w: OTH in marshal does not match OTH in marshalled", ErrJWKValidation)
		}
		for i, o := range j.marshal.OTH {
			err = cmpBase64Int(o.R, marshalled.OTH[i].R, j.options.Validate.StrictPadding)
			if err != nil {
				return fmt.Errorf("%w: OTH index %d in marshal does not match OTH in marshalled", errors.Join(ErrJWKValidation, err), i)
			}
			err = cmpBase64Int(o.D, marshalled.OTH[i].D, j.options.Validate.StrictPadding)
			if err != nil {
				return fmt.Errorf("%w: OTH index %d in marshal does not match OTH in marshalled", errors.Join(ErrJWKValidation, err), i)
			}
			err = cmpBase64Int(o.T, marshalled.OTH[i].T, j.options.Validate.StrictPadding)
			if err != nil {
				return fmt.Errorf("%w: OTH index %d in marshal does not match OTH in marshalled", errors.Join(ErrJWKValidation, err), i)
			}
		}
	case KtyOct:
		err = cmpBase64Int(j.marshal.K, marshalled.K, j.options.Validate.StrictPadding)
		if err != nil {
			return fmt.Errorf("%w: K in marshal does not match K in marshalled", errors.Join(ErrJWKValidation, err))
		}
	default:
		return fmt.Errorf("%w: invalid or unsupported key type %q", ErrJWKValidation, j.marshal.KTY)
	}

	// Saved for last because it may involve a network request.
	if j.marshal.X5U != "" || j.options.X509.X5U != "" {
		if j.marshal.X5U != j.options.X509.X5U {
			return fmt.Errorf("%w: X5U in marshal does not match X5U in options", errors.Join(ErrJWKValidation, ErrOptions))
		}
		u, err := url.ParseRequestURI(j.marshal.X5U)
		if err != nil {
			return fmt.Errorf("failed to parse X5U URI: %w", errors.Join(ErrJWKValidation, ErrOptions, err))
		}
		if !j.options.Validate.SkipX5UScheme && u.Scheme != "https" {
			return fmt.Errorf("%w: X5U URI scheme must be https", errors.Join(ErrJWKValidation, ErrOptions))
		}
		if j.options.Validate.GetX5U != nil {
			certs, err := j.options.Validate.GetX5U(u)
			if err != nil {
				return fmt.Errorf("failed to get X5U URI: %w", errors.Join(ErrJWKValidation, ErrOptions, err))
			}
			if len(certs) == 0 {
				return fmt.Errorf("%w: X5U URI did not return any certificates", errors.Join(ErrJWKValidation, ErrOptions))
			}
			larger := certs
			smaller := j.options.X509.X5C
			if len(j.options.X509.X5C) > len(certs) {
				larger = j.options.X509.X5C
				smaller = certs
			}
			for i, c := range smaller {
				if !c.Equal(larger[i]) {
					return fmt.Errorf("%w: the X5C and X5U (remote resource) parameters are not a full or partial match", errors.Join(ErrJWKValidation, ErrOptions))
				}
			}
		}
	}

	return nil
}

// DefaultGetX5U is the default implementation of the GetX5U field for JWKValidateOptions.
func DefaultGetX5U(u *url.URL) ([]*x509.Certificate, error) {
	timeout := time.Minute
	ctx, cancel := context.WithTimeoutCause(context.Background(), timeout, fmt.Errorf("%w: timeout of %s reached", ErrGetX5U, timeout.String()))
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create X5U request: %w", errors.Join(ErrGetX5U, err))
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to do X5U request: %w", errors.Join(ErrGetX5U, err))
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: X5U request returned status code %d", ErrGetX5U, resp.StatusCode)
	}
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read X5U response body: %w", errors.Join(ErrGetX5U, err))
	}
	certs, err := LoadCertificates(b)
	if err != nil {
		return nil, fmt.Errorf("failed to parse X5U response body: %w", errors.Join(ErrGetX5U, err))
	}
	return certs, nil
}

func cmpBase64Int(first, second string, strictPadding bool) error {
	if first == second {
		return nil
	}
	b, err := base64.RawURLEncoding.DecodeString(first)
	if err != nil {
		return fmt.Errorf("failed to decode Base64 raw URL decode first string: %w", err)
	}
	fLen := len(b)
	f := new(big.Int).SetBytes(b)
	b, err = base64.RawURLEncoding.DecodeString(second)
	if err != nil {
		return fmt.Errorf("failed to decode Base64 raw URL decode second string: %w", err)
	}
	sLen := len(b)
	s := new(big.Int).SetBytes(b)
	if f.Cmp(s) != 0 {
		return fmt.Errorf("%w: the parsed integers do not match", ErrJWKValidation)
	}
	if strictPadding && fLen != sLen {
		return fmt.Errorf("%w: the Base64 raw URL inputs do not have matching padding", errors.Join(ErrJWKValidation, ErrPadding))
	}
	return nil
}
