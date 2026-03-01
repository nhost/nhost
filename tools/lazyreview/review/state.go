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

type HunkState struct {
	Reviewed bool `json:"reviewed"`
}

type FileState struct {
	Path     string               `json:"path"`
	Hash     string               `json:"hash"`
	Reviewed bool                 `json:"reviewed"`
	Hunks    map[string]HunkState `json:"hunks"`
}

type State struct {
	Base  string               `json:"base"`
	Files map[string]FileState `json:"files"`

	path string
}

func NewTransientState() *State {
	return &State{
		Base:  "",
		Files: make(map[string]FileState),
		path:  "",
	}
}

func Hash(content string) string {
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

func Load(repoRoot, branch, base string) (*State, error) {
	p := statePath(repoRoot, branch)

	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return &State{
				Base:  base,
				Files: make(map[string]FileState),
				path:  p,
			}, nil
		}

		return nil, fmt.Errorf("failed to read state file: %w", err)
	}

	var s State
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("failed to parse state file: %w", err)
	}

	s.path = p

	if s.Files == nil {
		s.Files = make(map[string]FileState)
	}

	return &s, nil
}

func (s *State) Save() error {
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

// Reconcile updates the state to match the current set of file paths.
// It keeps existing entries for paths that still exist, removes entries for
// paths no longer present, and creates placeholder entries for new paths.
func (s *State) Reconcile(paths []string) {
	newFiles := make(map[string]FileState, len(paths))

	for _, p := range paths {
		if existing, ok := s.Files[p]; ok {
			newFiles[p] = existing

			continue
		}

		newFiles[p] = FileState{
			Path:     p,
			Hash:     "",
			Reviewed: false,
			Hunks:    nil,
		}
	}

	s.Files = newFiles
}

// ReconcileFile updates a single file's state after its diff has been fetched.
// It compares the content hash to detect changes and manages hunk state accordingly.
func (s *State) ReconcileFile(path, hash string, hunkCount int) {
	existing, ok := s.Files[path]

	switch {
	case ok && existing.Hash == hash && existing.Hunks != nil:
		// Hash matches and hunks populated — keep existing review state
		return

	case ok && existing.Hash == "":
		// Never viewed via GetChangeDetails — populate hash and hunks.
		// If Reviewed was set via StageFile, mark all hunks reviewed.
		existing.Hash = hash
		existing.Hunks = makeHunks(hunkCount, existing.Reviewed)
		s.Files[path] = existing

	case ok && existing.Hash != hash:
		// Diff changed — reset to unreviewed with new hunks
		s.Files[path] = FileState{
			Path:     path,
			Hash:     hash,
			Reviewed: false,
			Hunks:    makeHunks(hunkCount, false),
		}

	default:
		// New entry
		s.Files[path] = FileState{
			Path:     path,
			Hash:     hash,
			Reviewed: false,
			Hunks:    makeHunks(hunkCount, false),
		}
	}
}

func makeHunks(count int, reviewed bool) map[string]HunkState {
	hunks := make(map[string]HunkState, count)
	for i := range count {
		hunks[hunkKey(i)] = HunkState{Reviewed: reviewed}
	}

	return hunks
}

func (s *State) SetFilesReviewed(paths []string, reviewed bool) {
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

func (s *State) ToggleFileReviewed(path string) {
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

func (s *State) SetHunkReviewed(path string, index int, reviewed bool) {
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

func (s *State) ToggleHunkReviewed(path string, index int) {
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

func (s *State) allHunksReviewed(path string) bool {
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

func (s *State) IsHunkReviewed(path string, index int) bool {
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

func (s *State) ReviewedFileCount() int {
	count := 0
	for _, fs := range s.Files {
		if fs.Reviewed {
			count++
		}
	}

	return count
}
