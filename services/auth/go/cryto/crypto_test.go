package crypto_test

import (
	"bytes"
	"encoding/hex"
	"errors"
	"testing"

	crypto "github.com/nhost/nhost/services/auth/go/cryto"
)

func TestGenerateKey(t *testing.T) {
	t.Parallel()

	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey failed: %v", err)
	}

	if len(key) != 32 {
		t.Errorf("expected key length 32, got %d", len(key))
	}

	// Generate another key to ensure randomness
	key2, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey failed on second call: %v", err)
	}

	if bytes.Equal(key, key2) {
		t.Error("expected different keys, got identical keys")
	}
}

func TestKeyFromString(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		hexKey      string
		expectError error
		expectLen   int
	}{
		{
			name:        "valid AES-128 key",
			hexKey:      "0123456789abcdef0123456789abcdef",
			expectError: nil,
			expectLen:   16,
		},
		{
			name:        "valid AES-192 key",
			hexKey:      "0123456789abcdef0123456789abcdef0123456789abcdef",
			expectError: nil,
			expectLen:   24,
		},
		{
			name:        "valid AES-256 key",
			hexKey:      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			expectError: nil,
			expectLen:   32,
		},
		{
			name:        "invalid hex string",
			hexKey:      "not-a-hex-string",
			expectError: hex.InvalidByteError('n'),
			expectLen:   0,
		},
		{
			name:        "wrong key size - too short",
			hexKey:      "0123456789abcdef",
			expectError: crypto.ErrWrongKeySize,
			expectLen:   0,
		},
		{
			name:        "wrong key size - invalid length",
			hexKey:      "0123456789abcdef0123456789abcdef01",
			expectError: crypto.ErrWrongKeySize,
			expectLen:   0,
		},
		{
			name:        "empty string",
			hexKey:      "",
			expectError: crypto.ErrWrongKeySize,
			expectLen:   0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			key, err := crypto.KeyFromString(tc.hexKey)

			if tc.expectError != nil { //nolint:nestif
				if err == nil {
					t.Fatalf("expected error, got nil")
				}

				if !errors.Is(err, tc.expectError) && err.Error() != tc.expectError.Error() {
					t.Errorf("expected error %v, got %v", tc.expectError, err)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}

				if len(key) != tc.expectLen {
					t.Errorf("expected key length %d, got %d", tc.expectLen, len(key))
				}
			}
		})
	}
}

func TestNewEncrypter(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		keySize     int
		expectError bool
	}{
		{
			name:        "AES-128",
			keySize:     16,
			expectError: false,
		},
		{
			name:        "AES-192",
			keySize:     24,
			expectError: false,
		},
		{
			name:        "AES-256",
			keySize:     32,
			expectError: false,
		},
		{
			name:        "invalid key size",
			keySize:     15,
			expectError: true,
		},
		{
			name:        "empty key",
			keySize:     0,
			expectError: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			key := make([]byte, tc.keySize)
			enc, err := crypto.NewEncrypter(key)

			if tc.expectError { //nolint:nestif
				if err == nil {
					t.Error("expected error, got nil")
				}

				if enc != nil {
					t.Error("expected nil encrypter on error")
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}

				if enc == nil {
					t.Fatal("expected non-nil encrypter")
				}
			}
		})
	}
}

func TestEncryptDecrypt(t *testing.T) {
	t.Parallel()

	enc, err := crypto.NewEncrypterFromString(
		"41e7109ea7cfff9e4100d29bbd58bacab0258d0fc4c0495746ed0cf166650f9d",
	)
	if err != nil {
		t.Fatalf("failed to create encrypter: %v", err)
	}

	cases := []struct {
		name      string
		plaintext []byte
	}{
		{
			name:      "simple string",
			plaintext: []byte("FEWCQAIILM6UOYZCPFYRAPAUCIFUUUK3JUZXWKJIN4ORQNK4EQCQ"),
		},
		{
			name:      "empty string",
			plaintext: []byte(""),
		},
		{
			name:      "unicode characters",
			plaintext: []byte("こんにちは世界 🌍"), //nolint:gosmopolitan
		},
		{
			name: "long text",
			plaintext: []byte(
				"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.", //nolint:lll
			),
		},
		{
			name:      "binary data",
			plaintext: []byte{0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// Encrypt
			ciphertext, err := enc.Encrypt(tc.plaintext)
			if err != nil {
				t.Fatalf("encryption failed: %v", err)
			}

			// Verify ciphertext is hex encoded
			_, err = hex.DecodeString(string(ciphertext))
			if err != nil {
				t.Errorf("ciphertext is not valid hex: %v", err)
			}

			// Decrypt
			decrypted, err := enc.Decrypt(ciphertext)
			if err != nil {
				t.Fatalf("decryption failed: %v", err)
			}

			// Verify plaintext matches
			if !bytes.Equal(tc.plaintext, decrypted) {
				t.Errorf(
					"decrypted text doesn't match original.\nExpected: %v\nGot: %v",
					tc.plaintext,
					decrypted,
				)
			}
		})
	}
}

