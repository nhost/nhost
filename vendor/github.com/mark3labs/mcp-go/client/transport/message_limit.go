package transport

import (
	"bufio"
	"errors"
	"io"
)

// DefaultMaxMessageBytes is the largest message the SSE and Streamable HTTP
// client transports read from a server by default, 32 MiB: a JSON response
// body, or the data of one SSE event.
const DefaultMaxMessageBytes int64 = 32 << 20

// ErrMessageTooLarge is the error of a message from the server over the
// bound. See WithMaxMessageBytes and WithHTTPMaxMessageBytes.
var ErrMessageTooLarge = errors.New("message from the server exceeds the size bound")

// maxErrorBodyBytes bounds how much of an error response is read for the
// error it is reported in.
const maxErrorBodyBytes = 64 << 10

// readErrorBody reads at most maxErrorBodyBytes of an error response's body.
func readErrorBody(r io.Reader) []byte {
	body, _ := io.ReadAll(io.LimitReader(r, maxErrorBodyBytes))
	return body
}

// boundedReader is a reader that fails with ErrMessageTooLarge once its
// source has more than n bytes left.
type boundedReader struct {
	r io.Reader
	n int64
}

// newBoundedReader returns r bounded at limit bytes; zero or a negative limit
// leaves it unbounded.
func newBoundedReader(r io.Reader, limit int64) io.Reader {
	if limit <= 0 {
		return r
	}
	return &boundedReader{r: r, n: limit}
}

func (b *boundedReader) Read(p []byte) (int, error) {
	if b.n <= 0 {
		// One byte past the bound tells a body that fills it from a longer one.
		var probe [1]byte
		n, err := b.r.Read(probe[:])
		if n > 0 {
			return 0, ErrMessageTooLarge
		}
		return 0, err
	}
	if int64(len(p)) > b.n {
		p = p[:b.n]
	}
	n, err := b.r.Read(p)
	b.n -= int64(n)
	return n, err
}

// readSSELine reads one line of an SSE stream, line ending included, as
// bufio.Reader.ReadString does. A line may carry limit bytes of data besides
// its field name and line ending; a longer one is ErrMessageTooLarge. Zero or
// a negative limit leaves lines unbounded.
func readSSELine(br *bufio.Reader, limit int64) (string, error) {
	if limit > 0 {
		limit += int64(len("event: \r\n"))
	}
	var line []byte
	for {
		chunk, err := br.ReadSlice('\n')
		if limit > 0 && int64(len(line)+len(chunk)) > limit {
			return "", ErrMessageTooLarge
		}
		line = append(line, chunk...)
		if err != bufio.ErrBufferFull {
			return string(line), err
		}
	}
}
