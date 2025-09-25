package nhostclient

import (
	"time"
)

type Func func(attempt int) error

type BasicRetryer struct {
	maxAttempts int
	multiplier  int
}

func NewBasicRetryer(maxAttempts int, multiplier int) BasicRetryer {
	return BasicRetryer{
		maxAttempts: maxAttempts,
		multiplier:  multiplier,
	}
}

func (s BasicRetryer) Retry(f Func) error {
	if err := f(1); err == nil {
		return nil
	}

	var err error

	for i := 2; i <= s.maxAttempts; i++ {
		time.Sleep(time.Duration(i-1*s.multiplier) * time.Second)

		err = f(i)
		if err == nil {
			return nil
		}
	}

	return err
}
