package hasura

import "context"

type CreateEventRequest struct {
	Type string                 `json:"type,omitempty"`
	Args CreateEventRequestArgs `json:"args,omitzero"`
}

//nolint:tagliatelle
type CreateEventRequestArgs struct {
	Name          string                         `json:"name,omitempty"`
	Table         QualifiedTable                 `json:"table,omitzero"`
	Source        *string                        `json:"source,omitempty"`
	Webhook       *string                        `json:"webhook,omitempty"`
	Insert        *OperationSpec                 `json:"insert,omitempty"`
	Update        *OperationSpec                 `json:"update,omitempty"`
	Delete        *OperationSpec                 `json:"delete,omitempty"`
	Headers       []Header                       `json:"headers,omitempty"`
	RetryConf     *RetryConf                     `json:"retry_conf,omitempty"`
	CleanupConfig *AutoEventTriggerCleanupConfig `json:"cleanup_config,omitempty"`
	Replace       *bool                          `json:"replace,omitempty"`
}

type QualifiedTable struct {
	Name   string `json:"name,omitempty"`
	Schema string `json:"schema,omitempty"`
}

type OperationSpec struct {
	Columns string `json:"columns,omitempty"`
	Payload string `json:"payload,omitempty"`
}

//nolint:tagliatelle
type Header struct {
	Name         string `json:"name,omitempty"`
	Value        string `json:"value,omitempty"`
	ValueFromEnv string `json:"value_from_env,omitempty"`
}

//nolint:tagliatelle
type RetryConf struct {
	NumRetries  int `json:"num_retries,omitempty"`
	IntervalSec int `json:"interval_sec,omitempty"`
	TimeoutSec  int `json:"timeout_sec,omitempty"`
}

//nolint:tagliatelle
type AutoEventTriggerCleanupConfig struct {
	Schedule            string `json:"schedule,omitempty"`
	BatchSize           int    `json:"batch_size,omitempty"`
	ClearOlderThan      int    `json:"clear_older_than,omitempty"`
	Timeout             int    `json:"timeout,omitempty"`
	CleanInvocationLogs bool   `json:"clean_invocation_logs,omitempty"`
	Paused              bool   `json:"paused,omitempty"`
}

func (c *Client) CreateEvent(ctx context.Context, req *CreateEventRequest) error {
	var resp any
	return c.QueryMetadata(ctx, req, &resp)
}
