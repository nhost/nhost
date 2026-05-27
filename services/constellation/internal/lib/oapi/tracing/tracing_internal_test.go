package tracing

import (
	"net/http"
	"testing"
)

func TestFromHTTPHeadersAllPresent(t *testing.T) {
	t.Parallel()

	headers := http.Header{}
	headers.Set(headerTraceID, "trace-1")
	headers.Set(headerSpanID, "span-1")
	headers.Set(headerParentSpanID, "parent-1")

	got := FromHTTPHeaders(headers)
	if got.TraceID != "trace-1" {
		t.Errorf("TraceID: got %q, want %q", got.TraceID, "trace-1")
	}

	if got.SpanID != "span-1" {
		t.Errorf("SpanID: got %q, want %q", got.SpanID, "span-1")
	}

	if got.ParentSpanID != "parent-1" {
		t.Errorf("ParentSpanID: got %q, want %q", got.ParentSpanID, "parent-1")
	}
}

func TestFromHTTPHeadersNonePresentGeneratesTraceID(t *testing.T) {
	t.Parallel()

	got := FromHTTPHeaders(http.Header{})
	if got.TraceID == "" {
		t.Error("expected generated TraceID when none present")
	}

	if got.SpanID != "" {
		t.Errorf("SpanID: got %q, want empty", got.SpanID)
	}

	if got.ParentSpanID != "" {
		t.Errorf("ParentSpanID: got %q, want empty", got.ParentSpanID)
	}

	other := FromHTTPHeaders(http.Header{})
	if other.TraceID == got.TraceID {
		t.Errorf("expected unique generated TraceIDs, got %q twice", got.TraceID)
	}
}

func TestFromHTTPHeadersPartial(t *testing.T) {
	t.Parallel()

	headers := http.Header{}
	headers.Set(headerSpanID, "span-only")

	got := FromHTTPHeaders(headers)
	if got.TraceID == "" {
		t.Error("expected generated TraceID when missing")
	}

	if got.SpanID != "span-only" {
		t.Errorf("SpanID: got %q, want %q", got.SpanID, "span-only")
	}

	if got.ParentSpanID != "" {
		t.Errorf("ParentSpanID: got %q, want empty", got.ParentSpanID)
	}
}

func TestToHTTPHeadersWritesAllThree(t *testing.T) {
	t.Parallel()

	tr := Trace{
		TraceID:      "t",
		SpanID:       "s",
		ParentSpanID: "p",
	}
	out := http.Header{}
	ToHTTPHeaders(tr, out)

	for header, want := range map[string]string{
		headerTraceID:      "t",
		headerSpanID:       "s",
		headerParentSpanID: "p",
	} {
		if got := out.Get(header); got != want {
			t.Errorf("%s: got %q, want %q", header, got, want)
		}
	}
}

func TestTraceRoundTrip(t *testing.T) {
	t.Parallel()

	in := http.Header{}
	in.Set(headerTraceID, "trace-rt")
	in.Set(headerSpanID, "span-rt")
	in.Set(headerParentSpanID, "parent-rt")

	tr := FromHTTPHeaders(in)

	out := http.Header{}
	ToHTTPHeaders(tr, out)

	if !equalHeaderValue(in, out, headerTraceID) ||
		!equalHeaderValue(in, out, headerSpanID) ||
		!equalHeaderValue(in, out, headerParentSpanID) {
		t.Errorf("round-trip mismatch: in=%v out=%v", in, out)
	}
}

func equalHeaderValue(a, b http.Header, key string) bool {
	return a.Get(key) == b.Get(key)
}
