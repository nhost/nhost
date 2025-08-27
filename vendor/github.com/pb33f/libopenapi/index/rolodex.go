// Copyright 2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package index

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"maps"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

// CanBeIndexed is an interface that allows a file to be indexed.
type CanBeIndexed interface {
	Index(config *SpecIndexConfig) (*SpecIndex, error)
}

// RolodexFile is an interface that represents a file in the rolodex. It combines multiple `fs` interfaces
// like `fs.FileInfo` and `fs.File` into one interface, so the same struct can be used for everything.
type RolodexFile interface {
	GetContent() string
	GetFileExtension() FileExtension
	GetFullPath() string
	GetErrors() []error
	GetContentAsYAMLNode() (*yaml.Node, error)
	GetIndex() *SpecIndex
	Name() string
	ModTime() time.Time
	IsDir() bool
	Sys() any
	Size() int64
	Mode() os.FileMode
}

// RolodexFS is an interface that represents a RolodexFS, is the same interface as `fs.FS`, except it
// also exposes a GetFiles() signature, to extract all files in the FS.
type RolodexFS interface {
	Open(name string) (fs.File, error)
	GetFiles() map[string]RolodexFile
}

// Rolodex is a file system abstraction that allows for the indexing of multiple file systems
// and the ability to resolve references across those file systems. It is used to hold references to external
// files, and the indexes they hold. The rolodex is the master lookup for all references.
type Rolodex struct {
	localFS                    map[string]fs.FS
	remoteFS                   map[string]fs.FS
	indexed                    bool
	built                      bool
	manualBuilt                bool
	resolved                   bool
	circChecked                bool
	indexConfig                *SpecIndexConfig
	indexingDuration           time.Duration
	indexes                    []*SpecIndex
	indexMap                   map[string]*SpecIndex
	indexLock                  sync.Mutex
	rootIndex                  *SpecIndex
	rootNode                   *yaml.Node
	caughtErrors               []error
	safeCircularReferences     []*CircularReferenceResult
	infiniteCircularReferences []*CircularReferenceResult
	ignoredCircularReferences  []*CircularReferenceResult
	logger                     *slog.Logger
}

// NewRolodex creates a new rolodex with the provided index configuration.
func NewRolodex(indexConfig *SpecIndexConfig) *Rolodex {

	logger := indexConfig.Logger
	if logger == nil {
		logger = slog.New(
			slog.NewJSONHandler(
				os.Stdout, &slog.HandlerOptions{
					Level: slog.LevelError,
				},
			),
		)
	}

	r := &Rolodex{
		indexConfig: indexConfig,
		localFS:     make(map[string]fs.FS),
		remoteFS:    make(map[string]fs.FS),
		logger:      logger,
		indexMap:    make(map[string]*SpecIndex),
	}
	indexConfig.Rolodex = r
	return r
}

// GetIgnoredCircularReferences returns a list of circular references that were ignored during the indexing process.
// These can be an array or polymorphic references. Will return an empty slice if no ignored circular references are found.
func (r *Rolodex) GetIgnoredCircularReferences() []*CircularReferenceResult {
	debounced := make(map[string]*CircularReferenceResult)
	var debouncedResults []*CircularReferenceResult
	if r == nil {
		return debouncedResults
	}
	for _, c := range r.ignoredCircularReferences {
		if _, ok := debounced[c.LoopPoint.FullDefinition]; !ok {
			debounced[c.LoopPoint.FullDefinition] = c
		}
	}
	for _, v := range debounced {
		debouncedResults = append(debouncedResults, v)
	}
	return debouncedResults
}

