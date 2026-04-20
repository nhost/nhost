package configserver_test

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/nhost/nhost/cli/cmd/configserver"
	"github.com/nhost/nhost/cli/cmd/configserver/logsapi/model"
)

const composeServiceLabel = "com.docker.compose.service"

// stdcopyFrame builds a Docker stdcopy-multiplexed frame.
func stdcopyFrame(stream stdcopy.StdType, data string) []byte {
	header := [8]byte{}
	header[0] = byte(stream)
	binary.BigEndian.PutUint32(header[4:], uint32(len(data))) //nolint:gosec

	buf := make([]byte, 0, len(header)+len(data))
	buf = append(buf, header[:]...)
	buf = append(buf, []byte(data)...)

	return buf
}

// mockContainerClient is a minimal mock for testing DockerLogGatherer.
type mockContainerClient struct {
	client.ContainerAPIClient

	containers []container.Summary
	logData    map[string]*bytes.Buffer
}

func (m *mockContainerClient) ContainerList(
	_ context.Context,
	_ container.ListOptions,
) ([]container.Summary, error) {
	return m.containers, nil
}

func (m *mockContainerClient) ContainerLogs(
	_ context.Context,
	containerID string,
	_ container.LogsOptions,
) (io.ReadCloser, error) {
	buf, ok := m.logData[containerID]
	if !ok {
		return io.NopCloser(&bytes.Buffer{}), nil
	}

	return io.NopCloser(bytes.NewReader(buf.Bytes())), nil
}

