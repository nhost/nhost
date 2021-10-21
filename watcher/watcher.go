package watcher

import (
	"context"

	"github.com/fsnotify/fsnotify"
	"github.com/nhost/cli-go/logger"
	"github.com/nhost/cli-go/util"
	"github.com/sirupsen/logrus"
)

type Operation func() error

type Watcher struct {
	log *logrus.Logger

	//	It's inherently an fsnotify Watcher under the hood.
	*fsnotify.Watcher

	// In the following format:
	// Key - Absolute File Name to Watch
	// Value - Function to execute
	Map map[string]Operation

	//	(Optional) Context to use for stopping of watcher.
	context context.Context
}

//	Add individial location to watcher.
//	Along with associating it with respectiove operation function.
func (w *Watcher) Register(path string, op Operation) error {

	w.log.WithField("component", "path").Debugln("Watching", util.Rel(path))

	w.Map[path] = op

	return w.Add(path)
}

//	Validates whether a given key is already
//	register in the watcher.
func (w *Watcher) Registered(key string) bool {

	for name := range w.Map {
		if name == key {
			return true
		}
	}

	return false
}

//	Initializes a new watcher
func New(ctx context.Context) *Watcher {

	//	If no context has been supplied,
	//	initialize a new one
	if ctx == nil {
		ctx = context.Background()
	}

	w, _ := fsnotify.NewWatcher()

	return &Watcher{
		log:     &logger.Log,
		context: ctx,
		Map:     make(map[string]Operation),
		Watcher: w,
	}
}

// Infinite function which listens for
// fsnotify events once launched
func (w *Watcher) Start() {

	w.log.WithField("component", "watcher").Debug("Activated")

	for {
		select {

		// Inactivate the watch when the environment shuts does
		case <-w.context.Done():
			w.log.WithField("component", "watcher").Debug("Inactivated")
			return

		case event, ok := <-w.Events:
			if !ok {
				return
			}
			if event.Op&fsnotify.Write == fsnotify.Write ||
				event.Op&fsnotify.Create == fsnotify.Create {

				// run the operation
				go func() {
					if err := w.Map[event.Name](); err != nil {
						w.log.WithField("component", "watcher").Debug(err)
					}
				}()
			}
		case err, ok := <-w.Errors:
			if !ok {
				return
			}
			w.log.WithField("component", "watcher").Debug(err)
		}
	}
}
