package marker

import (
	"bytes"
)

const (
	// For simplicity we are using a rune that is one byte wide. A character
	// that is not used widely (apart from cli's) is the bell character (7).
	MarkerEscaping rune = '\a'

	// - - - - //

	// Marker0                rune = '\uF000' // 61440
	// Marker1                rune = '\uF001' // 61441
	MarkerCodeBlockNewline rune = '\uF002' // 61442
)

var (
	BytesMarkerEscaping = []byte{7}

	BytesMarkerCodeBlockNewline = []byte{239, 128, 130}
)

func init() {
	checkRuneAndByteSlice(MarkerEscaping, BytesMarkerEscaping)
	checkRuneAndByteSlice(MarkerCodeBlockNewline, BytesMarkerCodeBlockNewline)
}

func checkRuneAndByteSlice(r rune, b []byte) {
	if !bytes.Equal([]byte(string(r)), b) {
		panic("the rune and byte slice do not represent the same character")
	}
}
