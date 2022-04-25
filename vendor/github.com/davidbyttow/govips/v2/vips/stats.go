package vips

import "sync"

// RuntimeStats is a data structure to house a map of govips operation counts
type RuntimeStats struct {
	OperationCounts map[string]int64
}

var (
	operationCounter chan string
	runtimeStats     *RuntimeStats
	statLock         sync.RWMutex
)

func incOpCounter(op string) {
	if operationCounter != nil {
		operationCounter <- op
	}
}

func collectStats() chan struct{} {
	operationCounter = make(chan string, 100)
	done := make(chan struct{})
	exit := false
	go func() {
		for !exit {
			select {
			case op := <-operationCounter:
				statLock.Lock()
				runtimeStats.OperationCounts[op] = runtimeStats.OperationCounts[op] + 1
				statLock.Unlock()
			case <-done:
				exit = true
				break
			}
		}
	}()
	return done
}

// ReadRuntimeStats returns operation counts for govips
func ReadRuntimeStats(stats *RuntimeStats) {
	statLock.RLock()
	defer statLock.RUnlock()
	stats.OperationCounts = make(map[string]int64)
	for k, v := range runtimeStats.OperationCounts {
		stats.OperationCounts[k] = v
	}
}

func init() {
	runtimeStats = &RuntimeStats{
		OperationCounts: make(map[string]int64),
	}
}
