package storage

import "log/slog"

// NewS3ForTest builds an S3 backed by a custom ObjectAPI so tests can inject a
// mock client and exercise ListFiles without a live S3 endpoint.
func NewS3ForTest(client ObjectAPI, rootFolder string, logger *slog.Logger) *S3 {
	return &S3{
		client:        client,
		presignClient: nil,
		bucket:        nil,
		rootFolder:    rootFolder,
		url:           "",
		logger:        logger,
	}
}
