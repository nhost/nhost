// Copyright 2019 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package source contains utility functions that standardize reading source
// bytes across cue packages.
package source

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"
)

// ReadAll loads the source bytes for the given arguments. If src != nil,
// ReadAll converts src to a []byte if possible; otherwise it returns an
// error. If src == nil, ReadAll returns the result of reading the file
// specified by filename.
func ReadAll(filename string, src any) ([]byte, error) {
	if src != nil {
		switch src := src.(type) {
		case string:
			return []byte(src), nil
		case []byte:
			return src, nil
		case *bytes.Buffer:
			// is io.Reader, but src is already available in []byte form
			if src != nil {
				return src.Bytes(), nil
			}
		case io.Reader:
			var buf bytes.Buffer
			if _, err := io.Copy(&buf, src); err != nil {
				return nil, err
			}
			return buf.Bytes(), nil
		}
		return nil, fmt.Errorf("invalid source type %T", src)
	}
	return os.ReadFile(filename)
}

// Open creates a source reader for the given arguments. If src != nil,
// Open converts src to an io.Open if possible; otherwise it returns an
// error. If src == nil, Open returns the result of opening the file
// specified by filename.
func Open(filename string, src any) (io.ReadCloser, error) {
	if src != nil {
		switch src := src.(type) {
		case string:
			return io.NopCloser(strings.NewReader(src)), nil
		case []byte:
			return io.NopCloser(bytes.NewReader(src)), nil
		case io.Reader:
			return io.NopCloser(src), nil
		}
		return nil, fmt.Errorf("invalid source type %T", src)
	}
	return os.Open(filename)
}
