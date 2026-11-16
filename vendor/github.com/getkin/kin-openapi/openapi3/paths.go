package openapi3

import (
	"cmp"
	"context"
	"slices"
	"strings"
)

// Paths is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#paths-object
type Paths struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	m map[string]*PathItem
}

// NewPaths builds a paths object with path items in insertion order.
func NewPaths(opts ...NewPathsOption) *Paths {
	paths := NewPathsWithCapacity(len(opts))
	for _, opt := range opts {
		opt(paths)
	}
	return paths
}

// NewPathsOption describes options to NewPaths func
type NewPathsOption func(*Paths)

// WithPath adds a named path item
func WithPath(path string, pathItem *PathItem) NewPathsOption {
	return func(paths *Paths) {
		if p := pathItem; p != nil && path != "" {
			paths.Set(path, p)
		}
	}
}

// Validate returns an error if Paths does not comply with the OpenAPI spec.
func (paths *Paths) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	me := newErrCollector(ctx)

	normalizedPaths := make(map[string]string, paths.Len())

	for _, path := range paths.Keys() {
		pathItem := paths.Value(path)
		if path == "" || path[0] != '/' {
			if err := me.emit(newPathMustStartWithSlash(path, paths.Origin)); err != nil {
				return err
			}
			// Skip validating operations under a malformed path key: any
			// findings below would be addressed under a path that has no
			// resolution path until the key itself is fixed.
			continue
		}

		if pathItem == nil {
			pathItem = &PathItem{}
			paths.Set(path, pathItem)
		}

		normalizedPath, _, varsInPath := normalizeTemplatedPath(path)
		if oldPath, ok := normalizedPaths[normalizedPath]; ok {
			if err := me.emit(newConflictingPaths(path, oldPath, paths.Origin)); err != nil {
				return err
			}
			// Skip validating operations under a duplicate path: the
			// first occurrence already validated its operations under the
			// canonical path, so re-running would surface duplicate-but-
			// identical findings without new information.
			continue
		}
		normalizedPaths[normalizedPath] = path

		var commonParams []string
		for _, parameterRef := range pathItem.Parameters {
			if parameterRef != nil {
				if parameter := parameterRef.Value; parameter != nil && parameter.In == ParameterInPath {
					commonParams = append(commonParams, parameter.Name)
				}
			}
		}
		operations := pathItem.Operations()
		for _, method := range componentNames(operations) {
			operation := operations[method]
			var setParams []string
			for _, parameterRef := range operation.Parameters {
				if parameterRef != nil {
					if parameter := parameterRef.Value; parameter != nil && parameter.In == ParameterInPath {
						setParams = append(setParams, parameter.Name)
					}
				}
			}
			if expected := len(setParams) + len(commonParams); expected != len(varsInPath) {
				expected -= len(varsInPath)
				if expected < 0 {
					expected *= -1
				}
				missing := make(map[string]struct{}, expected)
				definedParams := append(setParams, commonParams...)
				for _, name := range definedParams {
					if _, ok := varsInPath[name]; !ok {
						missing[name] = struct{}{}
					}
				}
				for _, name := range componentNames(varsInPath) {
					if slices.Contains(definedParams, name) {
						break
					}
					missing[name] = struct{}{}
				}
				if len(missing) != 0 {
					if err := me.emit(&PathParametersError{
						Path:    path,
						Method:  method,
						Missing: componentNames(missing),
						Origin:  pathItem.Origin,
					}); err != nil {
						return err
					}
				}
			}
		}

		wrapPath := func(e error) error { return &PathValidationError{Path: path, Cause: e} }
		if err := me.emitWrapped(wrapPath, pathItem.Validate(ctx)); err != nil {
			return err
		}
	}

	if err := me.emit(paths.validateUniqueOperationIDs()); err != nil {
		return err
	}

	return me.finalize(validateExtensions(ctx, paths.Extensions, paths.Origin))
}

// InMatchingOrder returns paths in the order they are matched against URLs.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#paths-object
// When matching URLs, concrete (non-templated) paths would be matched
// before their templated counterparts.
func (paths *Paths) InMatchingOrder() []string {
	// NOTE: sorting by number of variables ASC then by descending lexicographical
	// order seems to be a good heuristic.
	if paths.Len() == 0 {
		return nil
	}

	vars := make(map[int][]string)
	max := 0
	for path := range paths.Map() {
		count := strings.Count(path, "}")
		vars[count] = append(vars[count], path)
		if count > max {
			max = count
		}
	}

	ordered := make([]string, 0, paths.Len())
	for c := 0; c <= max; c++ {
		if ps, ok := vars[c]; ok {
			slices.SortFunc(ps, func(a, b string) int { return cmp.Compare(b, a) })
			ordered = append(ordered, ps...)
		}
	}
	return ordered
}

// Find returns a path that matches the key.
//
// The method ignores differences in template variable names (except possible "*" suffix).
//
// For example:
//
//	paths := openapi3.Paths {
//	  "/person/{personName}": &openapi3.PathItem{},
//	}
//	pathItem := path.Find("/person/{name}")
//
// would return the correct path item.
func (paths *Paths) Find(key string) *PathItem {
	// Try directly access the map
	pathItem := paths.Value(key)
	if pathItem != nil {
		return pathItem
	}

	normalizedPath, expected, _ := normalizeTemplatedPath(key)
	pathsMap := paths.Map()
	for _, path := range componentNames(pathsMap) {
		pathNormalized, got, _ := normalizeTemplatedPath(path)
		if got == expected && pathNormalized == normalizedPath {
			return pathsMap[path]
		}
	}
	return nil
}

func (paths *Paths) validateUniqueOperationIDs() error {
	operationIDs := make(map[string]string)
	pathsMap := paths.Map()
	for _, urlPath := range componentNames(pathsMap) {
		pathItem := pathsMap[urlPath]
		if pathItem == nil {
			continue
		}
		operations := pathItem.Operations()
		for _, httpMethod := range componentNames(operations) {
			operation := operations[httpMethod]
			if operation == nil || operation.OperationID == "" {
				continue
			}
			endpoint := httpMethod + " " + urlPath
			if endpointDup, ok := operationIDs[operation.OperationID]; ok {
				if endpoint > endpointDup { // For make error message a bit more deterministic. May be useful for tests.
					endpoint, endpointDup = endpointDup, endpoint
				}
				return newDuplicateOperationID(endpoint, endpointDup, operation.OperationID, operation.Origin)
			}
			operationIDs[operation.OperationID] = endpoint
		}
	}
	return nil
}

func normalizeTemplatedPath(path string) (string, uint, map[string]struct{}) {
	if strings.IndexByte(path, '{') < 0 {
		return path, 0, nil
	}

	var buffTpl strings.Builder
	buffTpl.Grow(len(path))

	var (
		cc         rune
		count      uint
		isVariable bool
		vars       = make(map[string]struct{})
		buffVar    strings.Builder
	)
	for i, c := range path {
		if isVariable {
			if c == '}' {
				// End path variable
				isVariable = false

				vars[buffVar.String()] = struct{}{}
				buffVar = strings.Builder{}

				// First append possible '*' before this character
				// The character '}' will be appended
				if i > 0 && cc == '*' {
					buffTpl.WriteRune(cc)
				}
			} else {
				buffVar.WriteRune(c)
				continue
			}

		} else if c == '{' {
			// Begin path variable
			isVariable = true

			// The character '{' will be appended
			count++
		}

		// Append the character
		buffTpl.WriteRune(c)
		cc = c
	}
	return buffTpl.String(), count, vars
}
