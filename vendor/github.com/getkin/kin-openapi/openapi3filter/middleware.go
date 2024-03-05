package openapi3filter

import (
	"bytes"
	"io"
	"log"
	"net/http"

	"github.com/getkin/kin-openapi/routers"
)

// Validator provides HTTP request and response validation middleware.
type Validator struct {
	router  routers.Router
	errFunc ErrFunc
	logFunc LogFunc
	strict  bool
	options Options
}

// ErrFunc handles errors that may occur during validation.
type ErrFunc func(w http.ResponseWriter, status int, code ErrCode, err error)

// LogFunc handles log messages that may occur during validation.
type LogFunc func(message string, err error)

// ErrCode is used for classification of different types of errors that may
// occur during validation. These may be used to write an appropriate response
// in ErrFunc.
type ErrCode int

const (
	// ErrCodeOK indicates no error. It is also the default value.
	ErrCodeOK = 0
	// ErrCodeCannotFindRoute happens when the validator fails to resolve the
	// request to a defined OpenAPI route.
	ErrCodeCannotFindRoute = iota
	// ErrCodeRequestInvalid happens when the inbound request does not conform
	// to the OpenAPI 3 specification.
	ErrCodeRequestInvalid = iota
	// ErrCodeResponseInvalid happens when the wrapped handler response does
	// not conform to the OpenAPI 3 specification.
	ErrCodeResponseInvalid = iota
)

func (e ErrCode) responseText() string {
	switch e {
	case ErrCodeOK:
		return "OK"
	case ErrCodeCannotFindRoute:
		return "not found"
	case ErrCodeRequestInvalid:
		return "bad request"
	default:
		return "server error"
	}
}

// NewValidator returns a new response validation middleware, using the given
// routes from an OpenAPI 3 specification.
func NewValidator(router routers.Router, options ...ValidatorOption) *Validator {
	v := &Validator{
		router: router,
		errFunc: func(w http.ResponseWriter, status int, code ErrCode, _ error) {
			http.Error(w, code.responseText(), status)
		},
		logFunc: func(message string, err error) {
			log.Printf("%s: %v", message, err)
		},
	}
	for i := range options {
		options[i](v)
	}
	return v
}

// ValidatorOption defines an option that may be specified when creating a
// Validator.
type ValidatorOption func(*Validator)

// OnErr provides a callback that handles writing an HTTP response on a
// validation error. This allows customization of error responses without
// prescribing a particular form. This callback is only called on response
// validator errors in Strict mode.
func OnErr(f ErrFunc) ValidatorOption {
	return func(v *Validator) {
		v.errFunc = f
	}
}

// OnLog provides a callback that handles logging in the Validator. This allows
// the validator to integrate with a services' existing logging system without
// prescribing a particular one.
func OnLog(f LogFunc) ValidatorOption {
	return func(v *Validator) {
		v.logFunc = f
	}
}

// Strict, if set, causes an internal server error to be sent if the wrapped
// handler response fails response validation. If not set, the response is sent
// and the error is only logged.
func Strict(strict bool) ValidatorOption {
	return func(v *Validator) {
		v.strict = strict
	}
}

// ValidationOptions sets request/response validation options on the validator.
func ValidationOptions(options Options) ValidatorOption {
	return func(v *Validator) {
		v.options = options
	}
}

