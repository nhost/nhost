package jwkset

import (
	"context"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"math"
	"math/big"
	"slices"
	"strings"
)

var (
	// ErrGetX5U indicates there was an error getting the X5U remote resource.
	ErrGetX5U = errors.New("failed to get X5U via given URI")
	// ErrJWKValidation indicates that a JWK failed to validate.
	ErrJWKValidation = errors.New("failed to validate JWK")
	// ErrKeyUnmarshalParameter indicates that a JWK's attributes are invalid and cannot be unmarshaled.
	ErrKeyUnmarshalParameter = errors.New("unable to unmarshal JWK due to invalid attributes")
	// ErrOptions indicates that the given options caused an error.
	ErrOptions = errors.New("the given options caused an error")
	// ErrUnsupportedKey indicates a key is not supported.
	ErrUnsupportedKey = errors.New("unsupported key")
	// ErrX509Mismatch indicates that the X.509 certificate does not match the key.
	ErrX509Mismatch = errors.New("the X.509 certificate does not match Golang key type")
)

// OtherPrimes is for RSA private keys that have more than 2 primes.
// https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.7
type OtherPrimes struct {
	R string `json:"r,omitempty"` // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.7.1
	D string `json:"d,omitempty"` // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.7.2
	T string `json:"t,omitempty"` // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.7.3
}

// JWKMarshal is used to marshal or unmarshal a JSON Web Key.
// https://www.rfc-editor.org/rfc/rfc7517
// https://www.rfc-editor.org/rfc/rfc7518
// https://www.rfc-editor.org/rfc/rfc8037
//
// You can find the full list at https://www.iana.org/assignments/jose/jose.xhtml under "JSON Web Key Parameters".
type JWKMarshal struct {
	KTY     KTY           `json:"kty,omitempty"`      // https://www.rfc-editor.org/rfc/rfc7517#section-4.1
	USE     USE           `json:"use,omitempty"`      // https://www.rfc-editor.org/rfc/rfc7517#section-4.2
	KEYOPS  []KEYOPS      `json:"key_ops,omitempty"`  // https://www.rfc-editor.org/rfc/rfc7517#section-4.3
	ALG     ALG           `json:"alg,omitempty"`      // https://www.rfc-editor.org/rfc/rfc7517#section-4.4 and https://www.rfc-editor.org/rfc/rfc7518#section-4.1
	KID     string        `json:"kid,omitempty"`      // https://www.rfc-editor.org/rfc/rfc7517#section-4.5
	X5U     string        `json:"x5u,omitempty"`      // https://www.rfc-editor.org/rfc/rfc7517#section-4.6
	X5C     []string      `json:"x5c,omitempty"`      // https://www.rfc-editor.org/rfc/rfc7517#section-4.7
	X5T     string        `json:"x5t,omitempty"`      // https://www.rfc-editor.org/rfc/rfc7517#section-4.8
	X5TS256 string        `json:"x5t#S256,omitempty"` // https://www.rfc-editor.org/rfc/rfc7517#section-4.9
	CRV     CRV           `json:"crv,omitempty"`      // https://www.rfc-editor.org/rfc/rfc7518#section-6.2.1.1 and https://www.rfc-editor.org/rfc/rfc8037.html#section-2
	X       string        `json:"x,omitempty"`        // https://www.rfc-editor.org/rfc/rfc7518#section-6.2.1.2 and https://www.rfc-editor.org/rfc/rfc8037.html#section-2
	Y       string        `json:"y,omitempty"`        // https://www.rfc-editor.org/rfc/rfc7518#section-6.2.1.3
	D       string        `json:"d,omitempty"`        // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.1 and https://www.rfc-editor.org/rfc/rfc7518#section-6.2.2.1 and https://www.rfc-editor.org/rfc/rfc8037.html#section-2
	N       string        `json:"n,omitempty"`        // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.1.1
	E       string        `json:"e,omitempty"`        // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.1.2
	P       string        `json:"p,omitempty"`        // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.2
	Q       string        `json:"q,omitempty"`        // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.3
	DP      string        `json:"dp,omitempty"`       // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.4
	DQ      string        `json:"dq,omitempty"`       // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.5
	QI      string        `json:"qi,omitempty"`       // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.6
	OTH     []OtherPrimes `json:"oth,omitempty"`      // https://www.rfc-editor.org/rfc/rfc7518#section-6.3.2.7
	K       string        `json:"k,omitempty"`        // https://www.rfc-editor.org/rfc/rfc7518#section-6.4.1
}

