// Copyright 2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package index

import (
	"encoding/json"
	"github.com/pb33f/libopenapi/datamodel"
	"gopkg.in/yaml.v3"
	"io/fs"
	"log/slog"
	"net/http"
	"net/url"
	"path/filepath"
	"sync"
)

// Reference is a wrapper around *yaml.Node results to make things more manageable when performing
// algorithms on data models. the *yaml.Node def is just a bit too low level for tracking state.
type Reference struct {
	FullDefinition        string              `json:"fullDefinition,omitempty"`
	Definition            string              `json:"definition,omitempty"`
	Name                  string              `json:"name,omitempty"`
	Node                  *yaml.Node          `json:"-"`
	KeyNode               *yaml.Node          `json:"-"`
	ParentNode            *yaml.Node          `json:"-"`
	ParentNodeSchemaType  string              `json:"-"` // used to determine if the parent node is an array or not.
	ParentNodeTypes       []string            `json:"-"` // used to capture deep journeys, if any item is an array, we need to know.
	Resolved              bool                `json:"-"`
	Circular              bool                `json:"-"`
	Seen                  bool                `json:"-"`
	IsRemote              bool                `json:"isRemote,omitempty"`
	Index                 *SpecIndex          `json:"-"` // index that contains this reference.
	RemoteLocation        string              `json:"remoteLocation,omitempty"`
	Path                  string              `json:"path,omitempty"`               // this won't always be available.
	RequiredRefProperties map[string][]string `json:"requiredProperties,omitempty"` // definition names (eg, #/definitions/One) to a list of required properties on this definition which reference that definition
}

// ReferenceMapped is a helper struct for mapped references put into sequence (we lose the key)
type ReferenceMapped struct {
	OriginalReference *Reference `json:"originalReference,omitempty"`
	Reference         *Reference `json:"reference,omitempty"`
	Definition        string     `json:"definition,omitempty"`
	FullDefinition    string     `json:"fullDefinition,omitempty"`
	IsPolymorphic     bool       `json:"isPolymorphic,omitempty"`
}

// MarshalJSON is a custom JSON marshaller for the ReferenceMapped struct.
func (rm *ReferenceMapped) MarshalJSON() ([]byte, error) {
	d := map[string]interface{}{
		"definition":     rm.Definition,
		"fullDefinition": rm.FullDefinition,
		"jsonPath":       rm.OriginalReference.Path,
		"line":           rm.OriginalReference.Node.Line,
		"startColumn":    rm.OriginalReference.Node.Column,
		"endColumn": rm.OriginalReference.Node.Content[1].Column +
			(len(rm.OriginalReference.Node.Content[1].Value) + 2),
	}
	if rm.IsPolymorphic {
		d["isPolymorphic"] = true
	}

	if rm.Reference != nil && rm.Reference.KeyNode != nil {
		d["targetLine"] = rm.Reference.KeyNode.Line
		d["targetColumn"] = rm.Reference.KeyNode.Column
	}
	return json.Marshal(d)
}

