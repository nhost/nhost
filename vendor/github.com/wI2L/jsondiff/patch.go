package jsondiff

import (
	"errors"
	"fmt"
)

var (
	// ErrNonReversible is returned when a non-reversible
	// operation (not preceded by a test) is found in a patch.
	ErrNonReversible = errors.New("non-reversible operation")

	// ErrAmbiguousCopyOp is returned to signal that a copy
	// operation cannot be reversed as it is ambiguous.
	ErrAmbiguousCopyOp = errors.New("copy operation is ambiguous")
)

// A ErrTestPointer is returned by [Patch.Reverse] when the
// pointer of an operator does not match the preceding test
// operation pointer.
type ErrTestPointer struct {
	Op string
}

func (e ErrTestPointer) Error() string {
	return fmt.Sprintf("test pointer mismatch for %q operation", e.Op)
}

// Patch represents a series of JSON Patch operations.
type Patch []Operation

// Invert returns a patch that undo the modifications
// represented by this patch.
func (p Patch) Invert() (Patch, error) {
	newPatch := make(Patch, 0, len(p)/2)

	var skip int
	for i := len(p) - 1; i >= 0; i -= skip {
		ops, n, err := p.invertOp(i)
		if err != nil {
			return nil, err
		}
		newPatch = append(newPatch, ops...)
		skip = n
	}
	return newPatch, nil
}

func (p Patch) prevOp(i int) (*Operation, error) {
	op := p[i]
	if y := i - 1; y >= 0 && p[y].Type == OperationTest {
		if p[i].Path != p[y].Path {
			return nil, &ErrTestPointer{Op: op.Type}
		}
		return &p[y], nil
	}
	return nil, ErrNonReversible
}

func (p Patch) invertOp(i int) ([]Operation, int, error) {
	op := p[i]

	var ops []Operation
	switch op.Type {
	case OperationCopy:
		return nil, 0, ErrAmbiguousCopyOp

	case OperationTest:
		return []Operation{op}, 1, nil

	case OperationAdd:
		ops = make([]Operation, 0, 2)
		ops = append(ops, Operation{
			Type:  OperationTest,
			Path:  op.Path,
			Value: op.Value,
		})
		ops = append(ops, Operation{
			Type:     OperationRemove,
			Path:     op.Path,
			OldValue: op.Value,
		})
		return ops, 1, nil

	case OperationRemove:
		prev, err := p.prevOp(i)
		if err != nil {
			return nil, 0, err
		}
		return []Operation{{
			Type:  OperationAdd,
			Path:  prev.Path,
			Value: prev.Value,
		}}, 1, nil

	case OperationReplace:
		prev, err := p.prevOp(i)
		if err != nil {
			return nil, 0, err
		}
		ops = make([]Operation, 0, 2)
		ops = append(ops, Operation{
			Type:  OperationTest,
			Path:  prev.Path,
			Value: op.Value,
		})
		ops = append(ops, Operation{
			Type:     OperationReplace,
			Path:     prev.Path,
			Value:    prev.Value,
			OldValue: op.Value,
		})
		return ops, 2, nil

	case OperationMove:
		return []Operation{{
			Type:  OperationMove,
			Path:  op.From,
			From:  op.Path,
			Value: op.Value,
		}}, 1, nil
	}
	return nil, 0, errors.New("unknown operation")
}
