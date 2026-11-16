package sms

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

func TestDevRewritesModeOfExistingFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "+1234567890.txt")

	if err := os.WriteFile(path, []byte("stale"), 0o600); err != nil {
		t.Fatalf("failed to seed stale file: %v", err)
	}

	dev := &Dev{
		logger:    slog.Default(),
		outputDir: dir,
	}

	if err := dev.SendSMS("+1234567890", "Your code is 123456."); err != nil {
		t.Fatalf("SendSMS failed: %v", err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("expected file to exist: %v", err)
	}

	if got := info.Mode().Perm(); got != 0o644 {
		t.Errorf("expected mode 0644 on rewrite, got %04o", got)
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