// SpecIndexConfig is a configuration struct for the SpecIndex introduced in 0.6.0 that provides an expandable
// set of granular options. The first being the ability to set the Base URL for resolving relative references, and
// allowing or disallowing remote or local file lookups.
//   - https://github.com/pb33f/libopenapi/issues/73
type SpecIndexConfig struct {
	// The BaseURL will be the root from which relative references will be resolved from if they can't be found locally.
	//
	// For example:
	//  - $ref: somefile.yaml#/components/schemas/SomeSchema
	//
	// Might not be found locally, if the file was pulled in from a remote server (a good example is the DigitalOcean API).
	// so by setting a BaseURL, the reference will try to be resolved from the remote server.
	//
	// If our baseURL is set to https://pb33f.io/libopenapi then our reference will try to be resolved from:
	//  - $ref: https://pb33f.io/libopenapi/somefile.yaml#/components/schemas/SomeSchema
	//
	// More details on relative references can be found in issue #73: https://github.com/pb33f/libopenapi/issues/73
	BaseURL *url.URL // set the Base URL for resolving relative references if the spec is exploded.

	// If resolving remotely, the RemoteURLHandler will be used to fetch the remote document.
	// If not set, the default http client will be used.
	// Resolves [#132]: https://github.com/pb33f/libopenapi/issues/132
	// deprecated: Use the Rolodex instead
	RemoteURLHandler func(url string) (*http.Response, error)

	// FSHandler is an entity that implements the `fs.FS` interface that will be used to fetch local or remote documents.
	// This is useful if you want to use a custom file system handler, or if you want to use a custom http client or
	// custom network implementation for a lookup.
	//
	// libopenapi will pass the path to the FSHandler, and it will be up to the handler to determine how to fetch
	// the document. This is really useful if your application has a custom file system or uses a database for storing
	// documents.
	//
	// Is the FSHandler is set, it will be used for all lookups, regardless of whether they are local or remote.
	// it also overrides the RemoteURLHandler if set.
	//
	// Resolves[#85] https://github.com/pb33f/libopenapi/issues/85
	// deprecated: Use the Rolodex instead
	FSHandler fs.FS

	// If resolving locally, the BasePath will be the root from which relative references will be resolved from
	BasePath string // set the Base Path for resolving relative references if the spec is exploded.

	// SpecFilePath is the name of the root specification file (usually named "openapi.yaml").
	SpecFilePath string

	// In an earlier version of libopenapi (pre 0.6.0) the index would automatically resolve all references
	// They could have been local, or they could have been remote. This was a problem because it meant
	// There was a potential for a remote exploit if a remote reference was malicious. There aren't any known
	// exploits, but it's better to be safe than sorry.
	//
	// To read more about this, you can find a discussion here: https://github.com/pb33f/libopenapi/pull/64
	AllowRemoteLookup bool // Allow remote lookups for references. Defaults to false
	AllowFileLookup   bool // Allow file lookups for references. Defaults to false

	// If set to true, the index will not be built out, which means only the foundational elements will be
	// parsed and added to the index. This is useful to avoid building out an index if the specification is
	// broken up into references and want it fully resolved.
	//
	// Use the `BuildIndex()` method on the index to build it out once resolved/ready.
	AvoidBuildIndex bool

	// If set to true, the index will not check for circular references automatically, this should be triggered
	// manually, otherwise resolving may explode.
	AvoidCircularReferenceCheck bool

	// Logger is a logger that will be used for logging errors and warnings. If not set, the default logger
	// will be used, set to the Error level.
	Logger *slog.Logger

	// SpecInfo is a pointer to the SpecInfo struct that contains the root node and the spec version. It's the
	// struct that was used to create this index.
	SpecInfo *datamodel.SpecInfo

	// Rolodex is what provides all file and remote based lookups. Without the rolodex, no remote or file lookups
	// can be used. Normally you won't need to worry about setting this as each root document gets a rolodex
	// of its own automatically.
	Rolodex *Rolodex

	// The absolute path to the spec file for the index. Will be absolute, either as a http link or a file.
	// If the index is for a single file spec, then the root will be empty.
	SpecAbsolutePath string

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

	// SkipDocumentCheck will skip the document check when building the index. A document check will look for an 'openapi'
	// or 'swagger' node in the root of the document. If it's not found, then the document is not a valid OpenAPI or
	// the file is a JSON Schema. To allow JSON Schema files to be included set this to true.
	SkipDocumentCheck bool

	// ExtractRefsSequentially will extract all references sequentially, which means the index will look up references
	// as it finds them, vs looking up everything asynchronously.
	// This is a more thorough way of building the index, but it's slower. It's required building a document
	// to be bundled.
	ExtractRefsSequentially bool

	// ExcludeExtensionReferences will prevent the indexing of any $ref pointers buried under extensions.
	// defaults to false (which means extensions will be included)
	ExcludeExtensionRefs bool

	// private fields
	uri []string
}

// SetTheoreticalRoot sets the spec file paths to point to a theoretical spec file, which does not exist but is required
// in order to formulate the absolute path to root references correctly.
func (s *SpecIndexConfig) SetTheoreticalRoot() {
	s.SpecFilePath = filepath.Join(s.BasePath, theoreticalRoot)

	basePath := s.BasePath
	if !filepath.IsAbs(basePath) {
		basePath, _ = filepath.Abs(basePath)
	}
	s.SpecAbsolutePath = filepath.Join(basePath, theoreticalRoot)
}

// CreateOpenAPIIndexConfig is a helper function to create a new SpecIndexConfig with the AllowRemoteLookup and
// AllowFileLookup set to true. This is the default behaviour of the index in previous versions of libopenapi. (pre 0.6.0)
//
// The default BasePath is the current working directory.
func CreateOpenAPIIndexConfig() *SpecIndexConfig {
	return &SpecIndexConfig{
		AllowRemoteLookup: true,
		AllowFileLookup:   true,
	}
}

// CreateClosedAPIIndexConfig is a helper function to create a new SpecIndexConfig with the AllowRemoteLookup and
// AllowFileLookup set to false. This is the default behaviour of the index in versions 0.6.0+
//
// The default BasePath is the current working directory.
func CreateClosedAPIIndexConfig() *SpecIndexConfig {
	return &SpecIndexConfig{}
}

