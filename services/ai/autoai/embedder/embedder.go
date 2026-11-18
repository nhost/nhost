// Package embedder implements explicitly configured embedding providers and
// shared batching, response validation, and bounded retry. Embed makes one HTTP
// call; callers retain control over batch execution and failure isolation.
package embedder

import (
	"context"
	"fmt"
	"math"
)

// InputKind describes retrieval intent.
type InputKind string

const (
	// Document embeds content to be retrieved.
	Document InputKind = "document"
	// Query embeds a search query.
	Query InputKind = "query"
)

// Request selects an embedding space and ordered input texts.
type Request struct {
	Model      string
	Inputs     []string
	Dimensions int
	Kind       InputKind
}

// Limits bounds input count and text bytes per call.
type Limits struct {
	MaxInputs int
	MaxBytes  int
}

// Embedder performs one provider call without retrying or splitting.
//
//go:generate mockgen -package mock -destination mock/embedder.go . Embedder
type Embedder interface {
	Embed(ctx context.Context, req Request) ([][]float32, error)
	BatchLimits() Limits
}

// Registry maps declared names to reusable embedders.
type Registry map[string]Embedder

// ErrorClass determines retry and input-isolation behavior.
type ErrorClass string

const (
	// Configuration denotes a non-retryable provider or embedding-space problem.
	Configuration ErrorClass = "configuration"
	// Input denotes input that callers may isolate to individual rows.
	Input ErrorClass = "input"
	// Transient denotes a potentially retryable provider or transport failure.
	Transient ErrorClass = "transient"
	// Canceled denotes cancellation or deadline expiry.
	Canceled ErrorClass = "canceled"
)

// StatusError contains only fixed messages and HTTP metadata, never a provider
// body or underlying transport error (which can contain credentials and URLs).
type StatusError struct {
	Class      ErrorClass
	StatusCode int
	RetryAfter string
	Message    string
}

// Error renders sanitized HTTP metadata and a fixed message.
func (e *StatusError) Error() string {
	if e.StatusCode != 0 {
		return fmt.Sprintf("embedding request: HTTP status %d: %s", e.StatusCode, e.Message)
	}

	return "embedding request: " + e.Message
}

func failure(class ErrorClass, message string) *StatusError {
	return &StatusError{Class: class, StatusCode: 0, RetryAfter: "", Message: message}
}

// Split preserves input order, treating non-positive limits as unlimited.
// Oversized inputs are sent alone so they can be isolated by the caller.
func Split(req Request, limits Limits) []Request {
	var result []Request

	start, size := 0, 0
	for i, text := range req.Inputs {
		if i > start && ((limits.MaxInputs > 0 && i-start >= limits.MaxInputs) ||
			(limits.MaxBytes > 0 && (size > limits.MaxBytes || len(text) > limits.MaxBytes-size))) {
			batch := req
			batch.Inputs = req.Inputs[start:i]
			result = append(result, batch)
			start, size = i, 0
		}

		size += len(text)
	}

	if start < len(req.Inputs) {
		req.Inputs = req.Inputs[start:]
		result = append(result, req)
	}

	return result
}

// Validate rejects responses incompatible with the configured embedding space.
func Validate(vectors [][]float32, req Request) error {
	if len(vectors) != len(req.Inputs) {
		return failure(Configuration, "response count does not match inputs")
	}

	if req.Dimensions <= 0 {
		return failure(Configuration, "dimensions must be positive")
	}

	for _, vector := range vectors {
		if len(vector) != req.Dimensions {
			return failure(Configuration, "response dimensions do not match configuration")
		}

		for _, value := range vector {
			if math.IsNaN(float64(value)) || math.IsInf(float64(value), 0) {
				return failure(Configuration, "response contains non-finite values")
			}
		}
	}

	return nil
}
