// Copyright 2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package index

import (
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/pb33f/libopenapi/datamodel"
	"gopkg.in/yaml.v3"
	"sync"
)

// LocalFS is a file system that indexes local files.
type LocalFS struct {
	fsConfig            *LocalFSConfig
	indexConfig         *SpecIndexConfig
	entryPointDirectory string
	baseDirectory       string
	Files               sync.Map
	extractedFiles      map[string]RolodexFile
	logger              *slog.Logger
	readingErrors       []error
	rolodex             *Rolodex
	processingFiles     sync.Map
}

// GetFiles returns the files that have been indexed. A map of RolodexFile objects keyed by the full path of the file.
func (l *LocalFS) GetFiles() map[string]RolodexFile {
	files := make(map[string]RolodexFile)
	l.Files.Range(func(key, value interface{}) bool {
		files[key.(string)] = value.(*LocalFile)
		return true
	})
	l.extractedFiles = files
	return files
}

// GetErrors returns any errors that occurred during the indexing process.
func (l *LocalFS) GetErrors() []error {
	return l.readingErrors
}

type waiterLocal struct {
	f         string
	done      bool
	file      *LocalFile
	listeners int
}

// Open opens a file, returning it or an error. If the file is not found, the error is of type *PathError.
func (l *LocalFS) Open(name string) (fs.File, error) {
	if l.indexConfig != nil && !l.indexConfig.AllowFileLookup {
		return nil, &fs.PathError{
			Op: "open", Path: name,
			Err: fmt.Errorf("file lookup for '%s' not allowed, set the index configuration "+
				"to AllowFileLookup to be true", name),
		}
	}

	if !filepath.IsAbs(name) {
		name, _ = filepath.Abs(filepath.Join(l.baseDirectory, name))
	}

	if f, ok := l.Files.Load(name); ok {
		return f.(*LocalFile), nil
	} else {
		if l.fsConfig != nil && l.fsConfig.DirFS == nil {

			// if we're processing, we need to block and wait for the file to be processed
			// try path first
			if r, ko := l.processingFiles.Load(name); ko {

				wait := r.(*waiterLocal)
				wait.listeners++

				l.logger.Debug("[rolodex file loader]: waiting for existing OS load to complete", "file", name, "listeners", wait.listeners)

				for !wait.done {
					l.logger.Debug("[rolodex file loader]: sleeping for 200ns", "file", name, "listeners", wait.listeners)
					time.Sleep(200 * time.Nanosecond) // breathe for a few nanoseconds.
				}
				wait.listeners--
				l.logger.Debug("[rolodex file loader]: waiting done, OS load completed, returning file", "file", name, "listeners", wait.listeners)
				return wait.file, nil
			}

			processingWaiter := &waiterLocal{f: name}

			// add to processing
			l.processingFiles.Store(name, processingWaiter)

			var extractedFile *LocalFile
			var extErr error
			// attempt to open the file from the local filesystem
			l.logger.Debug("[rolodex file loader]: extracting file from OS", "file", name)
			extractedFile, extErr = l.extractFile(name)
			if extErr != nil {
				l.processingFiles.Delete(name)
				processingWaiter.done = true
				return nil, extErr
			}
			if extractedFile != nil {
				// in this mode, we need the index config to be set.
				if l.indexConfig != nil {
					copiedCfg := *l.indexConfig
					copiedCfg.SpecAbsolutePath = name
					copiedCfg.AvoidBuildIndex = true
					copiedCfg.SpecInfo = nil

					idx, _ := extractedFile.Index(&copiedCfg)

					if idx != nil && l.rolodex != nil {
						idx.rolodex = l.rolodex
					}

					// for each index, we need a resolver
					if idx != nil {
						resolver := NewResolver(idx)
						idx.resolver = resolver
						idx.BuildIndex()
					}

					if len(extractedFile.data) > 0 {
						l.logger.Debug("[rolodex file loader]: successfully loaded and indexed file", "file", name)
					}

					// add index to rolodex indexes
					if l.rolodex != nil {
						l.rolodex.AddIndex(idx)
					}
					if processingWaiter.listeners > 0 {
						l.logger.Debug("[rolodex file loader]: alerting file subscribers", "file", name, "subs", processingWaiter.listeners)
					}
					processingWaiter.file = extractedFile
					processingWaiter.done = true
					l.processingFiles.Delete(name)
					return extractedFile, nil
				}
			}
		}
	}
	waiter, _ := l.processingFiles.Load(name)
	if waiter != nil {
		waiter.(*waiterLocal).done = true
	}
	l.processingFiles.Delete(name)
	return nil, &fs.PathError{Op: "open", Path: name, Err: fs.ErrNotExist}
}

