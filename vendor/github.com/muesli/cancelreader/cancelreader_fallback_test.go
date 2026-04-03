package cancelreader

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"sync"
	"testing"
)

type blockingReader struct {
	sync.Mutex
	read      bool
	unblockCh chan bool
	startedCh chan bool
}

func (r *blockingReader) Read([]byte) (int, error) {
	defer func() {
		r.Lock()
		defer r.Unlock()
		r.read = true
	}()
	r.startedCh <- true
	<-r.unblockCh
	return 0, fmt.Errorf("this error should be ignored")
}

func TestFallbackReaderConcurrentCancel(t *testing.T) {
	doneCh := make(chan bool, 1)
	startedCh := make(chan bool, 1)
	unblockCh := make(chan bool, 1)
	r := blockingReader{
		startedCh: startedCh,
		unblockCh: unblockCh,
	}
	cr, err := newFallbackCancelReader(&r)
	if err != nil {
		t.Errorf("expected no error, but got %s", err)
	}

	go func() {
		defer func() { doneCh <- true }()
		if _, err := ioutil.ReadAll(cr); err != ErrCanceled {
			t.Errorf("expected canceled error, got %v", err)
		}
	}()

	// make sure the read started before canceling the reader
	<-startedCh
	cr.Cancel()
	unblockCh <- true

	// wait for the read to end to ensure its assertions were made
	<-doneCh

	// make sure that it waited for the reader
	if !r.read {
		t.Error("seems like the reader was canceled before the read, this shouldn't happen")
	}
}

func TestFallbackReader(t *testing.T) {
	var r bytes.Buffer
	cr, err := newFallbackCancelReader(&r)
	if err != nil {
		t.Errorf("expected no error, but got %s", err)
	}

	txt := "first"
	_, _ = r.WriteString(txt)
	first, err := ioutil.ReadAll(cr)
	if err != nil {
		t.Errorf("expected no error, but got %s", err)
	}
	if string(first) != txt {
		t.Errorf("expected output to be %q, got %q", txt, string(first))
	}

	cr.Cancel()
	second, err := ioutil.ReadAll(cr)
	if err != ErrCanceled {
		t.Errorf("expected ErrCanceled, got %v", err)
	}
	if len(second) > 0 {
		t.Errorf("expected an empty read, got %q", string(second))
	}
}
