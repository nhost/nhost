// Package asciisanitizer implements an ASCII control character sanitizer for UTF-8 strings.
// It will transform ASCII control codes into equivalent inert characters that are safe for display in the terminal.
// Without sanitization these ASCII control characters will be interpreted by the terminal.
// This behaviour can be used maliciously as an attack vector, especially the ASCII control characters \x1B and \x9B.
package asciisanitizer

import (
	"bytes"
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/transform"
)

// Sanitizer implements transform.Transformer interface.
type Sanitizer struct {
	// JSON tells the Sanitizer to replace strings that will be transformed
	// into control characters when the string is marshaled to JSON. Set to
	// true if the string being sanitized represents JSON formatted data.
	JSON      bool
	addEscape bool
}

// Transform uses a sliding window algorithm to detect C0 and C1 control characters as they are read and replaces
// them with equivalent inert characters. Bytes that are not part of a control character are not modified.
func (t *Sanitizer) Transform(dst, src []byte, atEOF bool) (nDst, nSrc int, err error) {
	transfer := func(write, read []byte) error {
		readLength := len(read)
		writeLength := len(write)
		if writeLength > len(dst) {
			return transform.ErrShortDst
		}
		copy(dst, write)
		nDst += writeLength
		dst = dst[writeLength:]
		nSrc += readLength
		src = src[readLength:]
		return nil
	}

	for len(src) > 0 {
		// When sanitizing JSON strings make sure that we have 6 bytes if available.
		if t.JSON && len(src) < 6 && !atEOF {
			err = transform.ErrShortSrc
			return
		}
		r, size := utf8.DecodeRune(src)
		if r == utf8.RuneError && size < 2 {
			if !atEOF {
				err = transform.ErrShortSrc
				return
			} else {
				err = errors.New("invalid UTF-8 string")
				return
			}
		}
		// Replace C0 and C1 control characters.
		if unicode.IsControl(r) {
			if repl, found := mapControlToCaret(r); found {
				err = transfer(repl, src[:size])
				if err != nil {
					return
				}
				continue
			}
		}
		// Replace JSON C0 and C1 control characters.
		if t.JSON && len(src) >= 6 {
			if repl, found := mapJSONControlToCaret(src[:6]); found {
				if t.addEscape {
					// Add an escape character when necessary to prevent creating
					// invalid JSON with our replacements.
					repl = append([]byte{'\\'}, repl...)
					t.addEscape = false
				}
				err = transfer(repl, src[:6])
				if err != nil {
					return
				}
				continue
			}
		}
		err = transfer(src[:size], src[:size])
		if err != nil {
			return
		}
		if t.JSON {
			if r == '\\' {
				t.addEscape = !t.addEscape
			} else {
				t.addEscape = false
			}
		}
	}
	return
}

// Reset resets the state and allows the Sanitizer to be reused.
func (t *Sanitizer) Reset() {
	t.addEscape = false
}

// mapControlToCaret maps C0 and C1 control characters to their caret notation.
func mapControlToCaret(r rune) ([]byte, bool) {
	//\t (09), \n (10), \v (11), \r (13) are safe C0 characters and are not sanitized.
	m := map[rune]string{
		0:   `^@`,
		1:   `^A`,
		2:   `^B`,
		3:   `^C`,
		4:   `^D`,
		5:   `^E`,
		6:   `^F`,
		7:   `^G`,
		8:   `^H`,
		12:  `^L`,
		14:  `^N`,
		15:  `^O`,
		16:  `^P`,
		17:  `^Q`,
		18:  `^R`,
		19:  `^S`,
		20:  `^T`,
		21:  `^U`,
		22:  `^V`,
		23:  `^W`,
		24:  `^X`,
		25:  `^Y`,
		26:  `^Z`,
		27:  `^[`,
		28:  `^\\`,
		29:  `^]`,
		30:  `^^`,
		31:  `^_`,
		128: `^@`,
		129: `^A`,
		130: `^B`,
		131: `^C`,
		132: `^D`,
		133: `^E`,
		134: `^F`,
		135: `^G`,
		136: `^H`,
		137: `^I`,
		138: `^J`,
		139: `^K`,
		140: `^L`,
		141: `^M`,
		142: `^N`,
		143: `^O`,
		144: `^P`,
		145: `^Q`,
		146: `^R`,
		147: `^S`,
		148: `^T`,
		149: `^U`,
		150: `^V`,
		151: `^W`,
		152: `^X`,
		153: `^Y`,
		154: `^Z`,
		155: `^[`,
		156: `^\\`,
		157: `^]`,
		158: `^^`,
		159: `^_`,
	}
	if c, ok := m[r]; ok {
		return []byte(c), true
	}
	return nil, false
}

// mapJSONControlToCaret maps JSON C0 and C1 control characters to their caret notation.
// JSON control characters are six byte strings, representing a unicode code point,
// ranging from \u0000 to \u001F and \u0080 to \u009F.
func mapJSONControlToCaret(b []byte) ([]byte, bool) {
	if len(b) != 6 {
		return nil, false
	}
	if !bytes.HasPrefix(b, []byte(`\u00`)) {
		return nil, false
	}
	//\t (\u0009), \n (\u000a), \v (\u000b), \r (\u000d) are safe C0 characters and are not sanitized.
	m := map[string]string{
		`\u0000`: `^@`,
		`\u0001`: `^A`,
		`\u0002`: `^B`,
		`\u0003`: `^C`,
		`\u0004`: `^D`,
		`\u0005`: `^E`,
		`\u0006`: `^F`,
		`\u0007`: `^G`,
		`\u0008`: `^H`,
		`\u000c`: `^L`,
		`\u000e`: `^N`,
		`\u000f`: `^O`,
		`\u0010`: `^P`,
		`\u0011`: `^Q`,
		`\u0012`: `^R`,
		`\u0013`: `^S`,
		`\u0014`: `^T`,
		`\u0015`: `^U`,
		`\u0016`: `^V`,
		`\u0017`: `^W`,
		`\u0018`: `^X`,
		`\u0019`: `^Y`,
		`\u001a`: `^Z`,
		`\u001b`: `^[`,
		`\u001c`: `^\\`,
		`\u001d`: `^]`,
		`\u001e`: `^^`,
		`\u001f`: `^_`,
		`\u0080`: `^@`,
		`\u0081`: `^A`,
		`\u0082`: `^B`,
		`\u0083`: `^C`,
		`\u0084`: `^D`,
		`\u0085`: `^E`,
		`\u0086`: `^F`,
		`\u0087`: `^G`,
		`\u0088`: `^H`,
		`\u0089`: `^I`,
		`\u008a`: `^J`,
		`\u008b`: `^K`,
		`\u008c`: `^L`,
		`\u008d`: `^M`,
		`\u008e`: `^N`,
		`\u008f`: `^O`,
		`\u0090`: `^P`,
		`\u0091`: `^Q`,
		`\u0092`: `^R`,
		`\u0093`: `^S`,
		`\u0094`: `^T`,
		`\u0095`: `^U`,
		`\u0096`: `^V`,
		`\u0097`: `^W`,
		`\u0098`: `^X`,
		`\u0099`: `^Y`,
		`\u009a`: `^Z`,
		`\u009b`: `^[`,
		`\u009c`: `^\\`,
		`\u009d`: `^]`,
		`\u009e`: `^^`,
		`\u009f`: `^_`,
	}
	if c, ok := m[strings.ToLower(string(b))]; ok {
		return []byte(c), true
	}
	return nil, false
}