// LocalFile is a file that has been indexed by the LocalFS. It implements the RolodexFile interface.
type LocalFile struct {
	filename      string
	name          string
	extension     FileExtension
	data          []byte
	fullPath      string
	lastModified  time.Time
	readingErrors []error
	index         *SpecIndex
	parsed        *yaml.Node
	offset        int64
}

// GetIndex returns the *SpecIndex for the file.
func (l *LocalFile) GetIndex() *SpecIndex {
	return l.index
}

// Index returns the *SpecIndex for the file. If the index has not been created, it will be created (indexed)
func (l *LocalFile) Index(config *SpecIndexConfig) (*SpecIndex, error) {
	if l.index != nil {
		return l.index, nil
	}
	content := l.data

	// first, we must parse the content of the file,
	// the check is bypassed, so as long as it's readable, we're good.
	info, _ := datamodel.ExtractSpecInfoWithDocumentCheck(content, true)
	if config.SpecInfo == nil {
		config.SpecInfo = info
	}
	index := NewSpecIndexWithConfig(info.RootNode, config)
	index.specAbsolutePath = l.fullPath

	l.index = index
	return index, nil
}

// GetContent returns the content of the file as a string.
func (l *LocalFile) GetContent() string {
	return string(l.data)
}

// GetContentAsYAMLNode returns the content of the file as a *yaml.Node. If something went wrong
// then an error is returned.
func (l *LocalFile) GetContentAsYAMLNode() (*yaml.Node, error) {
	if l.parsed != nil {
		return l.parsed, nil
	}
	if l.index != nil && l.index.root != nil {
		return l.index.root, nil
	}
	if l.data == nil {
		return nil, fmt.Errorf("no data to parse for file: %s", l.fullPath)
	}
	var root yaml.Node
	err := yaml.Unmarshal(l.data, &root)
	if err != nil {

		// we can't parse it, so create a fake document node with a single string content
		root = yaml.Node{
			Kind: yaml.DocumentNode,
			Content: []*yaml.Node{
				{
					Kind:  yaml.ScalarNode,
					Tag:   "!!str",
					Value: string(l.data),
				},
			},
		}
	}
	if l.index != nil && l.index.root == nil {
		l.index.root = &root
	}
	l.parsed = &root
	return &root, err
}

// GetFileExtension returns the FileExtension of the file.
func (l *LocalFile) GetFileExtension() FileExtension {
	return l.extension
}

// GetFullPath returns the full path of the file.
func (l *LocalFile) GetFullPath() string {
	return l.fullPath
}

// GetErrors returns any errors that occurred during the indexing process.
func (l *LocalFile) GetErrors() []error {
	return l.readingErrors
}

// FullPath returns the full path of the file.
func (l *LocalFile) FullPath() string {
	return l.fullPath
}

// Name returns the name of the file.
func (l *LocalFile) Name() string {
	return l.name
}

// Size returns the size of the file.
func (l *LocalFile) Size() int64 {
	return int64(len(l.data))
}

// Mode returns the file mode bits for the file.
func (l *LocalFile) Mode() fs.FileMode {
	return fs.FileMode(0)
}

// ModTime returns the modification time of the file.
func (l *LocalFile) ModTime() time.Time {
	return l.lastModified
}

// IsDir returns true if the file is a directory, it always returns false
func (l *LocalFile) IsDir() bool {
	return false
}

// Sys returns the underlying data source (always returns nil)
func (l *LocalFile) Sys() interface{} {
	return nil
}

// Close closes the file (doesn't do anything, returns no error)
func (l *LocalFile) Close() error {
	return nil
}

// Stat returns the FileInfo for the file.
func (l *LocalFile) Stat() (fs.FileInfo, error) {
	return l, nil
}

