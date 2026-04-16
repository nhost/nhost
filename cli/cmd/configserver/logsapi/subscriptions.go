package logsapi

import (
	"context"
)

const (
	subsBuffSize = 5
)

type SubscriptionFunc func()

// SubscriptionsManager runs subscription goroutines in the background.
// Subscription functions are added via the channel and started as goroutines.
type SubscriptionsManager struct {
	ch chan SubscriptionFunc
}

func NewSubscriptionsManager() *SubscriptionsManager {
	return &SubscriptionsManager{
		ch: make(chan SubscriptionFunc, subsBuffSize),
	}
}

func (s *SubscriptionsManager) Add(f SubscriptionFunc) {
	s.ch <- f
}

func (s *SubscriptionsManager) Close() {
	close(s.ch)
}

func (s *SubscriptionsManager) Start(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case f := <-s.ch:
			go f()
		}
	}
}
