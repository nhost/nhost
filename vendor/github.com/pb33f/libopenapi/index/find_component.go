// Copyright 2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package index

import (
	"fmt"
	jsonpathconfig "github.com/speakeasy-api/jsonpath/pkg/jsonpath/config"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/pb33f/libopenapi/utils"
	"github.com/speakeasy-api/jsonpath/pkg/jsonpath"
	"gopkg.in/yaml.v3"
)

// FindComponent will locate a component by its reference, returns nil if nothing is found.
// This method will recurse through remote, local and file references. For each new external reference
// a new index will be created. These indexes can then be traversed recursively.
func (index *SpecIndex) FindComponent(componentId string) *Reference {
	if index.root == nil {
		return nil
	}

	uri := strings.Split(componentId, "#/")
	if len(uri) == 2 {
		if uri[0] != "" {
			if index.specAbsolutePath == uri[0] {
				return index.FindComponentInRoot(fmt.Sprintf("#/%s", uri[1]))
			} else {
				return index.lookupRolodex(uri)
			}
		} else {
			return index.FindComponentInRoot(fmt.Sprintf("#/%s", uri[1]))
		}
	} else {

		// does it contain a file extension?
		fileExt := filepath.Ext(componentId)
		if fileExt != "" {
			return index.lookupRolodex(uri)
		}

		// root search
		return index.FindComponentInRoot(componentId)
	}
}

func FindComponent(root *yaml.Node, componentId, absoluteFilePath string, index *SpecIndex) *Reference {
	// check component for url encoding.
	if strings.Contains(componentId, "%") {
		// decode the url.
		componentId, _ = url.QueryUnescape(componentId)
	}

	name, friendlySearch := utils.ConvertComponentIdIntoFriendlyPathSearch(componentId)
	if friendlySearch == "$." {
		friendlySearch = "$"
	}
	path, err := jsonpath.NewPath(friendlySearch, jsonpathconfig.WithPropertyNameExtension())
	if path == nil || err != nil || root == nil {
		return nil // no component found
	}
	res := path.Query(root)

	if len(res) == 1 {
		resNode := res[0]
		fullDef := fmt.Sprintf("%s%s", absoluteFilePath, componentId)
		// extract properties

		// check if we have already seen this reference and there is a parent, use it
		var parentNode *yaml.Node
		if index.allRefs[componentId] != nil {
			parentNode = index.allRefs[componentId].ParentNode
		}
		if index.allRefs[fullDef] != nil {
			parentNode = index.allRefs[fullDef].ParentNode
		}

		ref := &Reference{
			FullDefinition:        fullDef,
			Definition:            componentId,
			Name:                  name,
			Node:                  resNode,
			Path:                  friendlySearch,
			RemoteLocation:        absoluteFilePath,
			ParentNode:            parentNode,
			Index:                 index,
			RequiredRefProperties: extractDefinitionRequiredRefProperties(resNode, map[string][]string{}, fullDef, index),
		}
		return ref
	}
	return nil
}

func (index *SpecIndex) FindComponentInRoot(componentId string) *Reference {
	if index.root != nil {

		componentId = utils.ReplaceWindowsDriveWithLinuxPath(componentId)
		if !strings.HasPrefix(componentId, "#/") {
			spl := strings.Split(componentId, "#/")
			if len(spl) == 2 {
				if spl[0] != "" {
					componentId = fmt.Sprintf("#/%s", spl[1])
				}
			}
		}

		return FindComponent(index.root, componentId, index.specAbsolutePath, index)
	}
	return nil
}

func (index *SpecIndex) lookupRolodex(uri []string) *Reference {
	if index.rolodex == nil {
		return nil
	}

	if len(uri) > 0 {

		// split string to remove file reference
		file := strings.ReplaceAll(uri[0], "file:", "")

		var absoluteFileLocation, fileName string
		fileName = filepath.Base(file)
		absoluteFileLocation = file

		// if the absolute file location has no file ext, then get the rolodex root.
		ext := filepath.Ext(absoluteFileLocation)
		var parsedDocument *yaml.Node
		idx := index
		if ext != "" {
			// extract the document from the rolodex.
			rFile, rError := index.rolodex.Open(absoluteFileLocation)

			if rError != nil {
				index.logger.Error("unable to open the rolodex file, check specification references and base path",
					"file", absoluteFileLocation, "error", rError)
				return nil
			}

			if rFile == nil {
				index.logger.Error("cannot locate file in the rolodex, check specification references and base path",
					"file", absoluteFileLocation)
				return nil
			}
			if rFile.GetIndex() != nil {
				idx = rFile.GetIndex()
			}

			parsedDocument, _ = rFile.GetContentAsYAMLNode()

		} else {
			parsedDocument = index.root
		}

		wholeFile := false
		query := ""
		if len(uri) < 2 {
			wholeFile = true
		} else {
			query = fmt.Sprintf("#/%s", uri[1])
		}

		// check if there is a component we want to suck in, or if the
		// entire root needs to come in.
		var foundRef *Reference
		if wholeFile {

			if parsedDocument != nil {
				if parsedDocument.Kind == yaml.DocumentNode {
					parsedDocument = parsedDocument.Content[0]
				}
			}

			var parentNode *yaml.Node
			if index.allRefs[absoluteFileLocation] != nil {
				parentNode = index.allRefs[absoluteFileLocation].ParentNode
			}

			foundRef = &Reference{
				ParentNode:            parentNode,
				FullDefinition:        absoluteFileLocation,
				Definition:            fileName,
				Name:                  fileName,
				Index:                 idx,
				Node:                  parsedDocument,
				IsRemote:              true,
				RemoteLocation:        absoluteFileLocation,
				Path:                  "$",
				RequiredRefProperties: extractDefinitionRequiredRefProperties(parsedDocument, map[string][]string{}, absoluteFileLocation, index),
			}
			return foundRef
		} else {
			foundRef = FindComponent(parsedDocument, query, absoluteFileLocation, index)
			if foundRef != nil {
				foundRef.IsRemote = true
				foundRef.RemoteLocation = absoluteFileLocation
				return foundRef
			}
		}
	}
	return nil
}
