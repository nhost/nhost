package controller

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"image/png"
	"io"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

const (
	totpPeriod     = 30
	totpSkew       = 1
	totpSecretSize = 32
	totpImageSize  = 200
)

type Totp struct {
	issuer        string
	timeGenerator func() time.Time
}

func NewTotp(issuer string, timeGenerator func() time.Time) *Totp {
	return &Totp{
		issuer:        issuer,
		timeGenerator: timeGenerator,
	}
}

func (t *Totp) Generate(accountName string) (string, string, error) {
	secret := make([]byte, totpSecretSize)
	_, err := io.ReadFull(rand.Reader, secret)
	if err != nil {
		return "", "", fmt.Errorf("failed to read random bytes: %w", err)
	}

	key, err := totp.Generate(
		totp.GenerateOpts{
			Issuer:      t.issuer,
			AccountName: accountName,
			Period:      totpPeriod,
			SecretSize:  totpSecretSize,
			Secret:      secret,
			Digits:      otp.DigitsSix,
			Algorithm:   otp.AlgorithmSHA1,
			Rand:        rand.Reader,
		},
	)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate TOTP: %w", err)
	}

	var buf bytes.Buffer
	img, err := key.Image(totpImageSize, totpImageSize)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate TOTP image: %w", err)
	}
	if err := png.Encode(&buf, img); err != nil {
		return "", "", fmt.Errorf("failed to encode TOTP image: %w", err)
	}

	imgBase64 := base64.StdEncoding.EncodeToString(buf.Bytes())
	return key.Secret(), imgBase64, nil
}

func (t *Totp) Validate(passcode string, secret string) bool {
	rv, _ := totp.ValidateCustom(
		passcode,
		secret,
		t.timeGenerator().UTC(),
		totp.ValidateOpts{
			Period:    totpPeriod,
			Skew:      totpSkew,
			Digits:    otp.DigitsSix,
			Algorithm: otp.AlgorithmSHA1,
		},
	)
	return rv
}
