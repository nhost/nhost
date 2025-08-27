// Copyright 2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package index

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pb33f/libopenapi/datamodel"
	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

const (
	YAML FileExtension = iota
	JSON
	JS
	GO
	TS
	CS
	C
	CPP
	PHP
	PY
	HTML
	MD
	JAVA
	RS
	ZIG
	RB
	UNSUPPORTED
)

// FileExtension is the type of file extension.
type FileExtension int

// RemoteFS is a file system that indexes remote files. It implements the fs.FS interface. Files are located remotely
// and served via HTTP.
type RemoteFS struct {
	indexConfig       *SpecIndexConfig
	rootURL           string
	rootURLParsed     *url.URL
	RemoteHandlerFunc utils.RemoteURLHandler
	Files             sync.Map
	ProcessingFiles   sync.Map
	FetchTime         int64
	FetchChannel      chan *RemoteFile
	remoteErrors      []error
	logger            *slog.Logger
	extractedFiles    map[string]RolodexFile
	rolodex           *Rolodex
}

// RemoteFile is a file that has been indexed by the RemoteFS. It implements the RolodexFile interface.
type RemoteFile struct {
	filename      string
	name          string
	extension     FileExtension
	data          []byte
	fullPath      string
	URL           *url.URL
	lastModified  time.Time
	seekingErrors []error
	index         *SpecIndex
	parsed        *yaml.Node
	offset        int64
}

// GetFileName returns the name of the file.
func (f *RemoteFile) GetFileName() string {
	return f.filename
}

// GetContent returns the content of the file as a string.
func (f *RemoteFile) GetContent() string {
	return string(f.data)
}

// GetContentAsYAMLNode returns the content of the file as a yaml.Node.
func (f *RemoteFile) GetContentAsYAMLNode() (*yaml.Node, error) {
	if f.parsed != nil {
		return f.parsed, nil
	}
	if f.index != nil && f.index.root != nil {
		return f.index.root, nil
	}
	if f.data == nil {
		return nil, fmt.Errorf("no data to parse for file: %s", f.fullPath)
	}
	var root yaml.Node
	err := yaml.Unmarshal(f.data, &root)
	if err != nil {
		return nil, err
	}
	if f.index != nil && f.index.root == nil {
		f.index.root = &root
	}
	f.parsed = &root
	return &root, nil
}

// GetFileExtension returns the file extension of the file.
func (f *RemoteFile) GetFileExtension() FileExtension {
	return f.extension
}

// GetLastModified returns the last modified time of the file.
func (f *RemoteFile) GetLastModified() time.Time {
	return f.lastModified
}

// GetErrors returns any errors that occurred while reading the file.
func (f *RemoteFile) GetErrors() []error {
	return f.seekingErrors
}

// GetFullPath returns the full path of the file.
func (f *RemoteFile) GetFullPath() string {
	return f.fullPath
}

// fs.FileInfo interfaces

// Name returns the name of the file.
func (f *RemoteFile) Name() string {
	return f.name
}

// Size returns the size of the file.
func (f *RemoteFile) Size() int64 {
	return int64(len(f.data))
}

// Mode returns the file mode bits for the file.
func (f *RemoteFile) Mode() fs.FileMode {
	return fs.FileMode(0)
}

// ModTime returns the modification time of the file.
func (f *RemoteFile) ModTime() time.Time {
	return f.lastModified
}

// IsDir returns true if the file is a directory.
func (f *RemoteFile) IsDir() bool {
	return false
}

// fs.File interfaces

// Sys returns the underlying data source (always returns nil)
func (f *RemoteFile) Sys() interface{} {
	return nil
}

// Close closes the file (doesn't do anything, returns no error)
func (f *RemoteFile) Close() error {
	return nil
}

// Stat returns the FileInfo for the file.
func (f *RemoteFile) Stat() (fs.FileInfo, error) {
	return f, nil
}

// Read reads the file. Makes it compatible with io.Reader.
func (f *RemoteFile) Read(b []byte) (int, error) {
	if f.offset >= int64(len(f.data)) {
		return 0, io.EOF
	}
	if f.offset < 0 {
		return 0, &fs.PathError{Op: "read", Path: f.name, Err: fs.ErrInvalid}
	}
	n := copy(b, f.data[f.offset:])
	f.offset += int64(n)
	return n, nil
}

// Index indexes the file and returns a *SpecIndex, any errors are returned as well.
func (f *RemoteFile) Index(config *SpecIndexConfig) (*SpecIndex, error) {
	if f.index != nil {
		return f.index, nil
	}
	content := f.data

	// first, we must parse the content of the file
	info, err := datamodel.ExtractSpecInfoWithDocumentCheckSync(content, true)
	if err != nil {
		return nil, err
	}

	index := NewSpecIndexWithConfig(info.RootNode, config)
	index.specAbsolutePath = config.SpecAbsolutePath
	f.index = index
	return index, nil
}

// GetIndex returns the index for the file.
func (f *RemoteFile) GetIndex() *SpecIndex {
	return f.index
}