// SpecIndex is a complete pre-computed index of the entire specification. Numbers are pre-calculated and
// quick direct access to paths, operations, tags are all available. No need to walk the entire node tree in rules,
// everything is pre-walked if you need it.
type SpecIndex struct {
	specAbsolutePath                    string
	rolodex                             *Rolodex                                      // the rolodex is used to fetch remote and file based documents.
	allRefs                             map[string]*Reference                         // all (deduplicated) refs
	rawSequencedRefs                    []*Reference                                  // all raw references in sequence as they are scanned, not deduped.
	linesWithRefs                       map[int]bool                                  // lines that link to references.
	allMappedRefs                       map[string]*Reference                         // these are the located mapped refs
	allMappedRefsSequenced              []*ReferenceMapped                            // sequenced mapped refs
	refsByLine                          map[string]map[int]bool                       // every reference and the lines it's referenced from
	pathRefs                            map[string]map[string]*Reference              // all path references
	paramOpRefs                         map[string]map[string]map[string][]*Reference // params in operations.
	paramCompRefs                       map[string]*Reference                         // params in components
	paramAllRefs                        map[string]*Reference                         // combined components and ops
	paramInlineDuplicateNames           map[string][]*Reference                       // inline params all with the same name
	globalTagRefs                       map[string]*Reference                         // top level global tags
	securitySchemeRefs                  map[string]*Reference                         // top level security schemes
	requestBodiesRefs                   map[string]*Reference                         // top level request bodies
	responsesRefs                       map[string]*Reference                         // top level responses
	headersRefs                         map[string]*Reference                         // top level responses
	examplesRefs                        map[string]*Reference                         // top level examples
	securityRequirementRefs             map[string]map[string][]*Reference            // (NOT $ref) but a name based lookup for requirements
	callbacksRefs                       map[string]map[string][]*Reference            // all links
	linksRefs                           map[string]map[string][]*Reference            // all  callbacks
	operationTagsRefs                   map[string]map[string][]*Reference            // tags found in operations
	operationDescriptionRefs            map[string]map[string]*Reference              // descriptions in operations.
	operationSummaryRefs                map[string]map[string]*Reference              // summaries in operations
	callbackRefs                        map[string]*Reference                         // top level callback refs
	serversRefs                         []*Reference                                  // all top level server refs
	rootServersNode                     *yaml.Node                                    // servers root node
	opServersRefs                       map[string]map[string][]*Reference            // all operation level server overrides.
	polymorphicRefs                     map[string]*Reference                         // every reference to a polymorphic ref
	polymorphicAllOfRefs                []*Reference                                  // every reference to 'allOf' references
	polymorphicOneOfRefs                []*Reference                                  // every reference to 'oneOf' references
	polymorphicAnyOfRefs                []*Reference                                  // every reference to 'anyOf' references
	externalDocumentsRef                []*Reference                                  // all external documents in spec
	rootSecurity                        []*Reference                                  // root security definitions.
	rootSecurityNode                    *yaml.Node                                    // root security node.
	refsWithSiblings                    map[string]Reference                          // references with sibling elements next to them
	pathRefsLock                        sync.RWMutex                                  // create lock for all refs maps, we want to build data as fast as we can
	externalDocumentsCount              int                                           // number of externalDocument nodes found
	operationTagsCount                  int                                           // number of unique tags in operations
	globalTagsCount                     int                                           // number of global tags defined
	totalTagsCount                      int                                           // number unique tags in spec
	globalLinksCount                    int                                           // component links
	globalCallbacksCount                int                                           // component callbacks
	pathCount                           int                                           // number of paths
	operationCount                      int                                           // number of operations
	operationParamCount                 int                                           // number of params defined in operations
	componentParamCount                 int                                           // number of params defined in components
	componentsInlineParamUniqueCount    int                                           // number of inline params with unique names
	componentsInlineParamDuplicateCount int                                           // number of inline params with duplicate names
	schemaCount                         int                                           // number of schemas
	refCount                            int                                           // total ref count
	root                                *yaml.Node                                    // the root document
	pathsNode                           *yaml.Node                                    // paths node
	tagsNode                            *yaml.Node                                    // tags node
	parametersNode                      *yaml.Node                                    // components/parameters node
	allParameters                       map[string]*Reference                         // all parameters (components/defs)
	schemasNode                         *yaml.Node                                    // components/schemas node
	allRefSchemaDefinitions             []*Reference                                  // all schemas found that are references.
	allInlineSchemaDefinitions          []*Reference                                  // all schemas found in document outside of components (openapi) or definitions (swagger).
	allInlineSchemaObjectDefinitions    []*Reference                                  // all schemas that are objects found in document outside of components (openapi) or definitions (swagger).
	allComponentSchemaDefinitions       *sync.Map                                     // all schemas found in components (openapi) or definitions (swagger).
	securitySchemesNode                 *yaml.Node                                    // components/securitySchemes node
	allSecuritySchemes                  *sync.Map                                     // all security schemes / definitions.
	allComponentSchemas                 map[string]*Reference                         // all component schema definitions
	allComponentSchemasLock             sync.RWMutex                                  // prevent concurrent read writes to the schema file which causes a race condition
	requestBodiesNode                   *yaml.Node                                    // components/requestBodies node
	allRequestBodies                    map[string]*Reference                         // all request bodies
	responsesNode                       *yaml.Node                                    // components/responses node
	allResponses                        map[string]*Reference                         // all responses
	headersNode                         *yaml.Node                                    // components/headers node
	allHeaders                          map[string]*Reference                         // all headers
	examplesNode                        *yaml.Node                                    // components/examples node
	allExamples                         map[string]*Reference                         // all components examples
	linksNode                           *yaml.Node                                    // components/links node
	allLinks                            map[string]*Reference                         // all links
	callbacksNode                       *yaml.Node                                    // components/callbacks node
	pathItemsNode                       *yaml.Node                                    // components/pathItems node
	allCallbacks                        map[string]*Reference                         // all components callbacks
	allComponentPathItems               map[string]*Reference                         // all components path items examples
	allExternalDocuments                map[string]*Reference                         // all external documents
	externalSpecIndex                   map[string]*SpecIndex                         // create a primary index of all external specs and componentIds
	refErrors                           []error                                       // errors when indexing references
	operationParamErrors                []error                                       // errors when indexing parameters
	allDescriptions                     []*DescriptionReference                       // every single description found in the spec.
	allSummaries                        []*DescriptionReference                       // every single summary found in the spec.
	allEnums                            []*EnumReference                              // every single enum found in the spec.
	allObjectsWithProperties            []*ObjectReference                            // every single object with properties found in the spec.
	enumCount                           int
	descriptionCount                    int
	summaryCount                        int
	refLock                             sync.Mutex
	nodeMapLock                         sync.RWMutex
	componentLock                       sync.RWMutex
	errorLock                           sync.RWMutex
	circularReferences                  []*CircularReferenceResult // only available when the resolver has been used.
	polyCircularReferences              []*CircularReferenceResult // only available when the resolver has been used.
	arrayCircularReferences             []*CircularReferenceResult // only available when the resolver has been used.
	allowCircularReferences             bool                       // decide if you want to error out, or allow circular references, default is false.
	config                              *SpecIndexConfig           // configuration for the index
	componentIndexChan                  chan struct{}
	polyComponentIndexChan              chan struct{}
	resolver                            *Resolver
	cache                               *sync.Map
	built                               bool
	uri                                 []string
	logger                              *slog.Logger
	nodeMap                             map[int]map[int]*yaml.Node
	nodeMapCompleted                    chan struct{}
	pendingResolve                      []refMap
	highModelCache                      Cache
}

