package oidc_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/oidc"
)

func testGoogleValidator(
	t *testing.T,
	audience string,
	datetime time.Time,
) *oidc.IDTokenValidator {
	t.Helper()

	v, err := oidc.NewIDTokenValidator(
		context.Background(),
		api.Google,
		audience,
		jwt.WithTimeFunc(func() time.Time {
			return datetime
		}),
	)
	if err != nil {
		t.Fatalf("failed to create Google ID token validator: %v", err)
	}

	return v
}

func testAppleValidator(
	t *testing.T,
	audience string,
	datetime time.Time,
) *oidc.IDTokenValidator {
	t.Helper()

	v, err := oidc.NewIDTokenValidator(
		context.Background(),
		api.Apple,
		audience,
		jwt.WithTimeFunc(func() time.Time {
			return datetime
		}),
	)
	if err != nil {
		t.Fatalf("failed to create Google ID token validator: %v", err)
	}

	return v
}

func TestIDTokenValidate(t *testing.T) {
	t.Parallel()

	tokenWithNonce := "eyJhbGciOiJSUzI1NiIsImtpZCI6ImU4NjNmZTI5MmZhMmEyOTY3Y2Q3NTUxYzQyYTEyMTFiY2FjNTUwNzEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI5MzYyODIyMjM4NzUtbzVrMHZiZmV2N21ra3NxbGExNXNsZzlhbTQydnZoY3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI5MzYyODIyMjM4NzUtMWJ0cXNxNGwxMTh1czUxa2RoYWxxb2Q0NGExN2JqMmUuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDY5NjQxNDk4MDkxNjk0MjEwODIiLCJlbWFpbCI6InZld2V5aWY2NjBAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5vbmNlIjoiZGYwNjNjYTliYmU5YzZlNWU4NGZhYjNlYjhmOTQxMmVhZmU4N2ZjNjBmMGE0Y2Y1YjY1YmExOTMwZGYzOGZmYSIsIm5hbWUiOiJKb2huIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0tYNlN2MjZvQzg4UmlOR1MxQkhHc2N4V0xyZ2oxcHhiQ0hQcUZEeWN0WlJWeWV5dz1zOTYtYyIsImdpdmVuX25hbWUiOiJKb2huIiwiaWF0IjoxNzMxMDY3NzQ0LCJleHAiOjE3MzEwNzEzNDR9.P-k76nGt2m5iwciPh7yh_qIfh46-vJ0YV2NHeXkezA3zL23nXxF7HZ7O0EWPHTZyFFnpEzPZCQOEu2WvePiBthjwbDJsoMjrnK5rwd5-GdBhwZBKarH0ZzL6DxObUislLEwRocLsQHxVwqOuU-x_58d4DjPt9uPET7HE0jNoApwWaJciq50iUPMUqm_EinkUeUxYdA_iVc1mIu_mwsuwXYkOI-dRgyKZNqXs_phfhg8Qe8t6pZR-jPzlSDK1PcgtNQP5TcQA-FIMT6ErVzMS94TNSEhYXhl5SNCpeZMBl2TAwkI3lzex8eiwtV1GnkSp0Ljcvc9D0uaJqyzK5sLK3Q" //nolint:gosec,lll
	nonce := "4laVSZd0rNanAE0TS5iouQ=="

	tokenWithoutNonce := "eyJhbGciOiJSUzI1NiIsImtpZCI6ImU4NjNmZTI5MmZhMmEyOTY3Y2Q3NTUxYzQyYTEyMTFiY2FjNTUwNzEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI5MzYyODIyMjM4NzUtbzVrMHZiZmV2N21ra3NxbGExNXNsZzlhbTQydnZoY3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI5MzYyODIyMjM4NzUtMWJ0cXNxNGwxMTh1czUxa2RoYWxxb2Q0NGExN2JqMmUuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDY5NjQxNDk4MDkxNjk0MjEwODIiLCJlbWFpbCI6InZld2V5aWY2NjBAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJKb2huIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0tYNlN2MjZvQzg4UmlOR1MxQkhHc2N4V0xyZ2oxcHhiQ0hQcUZEeWN0WlJWeWV5dz1zOTYtYyIsImdpdmVuX25hbWUiOiJKb2huIiwiaWF0IjoxNzMxMDY3OTU3LCJleHAiOjE3MzEwNzE1NTd9.fmqzZYaFqiMaS0lUhvbTbo1-PZNCJc81ii5IOageUoj3U3TxslX6hba_wtN6XpbVdUKQIDOIL1FZeDKSjxphx9fXCSDGQAKdbM26NhSG31c4ssEFhGvtLQxHOjOHmzWM-NNa313n9Bce96sPm_McRD5UikbT5g7lPC91lc5NiwdXM1ZxLo7mmUqlQwIeVok0soDPSGCRqKIUbx9GRI9dULB7SavrEJkL_fQuRRfhi6J6e7Bq9ECxCS5hX_nvkLxgTI3TrubzCktIrVdgdz3TBpxaIJfunbo8GRW-Ej1vwoAUrgTZcBdygldsngnIrWpm1kMD2Fc2scjnypuPSoSfTA" //nolint:lll,gosec

	googleProvider := testGoogleValidator(
		t,
		"936282223875-1btqsq4l118us51kdhalqod44a17bj2e.apps.googleusercontent.com",
		time.Date(2024, 11, 8, 12, 20, 0, 0, time.UTC),
	)

	cases := []struct {
		name             string
		idTokenValidator *oidc.IDTokenValidator
		token            string
		nonce            string
		expecedErr       error
	}{
		{
			name:             "with nonce",
			idTokenValidator: googleProvider,
			token:            tokenWithNonce,
			nonce:            nonce,
			expecedErr:       nil,
		},
		{
			name:             "with wrong nonce",
			idTokenValidator: googleProvider,
			token:            tokenWithNonce,
			nonce:            "asdasdasdasd",
			expecedErr:       oidc.ErrNonceMismatch,
		},
		{
			name:             "with missing nonce",
			idTokenValidator: googleProvider,
			token:            tokenWithNonce,
			nonce:            "",
			expecedErr:       oidc.ErrNonceMismatch,
		},
		{
			name:             "without nonce",
			idTokenValidator: googleProvider,
			token:            tokenWithoutNonce,
			nonce:            "",
			expecedErr:       nil,
		},
		{
			name: "wrong provider",
			idTokenValidator: testAppleValidator(
				t,
				"936282223875-1btqsq4l118us51kdhalqod44a17bj2e.apps.googleusercontent.com",
				time.Date(2024, 11, 6, 15, 30, 0, 0, time.UTC),
			),
			token:      tokenWithNonce,
			nonce:      nonce,
			expecedErr: keyfunc.ErrKeyfunc,
		},
		{
			name:             "wrong audience",
			idTokenValidator: testGoogleValidator(t, "wrong-auddience", time.Now()),
			token:            tokenWithNonce,
			nonce:            nonce,
			expecedErr:       jwt.ErrTokenInvalidAudience,
		},
		{
			name: "too early in the past",
			idTokenValidator: testGoogleValidator(
				t,
				"936282223875-1btqsq4l118us51kdhalqod44a17bj2e.apps.googleusercontent.com",
				time.Date(2024, 10, 6, 15, 30, 0, 0, time.UTC),
			),
			token:      tokenWithNonce,
			nonce:      nonce,
			expecedErr: jwt.ErrTokenUsedBeforeIssued,
		},
		{
			name: "too early in the past",
			idTokenValidator: testGoogleValidator(
				t,
				"936282223875-1btqsq4l118us51kdhalqod44a17bj2e.apps.googleusercontent.com",
				time.Date(2024, 12, 6, 15, 30, 0, 0, time.UTC),
			),
			token:      tokenWithNonce,
			nonce:      nonce,
			expecedErr: jwt.ErrTokenExpired,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if _, err := tc.idTokenValidator.Validate(
				tc.token, tc.nonce,
			); !errors.Is(err, tc.expecedErr) {
				t.Fatalf("expected error %v, got %v", tc.expecedErr, err)
			}
		})
	}
}
