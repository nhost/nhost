package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

const uploadConcurrency = 5

var errStorageReplace = errors.New("storage replace failed")

func CommandApply() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "apply",
		Aliases:   []string{},
		Usage:     "Restore a local seed by uploading its files into a bucket",
		ArgsUsage: "[bucket-name]",
		Description: "Restores a bucket's contents from disk in two steps:\n" +
			"  1. Queries Hasura for every uploaded row in storage.files where bucket_id matches.\n" +
			"  2. For each row, uploads <dir>/<bucket>/<id> via PUT /v1/files/{id} (replace).\n" +
			"     Rows whose local file is missing are warned and skipped.\n\n" +
			"This command does NOT create metadata rows — it only uploads file contents for " +
			"rows that already exist in storage.files. The target project's metadata must " +
			"therefore be pre-seeded (typically via Hasura SQL seeds or migrations) before " +
			"running apply, otherwise there is nothing to upload to.\n\n" +
			"Pair with `nhost storage seed create` to first snapshot a source environment.\n\n" +
			"Targets the linked cloud project by default; pass --subdomain=local to apply to " +
			"a running local development environment.",
		Action: commandApply,
		Flags: append(commonFlags(),
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagDir,
				Usage:   "Local files directory. Defaults to <nhost-folder>/files",
				Sources: cli.EnvVars("NHOST_STORAGE_DIR"),
			},
		),
	}
}

func replaceFile(
	ctx context.Context,
	storageURL, adminSecret, id, name, src string,
) error {
	f, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("failed to open %s: %w", src, err)
	}
	defer f.Close()

	pr, pw := io.Pipe()
	mw := multipart.NewWriter(pw)

	go func() {
		defer pw.Close()
		defer mw.Close()

		filename := name
		if filename == "" {
			filename = id
		}

		part, err := mw.CreateFormFile("file", filename)
		if err != nil {
			pw.CloseWithError(fmt.Errorf("failed to create form file: %w", err))

			return
		}

		if _, err := io.Copy(part, f); err != nil {
			pw.CloseWithError(fmt.Errorf("failed to copy %s into form: %w", src, err))

			return
		}
	}()

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPut, storageURL+"/files/"+id, pr,
	)
	if err != nil {
		return fmt.Errorf("failed to create replace request for %s: %w", id, err)
	}

	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set(adminSecretHeader, adminSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to replace %s: %w", id, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)

		return fmt.Errorf(
			"%w: %s: status %d: %s", errStorageReplace, id, resp.StatusCode, b,
		)
	}

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("failed to drain response for %s: %w", id, err)
	}

	return nil
}

type applyResult struct {
	mu      sync.Mutex
	failed  []error
	applied int
}

func (r *applyResult) recordErr(err error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.failed = append(r.failed, err)
}

func (r *applyResult) bumpApplied() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.applied++
}

func applyAll(
	ctx context.Context,
	ce *clienv.CliEnv,
	eps *endpoints,
	files []fileSummary,
	bucketDir string,
) (int, error) {
	sem := make(chan struct{}, uploadConcurrency)

	var (
		wg     sync.WaitGroup
		result applyResult
	)

	for _, file := range files {
		src := filepath.Join(bucketDir, file.ID)

		if _, err := os.Stat(src); errors.Is(err, os.ErrNotExist) {
			ce.Warnln("Missing local file for %s (%s); skipping", file.ID, file.Name)

			continue
		} else if err != nil {
			result.recordErr(fmt.Errorf("failed to stat %s: %w", src, err))

			continue
		}

		sem <- struct{}{}

		wg.Add(1)

		go func(file fileSummary, src string) {
			defer wg.Done()
			defer func() { <-sem }()

			if err := replaceFile(
				ctx, eps.storage, eps.adminSecret, file.ID, file.Name, src,
			); err != nil {
				result.recordErr(err)

				return
			}

			result.bumpApplied()
			ce.Debugln("Applied %s (%s)", file.ID, file.Name)
		}(file, src)
	}

	wg.Wait()

	if len(result.failed) > 0 {
		return result.applied, errors.Join(result.failed...)
	}

	return result.applied, nil
}

// ApplyAllBuckets walks <nhost-folder>/files for bucket subdirectories and runs
// the equivalent of `nhost storage seed apply <bucket>` for each. It is a no-op
// when the files folder does not exist or contains no bucket subdirectories.
// Used by `nhost up --apply-seeds` to auto-restore storage seeds.
func ApplyAllBuckets(
	ctx context.Context,
	ce *clienv.CliEnv,
	storageURL, graphqlURL, adminSecret string,
) error {
	filesDir := filepath.Join(ce.Path.NhostFolder(), "files")

	entries, err := os.ReadDir(filesDir)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}

	if err != nil {
		return fmt.Errorf("failed to read %s: %w", filesDir, err)
	}

	eps := &endpoints{
		storage:     storageURL,
		graphql:     graphqlURL,
		adminSecret: adminSecret,
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		bucketID := entry.Name()
		bucketDir := filepath.Join(filesDir, bucketID)

		if err := applyBucket(ctx, ce, eps, bucketID, bucketDir); err != nil {
			return err
		}
	}

	return nil
}

func applyBucket(
	ctx context.Context,
	ce *clienv.CliEnv,
	eps *endpoints,
	bucketID, bucketDir string,
) error {
	ce.Infoln("Applying storage seed for bucket %q...", bucketID)

	files, err := listFiles(ctx, eps.graphql, eps.adminSecret, bucketID)
	if err != nil {
		return fmt.Errorf("failed to list files for bucket %q: %w", bucketID, err)
	}

	if len(files) == 0 {
		ce.Warnln("No files registered in bucket %q; skipping", bucketID)

		return nil
	}

	applied, err := applyAll(ctx, ce, eps, files, bucketDir)
	if err != nil {
		return fmt.Errorf("failed to apply seed for bucket %q: %w", bucketID, err)
	}

	ce.Infoln("Applied %d/%d file(s) for bucket %q", applied, len(files), bucketID)

	return nil
}

func commandApply(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	bucketID := cmd.Args().First()
	if bucketID == "" {
		bucketID = defaultBucket
	}

	eps, err := resolveEndpoints(ctx, ce, cmd)
	if err != nil {
		return err
	}

	dir := cmd.String(flagDir)
	if dir == "" {
		dir = filepath.Join(ce.Path.NhostFolder(), "files")
	}

	bucketDir := filepath.Join(dir, bucketID)
	if _, err := os.Stat(bucketDir); err != nil {
		return fmt.Errorf("local bucket directory %s not found: %w", bucketDir, err)
	}

	ce.Infoln("Listing files in bucket %q...", bucketID)

	files, err := listFiles(ctx, eps.graphql, eps.adminSecret, bucketID)
	if err != nil {
		return err
	}

	if len(files) == 0 {
		ce.Infoln("No files registered in bucket %q", bucketID)

		return nil
	}

	ce.Infoln("Applying %d file(s) from %s ...", len(files), bucketDir)

	applied, err := applyAll(ctx, ce, eps, files, bucketDir)
	if err != nil {
		return fmt.Errorf("failed to apply files: %w", err)
	}

	ce.Infoln("Successfully applied %d/%d file(s) from %s", applied, len(files), bucketDir)

	return nil
}
