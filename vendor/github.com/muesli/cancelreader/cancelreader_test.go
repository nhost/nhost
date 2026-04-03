package cancelreader

import (
	"strings"
	"testing"
)

func TestReaderNonFile(t *testing.T) {
	cr, err := NewReader(strings.NewReader(""))
	if err != nil {
		t.Errorf("expected no error, but got %s", err)
	}

	if cr.Cancel() {
		t.Errorf("expected cancellation to be failure")
	}
}
