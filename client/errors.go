package client

import (
	"errors"

	"github.com/nhost/hasura-storage/controller"
)

var (
	ErrNoFiles          = errors.New("no files specified")
	ErrFilenameNotFound = errors.New("file not found in content-disposition")
)

type APIResponseError struct {
	StatusCode int
	*controller.ErrorResponse
	Response interface{}
}

func (err *APIResponseError) Error() string {
	return err.Message
}
