package clienv

import (
	"errors"
	"fmt"
	"io"
	"os"
)

var ErrNoContent = errors.New("no content")

func UnmarshalFile(filepath string, v any, f func([]byte, any) error) error {
	r, err := os.OpenFile(filepath, os.O_RDONLY, 0o600) //nolint:mnd
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer r.Close()

	b, err := io.ReadAll(r)
	if err != nil {
		return fmt.Errorf("failed to read contents of reader: %w", err)
	}

	if len(b) == 0 {
		return ErrNoContent
	}

	if err := f(b, v); err != nil {
		return fmt.Errorf("failed to unmarshal object: %w", err)
	}

	return nil
}

func MarshalFile(v any, filepath string, fn func(any) ([]byte, error)) error {
	f, err := os.OpenFile(filepath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0o600) //nolint:mnd
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	b, err := fn(v)
	if err != nil {
		return fmt.Errorf("error marshalling object: %w", err)
	}

	if _, err := f.Write(b); err != nil {
		return fmt.Errorf("error writing marshalled object: %w", err)
	}

	return nil
}
