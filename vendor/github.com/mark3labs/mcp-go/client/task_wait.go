package client

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
)

var (
	// ErrInvalidFallbackPollInterval is returned when WaitForTask receives a
	// non-positive fallback polling interval.
	ErrInvalidFallbackPollInterval = errors.New("fallback poll interval must be greater than zero")
	// ErrServerPollIntervalOverflow is returned when a server-provided polling
	// interval cannot be represented by time.Duration.
	ErrServerPollIntervalOverflow = errors.New("server poll interval exceeds time.Duration")
)

// WaitForTask polls a task until it reaches a terminal state or the context is done.
// The server-provided poll interval takes precedence over fallbackPollInterval.
func (c *Client) WaitForTask(
	ctx context.Context,
	request mcp.GetTaskRequest,
	fallbackPollInterval time.Duration,
) (*mcp.GetTaskResult, error) {
	if fallbackPollInterval <= 0 {
		return nil, ErrInvalidFallbackPollInterval
	}

	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		result, err := c.GetTask(ctx, request)
		if err != nil {
			return nil, fmt.Errorf("get task: %w", err)
		}
		if result.Status.IsTerminal() {
			return result, nil
		}

		interval := fallbackPollInterval
		if result.PollInterval != nil && *result.PollInterval > 0 {
			const maxPollIntervalMilliseconds = int64(1<<63-1) / int64(time.Millisecond)
			if *result.PollInterval > maxPollIntervalMilliseconds {
				return nil, ErrServerPollIntervalOverflow
			}
			interval = time.Duration(*result.PollInterval) * time.Millisecond
		}

		timer := time.NewTimer(interval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, ctx.Err()
		case <-timer.C:
		}
	}
}
