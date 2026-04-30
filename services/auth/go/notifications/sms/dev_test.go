package sms //nolint:testpackage

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

func TestDevWritesOTPToFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	dev := &Dev{
		logger:    slog.Default(),
		outputDir: dir,
	}

	if err := dev.SendSMS("+1234567890", "Your code is 123456."); err != nil {
		t.Fatalf("SendSMS failed: %v", err)
	}

	got, err := os.ReadFile(filepath.Join(dir, "+1234567890.txt"))
	if err != nil {
		t.Fatalf("expected file to exist: %v", err)
	}

	if string(got) != "Your code is 123456." {
		t.Errorf("unexpected file contents: %q", string(got))
	}
}

func TestDevNoOutputDirIsNoop(t *testing.T) {
	t.Parallel()

	dev := &Dev{
		logger:    slog.Default(),
		outputDir: "",
	}

	if err := dev.SendSMS("+1234567890", "Your code is 123456."); err != nil {
		t.Fatalf("SendSMS failed: %v", err)
	}
}

func TestDevSanitizesPhone(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	dev := &Dev{
		logger:    slog.Default(),
		outputDir: dir,
	}

	// Path-traversal attempt: sanitizer strips non-digit/non-plus chars,
	// so the resulting filename has no path separators.
	if err := dev.SendSMS("+12/../etc/3", "body"); err != nil {
		t.Fatalf("SendSMS failed: %v", err)
	}

	got, err := os.ReadFile(filepath.Join(dir, "+123.txt"))
	if err != nil {
		t.Fatalf("expected sanitized file: %v", err)
	}

	if string(got) != "body" {
		t.Errorf("unexpected file contents: %q", string(got))
	}
}