// GetSafeCircularReferences returns a list of circular references that were found to be safe during the indexing process.
// These can be an array or polymorphic references. Will return an empty slice if no safe circular references are found.
func (r *Rolodex) GetSafeCircularReferences() []*CircularReferenceResult {
	debounced := make(map[string]*CircularReferenceResult)
	var debouncedResults []*CircularReferenceResult
	if r == nil {
		return debouncedResults
	}

	// if this rolodex has not been manually checked for circular references or resolved,
	// then we need to perform that check now, looking at all indexes and extracting
	// results from the resolvers.
	if !r.circChecked {
		var extracted []*CircularReferenceResult
		for _, idx := range append(r.GetIndexes(), r.GetRootIndex()) {
			if idx != nil {
				res := idx.resolver
				if res != nil {
					extracted = append(extracted, res.GetSafeCircularReferences()...)
				}
			}
		}
		if len(extracted) > 0 {
			r.safeCircularReferences = append(r.safeCircularReferences, extracted...)
		}
	}

	for _, c := range r.safeCircularReferences {
		if _, ok := debounced[c.LoopPoint.FullDefinition]; !ok {
			debounced[c.LoopPoint.FullDefinition] = c
		}
	}
	for _, v := range debounced {
		debouncedResults = append(debouncedResults, v)
	}
	return debouncedResults
}

// GetIndexingDuration returns the duration it took to index the rolodex.
func (r *Rolodex) GetIndexingDuration() time.Duration {
	return r.indexingDuration
}

// GetRootIndex returns the root index of the rolodex (the entry point, the main document)
func (r *Rolodex) GetRootIndex() *SpecIndex {
	return r.rootIndex
}

// GetConfig returns the index configuration of the rolodex.
func (r *Rolodex) GetConfig() *SpecIndexConfig {
	return r.indexConfig
}

// GetRootNode returns the root index of the rolodex (the entry point, the main document)
func (r *Rolodex) GetRootNode() *yaml.Node {
	return r.rootNode
}

// GetIndexes returns all the indexes in the rolodex.
func (r *Rolodex) GetIndexes() []*SpecIndex {
	return r.indexes
}

// GetCaughtErrors returns all the errors that were caught during the indexing process.
func (r *Rolodex) GetCaughtErrors() []error {
	return r.caughtErrors
}

// AddLocalFS adds a local file system to the rolodex.
func (r *Rolodex) AddLocalFS(baseDir string, fileSystem fs.FS) {
	absBaseDir, _ := filepath.Abs(baseDir)
	if f, ok := fileSystem.(*LocalFS); ok {
		f.rolodex = r
		f.logger = r.logger
	}
	r.localFS[absBaseDir] = fileSystem
}

// SetRootNode sets the root node of the rolodex (the entry point, the main document)
func (r *Rolodex) SetRootNode(node *yaml.Node) {
	r.rootNode = node
}

func (r *Rolodex) AddExternalIndex(idx *SpecIndex, location string) {
	r.indexLock.Lock()
	r.indexes = append(r.indexes, idx)
	if r.indexMap[location] == nil {
		r.indexMap[location] = idx
	}
	r.indexLock.Unlock()
}

func (r *Rolodex) AddIndex(idx *SpecIndex) {
	if idx != nil {
		p := idx.specAbsolutePath
		r.AddExternalIndex(idx, p)
	}
}

// AddRemoteFS adds a remote file system to the rolodex.
func (r *Rolodex) AddRemoteFS(baseURL string, fileSystem fs.FS) {
	if f, ok := fileSystem.(*RemoteFS); ok {
		f.rolodex = r
		f.logger = r.logger
	}
	r.remoteFS[baseURL] = fileSystem
}