// NewRemoteFSWithConfig creates a new RemoteFS using the supplied SpecIndexConfig.
func NewRemoteFSWithConfig(specIndexConfig *SpecIndexConfig) (*RemoteFS, error) {
	if specIndexConfig == nil {
		return nil, errors.New("no spec index config provided")
	}
	remoteRootURL := specIndexConfig.BaseURL
	log := specIndexConfig.Logger
	if log == nil {
		log = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelError,
		}))
	}

	rfs := &RemoteFS{
		indexConfig:   specIndexConfig,
		logger:        log,
		rootURLParsed: remoteRootURL,
		FetchChannel:  make(chan *RemoteFile),
	}
	if remoteRootURL != nil {
		rfs.rootURL = remoteRootURL.String()
	}
	if specIndexConfig.RemoteURLHandler != nil {
		rfs.RemoteHandlerFunc = specIndexConfig.RemoteURLHandler
	} else {
		// default http client
		client := &http.Client{
			Timeout: time.Second * 120,
		}
		rfs.RemoteHandlerFunc = func(url string) (*http.Response, error) {
			return client.Get(url)
		}
	}
	return rfs, nil
}

// NewRemoteFSWithRootURL creates a new RemoteFS using the supplied root URL.
func NewRemoteFSWithRootURL(rootURL string) (*RemoteFS, error) {
	remoteRootURL, err := url.Parse(rootURL)
	if err != nil {
		return nil, err
	}
	config := CreateOpenAPIIndexConfig()
	config.BaseURL = remoteRootURL
	return NewRemoteFSWithConfig(config)
}

// SetRemoteHandlerFunc sets the remote handler function.
func (i *RemoteFS) SetRemoteHandlerFunc(handlerFunc utils.RemoteURLHandler) {
	i.RemoteHandlerFunc = handlerFunc
}

// SetIndexConfig sets the index configuration.
func (i *RemoteFS) SetIndexConfig(config *SpecIndexConfig) {
	i.indexConfig = config
}

// GetFiles returns the files that have been indexed.
func (i *RemoteFS) GetFiles() map[string]RolodexFile {
	files := make(map[string]RolodexFile)
	i.Files.Range(func(key, value interface{}) bool {
		files[key.(string)] = value.(*RemoteFile)
		return true
	})
	i.extractedFiles = files
	return files
}

// GetErrors returns any errors that occurred during the indexing process.
func (i *RemoteFS) GetErrors() []error {
	return i.remoteErrors
}

type waiterRemote struct {
	f         string
	done      bool
	file      *RemoteFile
	listeners int
}

