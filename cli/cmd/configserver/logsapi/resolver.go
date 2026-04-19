package logsapi

import (
	"context"
	"time"

	"github.com/nhost/nhost/cli/cmd/configserver/logsapi/model"
	"github.com/sirupsen/logrus"
)

// LogGatherer is the interface for gathering logs from Docker containers.
// This is a simplified version of bragi's LogGatherer, containing only
// the methods needed for local development.
type LogGatherer interface {
	GetLogs(
		ctx context.Context,
		service, regexFilter string,
		from, to time.Time,
	) ([]model.Log, error)
	TailLogs(
		ctx context.Context,
		service, regexFilter string,
		from time.Time,
		logsCh chan<- []model.Log,
	) error
	GetServiceLabelValues(ctx context.Context) ([]string, error)
	GetFunctionsLogs(
		ctx context.Context,
		path string,
		from, to time.Time,
	) ([]model.Log, error)
	TailFunctionsLogs(
		ctx context.Context,
		path string,
		from time.Time,
		logsCh chan<- []model.Log,
	) error
}

type Resolver struct {
	LogGatherer LogGatherer
	Logger      logrus.FieldLogger
}