// JWKSMarshal is used to marshal or unmarshal a JSON Web Key Set.
type JWKSMarshal struct {
	Keys []JWKMarshal `json:"keys"`
}

// JWKSlice converts the JWKSMarshal to a []JWK.
func (j JWKSMarshal) JWKSlice() ([]JWK, error) {
	slice := make([]JWK, len(j.Keys))
	for i, key := range j.Keys {
		marshalOptions := JWKMarshalOptions{
			Private: true,
		}
		jwk, err := keyUnmarshal(key, marshalOptions, JWKValidateOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal JWK: %w", err)
		}
		slice[i] = jwk
	}
	return slice, nil
}

// ToStorage converts the JWKSMarshal to a Storage.
func (j JWKSMarshal) ToStorage() (Storage, error) {
	m := NewMemoryStorage()
	jwks, err := j.JWKSlice()
	if err != nil {
		return nil, fmt.Errorf("failed to create a slice of JWK from JWKSMarshal: %w", err)
	}
	for _, jwk := range jwks {
		err = m.KeyWrite(context.Background(), jwk)
		if err != nil {
			return nil, fmt.Errorf("failed to write JWK to storage: %w", err)
		}
	}
	return m, nil
}

func keyMarshal(key any, options JWKOptions) (JWKMarshal, error) {
	m := JWKMarshal{}
	m.ALG = options.Metadata.ALG
	switch key := key.(type) {
	case *ecdh.PublicKey:
		pub := key.Bytes()
		m.CRV = CrvX25519
		m.X = base64.RawURLEncoding.EncodeToString(pub)
		m.KTY = KtyOKP
	case *ecdh.PrivateKey:
		pub := key.PublicKey().Bytes()
		m.CRV = CrvX25519
		m.X = base64.RawURLEncoding.EncodeToString(pub)
		m.KTY = KtyOKP
		if options.Marshal.Private {
			priv := key.Bytes()
			m.D = base64.RawURLEncoding.EncodeToString(priv)
		}
	case *ecdsa.PrivateKey:
		pub := key.PublicKey
		m.CRV = CRV(pub.Curve.Params().Name)
		l := uint(pub.Curve.Params().BitSize / 8)
		if pub.Curve.Params().BitSize%8 != 0 {
			l++
		}
		m.X = bigIntToBase64RawURL(pub.X, l)
		m.Y = bigIntToBase64RawURL(pub.Y, l)
		m.KTY = KtyEC
		if options.Marshal.Private {
			params := key.Curve.Params()
			f, _ := params.N.Float64()
			l = uint(math.Ceil(math.Log2(f) / 8))
			m.D = bigIntToBase64RawURL(key.D, l)
		}
	case *ecdsa.PublicKey:
		l := uint(key.Curve.Params().BitSize / 8)
		if key.Curve.Params().BitSize%8 != 0 {
			l++
		}
		m.CRV = CRV(key.Curve.Params().Name)
		m.X = bigIntToBase64RawURL(key.X, l)
		m.Y = bigIntToBase64RawURL(key.Y, l)
		m.KTY = KtyEC
	case ed25519.PrivateKey:
		pub := key.Public().(ed25519.PublicKey)
		m.ALG = AlgEdDSA
		m.CRV = CrvEd25519
		m.X = base64.RawURLEncoding.EncodeToString(pub)
		m.KTY = KtyOKP
		if options.Marshal.Private {
			m.D = base64.RawURLEncoding.EncodeToString(key[:32])
		}
	case ed25519.PublicKey:
		m.ALG = AlgEdDSA
		m.CRV = CrvEd25519
		m.X = base64.RawURLEncoding.EncodeToString(key)
		m.KTY = KtyOKP
	case *rsa.PrivateKey:
		pub := key.PublicKey
		m.E = bigIntToBase64RawURL(big.NewInt(int64(pub.E)), 0)
		m.N = bigIntToBase64RawURL(pub.N, 0)
		m.KTY = KtyRSA
		if options.Marshal.Private {
			m.D = bigIntToBase64RawURL(key.D, 0)
			m.P = bigIntToBase64RawURL(key.Primes[0], 0)
			m.Q = bigIntToBase64RawURL(key.Primes[1], 0)
			m.DP = bigIntToBase64RawURL(key.Precomputed.Dp, 0)
			m.DQ = bigIntToBase64RawURL(key.Precomputed.Dq, 0)
			m.QI = bigIntToBase64RawURL(key.Precomputed.Qinv, 0)
			if len(key.Precomputed.CRTValues) > 0 {
				m.OTH = make([]OtherPrimes, len(key.Precomputed.CRTValues))
				for i := 0; i < len(key.Precomputed.CRTValues); i++ {
					m.OTH[i] = OtherPrimes{
						D: bigIntToBase64RawURL(key.Precomputed.CRTValues[i].Exp, 0),
						T: bigIntToBase64RawURL(key.Precomputed.CRTValues[i].Coeff, 0),
						R: bigIntToBase64RawURL(key.Primes[i+2], 0),
					}
				}
			}
		}
	case *rsa.PublicKey:
		m.E = bigIntToBase64RawURL(big.NewInt(int64(key.E)), 0)
		m.N = bigIntToBase64RawURL(key.N, 0)
		m.KTY = KtyRSA
	case []byte:
		if options.Marshal.Private {
			m.KTY = KtyOct
			m.K = base64.RawURLEncoding.EncodeToString(key)
		} else {
			return JWKMarshal{}, fmt.Errorf("%w: incorrect options to marshal symmetric key (oct)", ErrOptions)
		}
	default:
		return JWKMarshal{}, fmt.Errorf("%w: %T", ErrUnsupportedKey, key)
	}
	haveX5C := len(options.X509.X5C) > 0
	if haveX5C {
		for i, cert := range options.X509.X5C {
			m.X5C = append(m.X5C, base64.StdEncoding.EncodeToString(cert.Raw))
			if i == 0 {
				h1 := sha1.Sum(cert.Raw)
				m.X5T = base64.RawURLEncoding.EncodeToString(h1[:])
				h256 := sha256.Sum256(cert.Raw)
				m.X5TS256 = base64.RawURLEncoding.EncodeToString(h256[:])
			}
		}
	}
	m.KID = options.Metadata.KID
	m.KEYOPS = options.Metadata.KEYOPS
	m.USE = options.Metadata.USE
	m.X5U = options.X509.X5U
	return m, nil
}

