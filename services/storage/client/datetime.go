package client

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
