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

package net

import (
	"errors"
	"net/url"
)

// PathEscape escapes the string so it can be safely placed inside a URL path
// segment, replacing special characters (including /) with %XX sequences as
// needed.
func PathEscape(s string) string {
	return url.PathEscape(s)
}

// PathUnescape does the inverse transformation of PathEscape, converting each
// 3-byte encoded substring of the form "%AB" into the hex-decoded byte 0xAB.
// It returns an error if any % is not followed by two hexadecimal digits.
//
// PathUnescape is identical to QueryUnescape except that it does not unescape
// '+' to ' ' (space).
func PathUnescape(s string) (string, error) {
	return url.PathUnescape(s)
}

// QueryEscape escapes the string so it can be safely placed inside a URL
// query.
func QueryEscape(s string) string {
	return url.QueryEscape(s)
}

// QueryUnescape does the inverse transformation of QueryEscape, converting
// each 3-byte encoded substring of the form "%AB" into the hex-decoded byte
// 0xAB. It returns an error if any % is not followed by two hexadecimal
// digits.
func QueryUnescape(s string) (string, error) {
	return url.QueryUnescape(s)
}

// URL validates that s is a valid relative or absolute URL.
// Note: this does also allow non-ASCII characters.
func URL(s string) (bool, error) {
	_, err := url.Parse(s)
	return err == nil, err
}

// URL validates that s is an absolute URL.
// Note: this does also allow non-ASCII characters.
func AbsURL(s string) (bool, error) {
	u, err := url.Parse(s)
	if err != nil {
		return false, err
	}
	if !u.IsAbs() {
		return false, errors.New("URL is not absolute")
	}
	return true, nil
}
