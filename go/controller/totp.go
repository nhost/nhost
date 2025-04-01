package controller

import (
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

const (
	totpPeriod = 30
	totpSkew   = 1
)

type Totp struct {
	timeGenerator func() time.Time
}

func NewTotp(timeGenerator func() time.Time) *Totp {
	return &Totp{
		timeGenerator: timeGenerator,
	}
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
