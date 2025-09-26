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
	"strings"

	"golang.org/x/mod/semver"
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

func (mgr *Manager) filterReleases(releases Releases, version string) Releases {
	if !strings.HasPrefix(version, "v") {
		version = "v" + version
	}

	// filter pre-releases and older releases
	r := make(Releases, 0, len(releases))
	for _, release := range releases {
		s := strings.Split(release.TagName, "@")
		if len(s) != 2 { //nolint:mnd
			continue
		}

		releaseName := s[0]
		releaseVersion := s[1]

		if !strings.HasPrefix(releaseVersion, "v") {
			releaseVersion = "v" + releaseVersion
		}

		if releaseName != "cli" ||
			release.Prerelease ||
			semver.Compare(version, releaseVersion) >= 0 {
			continue
		}

		r = append(r, release)
	}

	return r
}

func (mgr *Manager) GetReleases(ctx context.Context, version string) (Releases, error) {
	var releases Releases

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		"https://api.github.com/repos/nhost/nhost/releases?per_page=100",
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

		return nil, fmt.Errorf( //nolint:err113
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

	// filter pre-releases and older releases
	r := mgr.filterReleases(releases, version)

	mgr.cache = r

	return r, nil
}

func (mgr *Manager) LatestRelease(ctx context.Context, version string) (Release, error) {
	if mgr.cache == nil {
		if _, err := mgr.GetReleases(ctx, version); err != nil {
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
			return errors.New( //nolint:err113
				"expected a file inside tarball, found a directory instead",
			)
		case tar.TypeReg:
			if _, err := io.Copy(dst, tarReader); err != nil { //nolint:gosec
				return fmt.Errorf("failed to copy file: %w", err)
			}

			return nil

		default:
			return fmt.Errorf( //nolint:err113
				"unknown type: %b in %s",
				header.Typeflag,
				header.Name,
			)
		}
	}

	return errors.New("no file found in tarball") //nolint:err113
}
