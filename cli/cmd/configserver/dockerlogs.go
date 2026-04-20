package configserver

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/nhost/nhost/cli/cmd/configserver/logsapi/model"
)

const (
	composeProjectLabel = "com.docker.compose.project"
	composeServiceLabel = "com.docker.compose.service"
)

// DockerLogGatherer implements the logs.LogGatherer interface
// by reading Docker container logs via the Docker API.
type DockerLogGatherer struct {
	client      client.ContainerAPIClient
	projectName string
}

func NewDockerLogGatherer(
	dockerClient client.ContainerAPIClient,
	projectName string,
) *DockerLogGatherer {
	return &DockerLogGatherer{
		client:      dockerClient,
		projectName: projectName,
	}
}

func (d *DockerLogGatherer) listContainers(
	ctx context.Context,
	service string,
) ([]container.Summary, error) {
	f := filters.NewArgs()
	f.Add("label", composeProjectLabel+"="+d.projectName)

	if service != "" {
		f.Add("label", composeServiceLabel+"="+service)
	}

	containers, err := d.client.ContainerList(ctx, container.ListOptions{ //nolint:exhaustruct
		Filters: f,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	return containers, nil
}

func (d *DockerLogGatherer) GetLogs(
	ctx context.Context,
	service, regexFilter string,
	from, to time.Time,
) ([]model.Log, error) {
	containers, err := d.listContainers(ctx, service)
	if err != nil {
		return nil, err
	}

	var allLogs []model.Log

	for _, c := range containers {
		svcName := c.Labels[composeServiceLabel]

		reader, err := d.client.ContainerLogs(ctx, c.ID, container.LogsOptions{ //nolint:exhaustruct
			ShowStdout: true,
			ShowStderr: true,
			Timestamps: true,
			Since:      from.Format(time.RFC3339Nano),
			Until:      to.Format(time.RFC3339Nano),
		})
		if err != nil {
			return nil, fmt.Errorf("failed to get logs for container %s: %w", svcName, err)
		}

		logs, err := parseLogs(reader, svcName)
		reader.Close()

		if err != nil {
			return nil, fmt.Errorf("failed to parse logs for container %s: %w", svcName, err)
		}

		allLogs = append(allLogs, logs...)
	}

	sort.Slice(allLogs, func(i, j int) bool {
		return allLogs[i].Timestamp.Before(allLogs[j].Timestamp)
	})

	if regexFilter != "" {
		re, err := regexp.Compile(regexFilter)
		if err != nil {
			return nil, fmt.Errorf("failed to compile regex filter: %w", err)
		}

		filtered := make([]model.Log, 0, len(allLogs))
		for _, l := range allLogs {
			if re.MatchString(l.Log) {
				filtered = append(filtered, l)
			}
		}

		allLogs = filtered
	}

	return allLogs, nil
}

type tailReader struct {
	r       io.ReadCloser
	svcName string
}

func (d *DockerLogGatherer) openTailReaders(
	ctx context.Context,
	containers []container.Summary,
	from time.Time,
) ([]tailReader, error) {
	readers := make([]tailReader, 0, len(containers))

	for _, c := range containers {
		svcName := c.Labels[composeServiceLabel]

		reader, err := d.client.ContainerLogs(ctx, c.ID, container.LogsOptions{ //nolint:exhaustruct
			ShowStdout: true,
			ShowStderr: true,
			Timestamps: true,
			Follow:     true,
			Since:      from.Format(time.RFC3339Nano),
		})
		if err != nil {
			for _, rd := range readers {
				rd.r.Close()
			}

			return nil, fmt.Errorf("failed to tail logs for container %s: %w", svcName, err)
		}

		readers = append(readers, tailReader{r: reader, svcName: svcName})
	}

	return readers, nil
}

func (d *DockerLogGatherer) TailLogs(
	ctx context.Context,
	service, regexFilter string,
	from time.Time,
	logsCh chan<- []model.Log,
) error {
	defer close(logsCh)

	containers, err := d.listContainers(ctx, service)
	if err != nil {
		return err
	}

	var re *regexp.Regexp
	if regexFilter != "" {
		re, err = regexp.Compile(regexFilter)
		if err != nil {
			return fmt.Errorf("failed to compile regex filter: %w", err)
		}
	}

	// Open every reader before starting any writer goroutine. If ContainerLogs
	// fails partway, earlier readers are closed and we return without having
	// launched anything — otherwise `defer close(logsCh)` could fire while an
	// already-started goroutine was still sending, panicking on a closed chan.
	readers, err := d.openTailReaders(ctx, containers, from)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup

	for _, rd := range readers {
		wg.Add(1)

		go func(reader io.ReadCloser, svcName string) {
			defer wg.Done()
			defer reader.Close()

			// Close reader on ctx cancel so scanner.Scan() unblocks.
			done := make(chan struct{})
			defer close(done)

			go func() {
				select {
				case <-ctx.Done():
					reader.Close()
				case <-done:
				}
			}()

			tailContainerLogs(ctx, reader, svcName, re, logsCh)
		}(rd.r, rd.svcName)
	}

	wg.Wait()

	return nil
}

func (d *DockerLogGatherer) GetServiceLabelValues(
	ctx context.Context,
) ([]string, error) {
	containers, err := d.listContainers(ctx, "")
	if err != nil {
		return nil, err
	}

	seen := make(map[string]struct{})

	for _, c := range containers {
		if svc, ok := c.Labels[composeServiceLabel]; ok {
			seen[svc] = struct{}{}
		}
	}

	labels := make([]string, 0, len(seen))
	for svc := range seen {
		labels = append(labels, svc)
	}

	sort.Strings(labels)

	return labels, nil
}

const functionsService = "functions"

func (d *DockerLogGatherer) GetFunctionsLogs(
	ctx context.Context,
	path string,
	from, to time.Time,
) ([]model.Log, error) {
	containers, err := d.listContainers(ctx, functionsService)
	if err != nil {
		return nil, err
	}

	var allLogs []model.Log

	for _, c := range containers {
		reader, err := d.client.ContainerLogs(ctx, c.ID, container.LogsOptions{ //nolint:exhaustruct
			ShowStdout: true,
			ShowStderr: true,
			Timestamps: true,
			Since:      from.Format(time.RFC3339Nano),
			Until:      to.Format(time.RFC3339Nano),
		})
		if err != nil {
			return nil, fmt.Errorf("failed to get functions logs: %w", err)
		}

		logs, err := parseLogs(reader, functionsService)
		reader.Close()

		if err != nil {
			return nil, fmt.Errorf("failed to parse functions logs: %w", err)
		}

		allLogs = append(allLogs, logs...)
	}

	sort.Slice(allLogs, func(i, j int) bool {
		return allLogs[i].Timestamp.Before(allLogs[j].Timestamp)
	})

	allLogs = filterByJSONPath(allLogs, path)

	return allLogs, nil
}

func (d *DockerLogGatherer) TailFunctionsLogs(
	ctx context.Context,
	path string,
	from time.Time,
	logsCh chan<- []model.Log,
) error {
	defer close(logsCh)

	containers, err := d.listContainers(ctx, functionsService)
	if err != nil {
		return err
	}

	// See TailLogs: open every reader before launching any goroutine so a
	// mid-way ContainerLogs failure can't leave writers sending on a channel
	// we're about to close.
	readers, err := d.openTailReaders(ctx, containers, from)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup

	for _, rd := range readers {
		wg.Add(1)

		go func(reader io.ReadCloser) {
			defer wg.Done()
			defer reader.Close()

			done := make(chan struct{})
			defer close(done)

			go func() {
				select {
				case <-ctx.Done():
					reader.Close()
				case <-done:
				}
			}()

			tailFunctionsContainerLogs(ctx, reader, path, logsCh)
		}(rd.r)
	}

	wg.Wait()

	return nil
}

// filterByJSONPath filters log entries whose message contains a JSON object
// with a "path" field matching the given path.
func filterByJSONPath(logs []model.Log, path string) []model.Log {
	filtered := make([]model.Log, 0, len(logs))

	for _, l := range logs {
		if matchesJSONPath(l.Log, path) {
			filtered = append(filtered, l)
		}
	}

	return filtered
}

func matchesJSONPath(logLine, path string) bool {
	var obj struct {
		Path string `json:"path"`
	}

	if err := json.Unmarshal([]byte(logLine), &obj); err != nil {
		return false
	}

	return obj.Path == path
}

// tailFunctionsContainerLogs reads a Docker log stream and sends entries matching the path.
func tailFunctionsContainerLogs(
	ctx context.Context,
	reader io.Reader,
	path string,
	logsCh chan<- []model.Log,
) {
	lineCh := make(chan model.Log)

	go scanLines(ctx, reader, functionsService, func(l model.Log) bool {
		return matchesJSONPath(l.Log, path)
	}, lineCh)

	sendBacklogThenTail(ctx, lineCh, logsCh)
}

// parseLogs demuxes a Docker log stream and parses timestamped log lines.
func parseLogs(reader io.Reader, serviceName string) ([]model.Log, error) {
	var stdout, stderr bytes.Buffer
	if _, err := stdcopy.StdCopy(&stdout, &stderr, reader); err != nil {
		return nil, fmt.Errorf("failed to demux docker log stream: %w", err)
	}

	var logs []model.Log

	for _, buf := range []*bytes.Buffer{&stdout, &stderr} {
		scanner := bufio.NewScanner(buf)
		for scanner.Scan() {
			line := scanner.Text()

			logEntry, err := parseLogLine(line, serviceName)
			if err != nil {
				continue
			}

			logs = append(logs, logEntry)
		}
	}

	return logs, nil
}

// parseLogLine parses a single Docker log line with timestamp prefix.
// Format: "2006-01-02T15:04:05.999999999Z message text".
func parseLogLine(line, serviceName string) (model.Log, error) {
	before, after, ok := strings.Cut(line, " ")
	if !ok {
		return model.Log{}, fmt.Errorf("invalid log line format: %s", line) //nolint:err113
	}

	ts, err := time.Parse(time.RFC3339Nano, before)
	if err != nil {
		return model.Log{}, fmt.Errorf("failed to parse timestamp: %w", err)
	}

	return model.Log{
		Timestamp: ts,
		Service:   serviceName,
		Log:       after,
	}, nil
}

// tailContainerLogs reads a Docker log stream and sends parsed log entries to the channel.
func tailContainerLogs(
	ctx context.Context,
	reader io.Reader,
	serviceName string,
	re *regexp.Regexp,
	logsCh chan<- []model.Log,
) {
	lineCh := make(chan model.Log)

	go scanLines(ctx, reader, serviceName, func(l model.Log) bool {
		return re == nil || re.MatchString(l.Log)
	}, lineCh)

	sendBacklogThenTail(ctx, lineCh, logsCh)
}

// scanLines demuxes a Docker log stream, parses timestamped lines, applies the
// filter, and forwards matching entries to lineCh. Closes lineCh on exit.
func scanLines(
	ctx context.Context,
	reader io.Reader,
	serviceName string,
	keep func(model.Log) bool,
	lineCh chan<- model.Log,
) {
	defer close(lineCh)

	// For Follow mode, stdcopy.StdCopy blocks until the stream ends.
	// We use a pipe to demux and scan concurrently.
	pr, pw := io.Pipe()

	go func() {
		_, err := stdcopy.StdCopy(pw, pw, reader)
		pw.CloseWithError(err)
	}()

	scanner := bufio.NewScanner(pr)
	for scanner.Scan() {
		line := scanner.Text()

		logEntry, err := parseLogLine(line, serviceName)
		if err != nil {
			continue
		}

		if keep != nil && !keep(logEntry) {
			continue
		}

		select {
		case lineCh <- logEntry:
		case <-ctx.Done():
			return
		}
	}
}

// backlogIdleTimeout is how long sendBacklogThenTail waits for another entry
// before flushing the initial backlog as a single batch and switching to
// one-entry-per-payload live tailing.
const backlogIdleTimeout = 200 * time.Millisecond

// sendBacklogThenTail batches the first wave of entries (the replay of logs
// since `from`) into a single []model.Log payload, flushing once the stream
// idles. After that, every subsequent entry is sent as its own payload so live
// logs arrive without added latency.
func sendBacklogThenTail(
	ctx context.Context,
	lineCh <-chan model.Log,
	logsCh chan<- []model.Log,
) {
	if !drainBacklog(ctx, lineCh, logsCh) {
		return
	}

	tailLive(ctx, lineCh, logsCh)
}

// drainBacklog collects entries from lineCh until the stream idles for
// backlogIdleTimeout, then flushes them as a single payload. Returns false if
// the stream or context ended (caller should stop).
func drainBacklog(
	ctx context.Context,
	lineCh <-chan model.Log,
	logsCh chan<- []model.Log,
) bool {
	var pending []model.Log

	select {
	case <-ctx.Done():
		return false
	case entry, ok := <-lineCh:
		if !ok {
			return false
		}

		pending = append(pending, entry)
	}

	idle := time.NewTimer(backlogIdleTimeout)
	defer idle.Stop()

	for {
		select {
		case <-ctx.Done():
			return false
		case entry, ok := <-lineCh:
			if !ok {
				flushBatch(ctx, pending, logsCh)
				return false
			}

			pending = append(pending, entry)

			idle.Reset(backlogIdleTimeout)
		case <-idle.C:
			return flushBatch(ctx, pending, logsCh)
		}
	}
}

// tailLive forwards entries one-per-payload until the stream or context ends.
func tailLive(
	ctx context.Context,
	lineCh <-chan model.Log,
	logsCh chan<- []model.Log,
) {
	for {
		select {
		case <-ctx.Done():
			return
		case entry, ok := <-lineCh:
			if !ok {
				return
			}

			select {
			case logsCh <- []model.Log{entry}:
			case <-ctx.Done():
				return
			}
		}
	}
}

func flushBatch(ctx context.Context, batch []model.Log, logsCh chan<- []model.Log) bool {
	if len(batch) == 0 {
		return true
	}

	select {
	case logsCh <- batch:
		return true
	case <-ctx.Done():
		return false
	}
}
