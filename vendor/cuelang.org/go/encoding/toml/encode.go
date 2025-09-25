// Copyright 2024 The CUE Authors
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

package toml

import (
	"io"

	"github.com/pelletier/go-toml/v2"

	"cuelang.org/go/cue"
)

// TODO(mvdan): encode options

// TODO(mvdan): the encoder below is based on map[string]any since go-toml/v2/unstable
// does not support printing or encoding Nodes; this means no support for comments,
// positions such as empty lines, or the relative order of fields.

// NewEncoder creates an encoder to stream encoded TOML bytes.
func NewEncoder(w io.Writer) *Encoder {
	return &Encoder{encoder: toml.NewEncoder(w)}
}

// Encoder implements the encoding state.
type Encoder struct {
	encoder *toml.Encoder
}

func (e *Encoder) Encode(val cue.Value) error {
	var v any
	if err := val.Decode(&v); err != nil {
		return err
	}
	return e.encoder.Encode(v)
}
