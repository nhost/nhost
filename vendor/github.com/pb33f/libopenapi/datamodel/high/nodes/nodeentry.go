package nodes

import "gopkg.in/yaml.v3"

// NodeEntry represents a single node used by NodeBuilder.
type NodeEntry struct {
	Tag         string
	Key         string
	Value       any
	StringValue string
	Line        int
	KeyStyle    yaml.Style
	// ValueStyle  yaml.Style
	RenderZero bool
	LowValue   any
}