func TestEncryptRandomness(t *testing.T) {
	t.Parallel()

	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	enc, err := crypto.NewEncrypter(key)
	if err != nil {
		t.Fatalf("failed to create encrypter: %v", err)
	}

	plaintext := []byte("test message")

	// Encrypt the same message twice
	ciphertext1, err := enc.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("first encryption failed: %v", err)
	}

	ciphertext2, err := enc.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("second encryption failed: %v", err)
	}

	// Ciphertexts should be different due to random nonce
	if bytes.Equal(ciphertext1, ciphertext2) {
		t.Error("expected different ciphertexts for same plaintext, got identical")
	}
}

func TestDecryptErrors(t *testing.T) {
	t.Parallel()

	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	enc, err := crypto.NewEncrypter(key)
	if err != nil {
		t.Fatalf("failed to create encrypter: %v", err)
	}

	cases := []struct {
		name        string
		ciphertext  []byte
		expectError error
	}{
		{
			name:        "invalid hex",
			ciphertext:  []byte("not-valid-hex"),
			expectError: hex.InvalidByteError('n'),
		},
		{
			name:        "ciphertext too short",
			ciphertext:  []byte("0123"),
			expectError: crypto.ErrCiphertextTooShort,
		},
		{
			name:        "tampered ciphertext",
			ciphertext:  []byte("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
			expectError: crypto.ErrDecryptionFailed,
		},
		{
			name:        "empty ciphertext",
			ciphertext:  []byte(""),
			expectError: crypto.ErrCiphertextTooShort,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			_, err := enc.Decrypt(tc.ciphertext)
			if err == nil {
				t.Fatal("expected error, got nil")
			}

			if !errors.Is(err, tc.expectError) && err.Error() != tc.expectError.Error() {
				t.Errorf("expected error %v, got %v", tc.expectError, err)
			}
		})
	}
}

func TestDecryptWithWrongKey(t *testing.T) {
	t.Parallel()

	key1, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("failed to generate key1: %v", err)
	}

	key2, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("failed to generate key2: %v", err)
	}

	enc1, err := crypto.NewEncrypter(key1)
	if err != nil {
		t.Fatalf("failed to create encrypter1: %v", err)
	}

	enc2, err := crypto.NewEncrypter(key2)
	if err != nil {
		t.Fatalf("failed to create encrypter2: %v", err)
	}

	plaintext := []byte("secret message")

	// Encrypt with first key
	ciphertext, err := enc1.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("encryption failed: %v", err)
	}

	// Try to decrypt with second key
	_, err = enc2.Decrypt(ciphertext)
	if err == nil {
		t.Fatal("expected decryption to fail with wrong key")
	}

	if !errors.Is(err, crypto.ErrDecryptionFailed) {
		t.Errorf("expected ErrDecryptionFailed, got %v", err)
	}
}

func TestMultipleEncrypters(t *testing.T) {
	t.Parallel()

	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	enc1, err := crypto.NewEncrypter(key)
	if err != nil {
		t.Fatalf("failed to create encrypter1: %v", err)
	}

	enc2, err := crypto.NewEncrypter(key)
	if err != nil {
		t.Fatalf("failed to create encrypter2: %v", err)
	}

	plaintext := []byte("test message")

	// Encrypt with first encrypter
	ciphertext, err := enc1.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("encryption failed: %v", err)
	}

	// Decrypt with second encrypter (same key)
	decrypted, err := enc2.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("decryption failed: %v", err)
	}

	if !bytes.Equal(plaintext, decrypted) {
		t.Errorf("decrypted text doesn't match.\nExpected: %v\nGot: %v", plaintext, decrypted)
	}
}
