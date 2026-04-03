package localereader

import (
	"bytes"
	"io"
	"reflect"
	"runtime"
	"testing"

	"golang.org/x/text/transform"
)

func TestDecoder(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip()
	}
	b := []byte{0x01, 0xFF, 0x82, 0xA0, 0x82, 0xA4, 0x82, 0xA6, 0x82, 0xA8, 0x82}
	var buf bytes.Buffer
	_, err := io.Copy(&buf, transform.NewReader(bytes.NewReader(b), NewCodePageDecoder(932)))
	if err != nil {
		t.Fatal(err)
	}
	got := buf.String()
	want := "\x01\xFFあいうえお\x82"
	if reflect.DeepEqual(got, want) {
		t.Fatalf("want %q, but got %q", want, got)
	}
}

func TestUTF8(t *testing.T) {
	b := []byte{0x01, 0xFF, 0x82, 0xA0, 0x82, 0xA4, 0x82, 0xA6, 0x82, 0xA8, 0x82}
	got, err := UTF8(b)
	if err != nil {
		t.Fatal(err)
	}
	want := "\x01\xFFあいうえお\x82"
	if reflect.DeepEqual(got, want) {
		t.Fatalf("want %q, but got %q", want, got)
	}
}
