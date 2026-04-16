package logsapi

import (
	"errors"
	"time"
)

var ErrInvalidTimestampRange = errors.New("invalid time range, from must be before to")

func TimeRangeCheck(from, to *time.Time) (*time.Time, *time.Time, error) {
	if from == nil {
		from = new(time.Now().Add(-time.Hour))
	}

	if to == nil {
		to = new(time.Now())
	}

	if to.Before(*from) {
		return from, to, ErrInvalidTimestampRange
	}

	return from, to, nil
}