// GetResolver returns the resolver for this index.
func (index *SpecIndex) GetResolver() *Resolver {
	return index.resolver
}

// GetConfig returns the SpecIndexConfig for this index.
func (index *SpecIndex) GetConfig() *SpecIndexConfig {
	return index.config
}

func (index *SpecIndex) GetNodeMap() map[int]map[int]*yaml.Node {
	return index.nodeMap
}

func (index *SpecIndex) GetCache() *sync.Map {
	return index.cache
}

// SetAbsolutePath sets the absolute path to the spec file for the index. Will be absolute, either as a http link or a file.
func (index *SpecIndex) SetAbsolutePath(absolutePath string) {
	index.specAbsolutePath = absolutePath
}

// GetSpecAbsolutePath returns the absolute path to the spec file for the index. Will be absolute, either as a http link or a file.
func (index *SpecIndex) GetSpecAbsolutePath() string {
	return index.specAbsolutePath
}

// ExternalLookupFunction is for lookup functions that take a JSONSchema reference and tries to find that node in the
// URI based document. Decides if the reference is local, remote or in a file.
type ExternalLookupFunction func(id string) (foundNode *yaml.Node, rootNode *yaml.Node, lookupError error)

// IndexingError holds data about something that went wrong during indexing.
type IndexingError struct {
	Err     error
	Node    *yaml.Node
	KeyNode *yaml.Node
	Path    string
}

func (i *IndexingError) Error() string {
	return i.Err.Error()
}

// DescriptionReference holds data about a description that was found and where it was found.
type DescriptionReference struct {
	Content    string
	Path       string
	KeyNode    *yaml.Node
	Node       *yaml.Node
	ParentNode *yaml.Node
	IsSummary  bool
}

type EnumReference struct {
	Node       *yaml.Node
	KeyNode    *yaml.Node
	Type       *yaml.Node
	Path       string
	SchemaNode *yaml.Node
	ParentNode *yaml.Node
}

type ObjectReference struct {
	Node       *yaml.Node
	KeyNode    *yaml.Node
	Path       string
	ParentNode *yaml.Node
}

var methodTypes = []string{"get", "post", "put", "patch", "options", "head", "delete"}
