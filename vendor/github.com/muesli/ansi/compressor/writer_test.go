package compressor

import (
	"bytes"
	"errors"
	"io/ioutil"
	"testing"
)

func TestWriter_Write(t *testing.T) {
	tt := []struct {
		Input    []byte
		Expected []byte
	}{
		// nothing to compress
		{
			[]byte("\x1B[38;2;249;38;114mre\x1B[0m\x1B[38;2;249;38;115mflow\x1B[0m"),
			[]byte("\x1B[38;2;249;38;114mre\x1B[0m\x1B[38;2;249;38;115mflow\x1B[0m"),
		},
		// reset sequence before setting the same styles again
		{
			[]byte("\x1B[38;2;249;38;114mre\x1B[0m\x1B[38;2;249;38;114mfl\x1B[0m\x1B[38;2;249;38;114mow\x1B[0m"),
			[]byte("\x1B[38;2;249;38;114mreflow\x1B[0m"),
		},
	}

	for i, tc := range tt {
		forward := &bytes.Buffer{}
		w := &Writer{Forward: forward}

		n, err := w.Write(tc.Input)
		if err != nil {
			t.Fatalf("Test %d, err should be nil, but got %v", i, err)
		}
		if err := w.Close(); err != nil {
			t.Fatalf("Test %d, err should be nil, but got %v", i, err)
		}

		if l := len(tc.Input); n != l {
			t.Fatalf("Test %d, n should be %d, got %d", i, l, n)
		}

		if b := forward.Bytes(); !bytes.Equal(b, tc.Expected) {
			// fmt.Println(strings.ReplaceAll(string(tc.Expected), string(ansi.Marker), ""))
			// fmt.Println(strings.ReplaceAll(string(b), string(ansi.Marker), ""))

			t.Fatalf("Test %d, forward should be wrote by %v, but got %v", i, tc.Expected, b)
		}
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
	buf := []byte("\x1B[38;2;249;38;114mre\x1B[0m\x1B[38;2;249;38;114mfl\x1B[0m\x1B[38;2;249;38;114mow\x1B[0m")
	w := &Writer{Forward: ioutil.Discard}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = w.Write(buf)
	}
}
