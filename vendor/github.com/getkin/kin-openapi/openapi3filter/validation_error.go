package openapi3filter

import (
	"bytes"
	"strconv"
)

// ValidationError struct provides granular error information
// useful for communicating issues back to end user and developer.
// Based on https://jsonapi.org/format/#error-objects
type ValidationError struct {
	// A unique identifier for this particular occurrence of the problem.
	Id string `json:"id,omitempty" yaml:"id,omitempty"`
	// The HTTP status code applicable to this problem.
	Status int `json:"status,omitempty" yaml:"status,omitempty"`
	// An application-specific error code, expressed as a string value.
	Code string `json:"code,omitempty" yaml:"code,omitempty"`
	// A short, human-readable summary of the problem. It **SHOULD NOT** change from occurrence to occurrence of the problem, except for purposes of localization.
	Title string `json:"title,omitempty" yaml:"title,omitempty"`
	// A human-readable explanation specific to this occurrence of the problem.
	Detail string `json:"detail,omitempty" yaml:"detail,omitempty"`
	// An object containing references to the source of the error
	Source *ValidationErrorSource `json:"source,omitempty" yaml:"source,omitempty"`
}

// ValidationErrorSource struct
type ValidationErrorSource struct {
	// A JSON Pointer [RFC6901] to the associated entity in the request document [e.g. \"/data\" for a primary data object, or \"/data/attributes/title\" for a specific attribute].
	Pointer string `json:"pointer,omitempty" yaml:"pointer,omitempty"`
	// A string indicating which query parameter caused the error.
	Parameter string `json:"parameter,omitempty" yaml:"parameter,omitempty"`
}

var _ error = &ValidationError{}

// Error implements the error interface.
func (e *ValidationError) Error() string {
	b := bytes.NewBufferString("[")
	if e.Status != 0 {
		b.WriteString(strconv.Itoa(e.Status))
	}
	b.WriteString("]")
	b.WriteString("[")
	if e.Code != "" {
		b.WriteString(e.Code)
	}
	b.WriteString("]")
	b.WriteString("[")
	if e.Id != "" {
		b.WriteString(e.Id)
	}
	b.WriteString("]")
	b.WriteString(" ")
	if e.Title != "" {
		b.WriteString(e.Title)
		b.WriteString(" ")
	}
	if e.Detail != "" {
		b.WriteString("| ")
		b.WriteString(e.Detail)
		b.WriteString(" ")
	}
	if e.Source != nil {
		b.WriteString("[source ")
		if e.Source.Parameter != "" {
			b.WriteString("parameter=")
			b.WriteString(e.Source.Parameter)
		} else if e.Source.Pointer != "" {
			b.WriteString("pointer=")
			b.WriteString(e.Source.Pointer)
		}
		b.WriteString("]")
	}

	if b.Len() == 0 {
		return "no error"
	}
	return b.String()
}

// StatusCode implements the StatusCoder interface for DefaultErrorEncoder
func (e *ValidationError) StatusCode() int {
	return e.Status
}
