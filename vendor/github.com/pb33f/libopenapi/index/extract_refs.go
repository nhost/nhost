// Copyright 2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package index

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/pb33f/libopenapi/utils"
	"gopkg.in/yaml.v3"
)

// ExtractRefs will return a deduplicated slice of references for every unique ref found in the document.
// The total number of refs, will generally be much higher, you can extract those from GetRawReferenceCount()
func (index *SpecIndex) ExtractRefs(node, parent *yaml.Node, seenPath []string, level int, poly bool, pName string) []*Reference {
	if node == nil {
		return nil
	}
	var found []*Reference
	if len(node.Content) > 0 {
		var prev, polyName string
		for i, n := range node.Content {
			if utils.IsNodeMap(n) || utils.IsNodeArray(n) {
				level++
				// check if we're using  polymorphic values. These tend to create rabbit warrens of circular
				// references if every single link is followed. We don't resolve polymorphic values.
				isPoly, _ := index.checkPolymorphicNode(prev)
				polyName = pName
				if isPoly {
					poly = true
					if prev != "" {
						polyName = prev
					}
				}
				found = append(found, index.ExtractRefs(n, node, seenPath, level, poly, polyName)...)
			}

			// check if we're dealing with an inline schema definition, that isn't part of an array
			// (which means it's being used as a value in an array, and it's not a label)
			// https://github.com/pb33f/libopenapi/issues/76
			schemaContainingNodes := []string{"schema", "items", "additionalProperties", "contains", "not", "unevaluatedItems", "unevaluatedProperties"}
			if i%2 == 0 && slices.Contains(schemaContainingNodes, n.Value) && !utils.IsNodeArray(node) && (i+1 < len(node.Content)) {

				var jsonPath, definitionPath, fullDefinitionPath string

				if len(seenPath) > 0 || n.Value != "" {
					loc := append(seenPath, n.Value)
					// create definition and full definition paths
					definitionPath = fmt.Sprintf("#/%s", strings.Join(loc, "/"))
					fullDefinitionPath = fmt.Sprintf("%s#/%s", index.specAbsolutePath, strings.Join(loc, "/"))
					_, jsonPath = utils.ConvertComponentIdIntoFriendlyPathSearch(definitionPath)
				}

				ref := &Reference{
					ParentNode:     parent,
					FullDefinition: fullDefinitionPath,
					Definition:     definitionPath,
					Node:           node.Content[i+1],
					KeyNode:        node.Content[i],
					Path:           jsonPath,
					Index:          index,
				}

				isRef, _, _ := utils.IsNodeRefValue(node.Content[i+1])
				if isRef {
					// record this reference
					index.allRefSchemaDefinitions = append(index.allRefSchemaDefinitions, ref)
					continue
				}

				if n.Value == "additionalProperties" || n.Value == "unevaluatedProperties" {
					if utils.IsNodeBoolValue(node.Content[i+1]) {
						continue
					}
				}

				index.allInlineSchemaDefinitions = append(index.allInlineSchemaDefinitions, ref)

				// check if the schema is an object or an array,
				// and if so, add it to the list of inline schema object definitions.
				k, v := utils.FindKeyNodeTop("type", node.Content[i+1].Content)
				if k != nil && v != nil {
					if v.Value == "object" || v.Value == "array" {
						index.allInlineSchemaObjectDefinitions = append(index.allInlineSchemaObjectDefinitions, ref)
					}
				}
			}

			// Perform the same check for all maps of schemas like properties and patternProperties
			// https://github.com/pb33f/libopenapi/issues/76
			mapOfSchemaContainingNodes := []string{"properties", "patternProperties"}
			if i%2 == 0 && slices.Contains(mapOfSchemaContainingNodes, n.Value) && !utils.IsNodeArray(node) && (i+1 < len(node.Content)) {

				// if 'examples' or 'example' exists in the seenPath, skip this 'properties' node.
				// https://github.com/pb33f/libopenapi/issues/160
				if len(seenPath) > 0 {
					skip := false

					// iterate through the path and look for an item named 'examples' or 'example'
					for _, p := range seenPath {
						if p == "examples" || p == "example" {
							skip = true
							break
						}
						// look for any extension in the path and ignore it
						if strings.HasPrefix(p, "x-") {
							skip = true
							break
						}
					}
					if skip {
						continue
					}
				}

				// for each property add it to our schema definitions
				label := ""
				for h, prop := range node.Content[i+1].Content {

					if h%2 == 0 {
						label = prop.Value
						continue
					}
					var jsonPath, definitionPath, fullDefinitionPath string
					if len(seenPath) > 0 || n.Value != "" && label != "" {
						loc := append(seenPath, n.Value, label)
						definitionPath = fmt.Sprintf("#/%s", strings.Join(loc, "/"))
						fullDefinitionPath = fmt.Sprintf("%s#/%s", index.specAbsolutePath, strings.Join(loc, "/"))
						_, jsonPath = utils.ConvertComponentIdIntoFriendlyPathSearch(definitionPath)
					}
					ref := &Reference{
						ParentNode:     parent,
						FullDefinition: fullDefinitionPath,
						Definition:     definitionPath,
						Node:           prop,
						KeyNode:        node.Content[i],
						Path:           jsonPath,
						Index:          index,
					}

					isRef, _, _ := utils.IsNodeRefValue(prop)
					if isRef {
						// record this reference
						index.allRefSchemaDefinitions = append(index.allRefSchemaDefinitions, ref)
						continue
					}

					index.allInlineSchemaDefinitions = append(index.allInlineSchemaDefinitions, ref)

					// check if the schema is an object or an array,
					// and if so, add it to the list of inline schema object definitions.
					k, v := utils.FindKeyNodeTop("type", prop.Content)
					if k != nil && v != nil {
						if v.Value == "object" || v.Value == "array" {
							index.allInlineSchemaObjectDefinitions = append(index.allInlineSchemaObjectDefinitions, ref)
						}
					}
				}
			}

			// Perform the same check for all arrays of schemas like allOf, anyOf, oneOf
			arrayOfSchemaContainingNodes := []string{"allOf", "anyOf", "oneOf", "prefixItems"}
			if i%2 == 0 && slices.Contains(arrayOfSchemaContainingNodes, n.Value) && !utils.IsNodeArray(node) && (i+1 < len(node.Content)) {
				// for each element in the array, add it to our schema definitions
				for h, element := range node.Content[i+1].Content {

					var jsonPath, definitionPath, fullDefinitionPath string
					if len(seenPath) > 0 {
						loc := append(seenPath, n.Value, fmt.Sprintf("%d", h))
						definitionPath = fmt.Sprintf("#/%s", strings.Join(loc, "/"))
						fullDefinitionPath = fmt.Sprintf("%s#/%s", index.specAbsolutePath, strings.Join(loc, "/"))
						_, jsonPath = utils.ConvertComponentIdIntoFriendlyPathSearch(definitionPath)
					} else {
						definitionPath = fmt.Sprintf("#/%s", n.Value)
						fullDefinitionPath = fmt.Sprintf("%s#/%s", index.specAbsolutePath, n.Value)
						_, jsonPath = utils.ConvertComponentIdIntoFriendlyPathSearch(definitionPath)
					}

					ref := &Reference{
						ParentNode:     parent,
						FullDefinition: fullDefinitionPath,
						Definition:     definitionPath,
						Node:           element,
						KeyNode:        node.Content[i],
						Path:           jsonPath,
						Index:          index,
					}

					isRef, _, _ := utils.IsNodeRefValue(element)
					if isRef { // record this reference
						index.allRefSchemaDefinitions = append(index.allRefSchemaDefinitions, ref)
						continue
					}
					index.allInlineSchemaDefinitions = append(index.allInlineSchemaDefinitions, ref)

					// check if the schema is an object or an array,
					// and if so, add it to the list of inline schema object definitions.
					k, v := utils.FindKeyNodeTop("type", element.Content)
					if k != nil && v != nil {
						if v.Value == "object" || v.Value == "array" {
							index.allInlineSchemaObjectDefinitions = append(index.allInlineSchemaObjectDefinitions, ref)
						}
					}
				}
			}

			if i%2 == 0 && n.Value == "$ref" {

				// check if this reference is under an extension or not, if so, drop it from the index.
				if index.config.ExcludeExtensionRefs {
					ext := false
					for _, spi := range seenPath {
						if strings.HasPrefix(spi, "x-") {
							ext = true
							break
						}
					}
					if ext {
						continue
					}
				}

				// only look at scalar values, not maps (looking at you k8s)
				if len(node.Content) > i+1 {
					if !utils.IsNodeStringValue(node.Content[i+1]) {
						continue
					}
					// issue #481, don't look at refs in arrays, the next node isn't the value.
					if utils.IsNodeArray(node) {
						continue
					}
				}

				index.linesWithRefs[n.Line] = true

				fp := make([]string, len(seenPath))
				copy(fp, seenPath)

				if len(node.Content) > i+1 {

					value := node.Content[i+1].Value
					segs := strings.Split(value, "/")
					name := segs[len(segs)-1]
					uri := strings.Split(value, "#/")

					// determine absolute path to this definition
					var defRoot string
					if strings.HasPrefix(index.specAbsolutePath, "http") {
						defRoot = index.specAbsolutePath
					} else {
						defRoot = filepath.Dir(index.specAbsolutePath)
					}

					var componentName string
					var fullDefinitionPath string
					if len(uri) == 2 {
						// Check if we are dealing with a ref to a local definition.
						if uri[0] == "" {
							fullDefinitionPath = fmt.Sprintf("%s#/%s", index.specAbsolutePath, uri[1])
							componentName = value
						} else {
							if strings.HasPrefix(uri[0], "http") {
								fullDefinitionPath = value
								componentName = fmt.Sprintf("#/%s", uri[1])
							} else {
								if filepath.IsAbs(uri[0]) {
									fullDefinitionPath = value
									componentName = fmt.Sprintf("#/%s", uri[1])
								} else {
									// if the index has a base path, use that to resolve the path
									if index.config.BasePath != "" && index.config.BaseURL == nil {
										abs, _ := filepath.Abs(utils.CheckPathOverlap(index.config.BasePath, uri[0], string(os.PathSeparator)))
										if abs != defRoot {
											abs, _ = filepath.Abs(utils.CheckPathOverlap(defRoot, uri[0], string(os.PathSeparator)))
										}
										fullDefinitionPath = fmt.Sprintf("%s#/%s", abs, uri[1])
										componentName = fmt.Sprintf("#/%s", uri[1])
									} else {
										// if the index has a base URL, use that to resolve the path.
										if index.config.BaseURL != nil && !filepath.IsAbs(defRoot) {
											var u url.URL
											if strings.HasPrefix(defRoot, "http") {
												up, _ := url.Parse(defRoot)
												up.Path = utils.ReplaceWindowsDriveWithLinuxPath(filepath.Dir(up.Path))
												u = *up
											} else {
												u = *index.config.BaseURL
											}
											// abs, _ := filepath.Abs(filepath.Join(u.Path, uri[0]))
											// abs, _ := filepath.Abs(utils.CheckPathOverlap(u.Path, uri[0], string(os.PathSeparator)))
											abs := utils.CheckPathOverlap(u.Path, uri[0], string(os.PathSeparator))
											u.Path = utils.ReplaceWindowsDriveWithLinuxPath(abs)
											fullDefinitionPath = fmt.Sprintf("%s#/%s", u.String(), uri[1])
											componentName = fmt.Sprintf("#/%s", uri[1])

										} else {
											abs, _ := filepath.Abs(utils.CheckPathOverlap(defRoot, uri[0], string(os.PathSeparator)))
											fullDefinitionPath = fmt.Sprintf("%s#/%s", abs, uri[1])
											componentName = fmt.Sprintf("#/%s", uri[1])
										}
									}
								}
							}
						}
					} else {
						if strings.HasPrefix(uri[0], "http") {
							fullDefinitionPath = value
						} else {
							// is it a relative file include?
							if !strings.Contains(uri[0], "#") {
								if strings.HasPrefix(defRoot, "http") {
									if !filepath.IsAbs(uri[0]) {
										u, _ := url.Parse(defRoot)
										pathDir := filepath.Dir(u.Path)
										// pathAbs, _ := filepath.Abs(filepath.Join(pathDir, uri[0]))
										pathAbs, _ := filepath.Abs(utils.CheckPathOverlap(pathDir, uri[0], string(os.PathSeparator)))
										pathAbs = utils.ReplaceWindowsDriveWithLinuxPath(pathAbs)
										u.Path = pathAbs
										fullDefinitionPath = u.String()
									}
								} else {
									if !filepath.IsAbs(uri[0]) {
										// if the index has a base path, use that to resolve the path
										if index.config.BasePath != "" {
											abs, _ := filepath.Abs(utils.CheckPathOverlap(index.config.BasePath, uri[0], string(os.PathSeparator)))
											if abs != defRoot {
												abs, _ = filepath.Abs(utils.CheckPathOverlap(defRoot, uri[0], string(os.PathSeparator)))
											}
											fullDefinitionPath = abs
											componentName = uri[0]
										} else {
											// if the index has a base URL, use that to resolve the path.
											if index.config.BaseURL != nil {

												u := *index.config.BaseURL
												abs := utils.CheckPathOverlap(u.Path, uri[0], string(os.PathSeparator))
												abs = utils.ReplaceWindowsDriveWithLinuxPath(abs)
												u.Path = abs
												fullDefinitionPath = u.String()
												componentName = uri[0]
											} else {
												abs, _ := filepath.Abs(utils.CheckPathOverlap(defRoot, uri[0], string(os.PathSeparator)))
												fullDefinitionPath = abs
												componentName = uri[0]
											}
										}
									}
								}
							}
						}
					}

					_, p := utils.ConvertComponentIdIntoFriendlyPathSearch(componentName)

					ref := &Reference{
						ParentNode:     parent,
						FullDefinition: fullDefinitionPath,
						Definition:     componentName,
						Name:           name,
						Node:           node,
						KeyNode:        node.Content[i+1],
						Path:           p,
						Index:          index,
					}

					// add to raw sequenced refs
					index.rawSequencedRefs = append(index.rawSequencedRefs, ref)

					// add ref by line number
					refNameIndex := strings.LastIndex(value, "/")
					refName := value[refNameIndex+1:]
					if len(index.refsByLine[refName]) > 0 {
						index.refsByLine[refName][n.Line] = true
					} else {
						v := make(map[int]bool)
						v[n.Line] = true
						index.refsByLine[refName] = v
					}

					// if this ref value has any siblings (node.Content is larger than two elements)
					// then add to refs with siblings
					if len(node.Content) > 2 {
						copiedNode := *node
						copied := Reference{
							ParentNode:     parent,
							FullDefinition: fullDefinitionPath,
							Definition:     ref.Definition,
							Name:           ref.Name,
							Node:           &copiedNode,
							KeyNode:        node.Content[i],
							Path:           p,
							Index:          index,
						}
						// protect this data using a copy, prevent the resolver from destroying things.
						index.refsWithSiblings[value] = copied
					}

					// if this is a polymorphic reference, we're going to leave it out
					// allRefs. We don't ever want these resolved, so instead of polluting
					// the timeline, we will keep each poly ref in its own collection for later
					// analysis.
					if poly {
						index.polymorphicRefs[value] = ref

						// index each type
						switch pName {
						case "anyOf":
							index.polymorphicAnyOfRefs = append(index.polymorphicAnyOfRefs, ref)
						case "allOf":
							index.polymorphicAllOfRefs = append(index.polymorphicAllOfRefs, ref)
						case "oneOf":
							index.polymorphicOneOfRefs = append(index.polymorphicOneOfRefs, ref)
						}
						continue
					}

					// check if this is a dupe, if so, skip it, we don't care now.
					if index.allRefs[value] != nil { // seen before, skip.
						continue
					}

					if value == "" {

						completedPath := fmt.Sprintf("$.%s", strings.Join(fp, "."))
						c := node.Content[i]
						if len(node.Content) > i+1 { // if the next node exists, use that.
							c = node.Content[i+1]
						}

						indexError := &IndexingError{
							Err:     errors.New("schema reference is empty and cannot be processed"),
							Node:    c,
							KeyNode: node.Content[i],
							Path:    completedPath,
						}

						index.refErrors = append(index.refErrors, indexError)
						continue
					}

					// This sets the ref in the path using the full URL and sub-path.
					index.allRefs[fullDefinitionPath] = ref
					found = append(found, ref)
				}
			}

			if i%2 == 0 && n.Value != "$ref" && n.Value != "" {

				v := n.Value
				if strings.HasPrefix(v, "/") {
					v = strings.Replace(v, "/", "~1", 1)
				}

				loc := append(seenPath, v)
				definitionPath := fmt.Sprintf("#/%s", strings.Join(loc, "/"))
				_, jsonPath := utils.ConvertComponentIdIntoFriendlyPathSearch(definitionPath)

				// capture descriptions and summaries
				if n.Value == "description" {

					// if the parent is a sequence, ignore.
					if utils.IsNodeArray(node) {
						continue
					}
					if !slices.Contains(seenPath, "example") && !slices.Contains(seenPath, "examples") {
						ref := &DescriptionReference{
							ParentNode: parent,
							Content:    node.Content[i+1].Value,
							Path:       jsonPath,
							Node:       node.Content[i+1],
							KeyNode:    node.Content[i],
							IsSummary:  false,
						}

						if !utils.IsNodeMap(ref.Node) {
							index.allDescriptions = append(index.allDescriptions, ref)
							index.descriptionCount++
						}
					}
				}

				if n.Value == "summary" {

					if slices.Contains(seenPath, "example") || slices.Contains(seenPath, "examples") {
						continue
					}

					var b *yaml.Node
					if len(node.Content) == i+1 {
						b = node.Content[i]
					} else {
						b = node.Content[i+1]
					}
					ref := &DescriptionReference{
						ParentNode: parent,
						Content:    b.Value,
						Path:       jsonPath,
						Node:       b,
						KeyNode:    n,
						IsSummary:  true,
					}

					index.allSummaries = append(index.allSummaries, ref)
					index.summaryCount++
				}

				// capture security requirement references (these are not traditional references, but they
				// are used as a look-up. This is the only exception to the design.
				if n.Value == "security" {
					var b *yaml.Node
					if len(node.Content) == i+1 {
						b = node.Content[i]
					} else {
						b = node.Content[i+1]
					}
					if utils.IsNodeArray(b) {
						var secKey string
						for k := range b.Content {
							if utils.IsNodeMap(b.Content[k]) {
								for g := range b.Content[k].Content {
									if g%2 == 0 {
										secKey = b.Content[k].Content[g].Value
										continue
									}
									if utils.IsNodeArray(b.Content[k].Content[g]) {
										var refMap map[string][]*Reference
										if index.securityRequirementRefs[secKey] == nil {
											index.securityRequirementRefs[secKey] = make(map[string][]*Reference)
											refMap = index.securityRequirementRefs[secKey]
										} else {
											refMap = index.securityRequirementRefs[secKey]
										}
										for r := range b.Content[k].Content[g].Content {
											var refs []*Reference
											if refMap[b.Content[k].Content[g].Content[r].Value] != nil {
												refs = refMap[b.Content[k].Content[g].Content[r].Value]
											}

											refs = append(refs, &Reference{
												Definition: b.Content[k].Content[g].Content[r].Value,
												Path:       fmt.Sprintf("%s.security[%d].%s[%d]", jsonPath, k, secKey, r),
												Node:       b.Content[k].Content[g].Content[r],
												KeyNode:    b.Content[k].Content[g],
											})

											index.securityRequirementRefs[secKey][b.Content[k].Content[g].Content[r].Value] = refs
										}
									}
								}
							}
						}
					}
				}
				// capture enums
				if n.Value == "enum" {

					if len(seenPath) > 0 {
						lastItem := seenPath[len(seenPath)-1]
						if lastItem == "properties" {
							seenPath = append(seenPath, strings.ReplaceAll(n.Value, "/", "~1"))
							prev = n.Value
							continue
						}
					}

					// all enums need to have a type, extract the type from the node where the enum was found.
					_, enumKeyValueNode := utils.FindKeyNodeTop("type", node.Content)

					if enumKeyValueNode != nil {
						ref := &EnumReference{
							ParentNode: parent,
							Path:       jsonPath,
							Node:       node.Content[i+1],
							KeyNode:    node.Content[i],
							Type:       enumKeyValueNode,
							SchemaNode: node,
						}

						index.allEnums = append(index.allEnums, ref)
						index.enumCount++
					}
				}
				// capture all objects with properties
				if n.Value == "properties" {
					_, typeKeyValueNode := utils.FindKeyNodeTop("type", node.Content)

					if typeKeyValueNode != nil {
						isObject := false

						if typeKeyValueNode.Value == "object" {
							isObject = true
						}

						for _, v := range typeKeyValueNode.Content {
							if v.Value == "object" {
								isObject = true
							}
						}

						if isObject {
							index.allObjectsWithProperties = append(index.allObjectsWithProperties, &ObjectReference{
								Path:       jsonPath,
								Node:       node,
								KeyNode:    n,
								ParentNode: parent,
							})
						}
					}
				}

				seenPath = append(seenPath, strings.ReplaceAll(n.Value, "/", "~1"))
				// seenPath = append(seenPath, n.Value)
				prev = n.Value
			}

			// if next node is map, don't add segment.
			if i < len(node.Content)-1 {
				next := node.Content[i+1]

				if i%2 != 0 && next != nil && !utils.IsNodeArray(next) && !utils.IsNodeMap(next) && len(seenPath) > 0 {
					seenPath = seenPath[:len(seenPath)-1]
				}
			}
		}
	}

	index.refCount = len(index.allRefs)

	return found
}