// IndexTheRolodex indexes the rolodex, building out the indexes for each file, and then building the root index.
func (r *Rolodex) IndexTheRolodex() error {
	if r.indexed {
		return nil
	}

	var caughtErrors []error

	var indexBuildQueue []*SpecIndex

	indexRolodexFile := func(
		location string, fs fs.FS,
		doneChan chan struct{},
		errChan chan error,
		indexChan chan *SpecIndex,
	) {

		var wg sync.WaitGroup

		indexFileFunc := func(idxFile CanBeIndexed, fullPath string) {
			defer wg.Done()

			// copy config and set the
			copiedConfig := *r.indexConfig
			copiedConfig.SpecAbsolutePath = fullPath
			copiedConfig.AvoidBuildIndex = true // we will build out everything in two steps.
			idx, err := idxFile.Index(&copiedConfig)

			if err == nil { // Index() does not throw an error anymore.
				// for each index, we need a resolver
				resolver := NewResolver(idx)

				// check if the config has been set to ignore circular references in arrays and polymorphic schemas
				if copiedConfig.IgnoreArrayCircularReferences {
					resolver.IgnoreArrayCircularReferences()
				}
				if copiedConfig.IgnorePolymorphicCircularReferences {
					resolver.IgnorePolymorphicCircularReferences()
				}
				indexChan <- idx
			}

		}

		if lfs, ok := fs.(RolodexFS); ok {
			wait := false

			for _, f := range lfs.GetFiles() {
				if idxFile, ko := f.(CanBeIndexed); ko {
					wg.Add(1)
					wait = true
					go indexFileFunc(idxFile, f.GetFullPath())
				}
			}
			if wait {
				wg.Wait()
			}
			doneChan <- struct{}{}
			return
		} else {
			errChan <- errors.New("rolodex file system is not a RolodexFS")
			doneChan <- struct{}{}
		}
	}

	indexingCompleted := 0
	totalToIndex := len(r.localFS) + len(r.remoteFS)
	doneChan := make(chan struct{})
	errChan := make(chan error)
	indexChan := make(chan *SpecIndex)

	// run through every file system and index every file, fan out as many goroutines as possible.
	started := time.Now()
	for k, v := range r.localFS {
		go indexRolodexFile(k, v, doneChan, errChan, indexChan)
	}
	for k, v := range r.remoteFS {
		go indexRolodexFile(k, v, doneChan, errChan, indexChan)
	}

	for indexingCompleted < totalToIndex {
		select {
		case <-doneChan:
			indexingCompleted++
		case err := <-errChan:
			indexingCompleted++
			caughtErrors = append(caughtErrors, err)
		case idx := <-indexChan:
			indexBuildQueue = append(indexBuildQueue, idx)
		}
	}

	// now that we have indexed all the files, we can build the index.
	r.indexes = indexBuildQueue

	sort.Slice(
		indexBuildQueue, func(i, j int) bool {
			return indexBuildQueue[i].specAbsolutePath < indexBuildQueue[j].specAbsolutePath
		},
	)

	for _, idx := range indexBuildQueue {
		idx.BuildIndex()
		if r.indexConfig.AvoidCircularReferenceCheck {
			continue
		}
		errs := idx.resolver.CheckForCircularReferences()
		for e := range errs {
			caughtErrors = append(caughtErrors, errs[e])
		}
		if len(idx.resolver.GetIgnoredCircularPolyReferences()) > 0 {
			r.ignoredCircularReferences = append(
				r.ignoredCircularReferences, idx.resolver.GetIgnoredCircularPolyReferences()...,
			)
		}
		if len(idx.resolver.GetIgnoredCircularArrayReferences()) > 0 {
			r.ignoredCircularReferences = append(
				r.ignoredCircularReferences, idx.resolver.GetIgnoredCircularArrayReferences()...,
			)
		}
	}

	// indexed and built every supporting file, we can build the root index (our entry point)
	if r.rootNode != nil {

		// if there is a base path but no SpecFilePath, then we need to set the root spec config to point to a theoretical root.yaml
		// which does not exist, but is used to formulate the absolute path to root references correctly.
		if r.indexConfig.BasePath != "" && r.indexConfig.BaseURL == nil {
			basePath := r.indexConfig.BasePath
			if !filepath.IsAbs(basePath) {
				basePath, _ = filepath.Abs(basePath)
			}

			if len(r.localFS) > 0 || len(r.remoteFS) > 0 {
				if r.indexConfig.SpecFilePath != "" {
					r.indexConfig.SpecAbsolutePath = filepath.Join(basePath, filepath.Base(r.indexConfig.SpecFilePath))
				} else {
					r.indexConfig.SetTheoreticalRoot()
				}
			}
		}

		// Here we take the root node and also build the index for it.
		// This involves extracting references.
		index := NewSpecIndexWithConfig(r.rootNode, r.indexConfig)
		resolver := NewResolver(index)

		if r.indexConfig.IgnoreArrayCircularReferences {
			resolver.IgnoreArrayCircularReferences()
		}
		if r.indexConfig.IgnorePolymorphicCircularReferences {
			resolver.IgnorePolymorphicCircularReferences()
		}
		r.rootIndex = index
		r.logger.Debug("[rolodex] starting root index build")
		index.BuildIndex()
		r.logger.Debug("[rolodex] root index build completed")

		if !r.indexConfig.AvoidCircularReferenceCheck {
			resolvingErrors := resolver.CheckForCircularReferences()
			r.circChecked = true
			for e := range resolvingErrors {
				caughtErrors = append(caughtErrors, resolvingErrors[e])
			}
			if len(resolver.GetIgnoredCircularPolyReferences()) > 0 {
				r.ignoredCircularReferences = append(
					r.ignoredCircularReferences, resolver.GetIgnoredCircularPolyReferences()...,
				)
			}
			if len(resolver.GetIgnoredCircularArrayReferences()) > 0 {
				r.ignoredCircularReferences = append(
					r.ignoredCircularReferences, resolver.GetIgnoredCircularArrayReferences()...,
				)
			}
		}

		if len(index.refErrors) > 0 {
			caughtErrors = append(caughtErrors, index.refErrors...)
		}
	}
	r.indexingDuration = time.Since(started)
	r.indexed = true
	r.caughtErrors = caughtErrors
	r.built = true
	return errors.Join(caughtErrors...)

}

