package review

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	dirPerm  fs.FileMode = 0o755
	filePerm fs.FileMode = 0o644
)

type hunkState struct {
	Reviewed bool `json:"reviewed"`
}

type fileState struct {
	Path     string               `json:"path"`
	Hash     string               `json:"hash"`
	Reviewed bool                 `json:"reviewed"`
	Hunks    map[string]hunkState `json:"hunks"`
}

type state struct {
	Base  string               `json:"base"`
	Files map[string]fileState `json:"files"`

	path string
}

func newTransientState() *state {
	return &state{
		Base:  "",
		Files: make(map[string]fileState),
		path:  "",
	}
}

func hash(content string) string {
	h := sha256.Sum256([]byte(content))

	return hex.EncodeToString(h[:])
}

func hunkKey(index int) string {
	return strconv.Itoa(index)
}

func sanitizeBranch(branch string) string {
	r := strings.NewReplacer("/", "_", "\\", "_", ":", "_")

	return r.Replace(branch)
}

func statePath(repoRoot, branch string) string {
	return filepath.Join(repoRoot, ".lazyreview", sanitizeBranch(branch)+".json")
}

func load(repoRoot, branch, base string) (*state, error) {
	p := statePath(repoRoot, branch)

	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return &state{
				Base:  base,
				Files: make(map[string]fileState),
				path:  p,
			}, nil
		}

		return nil, fmt.Errorf("failed to read state file: %w", err)
	}

	var s state
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("failed to parse state file: %w", err)
	}

	s.path = p

	if s.Files == nil {
		s.Files = make(map[string]fileState)
	}

	return &s, nil
}

func (s *state) save() error {
	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, dirPerm); err != nil {
		return fmt.Errorf("failed to create state directory: %w", err)
	}

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal state: %w", err)
	}

	if err := os.WriteFile(s.path, data, filePerm); err != nil {
		return fmt.Errorf("failed to write state file: %w", err)
	}

	return nil
}

// reconcile updates the state to match the current set of file paths.
// It keeps existing entries for paths that still exist, removes entries for
// paths no longer present, and creates placeholder entries for new paths.
func (s *state) reconcile(paths []string) {
	newFiles := make(map[string]fileState, len(paths))

	for _, p := range paths {
		if existing, ok := s.Files[p]; ok {
			newFiles[p] = existing

			continue
		}

		newFiles[p] = fileState{
			Path:     p,
			Hash:     "",
			Reviewed: false,
			Hunks:    nil,
		}
	}

	s.Files = newFiles
}

// reconcileFile updates a single file's state after its diff has been fetched.
// It compares the content hash to detect changes and manages hunk state accordingly.
func (s *state) reconcileFile(path, h string, hunkCount int) {
	existing, ok := s.Files[path]

	switch {
	case ok && existing.Hash == h && existing.Hunks != nil:
		// Hash matches and hunks populated — keep existing review state
		return

	case ok && existing.Hash == "":
		// Never viewed via GetChangeDetails — populate hash and hunks.
		// If Reviewed was set via StageFile, mark all hunks reviewed.
		existing.Hash = h
		existing.Hunks = makeHunks(hunkCount, existing.Reviewed)
		s.Files[path] = existing

	case ok && existing.Hash != h:
		// Diff changed — reset to unreviewed with new hunks
		s.Files[path] = fileState{
			Path:     path,
			Hash:     h,
			Reviewed: false,
			Hunks:    makeHunks(hunkCount, false),
		}

	default:
		// New entry
		s.Files[path] = fileState{
			Path:     path,
			Hash:     h,
			Reviewed: false,
			Hunks:    makeHunks(hunkCount, false),
		}
	}
}

func makeHunks(count int, reviewed bool) map[string]hunkState {
	hunks := make(map[string]hunkState, count)
	for i := range count {
		hunks[hunkKey(i)] = hunkState{Reviewed: reviewed}
	}

	return hunks
}

func (s *state) setFilesReviewed(paths []string, reviewed bool) {
	for _, path := range paths {
		fs, ok := s.Files[path]
		if !ok {
			continue
		}

		fs.Reviewed = reviewed

		for k, h := range fs.Hunks {
			h.Reviewed = reviewed
			fs.Hunks[k] = h
		}

		s.Files[path] = fs
	}
}

func (s *state) toggleFileReviewed(path string) {
	fs, ok := s.Files[path]
	if !ok {
		return
	}

	newState := !fs.Reviewed
	fs.Reviewed = newState

	for k, h := range fs.Hunks {
		h.Reviewed = newState
		fs.Hunks[k] = h
	}

	s.Files[path] = fs
}

func (s *state) setHunkReviewed(path string, index int, reviewed bool) {
	fs, ok := s.Files[path]
	if !ok {
		return
	}

	key := hunkKey(index)

	h, ok := fs.Hunks[key]
	if !ok {
		return
	}

	h.Reviewed = reviewed
	fs.Hunks[key] = h

	fs.Reviewed = s.allHunksReviewed(path)
	s.Files[path] = fs
}

func (s *state) toggleHunkReviewed(path string, index int) {
	fs, ok := s.Files[path]
	if !ok {
		return
	}

	key := hunkKey(index)

	h, ok := fs.Hunks[key]
	if !ok {
		return
	}

	h.Reviewed = !h.Reviewed
	fs.Hunks[key] = h

	fs.Reviewed = s.allHunksReviewed(path)
	s.Files[path] = fs
}

func (s *state) allHunksReviewed(path string) bool {
	fs, ok := s.Files[path]
	if !ok {
		return false
	}

	for _, h := range fs.Hunks {
		if !h.Reviewed {
			return false
		}
	}

	return true
}

func (s *state) isHunkReviewed(path string, index int) bool {
	fs, ok := s.Files[path]
	if !ok {
		return false
	}

	h, ok := fs.Hunks[hunkKey(index)]
	if !ok {
		return false
	}

	return h.Reviewed
}

func (s *state) reviewedFileCount() int {
	count := 0
	for _, fs := range s.Files {
		if fs.Reviewed {
			count++
		}
	}

	return count
}
