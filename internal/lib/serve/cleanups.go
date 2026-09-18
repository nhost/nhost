package serve

import (
	"slices"
	"sync"
)

// Cleanups collects release hooks acquired while constructing a service.
// Add and Close are safe to call concurrently from multiple lifecycle paths.
// Close runs hooks registered before cleanup starts in reverse acquisition
// order exactly once. Together, these properties make the collection's cleanup
// idempotent and safe to invoke concurrently.
//
// A hook added after cleanup starts runs immediately on Add's calling goroutine.
// It may therefore run concurrently with hooks that Close is still running.
// Hooks must not call Close: Close blocks concurrent callers until its hooks
// finish, so re-entering it from a hook deadlocks.
//
// A fallible construction sequence should release what it acquired on the way
// out, and hand ownership to its caller only once it succeeds. Name the error
// result and close on it, so the decision tracks the returned error itself
// rather than a separate flag that can drift from it:
//
//	func New() (svc *Service, err error) {
//		cleanups := &serve.Cleanups{}
//
//		defer func() {
//			if err != nil {
//				cleanups.Close()
//			}
//		}()
//		// Acquire resources and add their release hooks.
//
//		return &Service{Close: cleanups.Close}, nil
//	}
type Cleanups struct {
	mu       sync.Mutex
	cleanups []func()
	closed   bool
	once     sync.Once
}

// Add registers a release hook, or runs it immediately if cleanup has started.
func (c *Cleanups) Add(cleanup func()) {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		cleanup()

		return
	}

	c.cleanups = append(c.cleanups, cleanup)
	c.mu.Unlock()
}

// Close runs the registered release hooks in reverse order exactly once.
func (c *Cleanups) Close() {
	c.once.Do(func() {
		c.mu.Lock()
		c.closed = true
		cleanups := c.cleanups
		c.cleanups = nil
		c.mu.Unlock()

		for _, cleanup := range slices.Backward(cleanups) {
			cleanup()
		}
	})
}