// CheckForCircularReferences checks for circular references in the rolodex.
func (r *Rolodex) CheckForCircularReferences() {
	if !r.circChecked {
		if r.rootIndex != nil && r.rootIndex.resolver != nil {
			resolvingErrors := r.rootIndex.resolver.CheckForCircularReferences()
			for e := range resolvingErrors {
				r.caughtErrors = append(r.caughtErrors, resolvingErrors[e])
			}
			if len(r.rootIndex.resolver.ignoredPolyReferences) > 0 {
				r.ignoredCircularReferences = append(
					r.ignoredCircularReferences, r.rootIndex.resolver.ignoredPolyReferences...,
				)
			}
			if len(r.rootIndex.resolver.ignoredArrayReferences) > 0 {
				r.ignoredCircularReferences = append(
					r.ignoredCircularReferences, r.rootIndex.resolver.ignoredArrayReferences...,
				)
			}
			r.safeCircularReferences = append(
				r.safeCircularReferences, r.rootIndex.resolver.GetSafeCircularReferences()...,
			)
			r.infiniteCircularReferences = append(
				r.infiniteCircularReferences, r.rootIndex.resolver.GetInfiniteCircularReferences()...,
			)
		}
		r.circChecked = true
	}
}

// Resolve resolves references in the rolodex.
func (r *Rolodex) Resolve() {

	var resolvers []*Resolver
	if r.rootIndex != nil && r.rootIndex.resolver != nil {
		resolvers = append(resolvers, r.rootIndex.resolver)
	}
	for _, idx := range r.indexes {
		if idx.resolver != nil {
			resolvers = append(resolvers, idx.resolver)
		}
	}
	for _, res := range resolvers {
		resolvingErrors := res.Resolve()
		for e := range resolvingErrors {
			r.caughtErrors = append(r.caughtErrors, resolvingErrors[e])
		}
		if r.rootIndex != nil && len(r.rootIndex.resolver.ignoredPolyReferences) > 0 {
			r.ignoredCircularReferences = append(r.ignoredCircularReferences, res.ignoredPolyReferences...)
		}
		if r.rootIndex != nil && len(r.rootIndex.resolver.ignoredArrayReferences) > 0 {
			r.ignoredCircularReferences = append(r.ignoredCircularReferences, res.ignoredArrayReferences...)
		}
		r.safeCircularReferences = append(r.safeCircularReferences, res.GetSafeCircularReferences()...)
		r.infiniteCircularReferences = append(r.infiniteCircularReferences, res.GetInfiniteCircularReferences()...)
	}

	// resolve pending nodes
	for _, res := range resolvers {
		res.ResolvePendingNodes()
	}
	r.resolved = true
}

