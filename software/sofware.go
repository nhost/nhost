package software

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

type Manager struct {
	client *http.Client
	cache  Releases
}

func NewManager() *Manager {
	return &Manager{
		client: &http.Client{}, //nolint:exhaustruct
		cache:  nil,
	}
}

func (mgr *Manager) GetReleases(ctx context.Context) (Releases, error) {
	var releases Releases

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		"https://api.github.com/repos/nhost/cli/releases",
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := mgr.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch releases: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf( //nolint:goerr113
			"failed to fetch releases with status code (%d): %s", resp.StatusCode, string(b),
		)
	}

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(b, &releases); err != nil {
		return nil, fmt.Errorf("failed to unmarshal releases: %w", err)
	}

	mgr.cache = releases

	return releases, nil
}

func (mgr *Manager) LatestRelease(ctx context.Context) (Release, error) {
	if mgr.cache == nil {
		if _, err := mgr.GetReleases(ctx); err != nil {
			return Release{}, err
		}
	}
	return mgr.cache[0], nil
}

func (mgr *Manager) DownloadAsset(ctx context.Context, url string, dst io.Writer) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := mgr.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to download release: %w", err)
	}
	defer resp.Body.Close()

	if err := extractTarGz(resp.Body, dst); err != nil {
		return fmt.Errorf("failed to extract tarball: %w", err)
	}

	return nil
}

func extractTarGz(gzipStream io.Reader, dst io.Writer) error {
	uncompressedStream, err := gzip.NewReader(gzipStream)
	if err != nil {
		return fmt.Errorf("gzip reader failed: %w", err)
	}

	tarReader := tar.NewReader(uncompressedStream)

	for {
		header, err := tarReader.Next()

		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			return fmt.Errorf("tar reader failed: %w", err)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			return fmt.Errorf( //nolint:goerr113
				"expected a file inside tarball, found a directory instead",
			)
		case tar.TypeReg:
			if _, err := io.Copy(dst, tarReader); err != nil { //nolint:gosec
				return fmt.Errorf("failed to copy file: %w", err)
			}
			return nil

		default:
			return fmt.Errorf( //nolint:goerr113
				"unknown type: %b in %s",
				header.Typeflag,
				header.Name,
			)
		}
	}

	return fmt.Errorf("no file found in tarball") //nolint:goerr113
}
