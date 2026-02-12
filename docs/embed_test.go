package docsembed_test

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	docsembed "github.com/nhost/nhost/docs"
)

func TestDocsFS_EmbedAllMDXFiles(t *testing.T) { //nolint:cyclop
	t.Parallel()

	// Walk the actual filesystem to find all .mdx files
	var onDisk []string

	err := filepath.WalkDir(docsembed.DocsRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		if strings.HasSuffix(path, ".mdx") {
			// Normalize to forward slashes for embed.FS compatibility
			onDisk = append(onDisk, filepath.ToSlash(path))
		}

		return nil
	})
	if err != nil {
		t.Fatalf("failed to walk %s on disk: %v", docsembed.DocsRoot, err)
	}

	if len(onDisk) == 0 {
		t.Fatal("no .mdx files found on disk — test is running from wrong directory?")
	}

	// Verify every file on disk is present in the embedded FS
	var missing []string

	for _, path := range onDisk {
		if _, err := docsembed.DocsFS.ReadFile(path); err != nil {
			missing = append(missing, path)
		}
	}

	if len(missing) > 0 {
		t.Errorf(
			"%d of %d .mdx files not embedded. First 10:\n%s",
			len(missing),
			len(onDisk),
			strings.Join(missing[:min(10, len(missing))], "\n"),
		)
	}

	// Also walk the embedded FS and count to make sure we don't have extras
	var embedded int

	err = fs.WalkDir(
		docsembed.DocsFS,
		docsembed.DocsRoot,
		func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil //nolint:nilerr
			}

			if strings.HasSuffix(path, ".mdx") {
				embedded++
			}

			return nil
		},
	)
	if err != nil {
		t.Fatalf("failed to walk embedded FS: %v", err)
	}

	if embedded != len(onDisk) {
		t.Errorf("embedded FS has %d .mdx files, disk has %d", embedded, len(onDisk))
	}

	t.Logf("verified %d .mdx files are embedded", len(onDisk))
}

func TestDocsFS_CanReadSamplePage(t *testing.T) {
	t.Parallel()

	// Find any .mdx file on disk to verify readability
	var sample string

	_ = filepath.WalkDir(docsembed.DocsRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil //nolint:nilerr
		}

		if strings.HasSuffix(path, ".mdx") {
			sample = filepath.ToSlash(path)

			return fs.SkipAll
		}

		return nil
	})

	if sample == "" {
		t.Skip("no .mdx files found on disk")
	}

	data, err := docsembed.DocsFS.ReadFile(sample)
	if err != nil {
		t.Fatalf("failed to read embedded file %s: %v", sample, err)
	}

	diskData, err := os.ReadFile(sample)
	if err != nil {
		t.Fatalf("failed to read disk file %s: %v", sample, err)
	}

	if string(data) != string(diskData) {
		t.Errorf("embedded content of %s differs from disk", sample)
	}
}
