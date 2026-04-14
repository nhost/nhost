package storage

import (
	"time"
)

const format = time.RFC1123

type Time struct {
	t time.Time
}

func NewTime(t time.Time) Time {
	return Time{t: t}
}

func (dt Time) MarshalText() ([]byte, error) {
	if dt.t.IsZero() {
		return []byte(`""`), nil
	}

	return []byte(dt.t.Format(format)), nil
}

func (dt *Time) UnmarshalText(text []byte) error {
	if len(text) == 0 || string(text) == `""` {
		*dt = Time{t: time.Time{}}
		return nil
	}

	t, err := time.Parse(format, string(text))
	if err != nil {
		return err //nolint:wrapcheck
	}

	*dt = Time{t: t}

	return nil
}
