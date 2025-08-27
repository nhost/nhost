// Copyright 2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package datamodel

import (
	"io/fs"
	"log/slog"
	"net/url"
	"os"

	"github.com/pb33f/libopenapi/utils"
)

// DocumentConfiguration is used to configure the document creation process. It was added in v0.6.0 to allow
// for more fine-grained control over controls and new features.
//
// The default configuration will set AllowFileReferences to false and AllowRemoteReferences to false, which means
// any non-local (local being the specification, not the file system) references, will be ignored.
type DocumentConfiguration struct {
	// The BaseURL will be the root from which relative references will be resolved from if they can't be found locally.
	// Make sure it does not point to a file as relative paths will be blindly added to the end of the
	// BaseURL's path.
	// Schema must be set to "http/https".
	BaseURL *url.URL

	// RemoteURLHandler is a function that will be used to retrieve remote documents. If not set, the default
	// remote document getter will be used.
	//
	// The remote handler is only used if the BaseURL is set. If the BaseURL is not set, then the remote handler
	// will not be used, as there will be nothing to use it against.
	//
	// Resolves [#132]: https://github.com/pb33f/libopenapi/issues/132
	RemoteURLHandler utils.RemoteURLHandler

	// If resolving locally, the BasePath will be the root from which relative references will be resolved from.
	// It's usually the location of the root specification.
	//
	// Be warned, setting this value will instruct the rolodex to index EVERY yaml and JSON file it finds from the
	// base path. The rolodex will recurse into every directory and pick up everything form this location down.
	//
	// To avoid sucking in all the files, set the FileFilter to a list of specific files to be included.
	BasePath string // set the Base Path for resolving relative references if the spec is exploded.

	// SpecFilePath is the name of the root specification file (usually named "openapi.yaml").
	SpecFilePath string

	// FileFilter is a list of specific files to be included by the rolodex when looking up references. If this value
	// is set, then only these specific files will be included. If this value is not set, then all files will be included.
	FileFilter []string

	// RemoteFS is a filesystem that will be used to retrieve remote documents. If not set, then the rolodex will
	// use its own internal remote filesystem implementation. The RemoteURLHandler will be used to retrieve remote
	// documents if it has been set. The default is to use the internal remote filesystem loader.
	RemoteFS fs.FS

	// LocalFS is a filesystem that will be used to retrieve local documents. If not set, then the rolodex will
	// use its own internal local filesystem implementation. The default is to use the internal local filesystem loader.
	LocalFS fs.FS

	// AllowFileReferences will allow the index to locate relative file references. This is disabled by default.
	//
	// This behavior is now driven by the inclusion of a BasePath. If a BasePath is set, then the
	// rolodex will look for relative file references. If no BasePath is set, then the rolodex will not look for
	// relative file references.
	//
	// This value when set, will force the creation of a local file system even when the BasePath has not been set.
	// it will suck in and index everything from the current working directory, down... so be warned
	// FileFilter should be used to limit the scope of the rolodex.
	AllowFileReferences bool

	// AllowRemoteReferences will allow the index to lookup remote references. This is disabled by default.
	//
	// This behavior is now driven by the inclusion of a BaseURL. If a BaseURL is set, then the
	// rolodex will look for remote references. If no BaseURL is set, then the rolodex will not look for
	// remote references. This value has no effect as of version 0.13.0 and will be removed in a future release.
	//
	// This value when set, will force the creation of a remote file system even when the BaseURL has not been set.
	// it will suck in every http link it finds, and recurse through all references located in each document.
	AllowRemoteReferences bool

	// AvoidIndexBuild will avoid building the index. This is disabled by default, only use if you are sure you don't need it.
	// This is useful for developers building out models that should be indexed later on.
	AvoidIndexBuild bool

	// BypassDocumentCheck will bypass the document check. This is disabled by default. This will allow any document to
	// passed in and used. Only enable this when parsing non openapi documents.
	BypassDocumentCheck bool

	// IgnorePolymorphicCircularReferences will skip over checking for circular references in polymorphic schemas.
	// A polymorphic schema is any schema that is composed other schemas using references via `oneOf`, `anyOf` of `allOf`.
	// This is disabled by default, which means polymorphic circular references will be checked.
	IgnorePolymorphicCircularReferences bool

	// IgnoreArrayCircularReferences will skip over checking for circular references in arrays. Sometimes a circular
	// reference is required to describe a data-shape correctly. Often those shapes are valid circles if the
	// type of the schema implementing the loop is an array. An empty array would technically break the loop.
	// So if libopenapi is returning circular references for this use case, then this option should be enabled.
	// this is disabled by default, which means array circular references will be checked.
	IgnoreArrayCircularReferences bool

	// SkipCircularReferenceCheck will skip over checking for circular references. This is disabled by default, which
	// means circular references will be checked. This is useful for developers building out models that should be
	// indexed later on.
	SkipCircularReferenceCheck bool

	// Logger is a structured logger that will be used for logging errors and warnings. If not set, a default logger
	// will be used, set to the Error level.
	Logger *slog.Logger

	// ExtractRefsSequentially will extract all references sequentially, which means the index will look up references
	// as it finds them, vs looking up everything asynchronously.
	// This is a more thorough way of building the index, but it's slower. It's required building a document
	// to be bundled.
	ExtractRefsSequentially bool

	// ExcludeExtensionReferences will prevent the indexing of any $ref pointers buried under extensions.
	// defaults to false (which means extensions will be included)
	ExcludeExtensionRefs bool

	// BundleInlineRefs is used by the bundler module. If set to true, all references will be inlined, including
	// local references (to the root document) as well as all external references. This is false by default.
	BundleInlineRefs bool
}

func NewDocumentConfiguration() *DocumentConfiguration {
	return &DocumentConfiguration{
		Logger: slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelError,
		})),
	}
}
