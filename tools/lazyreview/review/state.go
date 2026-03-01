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

	"github.com/nhost/nhost/tools/lazyreview/diff"
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

func (s *State) Reconcile(files []*diff.File) {
	newFiles := make(map[string]FileState, len(files))

	for _, f := range files {
		hash := Hash(f.RawDiff)

		if existing, ok := s.Files[hash]; ok {
			newFiles[hash] = existing

			continue
		}

		hunks := make(map[string]HunkState, len(f.Hunks))
		for i := range f.Hunks {
			hunks[hunkKey(i)] = HunkState{Reviewed: false}
		}

		newFiles[hash] = FileState{
			Path:     f.Path,
			Reviewed: false,
			Hunks:    hunks,
		}
	}

	s.Files = newFiles
}

func (s *State) SetFilesReviewed(hashes []string, reviewed bool) {
	for _, hash := range hashes {
		fs, ok := s.Files[hash]
		if !ok {
			continue
		}

		fs.Reviewed = reviewed

		for k, h := range fs.Hunks {
			h.Reviewed = reviewed
			fs.Hunks[k] = h
		}

		s.Files[hash] = fs
	}
}

func (s *State) ToggleFileReviewed(hash string) {
	fs, ok := s.Files[hash]
	if !ok {
		return
	}

	newState := !fs.Reviewed
	fs.Reviewed = newState

	for k, h := range fs.Hunks {
		h.Reviewed = newState
		fs.Hunks[k] = h
	}

	s.Files[hash] = fs
}

func (s *State) SetHunkReviewed(hash string, index int, reviewed bool) {
	fs, ok := s.Files[hash]
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

	fs.Reviewed = s.allHunksReviewed(hash)
	s.Files[hash] = fs
}

func (s *State) ToggleHunkReviewed(hash string, index int) {
	fs, ok := s.Files[hash]
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

	fs.Reviewed = s.allHunksReviewed(hash)
	s.Files[hash] = fs
}

func (s *State) allHunksReviewed(hash string) bool {
	fs, ok := s.Files[hash]
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

func (s *State) IsHunkReviewed(hash string, index int) bool {
	fs, ok := s.Files[hash]
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
