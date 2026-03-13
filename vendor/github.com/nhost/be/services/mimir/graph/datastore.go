package graph

import "context"

// DataStore is an interface for storing and retrieving app configurations.
type DataStore interface {
	GetApp(appID string) (*App, error)
	SetApp(appID string, app *App)
	DeleteApp(appID string)
	Range(fn func(appID string, app *App) bool)
	Len() int
}

// Fetcher fetches app data from an external source for lazy loading.
//
//go:generate mockgen -package graphmock -destination mock/fetcher.go . Fetcher
type Fetcher interface {
	FetchApp(ctx context.Context, appID string) (*App, error)
	FetchAllAppIDs(ctx context.Context) ([]string, error)
}
