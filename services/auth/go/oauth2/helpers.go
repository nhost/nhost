package oauth2

import (
	"crypto/sha256"
	"encoding/hex"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

func pgText(s *string) pgtype.Text {
	if s == nil || *s == "" {
		return pgtype.Text{} //nolint:exhaustruct
	}

	return pgtype.Text{String: *s, Valid: true}
}

func pgTextFromString(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{} //nolint:exhaustruct
	}

	return pgtype.Text{String: s, Valid: true}
}

func authReqNonce(authReq *sql.AuthOauth2AuthRequest) string {
	if authReq == nil {
		return ""
	}

	if authReq.Nonce.Valid {
		return authReq.Nonce.String
	}

	return ""
}

func deptr[T any](x *T) T { //nolint:ireturn
	if x == nil {
		return *new(T)
	}

	return *x
}