// Read reads the file into a byte slice, makes it compatible with io.Reader.
func (l *LocalFile) Read(b []byte) (int, error) {
	if l.offset >= int64(len(l.GetContent())) {
		return 0, io.EOF
	}
	if l.offset < 0 {
		return 0, &fs.PathError{Op: "read", Path: l.GetFullPath(), Err: fs.ErrInvalid}
	}
	n := copy(b, l.GetContent()[l.offset:])
	l.offset += int64(n)
	return n, nil
}

// LocalFSConfig is the configuration for the LocalFS.
type LocalFSConfig struct {
	// the base directory to index
	BaseDirectory string

	// supply your own logger
	Logger *slog.Logger

	// supply a list of specific files to index only
	FileFilters []string

	// supply a custom fs.FS to use
	DirFS fs.FS

	// supply an index configuration to use
	IndexConfig *SpecIndexConfig
}

// NewLocalFSWithConfig creates a new LocalFS with the supplied configuration.
func NewLocalFSWithConfig(config *LocalFSConfig) (*LocalFS, error) {
	var allErrors []error

	log := config.Logger
	if log == nil {
		log = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelError,
		}))
	}

	// if the basedir is an absolute file, we're just going to index that file.
	ext := filepath.Ext(config.BaseDirectory)
	file := filepath.Base(config.BaseDirectory)

	var absBaseDir string
	absBaseDir, _ = filepath.Abs(config.BaseDirectory)

	localFS := &LocalFS{
		indexConfig:         config.IndexConfig,
		fsConfig:            config,
		logger:              log,
		baseDirectory:       absBaseDir,
		entryPointDirectory: config.BaseDirectory,
	}

	// if a directory filesystem is supplied, use that to walk the directory and pick up everything it finds.
	if config.DirFS != nil {
		walkErr := fs.WalkDir(config.DirFS, ".", func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			// we don't care about directories, or errors, just read everything we can.
			if d.IsDir() {
				if d.Name() != config.BaseDirectory {
					return nil
				}
			}
			if len(ext) > 2 && p != file {
				return nil
			}
			if strings.HasPrefix(p, ".") {
				return nil
			}
			if len(config.FileFilters) > 0 {
				if !slices.Contains(config.FileFilters, p) {
					return nil
				}
			}
			_, fErr := localFS.extractFile(p)
			return fErr
		})

		if walkErr != nil {
			return nil, walkErr
		}
	}

	localFS.readingErrors = allErrors
	return localFS, nil
}

func (l *LocalFS) extractFile(p string) (*LocalFile, error) {
	extension := ExtractFileType(p)
	var readingErrors []error
	abs := p
	config := l.fsConfig
	if !filepath.IsAbs(p) {
		if config != nil && config.BaseDirectory != "" {
			abs, _ = filepath.Abs(filepath.Join(config.BaseDirectory, p))
		} else {
			abs, _ = filepath.Abs(p)
		}
	}
	var fileData []byte
	switch extension {
	case YAML, JSON, JS, GO, TS, CS, C, CPP, PHP, PY, HTML, MD, JAVA, RS, ZIG, RB:
		var file fs.File
		var fileError error
		if config != nil && config.DirFS != nil {
			l.logger.Debug("[rolodex file loader]: collecting file from dirFS", "file", extension, "location", abs)
			file, _ = config.DirFS.Open(p)
		} else {
			l.logger.Debug("[rolodex file loader]: reading local file from OS", "file", extension, "location", abs)
			file, fileError = os.Open(abs)
		}

		if config != nil && config.DirFS != nil {
		} else {
			file, fileError = os.Open(abs)
		}

		// if reading without a directory FS, error out on any error, do not continue.
		if fileError != nil {
			return nil, fileError
		}

		modTime := time.Now()
		stat, _ := file.Stat()
		if stat != nil {
			modTime = stat.ModTime()
		}
		fileData, _ = io.ReadAll(file)

		lf := &LocalFile{
			filename:      p,
			name:          filepath.Base(p),
			extension:     ExtractFileType(p),
			data:          fileData,
			fullPath:      abs,
			lastModified:  modTime,
			readingErrors: readingErrors,
		}
		l.Files.Store(abs, lf)
		return lf, nil
	case UNSUPPORTED:
		if config != nil && config.DirFS != nil {
			l.logger.Warn("[rolodex file loader]: skipping non JSON/YAML file", "file", abs)
		}
	}
	return nil, nil
}
