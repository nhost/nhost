package openai

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
)

var (
	ErrMetadataMustBeString = errors.New("metadata must be string")
	ErrNotfound             = errors.New("not found")
)

type responseWithStatus interface {
	StatusCode() int
}

func handleReponseStatus(resp responseWithStatus, body []byte) error {
	switch resp.StatusCode() {
	case http.StatusNotFound:
		return ErrNotfound
	case http.StatusOK:
		return nil
	default:
		return NewResponseError(resp.StatusCode(), string(body))
	}
}

type ResponseError struct {
	StatusCode int
	Message    string
}

func NewResponseError(statusCode int, message string) *ResponseError {
	return &ResponseError{
		StatusCode: statusCode,
		Message:    message,
	}
}

func (e *ResponseError) Error() string {
	return fmt.Sprintf("error (status %d): %s", e.StatusCode, e.Message)
}

type UnexpectedResponseError struct {
	Message     string
	RawResponse string
}

func NewUnexpectedResponseError(message string, rawResponse any) *UnexpectedResponseError {
	b, _ := json.Marshal(rawResponse) //nolint:errchkjson

	return &UnexpectedResponseError{
		Message:     message,
		RawResponse: string(b),
	}
}

func (e *UnexpectedResponseError) Error() string {
	return fmt.Sprintf("%s\nRaw Response:\n%s\n", e.Message, e.RawResponse)
}
