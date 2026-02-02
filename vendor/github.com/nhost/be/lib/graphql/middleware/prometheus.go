package nhmiddleware

import (
	"context"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

func PrometheusGraphqlAroundFieldsInstrumentation() graphql.FieldMiddleware {
	const (
		success = "success"
		failure = "failure"
	)

	requestsStarted := promauto.NewCounterVec(
		prometheus.CounterOpts{ //nolint: exhaustruct
			Name: "graphql_requests_started_total",
			Help: "Total number of graphql requests started.",
		},
		[]string{"operation", "root"},
	)

	requestsCompletedCounter := promauto.NewCounterVec(
		prometheus.CounterOpts{ //nolint: exhaustruct
			Name: "graphql_requests_completed_total",
			Help: "Total number of graphql requests completed.",
		},
		[]string{"operation", "root", "exist_status"},
	)

	timeToHandleActionHistogram := promauto.NewHistogramVec(
		prometheus.HistogramOpts{ //nolint: exhaustruct
			Name:    "requests_duration_miliseconds",
			Help:    "The time taken to handle a graphql request.",
			Buckets: prometheus.ExponentialBuckets(1, 2, 11), //nolint: mnd
		},
		[]string{"operation", "root", "exist_status"},
	)

	return func(ctx context.Context, next graphql.Resolver) (any, error) {
		oc := graphql.GetOperationContext(ctx)
		rc := graphql.GetFieldContext(ctx)

		operationType := rc.Object
		rootField := rc.Field.Name

		requestsStarted.WithLabelValues(operationType, rootField).Inc()

		res, err := next(ctx)

		status := success
		if err != nil {
			status = failure
		}

		requestsCompletedCounter.WithLabelValues(operationType, rootField, status).Inc()

		timeToHandleActionHistogram.WithLabelValues(operationType, rootField, status).
			Observe(float64(time.Since(oc.Stats.OperationStart).Milliseconds()))

		return res, err
	}
}
