package ansi

import (
	"bytes"
	"errors"
	"io/ioutil"
	"testing"
)

func TestWriter_Write(t *testing.T) {
	t.Parallel()

	buf := []byte("\x1B[38;2;249;38;114m你好reflow\x1B[0m")
	forward := &bytes.Buffer{}
	w := &Writer{Forward: forward}

	n, err := w.Write(buf)

	w.ResetAnsi()

	w.RestoreAnsi()

	if err != nil {
		t.Fatalf("err should be nil, but got %v", err)
	}

	if l := len(buf); n != l {
		t.Fatalf("n should be %d, got %d", l, n)
	}

	if ls := w.LastSequence(); ls != "" {
		t.Fatalf("LastSequence should be empty, got %s", ls)
	}

	if b := forward.Bytes(); !bytes.Equal(b, buf) {
		t.Fatalf("forward should be wrote by %v, but got %v", buf, b)
	}
}

var fakeErr = errors.New("fake error")

type fakeWriter struct{}

func (fakeWriter) Write(_ []byte) (int, error) {
	return 0, fakeErr
}

func TestWriter_Write_Error(t *testing.T) {
	t.Parallel()

	w := &Writer{Forward: fakeWriter{}}

	_, err := w.Write([]byte("foo"))

	if err != fakeErr {
		t.Fatalf("err should be fakeErr, but got %v", err)
	}
}

// go test -bench=BenchmarkWriter_Write -benchmem -count=4
func BenchmarkWriter_Write(b *testing.B) {
	buf := []byte("\x1B[38;2;249;38;114m你好reflow\x1B[0m")
	w := &Writer{Forward: ioutil.Discard}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = w.Write(buf)
	}
}

func TestWriter_LastSequence(t *testing.T) {
	t.Parallel()

	w := &Writer{}
	if s := w.LastSequence(); s != "" {
		t.Fatalf("LastSequence should be empty, but got %s", s)
	}
}

func TestWriter_ResetAnsi(t *testing.T) {
	t.Parallel()

	b := &bytes.Buffer{}
	w := &Writer{Forward: b}

	w.ResetAnsi()

	if s := b.String(); s != "" {
		t.Fatalf("b should be empty, but got %s", s)
	}

	w.seqchanged = true

	w.ResetAnsi()

	if s := b.String(); s != "\x1b[0m" {
		t.Fatalf("b.String() should be \"\\x1b[0m\", got %s", s)
	}
}

func TestWriter_RestoreAnsi(t *testing.T) {
	t.Parallel()

	b := &bytes.Buffer{}

	lastseq := bytes.Buffer{}
	lastseq.WriteString("\x1B[38;2;249;38;114m")
	w := &Writer{Forward: b, lastseq: lastseq}

	w.RestoreAnsi()

	if s := b.String(); s != "\x1B[38;2;249;38;114m" {
		t.Fatalf("b.String() should be \"\\x1B[38;2;249;38;114m\", got %s", s)
	}
}
