package keyfunc

import (
	"context"
	"crypto"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/MicahParks/jwkset"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/time/rate"
)

var (
	// ErrKeyfunc is returned when a keyfunc error occurs.
	ErrKeyfunc = errors.New("failed keyfunc")
)

// Keyfunc is meant to be used as the jwt.Keyfunc function for github.com/golang-jwt/jwt/v5. It uses
// github.com/MicahParks/jwkset as a JWK Set storage.
type Keyfunc interface {
	Keyfunc(token *jwt.Token) (any, error)
	KeyfuncCtx(ctx context.Context) jwt.Keyfunc
	Storage() jwkset.Storage
	VerificationKeySet(ctx context.Context) (jwt.VerificationKeySet, error)
}

// Options are used to create a new Keyfunc.
type Options struct {
	Ctx          context.Context
	Storage      jwkset.Storage
	UseWhitelist []jwkset.USE
}

// Override is used to change specific default behaviors.
type Override struct {
	// Client is from https://pkg.go.dev/github.com/MicahParks/jwkset#HTTPClientStorageOptions
	Client *http.Client
	// HTTPTimeout is from https://pkg.go.dev/github.com/MicahParks/jwkset#HTTPClientStorageOptions
	HTTPTimeout time.Duration
	// RateLimitWaitMax is from https://pkg.go.dev/github.com/MicahParks/jwkset#HTTPClientOptions
	RateLimitWaitMax time.Duration
	// RefreshErrorHandlerFunc is a function that accepts the URL of the remote JWK Set storage and returns the
	// RefreshErrorHandler from https://pkg.go.dev/github.com/MicahParks/jwkset#HTTPClientStorageOptions
	RefreshErrorHandlerFunc func(u string) func(ctx context.Context, err error)
	// RefreshInterval is from https://pkg.go.dev/github.com/MicahParks/jwkset#HTTPClientStorageOptions
	RefreshInterval time.Duration
	// RefreshUnknownKID is from https://pkg.go.dev/github.com/MicahParks/jwkset#HTTPClientOptions
	RefreshUnknownKID *rate.Limiter
	// ValidationSkipAll is copied to SkipAll in https://pkg.go.dev/github.com/MicahParks/jwkset#JWKValidateOptions
	ValidationSkipAll bool
}

type keyfunc struct {
	ctx          context.Context
	storage      jwkset.Storage
	useWhitelist []jwkset.USE
}

// New creates a new Keyfunc.
func New(options Options) (Keyfunc, error) {
	ctx := options.Ctx
	if ctx == nil {
		ctx = context.Background()
	}
	if options.Storage == nil {
		return nil, fmt.Errorf("%w: no JWK Set storage given in options", ErrKeyfunc)
	}
	k := keyfunc{
		ctx:          ctx,
		storage:      options.Storage,
		useWhitelist: options.UseWhitelist,
	}
	return k, nil
}

// NewDefault creates a new Keyfunc with a default JWK Set storage and options.
//
// This will launch "refresh goroutine" to automatically refresh the remote HTTP resources.
func NewDefault(urls []string) (Keyfunc, error) {
	return NewDefaultCtx(context.Background(), urls)
}

// NewDefaultCtx creates a new Keyfunc with a default JWK Set storage and options. The context is used to end the
// "refresh goroutine".
//
// This will launch "refresh goroutine" to automatically refresh the remote HTTP resources.
func NewDefaultCtx(ctx context.Context, urls []string) (Keyfunc, error) {
	client, err := jwkset.NewDefaultHTTPClientCtx(ctx, urls)
	if err != nil {
		return nil, err
	}
	options := Options{
		Storage: client,
	}
	return New(options)
}

// NewDefaultOverrideCtx creates a new Keyfunc with a default JWK Set storage and options. The context is used to end
// the "refresh goroutine". The override parameter is used to change specific default behaviors.
//
// This will launch "refresh goroutine" to automatically refresh remote HTTP resources.
func NewDefaultOverrideCtx(ctx context.Context, urls []string, override Override) (Keyfunc, error) {
	rateLimitWaitMax := time.Minute
	if override.RateLimitWaitMax != 0 {
		rateLimitWaitMax = override.RateLimitWaitMax
	}
	refreshErrorHandler := func(u string) func(ctx context.Context, err error) {
		return func(ctx context.Context, err error) {
			slog.Default().ErrorContext(ctx, "Failed to refresh HTTP JWK Set from remote HTTP resource.",
				"error", err,
				"url", u,
			)
		}
	}
	if override.RefreshErrorHandlerFunc != nil {
		refreshErrorHandler = override.RefreshErrorHandlerFunc
	}
	refreshInterval := time.Hour
	if override.RefreshInterval > 0 {
		refreshInterval = override.RefreshInterval
	}
	refreshUnknownKID := rate.NewLimiter(rate.Every(5*time.Minute), 1)
	if override.RefreshUnknownKID != nil {
		refreshUnknownKID = override.RefreshUnknownKID
	}

	clientOptions := jwkset.HTTPClientOptions{
		HTTPURLs:          make(map[string]jwkset.Storage),
		RateLimitWaitMax:  rateLimitWaitMax,
		RefreshUnknownKID: refreshUnknownKID,
	}
	for _, u := range urls {
		errorHandler := refreshErrorHandler(u)
		options := jwkset.HTTPClientStorageOptions{
			Client:                    override.Client,
			Ctx:                       ctx,
			NoErrorReturnFirstHTTPReq: true,
			RefreshErrorHandler:       errorHandler,
			RefreshInterval:           refreshInterval,
			ValidateOptions: jwkset.JWKValidateOptions{
				SkipAll: override.ValidationSkipAll,
			},
		}

		if override.HTTPTimeout > 0 {
			options.HTTPTimeout = override.HTTPTimeout
		}

		c, err := jwkset.NewStorageFromHTTP(u, options)
		if err != nil {
			return nil, fmt.Errorf("failed to create HTTP client storage for %q: %w", u, errors.Join(err, jwkset.ErrNewClient))
		}
		clientOptions.HTTPURLs[u] = c
	}
	storage, err := jwkset.NewHTTPClient(clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP client storage: %w", errors.Join(err, jwkset.ErrNewClient))
	}
	options := Options{
		Ctx:          ctx,
		Storage:      storage,
		UseWhitelist: nil,
	}
	return New(options)
}

