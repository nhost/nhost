package provider

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"

	"github.com/go-jose/go-jose/v4"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/sql"
)

const rsaKeySize = 2048

type Encrypter interface {
	Encrypt(plainText []byte) ([]byte, error)
	Decrypt(cipherText []byte) ([]byte, error)
}

type DBClient interface {
	GetActiveOAuth2SigningKey(ctx context.Context) (sql.AuthOauth2SigningKey, error)
	GetOAuth2SigningKeys(ctx context.Context) ([]sql.AuthOauth2SigningKey, error)
	InsertOAuth2SigningKey(
		ctx context.Context, arg sql.InsertOAuth2SigningKeyParams,
	) (sql.AuthOauth2SigningKey, error)
}

type KeyManager struct {
	db        DBClient
	encrypter Encrypter
}

func NewKeyManager(db DBClient, encrypter Encrypter) *KeyManager {
	return &KeyManager{
		db:        db,
		encrypter: encrypter,
	}
}

func (km *KeyManager) EnsureSigningKey(ctx context.Context, logger *slog.Logger) error {
	_, err := km.db.GetActiveOAuth2SigningKey(ctx)
	if err == nil {
		return nil
	}

	if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("error checking for existing signing key: %w", err)
	}

	logger.InfoContext(ctx, "no active OAuth2 signing key found, generating new RSA key pair")

	privateKey, err := rsa.GenerateKey(rand.Reader, rsaKeySize)
	if err != nil {
		return fmt.Errorf("error generating RSA key pair: %w", err)
	}

	privateKeyBytes := x509.MarshalPKCS1PrivateKey(privateKey)

	encryptedPrivateKey, err := km.encrypter.Encrypt(privateKeyBytes)
	if err != nil {
		return fmt.Errorf("error encrypting private key: %w", err)
	}

	publicKeyBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		return fmt.Errorf("error marshaling public key: %w", err)
	}

	keyID := uuid.NewString()

	_, err = km.db.InsertOAuth2SigningKey(ctx, sql.InsertOAuth2SigningKeyParams{
		PrivateKey: encryptedPrivateKey,
		PublicKey:  publicKeyBytes,
		Algorithm:  "RS256",
		KeyID:      keyID,
		IsActive:   true,
	})
	if err != nil {
		return fmt.Errorf("error inserting signing key: %w", err)
	}

	logger.InfoContext(ctx, "generated new OAuth2 signing key", slog.String("key_id", keyID))

	return nil
}

func (km *KeyManager) GetSigningKey(
	ctx context.Context,
) (*rsa.PrivateKey, string, error) {
	key, err := km.db.GetActiveOAuth2SigningKey(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("error getting active signing key: %w", err)
	}

	privateKeyBytes, err := km.encrypter.Decrypt(key.PrivateKey)
	if err != nil {
		return nil, "", fmt.Errorf("error decrypting private key: %w", err)
	}

	privateKey, err := x509.ParsePKCS1PrivateKey(privateKeyBytes)
	if err != nil {
		return nil, "", fmt.Errorf("error parsing private key: %w", err)
	}

	return privateKey, key.KeyID, nil
}

func (km *KeyManager) GetJWKS(ctx context.Context) (*jose.JSONWebKeySet, error) {
	keys, err := km.db.GetOAuth2SigningKeys(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting signing keys: %w", err)
	}

	jwks := &jose.JSONWebKeySet{
		Keys: make([]jose.JSONWebKey, 0, len(keys)),
	}

	for _, key := range keys {
		pubKey, err := x509.ParsePKIXPublicKey(key.PublicKey)
		if err != nil {
			continue
		}

		rsaPubKey, ok := pubKey.(*rsa.PublicKey)
		if !ok {
			continue
		}

		jwks.Keys = append(jwks.Keys, jose.JSONWebKey{ //nolint:exhaustruct
			Key:       rsaPubKey,
			KeyID:     key.KeyID,
			Algorithm: key.Algorithm,
			Use:       "sig",
		})
	}

	return jwks, nil
}

func (km *KeyManager) GetJWKSResponse(ctx context.Context) (*JWKSResponse, error) {
	keys, err := km.db.GetOAuth2SigningKeys(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting signing keys: %w", err)
	}

	jwksKeys := make([]JWKKey, 0, len(keys))

	for _, key := range keys {
		pubKey, err := x509.ParsePKIXPublicKey(key.PublicKey)
		if err != nil {
			continue
		}

		rsaPubKey, ok := pubKey.(*rsa.PublicKey)
		if !ok {
			continue
		}

		jwksKeys = append(jwksKeys, JWKKey{
			Kty: "RSA",
			Use: "sig",
			Alg: key.Algorithm,
			Kid: key.KeyID,
			N:   base64.RawURLEncoding.EncodeToString(rsaPubKey.N.Bytes()),
			E:   "AQAB",
		})
	}

	return &JWKSResponse{Keys: jwksKeys}, nil
}

type JWKKey struct {
	Kty string `json:"kty"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type JWKSResponse struct {
	Keys []JWKKey `json:"keys"`
}
