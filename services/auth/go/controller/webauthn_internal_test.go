package controller

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
)

func TestWebauthnChallengeStorageConcurrentAccess(t *testing.T) {
	t.Parallel()

	w := &Webauthn{
		wa:        nil,
		storageMu: sync.RWMutex{},
		storage:   make(map[string]WebauthnChallenge),
	}
	allowedRoles := []string{"user", "me"}
	defaultRole := "user"
	displayName := "Jane Doe"
	locale := "en"
	metadata := map[string]any{"items": []any{"base"}}
	redirectTo := "http://localhost:3000"
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
		User: WebauthnUser{
			ID:           uuid.Nil,
			Name:         "",
			Email:        "",
			Credentials:  make([]webauthn.Credential, 1),
			Discoverable: true,
		},
		Options: &api.SignUpOptions{
			AllowedRoles: &allowedRoles,
			DefaultRole:  &defaultRole,
			DisplayName:  &displayName,
			Locale:       &locale,
			Metadata:     &metadata,
			RedirectTo:   &redirectTo,
		},
	}
	expiredChallenge := futureChallenge
	expiredChallenge.Session.Expires = time.Now().Add(-time.Minute)

	const (
		workers    = 16
		iterations = 20
	)

	start := make(chan struct{})
	failureCh := make(chan string, workers*2+1)

	var wg sync.WaitGroup
	for worker := range workers {
		wg.Go(func() {
			<-start

			for iteration := range iterations {
				key := fmt.Sprintf("future-%d-%d", worker, iteration)
				w.storeChallenge(key, futureChallenge)
				w.storeChallenge("expired-"+key, expiredChallenge)

				if _, ok := w.getChallenge(key); !ok {
					failureCh <- fmt.Sprintf("stored challenge %q not found", key)
					return
				}

				w.cleanCache()
			}
		})
	}

	close(start)
	wg.Wait()

	const sharedKey = "shared"
	w.storeChallenge(sharedKey, futureChallenge)

	mutationStart := make(chan struct{})

	var ready, mutationWG sync.WaitGroup
	ready.Add(workers)

	for worker := range workers {
		mutationWG.Go(func() {
			challenge, ok := w.getChallenge(sharedKey)

			ready.Done()

			if !ok {
				failureCh <- "shared challenge not found"
				return
			}

			<-mutationStart

			challenge.User.Credentials[0].Flags.UserPresent = true
			(*challenge.Options.AllowedRoles)[0] = fmt.Sprintf("role-%d", worker)
			*challenge.Options.DefaultRole = fmt.Sprintf("default-%d", worker)

			items, itemsOK := (*challenge.Options.Metadata)["items"].([]any)
			if !itemsOK {
				failureCh <- "shared challenge metadata items have an unexpected type"
				return
			}

			items[0] = worker
		})
	}

	ready.Wait()
	close(mutationStart)
	mutationWG.Wait()

	storedChallenge, ok := w.getChallenge(sharedKey)
	if !ok {
		failureCh <- "shared challenge not found after concurrent reads"
	} else {
		assertStoredChallengeUnchanged(storedChallenge, failureCh)
	}

	close(failureCh)

	for failure := range failureCh {
		t.Error(failure)
	}
}

func TestWebauthnStoreChallengeClonesCredentials(t *testing.T) {
	t.Parallel()

	w := &Webauthn{
		wa:        nil,
		storageMu: sync.RWMutex{},
		storage:   make(map[string]WebauthnChallenge),
	}
	credentials := make([]webauthn.Credential, 1)
	challenge := WebauthnChallenge{
		Session: webauthn.SessionData{
			Challenge:            "challenge",
			UserID:               nil,
			AllowedCredentialIDs: nil,
			Expires:              time.Now().Add(time.Minute),
			UserVerification:     "preferred",
			Extensions:           nil,
			RelyingPartyID:       "react-apollo.example.nhost.io",
		},
		User: WebauthnUser{
			ID:           uuid.Nil,
			Name:         "",
			Email:        "",
			Credentials:  credentials,
			Discoverable: true,
		},
		Options: nil,
	}

	w.storeChallenge(challenge.Session.Challenge, challenge)

	credentials[0].Flags.UserPresent = true

	storedChallenge, ok := w.getChallenge(challenge.Session.Challenge)
	if !ok {
		t.Fatal("stored challenge not found")
	}

	if storedChallenge.User.Credentials[0].Flags.UserPresent {
		t.Error("mutating caller credentials changed the stored challenge")
	}
}

func assertStoredChallengeUnchanged(challenge WebauthnChallenge, failureCh chan<- string) {
	if challenge.User.Credentials[0].Flags.UserPresent {
		failureCh <- "mutating a returned challenge changed the stored credentials"
	}

	if (*challenge.Options.AllowedRoles)[0] != "user" {
		failureCh <- "mutating returned options changed the stored allowed roles"
	}

	if *challenge.Options.DefaultRole != "user" {
		failureCh <- "mutating returned options changed the stored default role"
	}

	items, ok := (*challenge.Options.Metadata)["items"].([]any)
	if !ok {
		failureCh <- "stored challenge metadata items have an unexpected type"
		return
	}

	if items[0] != "base" {
		failureCh <- "mutating returned options changed the stored metadata"
	}
}
