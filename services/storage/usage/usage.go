// Package usage reads the stored-byte counter and exposes it as a Prometheus metric.
package usage

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
)

// Querier reads the total uploaded bytes.
//
//go:generate mockgen -package mock -destination mock/querier.go . Querier
type Querier interface {
	Total(ctx context.Context) (int64, error)
}

// Reader reads the counter from Postgres.
type Reader struct{ pool *pgxpool.Pool }

// NewReader constructs a reader backed by a pool.
func NewReader(pool *pgxpool.Pool) *Reader { return &Reader{pool: pool} }

// Total returns the singleton counter value, or an error if it is absent.
func (r *Reader) Total(ctx context.Context) (int64, error) {
	var total int64
	if err := r.pool.QueryRow(ctx, "SELECT total_bytes FROM storage.usage WHERE id = true").
		Scan(&total); err != nil {
		return 0, fmt.Errorf("read storage usage: %w", err)
	}

	return total, nil
}

// Collector exports the total uploaded bytes without labels.
type Collector struct {
	querier Querier
	desc    *prometheus.Desc
}

// NewCollector constructs a collector for the storage usage gauge.
func NewCollector(querier Querier) *Collector {
	return &Collector{
		querier: querier,
		desc: prometheus.NewDesc(
			"nhost_storage_total_bytes",
			"Total uploaded storage bytes.",
			nil,
			nil,
		),
	}
}

// Describe sends the gauge descriptor.
func (c *Collector) Describe(ch chan<- *prometheus.Desc) { ch <- c.desc }

// Collect reads the counter on each scrape; read failures invalidate the scrape.
func (c *Collector) Collect(ch chan<- prometheus.Metric) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second) //nolint:mnd
	defer cancel()

	total, err := c.querier.Total(ctx)
	if err != nil {
		ch <- prometheus.NewInvalidMetric(c.desc, fmt.Errorf("collect storage usage: %w", err))
		return
	}

	ch <- prometheus.MustNewConstMetric(c.desc, prometheus.GaugeValue, float64(total))
}
