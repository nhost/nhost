//go:generate ./schema.sh
package sql

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

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
