package api

import (
	"time"
)

const format = time.RFC1123

type Time time.Time

func (dt *Time) UnmarshalText(text []byte) error {
	if len(text) == 0 || string(text) == `""` {
		*dt = Time(time.Time{})
		return nil
	}

	t, err := time.Parse(format, string(text))
	if err != nil {
		return err //nolint:wrapcheck
	}

	*dt = Time(t)

	return nil
}

func Date(year int, month time.Month, day, hour, minute, sec, nsec int, loc *time.Location) Time {
	return Time(time.Date(year, month, day, hour, minute, sec, nsec, loc))
}
