/*

The logic to handle whitespace around delimiters was initially developed
in the fork from "anyproto" by Roman Khafizianov and Mikhail.

The changes were then merged upstream by Johannes Kaufmann.

https://github.com/anyproto/html-to-markdown
https://github.com/JohannesKaufmann/html-to-markdown

-----------

MIT License

Copyright (c) 2018 Johannes Kaufmann
Copyright (c) 2020 Roman Khafizianov
Copyright (c) 2023 Mikhail

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

package textutils

import (
	"bytes"
	"unicode"
)

func SurroundingSpaces(content []byte) ([]byte, []byte, []byte) {
	rightTrimmed := bytes.TrimRightFunc(content, func(r rune) bool {
		return unicode.IsSpace(r)
	})
	rightExtra := content[len(rightTrimmed):]

	trimmed := bytes.TrimLeftFunc(rightTrimmed, func(r rune) bool {
		return unicode.IsSpace(r)
	})
	leftExtra := content[0 : len(rightTrimmed)-len(trimmed)]

	return leftExtra, trimmed, rightExtra
}