// NewJWKJSON creates a new Keyfunc from raw JWK JSON.
func NewJWKJSON(raw json.RawMessage) (Keyfunc, error) {
	marshalOptions := jwkset.JWKMarshalOptions{
		Private: true,
	}
	jwk, err := jwkset.NewJWKFromRawJSON(raw, marshalOptions, jwkset.JWKValidateOptions{})
	if err != nil {
		return nil, fmt.Errorf("%w: could not create JWK from raw JSON", errors.Join(err, ErrKeyfunc))
	}
	store := jwkset.NewMemoryStorage()
	err = store.KeyWrite(context.Background(), jwk)
	if err != nil {
		return nil, fmt.Errorf("%w: could not write JWK to storage", errors.Join(err, ErrKeyfunc))
	}
	options := Options{
		Storage: store,
	}
	return New(options)
}

// NewJWKSetJSON creates a new Keyfunc from raw JWK Set JSON.
func NewJWKSetJSON(raw json.RawMessage) (Keyfunc, error) {
	var jwks jwkset.JWKSMarshal
	err := json.Unmarshal(raw, &jwks)
	if err != nil {
		return nil, fmt.Errorf("%w: could not unmarshal raw JWK Set JSON", errors.Join(err, ErrKeyfunc))
	}
	store, err := jwks.ToStorage()
	if err != nil {
		return nil, fmt.Errorf("%w: could not create JWK Set storage", errors.Join(err, ErrKeyfunc))
	}
	options := Options{
		Storage: store,
	}
	return New(options)
}

func (k keyfunc) KeyfuncCtx(ctx context.Context) jwt.Keyfunc {
	return func(token *jwt.Token) (any, error) {
		kidInter, ok := token.Header[jwkset.HeaderKID]
		if !ok {
			return k.VerificationKeySet(ctx)
		}
		kid, ok := kidInter.(string)
		if !ok {
			return nil, fmt.Errorf("%w: could not convert kid in JWT header to string", ErrKeyfunc)
		}
		algInter, ok := token.Header["alg"]
		if !ok {
			return nil, fmt.Errorf("%w: could not find alg in JWT header", ErrKeyfunc)
		}
		alg, ok := algInter.(string)
		if !ok {
			// For test coverage purposes, this should be impossible to reach because the JWT package rejects a token
			// without an alg parameter in the header before calling jwt.Keyfunc.
			return nil, fmt.Errorf(`%w: the JWT header did not contain the "alg" parameter, which is required by RFC 7515 section 4.1.1`, ErrKeyfunc)
		}

		jwk, err := k.storage.KeyRead(ctx, kid)
		if err != nil {
			return nil, fmt.Errorf("%w: could not read JWK from storage", errors.Join(err, ErrKeyfunc))
		}

		if a := jwk.Marshal().ALG.String(); a != "" && a != alg {
			return nil, fmt.Errorf(`%w: JWK "alg" parameter value %q does not match token "alg" parameter value %q`, ErrKeyfunc, a, alg)
		}
		if len(k.useWhitelist) > 0 {
			found := false
			for _, u := range k.useWhitelist {
				if jwk.Marshal().USE == u {
					found = true
					break
				}
			}
			if !found {
				return nil, fmt.Errorf(`%w: JWK "use" parameter value %q is not in whitelist`, ErrKeyfunc, jwk.Marshal().USE)
			}
		}

		key := jwk.Key()
		pk, ok := key.(publicKeyer)
		if ok {
			key = pk.Public()
		}

		return key, nil
	}
}
func (k keyfunc) Keyfunc(token *jwt.Token) (any, error) {
	keyF := k.KeyfuncCtx(k.ctx)
	return keyF(token)
}
func (k keyfunc) Storage() jwkset.Storage {
	return k.storage
}
func (k keyfunc) VerificationKeySet(ctx context.Context) (jwt.VerificationKeySet, error) {
	jwk, err := k.storage.KeyReadAll(ctx)
	if err != nil {
		return jwt.VerificationKeySet{}, fmt.Errorf("failed to read all JWK from storage: %w", errors.Join(err, ErrKeyfunc))
	}
	var allKeys jwt.VerificationKeySet
	for _, j := range jwk {
		key := j.Key()
		pk, ok := key.(publicKeyer)
		if ok {
			key = pk.Public()
		}
		allKeys.Keys = append(allKeys.Keys, key)
	}
	return allKeys, nil
}

type publicKeyer interface {
	Public() crypto.PublicKey
}
