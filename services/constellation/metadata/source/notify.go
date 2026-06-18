package source

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
)

// metadataChannel is the Postgres LISTEN/NOTIFY channel Constellation uses to
// propagate metadata changes across replicas that share one
// hdb_catalog.hdb_metadata. A writer emits the new resource_version as the
// payload after every committed metadata change; listeners reload their
// in-memory snapshot when they observe a version newer than their own. This is
// the cross-replica sync mechanism that replaces the legacy hdb_metadata
// poller in database mode.
const metadataChannel = "constellation_metadata_v1"

// notifyMetadataSQL emits a metadata-change notification carrying the new
// resource_version as its text payload. The channel is passed as a value to
// pg_notify (not interpolated into the statement), so there is no injection
// surface.
const notifyMetadataSQL = `SELECT pg_notify($1, $2)`

// notifyMetadataChange announces a committed metadata change on metadataChannel
// carrying rv as the payload. Best-effort: a failure here does not invalidate a
// write that already committed, so callers log and continue rather than fail.
func notifyMetadataChange(ctx context.Context, q Queryer, rv int64) error {
	rows, err := q.Query(ctx, notifyMetadataSQL, metadataChannel, strconv.FormatInt(rv, 10))
	if err != nil {
		return fmt.Errorf("emitting metadata change notification: %w", err)
	}

	rows.Close()

	if err := rows.Err(); err != nil {
		return fmt.Errorf("emitting metadata change notification: %w", err)
	}

	return nil
}

// snapshotReloader is the subset of *Store the notify listener drives: it
// reloads the in-memory snapshot from the database when a newer
// resource_version is observed. Declared as an interface so ListenAndReload can
// be exercised with a fake in tests.
type snapshotReloader interface {
	ReloadIfStale(ctx context.Context, notifiedRV int64) (int64, IdempotencyCode, error)
}

// ListenAndReload subscribes to metadataChannel on a dedicated connection and
// reloads target whenever a peer announces a newer resource_version. It runs
// until ctx is cancelled, reconnecting with a fixed backoff if the listen
// connection drops, so a transient database blip does not permanently silence
// cross-replica metadata sync.
func ListenAndReload(
	ctx context.Context,
	databaseURL string,
	target snapshotReloader,
	logger *slog.Logger,
) {
	if logger == nil {
		logger = slog.Default()
	}

	const reconnectBackoff = 2 * time.Second

	for ctx.Err() == nil {
		err := listenOnce(ctx, databaseURL, target, logger)
		if ctx.Err() != nil {
			return
		}

		logger.WarnContext(
			ctx, "metadata notify listener disconnected; reconnecting",
			"error", err, "backoff", reconnectBackoff.String(),
		)

		select {
		case <-time.After(reconnectBackoff):
		case <-ctx.Done():
			return
		}
	}
}

// listenOnce opens a dedicated connection, LISTENs on metadataChannel, and
// dispatches reloads until ctx is cancelled or the connection fails.
func listenOnce(
	ctx context.Context,
	databaseURL string,
	target snapshotReloader,
	logger *slog.Logger,
) error {
	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("connecting metadata notify listener: %w", err)
	}

	defer func() { _ = conn.Close(context.WithoutCancel(ctx)) }()

	// metadataChannel is a fixed identifier constant; Sanitize quotes it safely.
	if _, err := conn.Exec(ctx, "LISTEN "+pgx.Identifier{metadataChannel}.Sanitize()); err != nil {
		return fmt.Errorf("listening on %s: %w", metadataChannel, err)
	}

	for {
		notification, err := conn.WaitForNotification(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}

			return fmt.Errorf("waiting for metadata notification: %w", err)
		}

		dispatchNotification(ctx, notification.Payload, target, logger)
	}
}

// dispatchNotification reloads target in response to a single notification
// payload. An unparseable payload maps to notifiedRV 0, which ReloadIfStale
// treats as an unconditional reload rather than risk skipping a real change.
// A reload failure is logged, not propagated: it must not tear down the listen
// connection, which would drop subsequent notifications.
func dispatchNotification(
	ctx context.Context, payload string, target snapshotReloader, logger *slog.Logger,
) {
	notifiedRV, parseErr := strconv.ParseInt(payload, 10, 64)
	if parseErr != nil {
		notifiedRV = 0
	}

	if _, _, err := target.ReloadIfStale(ctx, notifiedRV); err != nil {
		logger.ErrorContext(
			ctx, "reloading metadata after notification failed", "error", err,
		)
	}
}
