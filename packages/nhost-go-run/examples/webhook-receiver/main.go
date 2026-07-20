// Command webhook-receiver is a minimal Nhost Run service built on
// nhost-go-run: it receives authenticated webhooks and lets the runservice
// package answer the platform's GET /healthz probe and own the server
// lifecycle.
//
// The health check reports the service as unhealthy (503) until WEBHOOK_SECRET
// is configured, since without it we cannot authenticate incoming webhooks — so
// a misconfigured deploy is restarted instead of silently rejecting every
// request.
//
// Run it locally with:
//
//	WEBHOOK_SECRET=dev-secret go run .
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"sync/atomic"

	runservice "github.com/nhost/nhost/packages/nhost-go-run"
)

var (
	received    atomic.Int64
	errNoSecret = errors.New("WEBHOOK_SECRET is not configured")
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", handleRoot)
	mux.HandleFunc("POST /webhook", handleWebhook)

	addr := ":" + port()
	log.Printf("webhook-receiver listening on %s", addr)

	// Serve mounts GET /healthz (backed by health) and delegates everything
	// else to mux, draining in-flight requests on SIGINT/SIGTERM.
	if err := runservice.Serve(context.Background(), addr, mux, health); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}

	return "8080"
}

// health backs GET /healthz.
func health(context.Context) error {
	if os.Getenv("WEBHOOK_SECRET") == "" {
		return errNoSecret
	}

	return nil
}

func handleRoot(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"service":  "webhook-receiver",
		"received": received.Load(),
	})
}

func handleWebhook(w http.ResponseWriter, r *http.Request) {
	secret := os.Getenv("WEBHOOK_SECRET")
	if secret == "" || r.Header.Get("X-Webhook-Secret") != secret {
		http.Error(w, "invalid or missing webhook secret", http.StatusUnauthorized)

		return
	}

	var payload struct {
		Type string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)

		return
	}

	if payload.Type == "" {
		payload.Type = "unknown"
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"event":    payload.Type,
		"received": received.Add(1),
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
