package jsondiff

import (
	"encoding/json"
	"strings"
	"unsafe"
)

// JSON Patch operation types.
// These are defined in RFC 6902 section 4.
// https://datatracker.ietf.org/doc/html/rfc6902#section-4
const (
	OperationAdd     = "add"
	OperationReplace = "replace"
	OperationRemove  = "remove"
	OperationMove    = "move"
	OperationCopy    = "copy"
	OperationTest    = "test"
)

const (
	fromFieldLen  = len(`,"from":""`)
	valueFieldLen = len(`,"value":`)
	opBaseLen     = len(`{"op":"","path":""}`)
)

// null represents a JSON null value.
type null struct{}

// Patch represents a series of JSON Patch operations.
type Patch []Operation

// Operation represents a single JSON Patch (RFC6902) operation.
type Operation struct {
	Value    interface{} `json:"value,omitempty"`
	OldValue interface{} `json:"-"`
	Type     string      `json:"op"`
	From     string      `json:"from,omitempty"`
	Path     string      `json:"path"`
	valueLen int
}

// MarshalJSON implements the json.Marshaler interface.
func (null) MarshalJSON() ([]byte, error) {
	return []byte("null"), nil
}

// String implements the fmt.Stringer interface.
func (o Operation) String() string {
	b, err := json.Marshal(o)
	if err != nil {
		return "<invalid operation>"
	}
	return string(b)
}

// MarshalJSON implements the json.Marshaler interface.
func (o Operation) MarshalJSON() ([]byte, error) {
	type op Operation

	if !o.marshalWithValue() {
		o.Value = nil
	} else if (*[2]uintptr)(unsafe.Pointer(&o.Value))[1] == 0 {
		// Generic check that works for nil
		// and typed nil interface values.
		o.Value = null{}
	}
	if !o.hasFrom() {
		o.From = emptyPointer
	}
	return json.Marshal(op(o))
}

// jsonLength returns the length in bytes that the
// operation would occupy when marshaled to JSON.
func (o Operation) jsonLength() int {
	l := opBaseLen + len(o.Type) + len(o.Path)

	if o.marshalWithValue() {
		l += valueFieldLen + o.valueLen
	}
	if o.hasFrom() {
		l += fromFieldLen + len(o.From)
	}
	return l
}

func (o Operation) hasFrom() bool {
	switch o.Type {
	case OperationCopy, OperationMove:
		return true
	default:
		return false
	}
}

func (o Operation) marshalWithValue() bool {
	switch o.Type {
	case OperationAdd, OperationReplace, OperationTest:
		return true
	default:
		return false
	}
}

func (p *Patch) remove(idx int) Patch {
	return (*p)[:idx+copy((*p)[idx:], (*p)[idx+1:])]
}

func (p *Patch) append(typ string, from, path string, src, tgt interface{}, vl int) Patch {
	return append(*p, Operation{
		Type:     typ,
		From:     from,
		Path:     path,
		OldValue: src,
		Value:    tgt,
		valueLen: vl,
	})
}

func (p *Patch) insert(pos int, typ string, from, path string, src, tgt interface{}, vl int) Patch {
	if pos > len(*p) {
		return p.append(typ, from, path, src, tgt, vl)
	}
	op := Operation{
		Type:     typ,
		From:     from,
		Path:     path,
		OldValue: src,
		Value:    tgt,
		valueLen: vl,
	}
	return append((*p)[:pos], append([]Operation{op}, (*p)[pos:]...)...)
}

func (p *Patch) jsonLength() int {
	if p == nil {
		return 0
	}
	var length int
	for _, op := range *p {
		length += op.jsonLength()
	}
	// Count comma-separators if the patch
	// has more than one operation.
	if len(*p) > 1 {
		length += len(*p) - 1
	}
	return length
}

// String implements the fmt.Stringer interface.
func (p *Patch) String() string {
	if p == nil || len(*p) == 0 {
		return ""
	}
	sb := strings.Builder{}
	for i, op := range *p {
		if i != 0 {
			sb.WriteByte('\n')
		}
		sb.WriteString(op.String())
	}
	return sb.String()
}
