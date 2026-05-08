package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

const downloadConcurrency = 5

var errStorageDownload = errors.New("storage download failed")

func CommandCreate() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "create",
		Aliases:   []string{},
		Usage:     "Create a local seed by downloading all files in a bucket",
		ArgsUsage: "[bucket-name]",
		Description: "Downloads every uploaded file from the given bucket using the supplied " +
			"Hasura admin secret. Files are written to <dir>/<bucket>/<id>. " +
			"Targets the linked cloud project by default; pass --subdomain=local to read from a " +
			"running local development environment.",
		Action: commandCreate,
		Flags: append(commonFlags(),
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagDir,
				Usage:   "Local files directory. Defaults to <nhost-folder>/files",
				Sources: cli.EnvVars("NHOST_STORAGE_DIR"),
			},
		),
	}
}

func downloadFile(
	ctx context.Context,
	storageURL, adminSecret, id, dest string,
) error {
	req, err := http.NewRequestWithContext(
		ctx, http.MethodGet, storageURL+"/files/"+id, nil,
	)
	if err != nil {
		return fmt.Errorf("failed to create download request for %s: %w", id, err)
	}

	req.Header.Set(adminSecretHeader, adminSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to download %s: %w", id, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)

		return fmt.Errorf(
			"%w: %s: status %d: %s", errStorageDownload, id, resp.StatusCode, b,
		)
	}

	f, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("failed to create %s: %w", dest, err)
	}
	defer f.Close()

	if _, err := io.Copy(f, resp.Body); err != nil {
		return fmt.Errorf("failed to write %s: %w", dest, err)
	}

	return nil
}

func downloadAll(
	ctx context.Context,
	ce *clienv.CliEnv,
	eps *endpoints,
	files []fileSummary,
	bucketDir string,
) error {
	sem := make(chan struct{}, downloadConcurrency)

	var (
		wg     sync.WaitGroup
		mu     sync.Mutex
		failed []error
	)

	recordErr := func(err error) {
		mu.Lock()
		defer mu.Unlock()

		failed = append(failed, err)
	}

	for _, file := range files {
		sem <- struct{}{}

		wg.Add(1)

		go func(file fileSummary) {
			defer wg.Done()
			defer func() { <-sem }()

			dest := filepath.Join(bucketDir, file.ID)

			if err := downloadFile(ctx, eps.storage, eps.adminSecret, file.ID, dest); err != nil {
				recordErr(err)

				return
			}

			ce.Debugln("Downloaded %s (%s)", file.ID, file.Name)
		}(file)
	}

	wg.Wait()

	if len(failed) > 0 {
		return errors.Join(failed...)
	}

	return nil
}

func commandCreate(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	bucketID := cmd.Args().First()
	if bucketID == "" {
		bucketID = defaultBucket
	}

	eps, err := resolveEndpoints(ctx, ce, cmd)
	if err != nil {
		return err
	}

	ce.Infoln("Listing files in bucket %q...", bucketID)

	files, err := listFiles(ctx, eps.graphql, eps.adminSecret, bucketID)
	if err != nil {
		return err
	}

	dir := cmd.String(flagDir)
	if dir == "" {
		dir = filepath.Join(ce.Path.NhostFolder(), "files")
	}

	bucketDir := filepath.Join(dir, bucketID)
	if err := os.MkdirAll(bucketDir, dirPerm); err != nil {
		return fmt.Errorf("failed to create %s: %w", bucketDir, err)
	}

	if len(files) == 0 {
		ce.Infoln("No files found in bucket %q", bucketID)

		return nil
	}

	ce.Infoln("Downloading %d file(s) to %s ...", len(files), bucketDir)

	if err := downloadAll(ctx, ce, eps, files, bucketDir); err != nil {
		return fmt.Errorf("failed to download files: %w", err)
	}

	ce.Infoln("Successfully created seed with %d file(s) in %s", len(files), bucketDir)

	return nil
}