// ExtractComponentsFromRefs returns located components from references. The returned nodes from here
// can be used for resolving as they contain the actual object properties.
func (index *SpecIndex) ExtractComponentsFromRefs(refs []*Reference) []*Reference {
	var found []*Reference

	// run this async because when things get recursive, it can take a while
	var c chan struct{}
	if !index.config.ExtractRefsSequentially {
		c = make(chan struct{})
	}

	locate := func(ref *Reference, refIndex int, sequence []*ReferenceMapped) {
		index.refLock.Lock()
		if index.allMappedRefs[ref.FullDefinition] != nil {
			rm := &ReferenceMapped{
				OriginalReference: ref,
				Reference:         index.allMappedRefs[ref.FullDefinition],
				Definition:        index.allMappedRefs[ref.FullDefinition].Definition,
				FullDefinition:    index.allMappedRefs[ref.FullDefinition].FullDefinition,
			}
			sequence[refIndex] = rm
			if !index.config.ExtractRefsSequentially {
				c <- struct{}{}
			}
			index.refLock.Unlock()
		} else {
			index.refLock.Unlock()
			// If it's local, this is safe to do unlocked
			uri := strings.Split(ref.FullDefinition, "#/")
			unsafeAsync := len(uri) == 2 && len(uri[0]) > 0
			if unsafeAsync {
				index.refLock.Lock()
			}
			located := index.FindComponent(ref.FullDefinition)
			if unsafeAsync {
				index.refLock.Unlock()
			}
			if located != nil {

				// key node is always going to be nil when mapping, yamlpath API returns
				// subnodes only, so we need to rollback in the nodemap a line (if we can) to extract
				// the keynode.
				if located.Node != nil {
					index.nodeMapLock.RLock()
					if located.Node.Line > 1 && len(index.nodeMap[located.Node.Line-1]) > 0 {
						for _, v := range index.nodeMap[located.Node.Line-1] {
							located.KeyNode = v
							break
						}
					}
					index.nodeMapLock.RUnlock()
				}

				// have we already mapped this?
				index.refLock.Lock()
				if index.allMappedRefs[ref.FullDefinition] == nil {
					found = append(found, located)
					index.allMappedRefs[located.FullDefinition] = located
				}
				rm := &ReferenceMapped{
					OriginalReference: ref,
					Reference:         located,
					Definition:        located.Definition,
					FullDefinition:    located.FullDefinition,
				}
				sequence[refIndex] = rm
				index.refLock.Unlock()

			} else {

				_, path := utils.ConvertComponentIdIntoFriendlyPathSearch(ref.Definition)
				indexError := &IndexingError{
					Err:     fmt.Errorf("component `%s` does not exist in the specification", ref.Definition),
					Node:    ref.Node,
					Path:    path,
					KeyNode: ref.KeyNode,
				}
				index.errorLock.Lock()
				index.refErrors = append(index.refErrors, indexError)
				index.errorLock.Unlock()
			}
			if !index.config.ExtractRefsSequentially {
				c <- struct{}{}
			}
		}
	}

	var refsToCheck []*Reference
	refsToCheck = append(refsToCheck, refs...)

	mappedRefsInSequence := make([]*ReferenceMapped, len(refsToCheck))

	for r := range refsToCheck {
		// expand our index of all mapped refs
		if !index.config.ExtractRefsSequentially {
			go locate(refsToCheck[r], r, mappedRefsInSequence) // run async
		} else {
			locate(refsToCheck[r], r, mappedRefsInSequence) // run synchronously
		}
	}

	if !index.config.ExtractRefsSequentially {
		completedRefs := 0
		for completedRefs < len(refsToCheck) {
			<-c
			completedRefs++
		}
	}
	for m := range mappedRefsInSequence {
		if mappedRefsInSequence[m] != nil {
			index.allMappedRefsSequenced = append(index.allMappedRefsSequenced, mappedRefsInSequence[m])
		}
	}

	return found
}
