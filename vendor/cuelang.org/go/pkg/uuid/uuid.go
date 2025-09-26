// Copyright 2021 CUE Authors
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

// Package uuid defines functionality for creating UUIDs as defined in RFC 4122.
//
// Currently only Version 5 (SHA1) and Version 3 (MD5) are supported.
package uuid

import (
	"math/big"

	"github.com/google/uuid"
)

// Valid ensures that s is a valid UUID which would be accepted by Parse.
func Valid(s string) error {
	return uuid.Validate(s)
}

// Parse decodes s into a UUID or returns an error. Both the standard UUID forms
// of xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx and
// urn:uuid:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx are decoded as well as the
// Microsoft encoding {xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx} and the raw hex
// encoding: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.
func Parse(s string) (string, error) {
	x, err := uuid.Parse(s)
	return string(x.String()), err
}

// TODO(mvdan): what is ToString meant to do? it appears like a no-op?

// String represents a 128-bit UUID value as a string.
func ToString(x string) string {
	return string(x)
}

// URN reports the canonical URN of a UUID.
func URN(x string) (string, error) {
	u, err := uuid.Parse(string(x))
	if err != nil {
		return "", err
	}
	return u.URN(), nil
}

// FromInt creates a UUID from an integer.
//
//	DNS:  uuid.FromInt(0x6ba7b810_9dad_11d1_80b4_00c04fd430c8)
func FromInt(i *big.Int) (string, error) {
	// must be uint128
	var buf [16]byte
	b := i.Bytes()
	if len(b) < 16 {
		copy(buf[16-len(b):], b)
		b = buf[:]
	}
	u, err := uuid.FromBytes(b)
	return string(u.String()), err
}

// ToInt represents a UUID string as a 128-bit value.
func ToInt(x string) *big.Int {
	var i big.Int
	i.SetBytes([]byte(x[:]))
	return &i
}

// Variant reports the UUID variant.
func Variant(x string) (int, error) {
	u, err := uuid.Parse(string(x))
	if err != nil {
		return 0, err
	}
	return int(u.Variant()), nil
}

// Version reports the UUID version.
func Version(x string) (int, error) {
	u, err := uuid.Parse(string(x))
	if err != nil {
		return 0, err
	}
	return int(u.Version()), nil
}

// SHA1 generates a version 5 UUID based on the supplied name space and data.
func SHA1(space string, data []byte) (string, error) {
	u, err := uuid.Parse(string(space))
	if err != nil {
		return "", err
	}
	return string(uuid.NewSHA1(u, data).String()), nil
}

// MD5 generates a version 3 UUID based on the supplied name space and data.
// Use SHA1 instead if you can.
func MD5(space string, data []byte) (string, error) {
	u, err := uuid.Parse(string(space))
	if err != nil {
		return "", err
	}
	return string(uuid.NewMD5(u, data).String()), nil
}