func TestGetLogs(t *testing.T) {
	t.Parallel()

	logBuf := &bytes.Buffer{}
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:00Z line one\n"))
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:01Z line two\n"))

	mock := &mockContainerClient{ //nolint:exhaustruct
		containers: []container.Summary{
			{ //nolint:exhaustruct
				ID: "container-1",
				Labels: map[string]string{
					composeServiceLabel: "postgres",
				},
			},
		},
		logData: map[string]*bytes.Buffer{
			"container-1": logBuf,
		},
	}

	gatherer := configserver.NewDockerLogGatherer(mock, "test-project")

	logs, err := gatherer.GetLogs(
		context.Background(),
		"",
		"",
		time.Date(2024, 1, 15, 9, 0, 0, 0, time.UTC),
		time.Date(2024, 1, 15, 11, 0, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(logs) != 2 {
		t.Fatalf("got %d logs, want 2", len(logs))
	}

	if logs[0].Service != "postgres" {
		t.Errorf("logs[0].Service = %q, want %q", logs[0].Service, "postgres")
	}

	if logs[0].Log != "line one" {
		t.Errorf("logs[0].Log = %q, want %q", logs[0].Log, "line one")
	}
}

func TestGetLogsFiltering(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		lines       []string
		regexFilter string
		wantCount   int
	}{
		{
			name: "skips invalid lines",
			lines: []string{
				"2024-01-15T10:00:00Z valid line\n",
				"garbage-no-timestamp\n",
				"2024-01-15T10:00:02Z another valid\n",
			},
			regexFilter: "",
			wantCount:   2,
		},
		{
			name: "regex filter",
			lines: []string{
				"2024-01-15T10:00:00Z ERROR something failed\n",
				"2024-01-15T10:00:01Z INFO all good\n",
				"2024-01-15T10:00:02Z ERROR another failure\n",
			},
			regexFilter: "^ERROR",
			wantCount:   2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			logBuf := &bytes.Buffer{}
			for _, line := range tt.lines {
				logBuf.Write(stdcopyFrame(stdcopy.Stdout, line))
			}

			mock := &mockContainerClient{ //nolint:exhaustruct
				containers: []container.Summary{
					{ //nolint:exhaustruct
						ID:     "c1",
						Labels: map[string]string{composeServiceLabel: "svc"},
					},
				},
				logData: map[string]*bytes.Buffer{"c1": logBuf},
			}

			gatherer := configserver.NewDockerLogGatherer(mock, "proj")

			logs, err := gatherer.GetLogs(
				context.Background(), "", tt.regexFilter, time.Time{}, time.Now(),
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(logs) != tt.wantCount {
				t.Fatalf("got %d logs, want %d", len(logs), tt.wantCount)
			}
		})
	}
}

func TestGetLogsChronologicalOrder(t *testing.T) {
	t.Parallel()

	logBuf1 := &bytes.Buffer{}
	logBuf1.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:02Z second\n"))

	logBuf2 := &bytes.Buffer{}
	logBuf2.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:00Z first\n"))
	logBuf2.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:03Z third\n"))

	mock := &mockContainerClient{ //nolint:exhaustruct
		containers: []container.Summary{
			{ID: "c1", Labels: map[string]string{composeServiceLabel: "svc1"}}, //nolint:exhaustruct
			{ID: "c2", Labels: map[string]string{composeServiceLabel: "svc2"}}, //nolint:exhaustruct
		},
		logData: map[string]*bytes.Buffer{
			"c1": logBuf1,
			"c2": logBuf2,
		},
	}

	gatherer := configserver.NewDockerLogGatherer(mock, "proj")

	logs, err := gatherer.GetLogs(context.Background(), "", "", time.Time{}, time.Now())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(logs) != 3 {
		t.Fatalf("got %d logs, want 3", len(logs))
	}

	for i := 1; i < len(logs); i++ {
		if logs[i].Timestamp.Before(logs[i-1].Timestamp) {
			t.Errorf("logs not sorted: logs[%d].Timestamp=%v < logs[%d].Timestamp=%v",
				i, logs[i].Timestamp, i-1, logs[i-1].Timestamp)
		}
	}
}

func TestGetServiceLabelValues(t *testing.T) {
	t.Parallel()

	mock := &mockContainerClient{ //nolint:exhaustruct
		containers: []container.Summary{
			{ //nolint:exhaustruct
				ID:     "c1",
				Labels: map[string]string{composeServiceLabel: "postgres"},
			},
			{ //nolint:exhaustruct
				ID:     "c2",
				Labels: map[string]string{composeServiceLabel: "auth"},
			},
			{ //nolint:exhaustruct
				ID:     "c3",
				Labels: map[string]string{composeServiceLabel: "postgres"},
			},
			{ //nolint:exhaustruct
				ID:     "c4",
				Labels: map[string]string{composeServiceLabel: "storage"},
			},
		},
	}

	gatherer := configserver.NewDockerLogGatherer(mock, "proj")

	labels, err := gatherer.GetServiceLabelValues(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := []string{"auth", "postgres", "storage"}
	if len(labels) != len(want) {
		t.Fatalf("got %d labels, want %d", len(labels), len(want))
	}

	for i, label := range labels {
		if label != want[i] {
			t.Errorf("labels[%d] = %q, want %q", i, label, want[i])
		}
	}
}

func TestGetFunctionsLogs(t *testing.T) {
	t.Parallel()

	logBuf := &bytes.Buffer{}
	logBuf.Write(
		stdcopyFrame(stdcopy.Stdout, `2024-01-15T10:00:00Z {"path":"/api/hello","msg":"ok"}`+"\n"),
	)
	logBuf.Write(
		stdcopyFrame(
			stdcopy.Stdout,
			`2024-01-15T10:00:01Z {"path":"/api/other","msg":"nope"}`+"\n",
		),
	)
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:02Z plain text\n"))

	mock := &mockContainerClient{ //nolint:exhaustruct
		containers: []container.Summary{
			{ //nolint:exhaustruct
				ID:     "fn1",
				Labels: map[string]string{composeServiceLabel: "functions"},
			},
		},
		logData: map[string]*bytes.Buffer{"fn1": logBuf},
	}

	gatherer := configserver.NewDockerLogGatherer(mock, "proj")

	logs, err := gatherer.GetFunctionsLogs(
		context.Background(), "/api/hello", time.Time{}, time.Now(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(logs) != 1 {
		t.Fatalf("got %d logs, want 1", len(logs))
	}

	if logs[0].Service != "functions" {
		t.Errorf("service = %q, want %q", logs[0].Service, "functions")
	}
}

func collectLogs(ch <-chan []model.Log) []model.Log {
	var got []model.Log

	for batch := range ch {
		got = append(got, batch...)
	}

	return got
}

func TestTailLogsClosesChannelAndDeliversBacklog(t *testing.T) {
	t.Parallel()

	logBuf := &bytes.Buffer{}
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:00Z line one\n"))
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:01Z line two\n"))
	logBuf.Write(stdcopyFrame(stdcopy.Stderr, "2024-01-15T10:00:02Z line three\n"))

	mock := &mockContainerClient{ //nolint:exhaustruct
		containers: []container.Summary{
			{ID: "c1", Labels: map[string]string{composeServiceLabel: "svc"}}, //nolint:exhaustruct
		},
		logData: map[string]*bytes.Buffer{"c1": logBuf},
	}

	gatherer := configserver.NewDockerLogGatherer(mock, "proj")

	ch := make(chan []model.Log, 10)

	err := gatherer.TailLogs(t.Context(), "", "", time.Time{}, ch)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var batches [][]model.Log
	for batch := range ch {
		batches = append(batches, batch)
	}

	// All three entries should arrive in the initial backlog batch.
	if len(batches) != 1 {
		t.Fatalf("got %d batches, want 1 (backlog should be a single payload)", len(batches))
	}

	logs := batches[0]
	if len(logs) != 3 {
		t.Fatalf("got %d logs, want 3", len(logs))
	}

	if logs[0].Log != "line one" {
		t.Errorf("logs[0].Log = %q, want %q", logs[0].Log, "line one")
	}
}

func TestTailLogsRegexFilter(t *testing.T) {
	t.Parallel()

	logBuf := &bytes.Buffer{}
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:00Z ERROR boom\n"))
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:01Z INFO nope\n"))
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:02Z ERROR again\n"))

	mock := &mockContainerClient{ //nolint:exhaustruct
		containers: []container.Summary{
			{ID: "c1", Labels: map[string]string{composeServiceLabel: "svc"}}, //nolint:exhaustruct
		},
		logData: map[string]*bytes.Buffer{"c1": logBuf},
	}

	gatherer := configserver.NewDockerLogGatherer(mock, "proj")

	ch := make(chan []model.Log, 10)

	if err := gatherer.TailLogs(t.Context(), "", "^ERROR", time.Time{}, ch); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	logs := collectLogs(ch)
	if len(logs) != 2 {
		t.Fatalf("got %d logs, want 2", len(logs))
	}
}

func TestTailLogsCtxCancel(t *testing.T) {
	t.Parallel()

	logBuf := &bytes.Buffer{}
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:00Z one\n"))

	mock := &mockContainerClient{ //nolint:exhaustruct
		containers: []container.Summary{
			{ID: "c1", Labels: map[string]string{composeServiceLabel: "svc"}}, //nolint:exhaustruct
		},
		logData: map[string]*bytes.Buffer{"c1": logBuf},
	}

	gatherer := configserver.NewDockerLogGatherer(mock, "proj")

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	ch := make(chan []model.Log, 10)

	if err := gatherer.TailLogs(ctx, "", "", time.Time{}, ch); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Channel must be closed even with canceled ctx.
	if _, ok := <-ch; ok {
		// drain in case a racing send happened
		for range ch { //nolint:revive
		}
	}
}

func TestTailFunctionsLogsFiltersByPath(t *testing.T) {
	t.Parallel()

	logBuf := &bytes.Buffer{}
	logBuf.Write(
		stdcopyFrame(stdcopy.Stdout, `2024-01-15T10:00:00Z {"path":"/api/hello","msg":"ok"}`+"\n"),
	)
	logBuf.Write(
		stdcopyFrame(
			stdcopy.Stdout,
			`2024-01-15T10:00:01Z {"path":"/api/other","msg":"nope"}`+"\n",
		),
	)
	logBuf.Write(
		stdcopyFrame(stdcopy.Stdout, `2024-01-15T10:00:02Z {"path":"/api/hello","msg":"two"}`+"\n"),
	)

	mock := &mockContainerClient{ //nolint:exhaustruct
		containers: []container.Summary{
			{ //nolint:exhaustruct
				ID:     "fn1",
				Labels: map[string]string{composeServiceLabel: "functions"},
			},
		},
		logData: map[string]*bytes.Buffer{"fn1": logBuf},
	}

	gatherer := configserver.NewDockerLogGatherer(mock, "proj")

	ch := make(chan []model.Log, 10)

	if err := gatherer.TailFunctionsLogs(t.Context(), "/api/hello", time.Time{}, ch); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	logs := collectLogs(ch)
	if len(logs) != 2 {
		t.Fatalf("got %d logs, want 2", len(logs))
	}

	for _, l := range logs {
		if l.Service != "functions" {
			t.Errorf("service = %q, want functions", l.Service)
		}
	}
}

func TestGetLogsStderrAndStdout(t *testing.T) {
	t.Parallel()

	logBuf := &bytes.Buffer{}
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:00Z from stdout\n"))
	logBuf.Write(stdcopyFrame(stdcopy.Stderr, "2024-01-15T10:00:01Z from stderr\n"))

	mock := &mockContainerClient{ //nolint:exhaustruct
		containers: []container.Summary{
			{ID: "c1", Labels: map[string]string{composeServiceLabel: "svc"}}, //nolint:exhaustruct
		},
		logData: map[string]*bytes.Buffer{"c1": logBuf},
	}

	gatherer := configserver.NewDockerLogGatherer(mock, "proj")

	logs, err := gatherer.GetLogs(context.Background(), "", "", time.Time{}, time.Now())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(logs) != 2 {
		t.Fatalf("got %d logs, want 2", len(logs))
	}
}

// flakyContainerClient returns an error for one specific container ID, to
// exercise the mid-loop ContainerLogs failure path.
type flakyContainerClient struct {
	client.ContainerAPIClient

	containers []container.Summary
	logData    map[string]*bytes.Buffer
	failOnID   string
}

func (m *flakyContainerClient) ContainerList(
	_ context.Context,
	_ container.ListOptions,
) ([]container.Summary, error) {
	return m.containers, nil
}

var errBoom = errors.New("boom")

func (m *flakyContainerClient) ContainerLogs(
	_ context.Context,
	containerID string,
	_ container.LogsOptions,
) (io.ReadCloser, error) {
	if containerID == m.failOnID {
		return nil, errBoom
	}

	if buf, ok := m.logData[containerID]; ok {
		return io.NopCloser(bytes.NewReader(buf.Bytes())), nil
	}

	return io.NopCloser(&bytes.Buffer{}), nil
}

// TestTailLogsPartialContainerLogsFailure guards against a regression where a
// mid-loop ContainerLogs failure returned early while goroutines were still
// sending to logsCh, panicking when the deferred close fired.
func TestTailLogsPartialContainerLogsFailure(t *testing.T) {
	t.Parallel()

	logBuf := &bytes.Buffer{}
	logBuf.Write(stdcopyFrame(stdcopy.Stdout, "2024-01-15T10:00:00Z ok\n"))

	mock := &flakyContainerClient{ //nolint:exhaustruct
		containers: []container.Summary{
			{ID: "c1", Labels: map[string]string{composeServiceLabel: "a"}}, //nolint:exhaustruct
			{ID: "c2", Labels: map[string]string{composeServiceLabel: "b"}}, //nolint:exhaustruct
		},
		logData:  map[string]*bytes.Buffer{"c1": logBuf},
		failOnID: "c2",
	}

	gatherer := configserver.NewDockerLogGatherer(mock, "proj")

	ch := make(chan []model.Log, 10)

	err := gatherer.TailLogs(t.Context(), "", "", time.Time{}, ch)
	if !errors.Is(err, errBoom) {
		t.Fatalf("err = %v, want to wrap errBoom", err)
	}

	// Channel must be closed; no panic. Drain in case c1 delivered anything
	// before we bailed out (should be nothing, since we open readers first).
	for range ch { //nolint:revive
	}
}
