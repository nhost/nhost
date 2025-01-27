package ansi

import (
	"bytes"
	"strconv"
	"strings"
)

// DcsSequence represents a Device Control String (DCS) escape sequence.
//
// The DCS sequence is used to send device control strings to the terminal. The
// sequence starts with the C1 control code character DCS (0x9B) or ESC P in
// 7-bit environments, followed by parameter bytes, intermediate bytes, a
// command byte, followed by data bytes, and ends with the C1 control code
// character ST (0x9C) or ESC \ in 7-bit environments.
//
// This follows the parameter string format.
// See ECMA-48 § 5.4.1
type DcsSequence struct {
	// Params contains the raw parameters of the sequence.
	// This is a slice of integers, where each integer is a 32-bit integer
	// containing the parameter value in the lower 31 bits and a flag in the
	// most significant bit indicating whether there are more sub-parameters.
	Params []Parameter

	// Data contains the string raw data of the sequence.
	// This is the data between the final byte and the escape sequence terminator.
	Data []byte

	// Cmd contains the raw command of the sequence.
	// The command is a 32-bit integer containing the DCS command byte in the
	// lower 8 bits, the private marker in the next 8 bits, and the intermediate
	// byte in the next 8 bits.
	//
	//  DCS > 0 ; 1 $ r <data> ST
	//
	// Is represented as:
	//
	//  'r' | '>' << 8 | '$' << 16
	Cmd Command
}

var _ Sequence = DcsSequence{}

// Clone returns a deep copy of the DCS sequence.
func (s DcsSequence) Clone() Sequence {
	return DcsSequence{
		Params: append([]Parameter(nil), s.Params...),
		Data:   append([]byte(nil), s.Data...),
		Cmd:    s.Cmd,
	}
}

// Split returns a slice of data split by the semicolon.
func (s DcsSequence) Split() []string {
	return strings.Split(string(s.Data), ";")
}

// Marker returns the marker byte of the DCS sequence.
// This is always gonna be one of the following '<' '=' '>' '?' and in the
// range of 0x3C-0x3F.
// Zero is returned if the sequence does not have a marker.
func (s DcsSequence) Marker() int {
	return s.Cmd.Marker()
}

// Intermediate returns the intermediate byte of the DCS sequence.
// An intermediate byte is in the range of 0x20-0x2F. This includes these
// characters from ' ', '!', '"', '#', '$', '%', '&', ”', '(', ')', '*', '+',
// ',', '-', '.', '/'.
// Zero is returned if the sequence does not have an intermediate byte.
func (s DcsSequence) Intermediate() int {
	return s.Cmd.Intermediate()
}

// Command returns the command byte of the CSI sequence.
func (s DcsSequence) Command() int {
	return s.Cmd.Command()
}

// Param is a helper that returns the parameter at the given index and falls
// back to the default value if the parameter is missing. If the index is out
// of bounds, it returns the default value and false.
func (s DcsSequence) Param(i, def int) (int, bool) {
	if i < 0 || i >= len(s.Params) {
		return def, false
	}
	return s.Params[i].Param(def), true
}

// String returns a string representation of the sequence.
// The string will always be in the 7-bit format i.e (ESC P p..p i..i f <data> ESC \).
func (s DcsSequence) String() string {
	return s.buffer().String()
}

// buffer returns a buffer containing the sequence.
func (s DcsSequence) buffer() *bytes.Buffer {
	var b bytes.Buffer
	b.WriteString("\x1bP")
	if m := s.Marker(); m != 0 {
		b.WriteByte(byte(m))
	}
	for i, p := range s.Params {
		param := p.Param(-1)
		if param >= 0 {
			b.WriteString(strconv.Itoa(param))
		}
		if i < len(s.Params)-1 {
			if p.HasMore() {
				b.WriteByte(':')
			} else {
				b.WriteByte(';')
			}
		}
	}
	if i := s.Intermediate(); i != 0 {
		b.WriteByte(byte(i))
	}
	if cmd := s.Command(); cmd != 0 {
		b.WriteByte(byte(cmd))
	}
	b.Write(s.Data)
	b.WriteByte(ESC)
	b.WriteByte('\\')
	return &b
}

// Bytes returns the byte representation of the sequence.
// The bytes will always be in the 7-bit format i.e (ESC P p..p i..i F <data> ESC \).
func (s DcsSequence) Bytes() []byte {
	return s.buffer().Bytes()
}
