package converter

import "sort"

const (
	// PriorityEarly means that the handler will be run **early** in the process.
	// To run it even earlier you need to subtract from this number.
	PriorityEarly = 100

	// PriorityStandard is for handlers that don't need to be run in a particular order.
	PriorityStandard = 500

	// PriorityLate means that the handler will be run **late** in the process.
	// To run it even later you need to add to this number.
	PriorityLate = 1000
)

type prioritizedValue[V any] struct {
	Value    V
	Priority int
}

type prioritizedSlice[V any] []prioritizedValue[V]

func (s prioritizedSlice[V]) Sort() {
	sort.Slice(s, func(i, j int) bool {
		return s[i].Priority < s[j].Priority
	})
}

func prioritized[V any](v V, priority int) prioritizedValue[V] {
	return prioritizedValue[V]{v, priority}
}