// BuildIndexes builds the indexes in the rolodex, this is generally not required unless manually building a rolodex.
func (r *Rolodex) BuildIndexes() {
	if r.manualBuilt {
		return
	}
	for _, idx := range r.indexes {
		idx.BuildIndex()
	}
	if r.rootIndex != nil {
		r.rootIndex.BuildIndex()
	}
	r.manualBuilt = true
}

// GetAllReferences  returns all references found in the root and all other indices
func (r *Rolodex) GetAllReferences() map[string]*Reference {
	allRefs := make(map[string]*Reference)
	for _, idx := range append(r.GetIndexes(), r.GetRootIndex()) {
		if idx == nil {
			continue
		}
		refs := idx.GetAllReferences()
		maps.Copy(allRefs, refs)
	}
	return allRefs
}

// GetAllMappedReferences returns all mapped references found in the root and all other indices
func (r *Rolodex) GetAllMappedReferences() map[string]*Reference {
	mappedRefs := make(map[string]*Reference)
	for _, idx := range append(r.GetIndexes(), r.GetRootIndex()) {
		if idx == nil {
			continue
		}
		refs := idx.GetMappedReferences()
		maps.Copy(mappedRefs, refs)
	}
	return mappedRefs
}

// Open opens a file in the rolodex, and returns a RolodexFile.
func (r *Rolodex) Open(location string) (RolodexFile, error) {

	if r == nil {
		return nil, fmt.Errorf("rolodex has not been initialized, cannot open file '%s'", location)
	}

	if len(r.localFS) <= 0 && len(r.remoteFS) <= 0 {
		return nil, fmt.Errorf(
			"rolodex has no file systems configured, cannot open '%s'. Add a BaseURL or BasePath to your configuration so the rolodex knows how to resolve references",
			location,
		)
	}

	var errorStack []error
	var localFile *LocalFile
	var remoteFile *RemoteFile
	fileLookup := location
	isUrl := false
	if strings.HasPrefix(location, "http") {
		isUrl = true
	}

	if !isUrl {
		if len(r.localFS) <= 0 {
			r.logger.Warn("[rolodex] no local file systems configured, cannot open local file", "location", location)
			return nil, fmt.Errorf(
				"the rolodex has no local file systems configured, cannot open local file '%s'", location,
			)
		}

		for k, v := range r.localFS {

			// check if this is a URL or an abs/rel reference.
			if !filepath.IsAbs(location) {
				fileLookup, _ = filepath.Abs(filepath.Join(k, location))
			}

			f, err := v.Open(fileLookup)
			if err != nil {
				// try a lookup that is not absolute, but relative
				f, err = v.Open(location)
				if err != nil {
					errorStack = append(errorStack, err)
					continue
				}
			}
			// check if this is a native rolodex FS, then the work is done.
			if lf, ko := interface{}(f).(*LocalFile); ko {
				localFile = lf
				break
			} else {
				// not a native FS, so we need to read the file and create a local file.
				bytes, rErr := io.ReadAll(f)
				if rErr != nil {
					errorStack = append(errorStack, rErr)
					continue
				}
				s, sErr := f.Stat()
				if sErr != nil {
					errorStack = append(errorStack, sErr)
					continue
				}
				if len(bytes) > 0 {
					localFile = &LocalFile{
						filename:     filepath.Base(fileLookup),
						name:         filepath.Base(fileLookup),
						extension:    ExtractFileType(fileLookup),
						data:         bytes,
						fullPath:     fileLookup,
						lastModified: s.ModTime(),
						index:        r.rootIndex,
					}
					break
				}
			}
		}

	} else {

		if !r.indexConfig.AllowRemoteLookup {
			return nil, fmt.Errorf(
				"remote lookup for '%s' not allowed, please set the index configuration to "+
					"AllowRemoteLookup to true", fileLookup,
			)
		}

		for _, v := range r.remoteFS {

			f, err := v.Open(fileLookup)
			if err != nil {
				r.logger.Warn("[rolodex] errors opening remote file", "location", fileLookup, "error", err)
			}
			if f != nil {

				if rf, ok := interface{}(f).(*RemoteFile); ok {
					remoteFile = rf
					break
				} else {

					bytes, rErr := io.ReadAll(f)
					if rErr != nil {
						errorStack = append(errorStack, rErr)
						continue
					}
					s, sErr := f.Stat()
					if sErr != nil {
						errorStack = append(errorStack, sErr)
						continue
					}
					if len(bytes) > 0 {
						remoteFile = &RemoteFile{
							filename:     filepath.Base(fileLookup),
							name:         filepath.Base(fileLookup),
							extension:    ExtractFileType(fileLookup),
							data:         bytes,
							fullPath:     fileLookup,
							lastModified: s.ModTime(),
							index:        r.rootIndex,
						}
						break
					}
				}
			}
		}
	}

	if localFile != nil {
		return &rolodexFile{
			rolodex:   r,
			location:  localFile.fullPath,
			localFile: localFile,
		}, errors.Join(errorStack...)
	}

	if remoteFile != nil {
		return &rolodexFile{
			rolodex:    r,
			location:   remoteFile.fullPath,
			remoteFile: remoteFile,
		}, errors.Join(errorStack...)
	}

	return nil, errors.Join(errorStack...)
}

