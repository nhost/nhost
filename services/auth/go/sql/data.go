//go:generate ./schema.sh
package sql

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type RefreshTokenType string

const (
	RefreshTokenTypeRegular RefreshTokenType = "regular"
	RefreshTokenTypePAT     RefreshTokenType = "pat"
)

func UUID(value uuid.UUID) pgtype.UUID {
	return pgtype.UUID{
		Bytes: value,
		Valid: true,
	}
}

func Text[T ~string](value T) pgtype.Text {
	return pgtype.Text{
		String: string(value),
		Valid:  true,
	}
}

func TimestampTz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{
		Time:             t,
		InfinityModifier: pgtype.Finite,
		Valid:            true,
	}
}

func ToPointerString(value pgtype.Text) *string {
	if value.Valid {
		return &value.String
	}

	return nil
}
