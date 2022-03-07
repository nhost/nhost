package controller

import (
	"errors"
	"fmt"
	"net/http"
)

var (
	ErrMultipartFormFileNotFound = &APIError{
		http.StatusBadRequest,
		"file[] not found in Multipart form",
		errors.New("file[] not found in Multipart form"), // nolint
		nil,
	}
	ErrMultipartFileWrong = &APIError{
		http.StatusBadRequest,
		"wrong file data in multipart form, one needs to be specified",
		errors.New("wrong file data in multipart form, one needs to be specified"), // nolint
		nil,
	}
	ErrWrongDate = &APIError{
		http.StatusBadRequest,
		"couldn't parse date",
		errors.New("couldn't parse date"), // nolint
		nil,
	}
	ErrMetadataLength = &APIError{
		http.StatusBadRequest,
		"file metadata length doesn't match number of files in request",
		errors.New("file metadata length doesn't match number of files in request"), // nolint
		nil,
	}
	ErrBucketNotFound = &APIError{
		http.StatusNotFound,
		"bucket not found",
		errors.New("bucket not found"), // nolint
		nil,
	}
	ErrFileNotFound = &APIError{
		http.StatusNotFound,
		"file not found",
		errors.New("file not found"), // nolint
		nil,
	}
	ErrFileNotUploaded = &APIError{
		http.StatusForbidden,
		"file not uploaded",
		errors.New("file not uploaded"), // nolint
		nil,
	}
)

// Used to standardized the output of the handers' response.
type ErrorResponse struct {
	Message string                 `json:"message"`
	Data    map[string]interface{} `json:"data,omitempty"`
}

type APIError struct {
	statusCode    int
	publicMessage string
	err           error
	data          map[string]interface{}
}

func InternalServerError(err error) *APIError {
	return &APIError{
		statusCode:    http.StatusInternalServerError,
		publicMessage: "an internal server error occurred",
		err:           err,
		data:          nil,
	}
}

func ForbiddenError(err error, publicMessage string) *APIError {
	return &APIError{
		statusCode:    http.StatusForbidden,
		publicMessage: publicMessage,
		err:           err,
		data:          nil,
	}
}

func FailedToInitializeMetadataError(err error) *APIError {
	return &APIError{
		statusCode:    http.StatusForbidden,
		publicMessage: "you are not authorized",
		err:           err,
		data:          nil,
	}
}

func FileTooBigError(filename string, size, maxSize int) *APIError {
	return &APIError{
		statusCode:    http.StatusBadRequest,
		publicMessage: "file too big",
		err:           fmt.Errorf("file %s too big: %d > %d", filename, size, maxSize), // nolint
		data: map[string]interface{}{
			"filename": filename,
			"size":     size,
			"maxSize":  maxSize,
		},
	}
}

func FileTooSmallError(filename string, size, minSize int) *APIError {
	return &APIError{
		statusCode:    http.StatusBadRequest,
		publicMessage: "file too small",
		err:           fmt.Errorf("file %s too big: %d < %d", filename, size, minSize), // nolint
		data: map[string]interface{}{
			"filename": filename,
			"size":     size,
			"minSize":  minSize,
		},
	}
}

func WrongMetadataFormatError(err error) *APIError {
	return &APIError{
		statusCode:    http.StatusBadRequest,
		publicMessage: "couldn't decode metadata",
		err:           err,
	}
}

func BadDataError(err error, publicMessage string) *APIError {
	return &APIError{
		statusCode:    http.StatusBadRequest,
		publicMessage: publicMessage,
		err:           err,
	}
}

func (a *APIError) StatusCode() int {
	if a == nil {
		return 0
	}
	return a.statusCode
}

func (a *APIError) PublicResponse() *ErrorResponse {
	return &ErrorResponse{
		Message: a.publicMessage,
		Data:    a.data,
	}
}

func (a *APIError) Error() string {
	return a.err.Error()
}

func (a *APIError) ExtendError(msg string) *APIError {
	a.err = fmt.Errorf(fmt.Sprintf("%s: %s", msg, a.err.Error())) // nolint
	return a
}
