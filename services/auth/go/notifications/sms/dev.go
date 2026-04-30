package sms

import (
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/nhost/nhost/services/auth/go/notifications"
)

type Dev struct {
	logger    *slog.Logger
	outputDir string
}

func NewDev(
	templates *notifications.Templates,
	db DB,
	outputDir string,
	logger *slog.Logger,
) *SMS {
	logger.Info(
		"Using dev SMS provider. All SMS will be logged to the console.",
		slog.String("outputDir", outputDir),
	)

	return NewSMS(
		&Dev{
			logger:    logger,
			outputDir: outputDir,
		},
		templates,
		db,
	)
}

func (s *Dev) SendSMS(to string, body string) error {
	s.logger.Info("Dev SMS sent", slog.String("to", to), slog.String("body", body))

	if s.outputDir == "" {
		return nil
	}

	name := sanitizePhoneForFilename(to)
	if name == "" {
		return errors.New("invalid phone number for output file") //nolint:err113
	}

	const (
		dirPerm  = 0o700
		filePerm = 0o600
	)

	if err := os.MkdirAll(s.outputDir, dirPerm); err != nil {
		return err //nolint:wrapcheck
	}

	path := filepath.Join(s.outputDir, name+".txt")
	if err := os.WriteFile(path, []byte(body), filePerm); err != nil {
		return err //nolint:wrapcheck
	}

	return nil
}

// sanitizePhoneForFilename strips any character that isn't a digit or '+'.
// Defensive against path traversal even though this is dev-only.
func sanitizePhoneForFilename(phone string) string {
	var b strings.Builder
	for _, r := range phone {
		if r == '+' || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}

	return b.String()
}
