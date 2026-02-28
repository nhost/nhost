package crypto //nolint:revive

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
)

var (
	ErrCiphertextTooShort = errors.New("ciphertext too short")
	ErrDecryptionFailed   = errors.New("decryption failed")
	ErrWrongKeySize       = errors.New(
		"key must be 16, 24, or 32 bytes (AES-128, AES-192, or AES-256)",
	)
)

type Encrypter struct {
	aead cipher.AEAD
}

// NewEncrypter creates a new encrypter using AES-GCM (AEAD mode).
func NewEncrypter(key []byte) (*Encrypter, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create AES cipher: %w", err)
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	return &Encrypter{
		aead: aead,
	}, nil
}

// NewEncrypterFromString creates a new encrypter from a hex string key.
func NewEncrypterFromString(hexKey string) (*Encrypter, error) {
	key, err := KeyFromString(hexKey)
	if err != nil {
		return nil, err
	}

	return NewEncrypter(key)
}

// Encrypt encrypts the plaintext using AES-GCM
// The result includes the nonce and authentication tag.
func (enc *Encrypter) Encrypt(plaintext []byte) ([]byte, error) {
	nonce := make([]byte, enc.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := enc.aead.Seal(nonce, nonce, plaintext, nil)

	encoded := make([]byte, hex.EncodedLen(len(ciphertext)))
	hex.Encode(encoded, ciphertext)

	return encoded, nil
}

// Decrypt decrypts the ciphertext using AES-GCM
// Automatically verifies authentication tag.
func (enc *Encrypter) Decrypt(ciphertext []byte) ([]byte, error) {
	decoded := make([]byte, hex.DecodedLen(len(ciphertext)))

	_, err := hex.Decode(decoded, ciphertext)
	if err != nil {
		return nil, fmt.Errorf("failed to decode hex string: %w", err)
	}

	if len(decoded) < enc.aead.NonceSize() {
		return nil, ErrCiphertextTooShort
	}

	nonce := decoded[:enc.aead.NonceSize()]
	encryptedData := decoded[enc.aead.NonceSize():]

	plaintext, err := enc.aead.Open(nil, nonce, encryptedData, nil)
	if err != nil {
		return nil, ErrDecryptionFailed
	}

	return plaintext, nil
}

// GenerateKey generates a random 256-bit key for AES-256.
func GenerateKey() ([]byte, error) {
	key := make([]byte, 32) //nolint:mnd

	_, err := io.ReadFull(rand.Reader, key)
	if err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}

	return key, nil
}

// KeyFromString creates a key from a hex string.
func KeyFromString(hexKey string) ([]byte, error) {
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("invalid hex key: %w", err)
	}

	if len(key) != 16 && len(key) != 24 && len(key) != 32 {
		return nil, ErrWrongKeySize
	}

	return key, nil
}