var suffixes = []string{"B", "KB", "MB", "GB", "TB"}

func Round(val float64, roundOn float64, places int) (newVal float64) {
	var round float64
	pow := math.Pow(10, float64(places))
	digit := pow * val
	_, div := math.Modf(digit)
	if div >= roundOn {
		round = math.Ceil(digit)
	} else {
		round = math.Floor(digit)
	}
	newVal = round / pow
	return
}

func HumanFileSize(size float64) string {
	base := math.Log(size) / math.Log(1024)
	getSize := Round(math.Pow(1024, base-math.Floor(base)), .5, 2)
	getSuffix := suffixes[int(math.Floor(base))]
	return strconv.FormatFloat(getSize, 'f', -1, 64) + " " + string(getSuffix)
}

func (r *Rolodex) RolodexFileSizeAsString() string {
	size := r.RolodexFileSize()
	return HumanFileSize(float64(size))
}

func (r *Rolodex) RolodexTotalFiles() int {
	// look through each file system and count the files
	var total int
	for _, v := range r.localFS {
		if lfs, ok := v.(RolodexFS); ok {
			total += len(lfs.GetFiles())
		}
	}
	for _, v := range r.remoteFS {
		if lfs, ok := v.(RolodexFS); ok {
			total += len(lfs.GetFiles())
		}
	}
	return total
}

func (r *Rolodex) RolodexFileSize() int64 {
	var size int64
	for _, v := range r.localFS {
		if lfs, ok := v.(RolodexFS); ok {
			for _, f := range lfs.GetFiles() {
				size += f.Size()
			}
		}
	}
	for _, v := range r.remoteFS {
		if lfs, ok := v.(RolodexFS); ok {
			for _, f := range lfs.GetFiles() {
				size += f.Size()
			}
		}
	}
	return size
}

// GetFullLineCount returns the total number of lines from all files in the Rolodex
func (r *Rolodex) GetFullLineCount() int64 {
	var lineCount int64
	for _, v := range r.localFS {
		if lfs, ok := v.(RolodexFS); ok {
			for _, f := range lfs.GetFiles() {
				lineCount += int64(strings.Count(f.GetContent(), "\n")) + 1
			}
		}
	}
	for _, v := range r.remoteFS {
		if lfs, ok := v.(RolodexFS); ok {
			for _, f := range lfs.GetFiles() {
				lineCount += int64(strings.Count(f.GetContent(), "\n")) + 1
			}
		}
	}
	// add in root count
	if r.indexConfig != nil && r.indexConfig.SpecInfo != nil {
		lineCount += int64(strings.Count(string(*r.indexConfig.SpecInfo.SpecBytes), "\n")) + 1
	}
	return lineCount
}

func (r *Rolodex) ClearIndexCaches() {
	if r.rootIndex != nil {
		r.rootIndex.GetHighCache().Clear()
	}
	for _, idx := range r.indexes {
		idx.GetHighCache().Clear()
	}
}