// Middleware returns an http.Handler which wraps the given handler with
// request and response validation.
func (v *Validator) Middleware(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		route, pathParams, err := v.router.FindRoute(r)
		if err != nil {
			v.logFunc("validation error: failed to find route for "+r.URL.String(), err)
			v.errFunc(w, http.StatusNotFound, ErrCodeCannotFindRoute, err)
			return
		}
		requestValidationInput := &RequestValidationInput{
			Request:    r,
			PathParams: pathParams,
			Route:      route,
			Options:    &v.options,
		}
		if err = ValidateRequest(r.Context(), requestValidationInput); err != nil {
			v.logFunc("invalid request", err)
			v.errFunc(w, http.StatusBadRequest, ErrCodeRequestInvalid, err)
			return
		}

		var wr responseWrapper
		if v.strict {
			wr = &strictResponseWrapper{w: w}
		} else {
			wr = newWarnResponseWrapper(w)
		}

		h.ServeHTTP(wr, r)

		if err = ValidateResponse(r.Context(), &ResponseValidationInput{
			RequestValidationInput: requestValidationInput,
			Status:                 wr.statusCode(),
			Header:                 wr.Header(),
			Body:                   io.NopCloser(bytes.NewBuffer(wr.bodyContents())),
			Options:                &v.options,
		}); err != nil {
			v.logFunc("invalid response", err)
			if v.strict {
				v.errFunc(w, http.StatusInternalServerError, ErrCodeResponseInvalid, err)
			}
			return
		}

		if err = wr.flushBodyContents(); err != nil {
			v.logFunc("failed to write response", err)
		}
	})
}

type responseWrapper interface {
	http.ResponseWriter

	// flushBodyContents writes the buffered response to the client, if it has
	// not yet been written.
	flushBodyContents() error

	// statusCode returns the response status code, 0 if not set yet.
	statusCode() int

	// bodyContents returns the buffered
	bodyContents() []byte
}

type warnResponseWrapper struct {
	w             http.ResponseWriter
	headerWritten bool
	status        int
	body          bytes.Buffer
	tee           io.Writer
}

func newWarnResponseWrapper(w http.ResponseWriter) *warnResponseWrapper {
	wr := &warnResponseWrapper{
		w: w,
	}
	wr.tee = io.MultiWriter(w, &wr.body)
	return wr
}

// Write implements http.ResponseWriter.
func (wr *warnResponseWrapper) Write(b []byte) (int, error) {
	if !wr.headerWritten {
		wr.WriteHeader(http.StatusOK)
	}
	return wr.tee.Write(b)
}

// WriteHeader implements http.ResponseWriter.
func (wr *warnResponseWrapper) WriteHeader(status int) {
	if !wr.headerWritten {
		// If the header hasn't been written, record the status for response
		// validation.
		wr.status = status
		wr.headerWritten = true
	}
	wr.w.WriteHeader(wr.status)
}

// Header implements http.ResponseWriter.
func (wr *warnResponseWrapper) Header() http.Header {
	return wr.w.Header()
}

// Flush implements the optional http.Flusher interface.
func (wr *warnResponseWrapper) Flush() {
	// If the wrapped http.ResponseWriter implements optional http.Flusher,
	// pass through.
	if fl, ok := wr.w.(http.Flusher); ok {
		fl.Flush()
	}
}

func (wr *warnResponseWrapper) flushBodyContents() error {
	return nil
}

func (wr *warnResponseWrapper) statusCode() int {
	return wr.status
}

func (wr *warnResponseWrapper) bodyContents() []byte {
	return wr.body.Bytes()
}

type strictResponseWrapper struct {
	w             http.ResponseWriter
	headerWritten bool
	status        int
	body          bytes.Buffer
}

// Write implements http.ResponseWriter.
func (wr *strictResponseWrapper) Write(b []byte) (int, error) {
	if !wr.headerWritten {
		wr.WriteHeader(http.StatusOK)
	}
	return wr.body.Write(b)
}

// WriteHeader implements http.ResponseWriter.
func (wr *strictResponseWrapper) WriteHeader(status int) {
	if !wr.headerWritten {
		wr.status = status
		wr.headerWritten = true
	}
}

// Header implements http.ResponseWriter.
func (wr *strictResponseWrapper) Header() http.Header {
	return wr.w.Header()
}

func (wr *strictResponseWrapper) flushBodyContents() error {
	wr.w.WriteHeader(wr.status)
	_, err := wr.w.Write(wr.body.Bytes())
	return err
}

func (wr *strictResponseWrapper) statusCode() int {
	return wr.status
}

func (wr *strictResponseWrapper) bodyContents() []byte {
	return wr.body.Bytes()
}