func keyUnmarshal(marshal JWKMarshal, options JWKMarshalOptions, validateOptions JWKValidateOptions) (JWK, error) {
	marshalCopy := JWKMarshal{}
	var key any
	switch marshal.KTY {
	case KtyEC:
		if marshal.CRV == "" || marshal.X == "" || marshal.Y == "" {
			return JWK{}, fmt.Errorf(`%w: %s requires parameters "crv", "x", and "y"`, ErrKeyUnmarshalParameter, KtyEC)
		}
		x, err := base64urlTrailingPadding(marshal.X)
		if err != nil {
			return JWK{}, fmt.Errorf(`failed to decode %s key parameter "x": %w`, KtyEC, err)
		}
		y, err := base64urlTrailingPadding(marshal.Y)
		if err != nil {
			return JWK{}, fmt.Errorf(`failed to decode %s key parameter "y": %w`, KtyEC, err)
		}
		publicKey := &ecdsa.PublicKey{
			X: new(big.Int).SetBytes(x),
			Y: new(big.Int).SetBytes(y),
		}
		switch marshal.CRV {
		case CrvP256:
			publicKey.Curve = elliptic.P256()
		case CrvP384:
			publicKey.Curve = elliptic.P384()
		case CrvP521:
			publicKey.Curve = elliptic.P521()
		default:
			return JWK{}, fmt.Errorf("%w: unsupported curve type %q", ErrKeyUnmarshalParameter, marshal.CRV)
		}
		marshalCopy.CRV = marshal.CRV
		marshalCopy.X = marshal.X
		marshalCopy.Y = marshal.Y
		if options.Private && marshal.D != "" {
			d, err := base64urlTrailingPadding(marshal.D)
			if err != nil {
				return JWK{}, fmt.Errorf(`failed to decode %s key parameter "d": %w`, KtyEC, err)
			}
			privateKey := &ecdsa.PrivateKey{
				PublicKey: *publicKey,
				D:         new(big.Int).SetBytes(d),
			}
			key = privateKey
			marshalCopy.D = marshal.D
		} else {
			key = publicKey
		}
	case KtyOKP:
		if marshal.CRV == "" || marshal.X == "" {
			return JWK{}, fmt.Errorf(`%w: %s requires parameters "crv" and "x"`, ErrKeyUnmarshalParameter, KtyOKP)
		}
		public, err := base64urlTrailingPadding(marshal.X)
		if err != nil {
			return JWK{}, fmt.Errorf(`failed to decode %s key parameter "x": %w`, KtyOKP, err)
		}
		marshalCopy.CRV = marshal.CRV
		marshalCopy.X = marshal.X
		var private []byte
		if options.Private && marshal.D != "" {
			private, err = base64urlTrailingPadding(marshal.D)
			if err != nil {
				return JWK{}, fmt.Errorf(`failed to decode %s key parameter "d": %w`, KtyOKP, err)
			}
		}
		switch marshal.CRV {
		case CrvEd25519:
			if len(public) != ed25519.PublicKeySize {
				return JWK{}, fmt.Errorf("%w: %s key should be %d bytes", ErrKeyUnmarshalParameter, KtyOKP, ed25519.PublicKeySize)
			}
			if options.Private && marshal.D != "" {
				private = append(private, public...)
				if len(private) != ed25519.PrivateKeySize {
					return JWK{}, fmt.Errorf("%w: %s key should be %d bytes", ErrKeyUnmarshalParameter, KtyOKP, ed25519.PrivateKeySize)
				}
				key = ed25519.PrivateKey(private)
				marshalCopy.D = marshal.D
			} else {
				key = ed25519.PublicKey(public)
			}
		case CrvX25519:
			const x25519PublicKeySize = 32
			if len(public) != x25519PublicKeySize {
				return JWK{}, fmt.Errorf("%w: %s with curve %s public key should be %d bytes", ErrKeyUnmarshalParameter, KtyOKP, CrvEd25519, x25519PublicKeySize)
			}
			if options.Private && marshal.D != "" {
				const x25519PrivateKeySize = 32
				if len(private) != x25519PrivateKeySize {
					return JWK{}, fmt.Errorf("%w: %s with curve %s private key should be %d bytes", ErrKeyUnmarshalParameter, KtyOKP, CrvEd25519, x25519PrivateKeySize)
				}
				key, err = ecdh.X25519().NewPrivateKey(private)
				if err != nil {
					return JWK{}, fmt.Errorf("failed to create X25519 private key: %w", err)
				}
				marshalCopy.D = marshal.D
			} else {
				key, err = ecdh.X25519().NewPublicKey(public)
				if err != nil {
					return JWK{}, fmt.Errorf("failed to create X25519 public key: %w", err)
				}
			}
		default:
			return JWK{}, fmt.Errorf("%w: unsupported curve type %q", ErrKeyUnmarshalParameter, marshal.CRV)
		}
	case KtyRSA:
		if marshal.N == "" || marshal.E == "" {
			return JWK{}, fmt.Errorf(`%w: %s requires parameters "n" and "e"`, ErrKeyUnmarshalParameter, KtyRSA)
		}
		n, err := base64urlTrailingPadding(marshal.N)
		if err != nil {
			return JWK{}, fmt.Errorf(`failed to decode %s key parameter "n": %w`, KtyRSA, err)
		}
		e, err := base64urlTrailingPadding(marshal.E)
		if err != nil {
			return JWK{}, fmt.Errorf(`failed to decode %s key parameter "e": %w`, KtyRSA, err)
		}
		publicKey := rsa.PublicKey{
			N: new(big.Int).SetBytes(n),
			E: int(new(big.Int).SetBytes(e).Uint64()),
		}
		marshalCopy.N = marshal.N
		marshalCopy.E = marshal.E
		if options.Private && marshal.D != "" && marshal.P != "" && marshal.Q != "" && marshal.DP != "" && marshal.DQ != "" && marshal.QI != "" { // TODO Only "d" is required, but if one of the others is present, they all must be.
			d, err := base64urlTrailingPadding(marshal.D)
			if err != nil {
				return JWK{}, fmt.Errorf(`failed to decode %s key parameter "d": %w`, KtyRSA, err)
			}
			p, err := base64urlTrailingPadding(marshal.P)
			if err != nil {
				return JWK{}, fmt.Errorf(`failed to decode %s key parameter "p": %w`, KtyRSA, err)
			}
			q, err := base64urlTrailingPadding(marshal.Q)
			if err != nil {
				return JWK{}, fmt.Errorf(`failed to decode %s key parameter "q": %w`, KtyRSA, err)
			}
			dp, err := base64urlTrailingPadding(marshal.DP)
			if err != nil {
				return JWK{}, fmt.Errorf(`failed to decode %s key parameter "dp": %w`, KtyRSA, err)
			}
			dq, err := base64urlTrailingPadding(marshal.DQ)
			if err != nil {
				return JWK{}, fmt.Errorf(`failed to decode %s key parameter "dq": %w`, KtyRSA, err)
			}
			qi, err := base64urlTrailingPadding(marshal.QI)
			if err != nil {
				return JWK{}, fmt.Errorf(`failed to decode %s key parameter "qi": %w`, KtyRSA, err)
			}
			var oth []rsa.CRTValue
			primes := []*big.Int{
				new(big.Int).SetBytes(p),
				new(big.Int).SetBytes(q),
			}
			if len(marshal.OTH) > 0 {
				oth = make([]rsa.CRTValue, len(marshal.OTH))
				for i, otherPrimes := range marshal.OTH {
					if otherPrimes.R == "" || otherPrimes.D == "" || otherPrimes.T == "" {
						return JWK{}, fmt.Errorf(`%w: %s requires parameters "r", "d", and "t" for each "oth"`, ErrKeyUnmarshalParameter, KtyRSA)
					}
					othD, err := base64urlTrailingPadding(otherPrimes.D)
					if err != nil {
						return JWK{}, fmt.Errorf(`failed to decode %s key parameter "d": %w`, KtyRSA, err)
					}
					othT, err := base64urlTrailingPadding(otherPrimes.T)
					if err != nil {
						return JWK{}, fmt.Errorf(`failed to decode %s key parameter "t": %w`, KtyRSA, err)
					}
					othR, err := base64urlTrailingPadding(otherPrimes.R)
					if err != nil {
						return JWK{}, fmt.Errorf(`failed to decode %s key parameter "r": %w`, KtyRSA, err)
					}
					primes = append(primes, new(big.Int).SetBytes(othR))
					oth[i] = rsa.CRTValue{
						Exp:   new(big.Int).SetBytes(othD),
						Coeff: new(big.Int).SetBytes(othT),
						R:     new(big.Int).SetBytes(othR),
					}
				}
			}
			privateKey := &rsa.PrivateKey{
				PublicKey: publicKey,
				D:         new(big.Int).SetBytes(d),
				Primes:    primes,
				Precomputed: rsa.PrecomputedValues{
					Dp:        new(big.Int).SetBytes(dp),
					Dq:        new(big.Int).SetBytes(dq),
					Qinv:      new(big.Int).SetBytes(qi),
					CRTValues: oth,
				},
			}
			err = privateKey.Validate()
			if err != nil {
				return JWK{}, fmt.Errorf(`failed to validate %s key: %w`, KtyRSA, err)
			}
			key = privateKey
			marshalCopy.D = marshal.D
			marshalCopy.P = marshal.P
			marshalCopy.Q = marshal.Q
			marshalCopy.DP = marshal.DP
			marshalCopy.DQ = marshal.DQ
			marshalCopy.QI = marshal.QI
			marshalCopy.OTH = slices.Clone(marshal.OTH)
		} else {
			key = &publicKey
		}
	case KtyOct:
		if options.Private {
			if marshal.K == "" {
				return JWK{}, fmt.Errorf(`%w: %s requires parameter "k"`, ErrKeyUnmarshalParameter, KtyOct)
			}
			k, err := base64urlTrailingPadding(marshal.K)
			if err != nil {
				return JWK{}, fmt.Errorf(`failed to decode %s key parameter "k": %w`, KtyOct, err)
			}
			key = k
			marshalCopy.K = marshal.K
		} else {
			return JWK{}, fmt.Errorf("%w: incorrect options to unmarshal symmetric key (%s)", ErrOptions, KtyOct)
		}
	default:
		return JWK{}, fmt.Errorf("%w: %s (kty)", ErrUnsupportedKey, marshal.KTY)
	}
	marshalCopy.KTY = marshal.KTY
	x5c := make([]*x509.Certificate, len(marshal.X5C))
	for i, cert := range marshal.X5C {
		raw, err := base64.StdEncoding.DecodeString(cert)
		if err != nil {
			return JWK{}, fmt.Errorf("failed to Base64 decode X.509 certificate: %w", err)
		}
		x5c[i], err = x509.ParseCertificate(raw)
		if err != nil {
			return JWK{}, fmt.Errorf("failed to parse X.509 certificate: %w", err)
		}
	}
	jwkX509 := JWKX509Options{
		X5C: x5c,
		X5U: marshal.X5U,
	}
	marshalCopy.X5C = slices.Clone(marshal.X5C)
	marshalCopy.X5T = marshal.X5T
	marshalCopy.X5TS256 = marshal.X5TS256
	marshalCopy.X5U = marshal.X5U
	metadata := JWKMetadataOptions{
		ALG:    marshal.ALG,
		KID:    marshal.KID,
		KEYOPS: slices.Clone(marshal.KEYOPS),
		USE:    marshal.USE,
	}
	marshalCopy.ALG = marshal.ALG
	marshalCopy.KID = marshal.KID
	marshalCopy.KEYOPS = slices.Clone(marshal.KEYOPS)
	marshalCopy.USE = marshal.USE
	opts := JWKOptions{
		Metadata: metadata,
		Marshal:  options,
		Validate: validateOptions,
		X509:     jwkX509,
	}
	j := JWK{
		key:     key,
		marshal: marshalCopy,
		options: opts,
	}
	return j, nil
}

// base64urlTrailingPadding removes trailing padding before decoding a string from base64url. Some non-RFC compliant
// JWKS contain padding at the end values for base64url encoded public keys.
//
// Trailing padding is required to be removed from base64url encoded keys.
// RFC 7517 defines base64url the same as RFC 7515 Section 2:
// https://datatracker.ietf.org/doc/html/rfc7517#section-1.1
// https://datatracker.ietf.org/doc/html/rfc7515#section-2
func base64urlTrailingPadding(s string) ([]byte, error) {
	s = strings.TrimRight(s, "=")
	return base64.RawURLEncoding.DecodeString(s)
}

func bigIntToBase64RawURL(i *big.Int, l uint) string {
	var b []byte
	if l != 0 {
		b = make([]byte, l)
		i.FillBytes(b)
	} else {
		b = i.Bytes()
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
