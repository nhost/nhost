package httpretty

import (
	"bytes"
	"io"
	"net/http"
)

type bodyCloser struct {
	r     io.Reader
	close func() error
}

func (bc *bodyCloser) Read(p []byte) (n int, err error) {
	return bc.r.Read(p)
}

func (bc *bodyCloser) Close() error {
	return bc.close()
}

func newBodyReaderBuf(buf io.Reader, body io.ReadCloser) *bodyCloser {
	return &bodyCloser{
		r:     io.MultiReader(buf, body),
		close: body.Close,
	}
}

type responseRecorder struct {
	http.ResponseWriter

	statusCode int

	maxReadableBody int64
	size            int64
	buf             *bytes.Buffer
}

// Write the data to the connection as part of an HTTP reply, and records it.
func (rr *responseRecorder) Write(p []byte) (int, error) {
	rr.size += int64(len(p))

	if rr.maxReadableBody > 0 && rr.size > rr.maxReadableBody {
		rr.buf = nil
		return rr.ResponseWriter.Write(p)
	}

	defer rr.buf.Write(p)
	return rr.ResponseWriter.Write(p)
}

// WriteHeader sends an HTTP response header with the provided
// status code, and records it.
func (rr *responseRecorder) WriteHeader(statusCode int) {
	rr.ResponseWriter.WriteHeader(statusCode)
	rr.statusCode = statusCode
}