// Open opens a file, returning it or an error. If the file is not found, the error is of type *PathError.
func (i *RemoteFS) Open(remoteURL string) (fs.File, error) {
	if i.indexConfig != nil && !i.indexConfig.AllowRemoteLookup {
		return nil, fmt.Errorf("remote lookup for '%s' is not allowed, please set "+
			"AllowRemoteLookup to true as part of the index configuration", remoteURL)
	}

	if !strings.HasPrefix(remoteURL, "http") {
		if i.logger != nil {
			i.logger.Debug("[rolodex remote loader] not a remote file, ignoring", "file", remoteURL)
		}
		return nil, fmt.Errorf("not a remote file: %s", remoteURL)
	}

	remoteParsedURL, err := url.Parse(remoteURL)
	if err != nil {
		return nil, err
	}
	remoteParsedURLOriginal, _ := url.Parse(remoteURL)

	// try path first
	if r, ok := i.Files.Load(remoteParsedURL.Path); ok {
		return r.(*RemoteFile), nil
	}

	// if we're processing, we need to block and wait for the file to be processed
	// try path first
	if r, ok := i.ProcessingFiles.Load(remoteParsedURL.Path); ok {

		wait := r.(*waiterRemote)
		wait.listeners++

		i.logger.Debug("[rolodex remote loader] waiting for existing fetch to complete", "file", remoteURL,
			"remoteURL", remoteParsedURL.String())

		for !wait.done {
			i.logger.Debug("[rolodex remote loader] sleeping, waiting for file to return", "file", remoteURL)
			time.Sleep(500 * time.Nanosecond) // breathe for a few nanoseconds.
		}

		wait.listeners--
		i.logger.Debug("[rolodex remote loader]: waiting done, remote completed, returning file", "file",
			remoteParsedURL.String(), "listeners", wait.listeners)
		return wait.file, nil
	}

	fileExt := ExtractFileType(remoteParsedURL.Path)

	if fileExt == UNSUPPORTED {
		i.remoteErrors = append(i.remoteErrors, fs.ErrInvalid)
		if i.logger != nil {
			i.logger.Warn("[rolodex remote loader] unsupported file in reference will be ignored", "file", remoteURL, "remoteURL", remoteParsedURL.String())
		}
		return nil, &fs.PathError{Op: "open", Path: remoteURL, Err: fs.ErrInvalid}
	}

	processingWaiter := &waiterRemote{f: remoteParsedURL.Path}

	// add to processing
	i.ProcessingFiles.Store(remoteParsedURL.Path, processingWaiter)

	// if the remote URL is absolute (http:// or https://), and we have a rootURL defined, we need to override
	// the host being defined by this URL, and use the rootURL instead, but keep the path.
	if i.rootURLParsed != nil {
		remoteParsedURL.Host = i.rootURLParsed.Host
		remoteParsedURL.Scheme = i.rootURLParsed.Scheme
		// this has been disabled, because I don't think it has value, it causes more problems than it solves currently.
		// if !strings.HasPrefix(remoteParsedURL.Path, "/") {
		//	remoteParsedURL.Path = filepath.Join(i.rootURLParsed.Path, remoteParsedURL.Path)
		//	remoteParsedURL.Path = strings.ReplaceAll(remoteParsedURL.Path, "\\", "/")
		// }
	}

	if remoteParsedURL.Scheme == "" {
		processingWaiter.done = true
		i.ProcessingFiles.Delete(remoteParsedURL.Path)
		return nil, nil // not a remote file, nothing wrong with that - just we can't keep looking here partner.
	}

	i.logger.Debug("[rolodex remote loader] loading remote file", "file", remoteURL, "remoteURL", remoteParsedURL.String())

	response, clientErr := i.RemoteHandlerFunc(remoteParsedURL.String())
	if clientErr != nil {

		i.remoteErrors = append(i.remoteErrors, clientErr)
		// remove from processing
		processingWaiter.done = true
		i.ProcessingFiles.Delete(remoteParsedURL.Path)
		if response != nil {
			i.logger.Error("client error", "error", clientErr, "status", response.StatusCode)
		} else {
			i.logger.Error("client error", "error", clientErr.Error())
		}
		return nil, clientErr
	}
	if response == nil {
		// remove from processing
		processingWaiter.done = true
		i.ProcessingFiles.Delete(remoteParsedURL.Path)
		return nil, fmt.Errorf("empty response from remote URL: %s", remoteParsedURL.String())
	}
	responseBytes, readError := io.ReadAll(response.Body)
	if readError != nil {

		// remove from processing
		processingWaiter.done = true
		i.ProcessingFiles.Delete(remoteParsedURL.Path)

		return nil, fmt.Errorf("error reading bytes from remote file '%s': [%s]",
			remoteParsedURL.String(), readError.Error())
	}

	if response.StatusCode >= 400 {

		// remove from processing
		processingWaiter.done = true
		i.ProcessingFiles.Delete(remoteParsedURL.Path)

		i.logger.Error("unable to fetch remote document",
			"file", remoteParsedURL.Path, "status", response.StatusCode, "resp", string(responseBytes))
		return nil, fmt.Errorf("unable to fetch remote document '%s' (error %d)", remoteParsedURL.String(),
			response.StatusCode)
	}

	absolutePath := remoteParsedURL.Path

	// extract last modified from response
	lastModified := response.Header.Get("Last-Modified")

	// parse the last modified date into a time object
	lastModifiedTime, parseErr := time.Parse(time.RFC1123, lastModified)

	if parseErr != nil {
		// can't extract last modified, so use now
		lastModifiedTime = time.Now()
	}

	filename := filepath.Base(remoteParsedURL.Path)

	remoteFile := &RemoteFile{
		filename:     filename,
		name:         remoteParsedURL.Path,
		extension:    fileExt,
		data:         responseBytes,
		fullPath:     remoteParsedURL.String(),
		URL:          remoteParsedURL,
		lastModified: lastModifiedTime,
	}

	copiedCfg := *i.indexConfig

	newBase := fmt.Sprintf("%s://%s%s", remoteParsedURLOriginal.Scheme, remoteParsedURLOriginal.Host,
		filepath.Dir(remoteParsedURL.Path))
	newBaseURL, _ := url.Parse(newBase)

	if newBaseURL != nil {
		copiedCfg.BaseURL = newBaseURL
	}
	copiedCfg.SpecAbsolutePath = remoteParsedURL.String()

	if len(remoteFile.data) > 0 {
		i.logger.Debug("[rolodex remote loaded] successfully loaded file", "file", absolutePath)
	}

	i.Files.Store(absolutePath, remoteFile)

	idx, idxError := remoteFile.Index(&copiedCfg)

	if idxError != nil && idx == nil {
		i.remoteErrors = append(i.remoteErrors, idxError)
	} else {

		// for each index, we need a resolver
		resolver := NewResolver(idx)
		idx.resolver = resolver
		idx.BuildIndex()
		if i.rolodex != nil {
			i.rolodex.AddExternalIndex(idx, remoteParsedURL.String())
		}
	}

	// remove from processing
	processingWaiter.file = remoteFile
	processingWaiter.done = true
	i.ProcessingFiles.Delete(remoteParsedURL.Path)
	return remoteFile, errors.Join(i.remoteErrors...)
}
