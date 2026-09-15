package controller

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/nhost/nhost/internal/lib/syncmap"
)

func TestWebauthnChallengeStorageConcurrentAccess(t *testing.T) {
	t.Parallel()

	w := &Webauthn{
		wa:      nil,
		Storage: syncmap.New[string, WebauthnChallenge](),
	}
	futureChallenge := WebauthnChallenge{
		Session: webauthn.SessionData{
			Challenge:            "future",
			UserID:               nil,
			AllowedCredentialIDs: nil,
			Expires:              time.Now().Add(time.Minute),
			UserVerification:     "preferred",
			Extensions:           nil,
			RelyingPartyID:       "react-apollo.example.nhost.io",
		},
		User:    WebauthnUser{},
		Options: nil,
	}
	expiredChallenge := futureChallenge
	expiredChallenge.Session.Expires = time.Now().Add(-time.Minute)

	const (
		workers    = 16
		iterations = 20
	)

	start := make(chan struct{})
	failureCh := make(chan string, workers)

	var wg sync.WaitGroup
	for worker := range workers {
		wg.Go(func() {
			<-start

			for iteration := range iterations {
				key := fmt.Sprintf("future-%d-%d", worker, iteration)
				w.Storage.Store(key, futureChallenge)
				w.Storage.Store("expired-"+key, expiredChallenge)

				if _, ok := w.Storage.Load(key); !ok {
					failureCh <- fmt.Sprintf("stored challenge %q not found", key)
					return
				}

				w.cleanCache()
			}
		})
	}

	close(start)
	wg.Wait()
	close(failureCh)

	for failure := range failureCh {
		t.Error(failure)
	}
}
