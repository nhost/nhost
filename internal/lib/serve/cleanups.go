package serve

import "sync"

// Cleanups collects release hooks acquired while constructing a service.
// Add hooks in acquisition order before calling Close. Close runs them in
// reverse order exactly once, so it is safe for multiple lifecycle paths to
// request cleanup.
type Cleanups struct {
	cleanups []func()
	once     sync.Once
}

// Add registers a release hook.
func (c *Cleanups) Add(cleanup func()) {
	c.cleanups = append(c.cleanups, cleanup)
}

// Close runs the registered release hooks in reverse order exactly once.
func (c *Cleanups) Close() {
	c.once.Do(func() {
		for i := len(c.cleanups) - 1; i >= 0; i-- {
			c.cleanups[i]()
		}
	})
}
