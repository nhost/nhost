// Copyright 2023 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package index

import (
	"context"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
)

type ContextKey string

const (
	CurrentPathKey ContextKey = "currentPath"
	FoundIndexKey  ContextKey = "foundIndex"
)

func (index *SpecIndex) SearchIndexForReferenceByReference(fullRef *Reference) (*Reference, *SpecIndex) {
	r, idx, _ := index.SearchIndexForReferenceByReferenceWithContext(context.Background(), fullRef)
	return r, idx
}

// SearchIndexForReference searches the index for a reference, first looking through the mapped references
// and then externalSpecIndex for a match. If no match is found, it will recursively search the child indexes
// extracted when parsing the OpenAPI Spec.
func (index *SpecIndex) SearchIndexForReference(ref string) (*Reference, *SpecIndex) {
	return index.SearchIndexForReferenceByReference(&Reference{FullDefinition: ref})
}

func (index *SpecIndex) SearchIndexForReferenceWithContext(ctx context.Context, ref string) (*Reference, *SpecIndex, context.Context) {
	return index.SearchIndexForReferenceByReferenceWithContext(ctx, &Reference{FullDefinition: ref})
}

func (index *SpecIndex) SearchIndexForReferenceByReferenceWithContext(ctx context.Context, searchRef *Reference) (*Reference, *SpecIndex, context.Context) {
	if index.cache != nil {
		if v, ok := index.cache.Load(searchRef.FullDefinition); ok {
			idx := index.extractIndex(v.(*Reference))
			return v.(*Reference), idx, context.WithValue(ctx, CurrentPathKey, v.(*Reference).RemoteLocation)
		}
	}

	ref := searchRef.FullDefinition
	refAlt := ref
	absPath := index.specAbsolutePath
	if searchRef.RemoteLocation != "" {
		absPath = searchRef.RemoteLocation
	}
	if absPath == "" {
		absPath = index.config.BasePath
	}
	var roloLookup string
	uri := strings.Split(ref, "#/")
	if len(uri) == 2 {
		if uri[0] != "" {
			if strings.HasPrefix(uri[0], "http") {
				roloLookup = searchRef.FullDefinition
			} else {
				if filepath.IsAbs(uri[0]) {
					roloLookup = uri[0]
				} else {
					if filepath.Ext(absPath) != "" {
						absPath = filepath.Dir(absPath)
					}
					roloLookup, _ = filepath.Abs(filepath.Join(absPath, uri[0]))
				}
			}
		} else {

			if filepath.Ext(uri[1]) != "" {
				roloLookup = absPath
			} else {
				roloLookup = ""
			}

			ref = fmt.Sprintf("#/%s", uri[1])
			refAlt = fmt.Sprintf("%s#/%s", absPath, uri[1])

		}
	} else {
		if filepath.IsAbs(uri[0]) {
			roloLookup = uri[0]
		} else {
			if strings.HasPrefix(uri[0], "http") {
				roloLookup = ref
			} else {
				if filepath.Ext(absPath) != "" {
					absPath = filepath.Dir(absPath)
				}
				roloLookup, _ = filepath.Abs(filepath.Join(absPath, uri[0]))
			}
		}
		ref = uri[0]
	}
	if strings.Contains(ref, "%") {
		// decode the url.
		ref, _ = url.QueryUnescape(ref)
		refAlt, _ = url.QueryUnescape(refAlt)
	}

	if r, ok := index.allMappedRefs[ref]; ok {
		idx := index.extractIndex(r)
		index.cache.Store(ref, r)
		return r, idx, context.WithValue(ctx, CurrentPathKey, r.RemoteLocation)
	}

	if r, ok := index.allMappedRefs[refAlt]; ok {
		idx := index.extractIndex(r)
		idx.cache.Store(refAlt, r)
		return r, idx, context.WithValue(ctx, CurrentPathKey, r.RemoteLocation)
	}

	if r, ok := index.allComponentSchemaDefinitions.Load(refAlt); ok {
		rf := r.(*Reference)
		idx := index.extractIndex(rf)
		index.cache.Store(refAlt, r)
		return rf, idx, context.WithValue(ctx, CurrentPathKey, rf.RemoteLocation)
	}

	// check security schemes
	if index.allSecuritySchemes != nil {
		if r, ok := index.allSecuritySchemes.Load(refAlt); ok {
			rf := r.(*Reference)
			idx := index.extractIndex(rf)
			index.cache.Store(refAlt, r)
			return rf, idx, context.WithValue(ctx, CurrentPathKey, rf.RemoteLocation)
		}
	}

	// check the rolodex for the reference.
	if roloLookup != "" {

		if strings.Contains(roloLookup, "#") {
			roloLookup = strings.Split(roloLookup, "#")[0]
		}

		b := filepath.Base(roloLookup)
		sfn := index.GetSpecFileName()

		abp := index.GetSpecAbsolutePath()

		if b == sfn && roloLookup == abp {
			return nil, index, ctx
		}
		rFile, err := index.rolodex.Open(roloLookup)
		if err != nil {
			return nil, index, ctx
		}

		// extract the index from the rolodex file.
		if rFile != nil {

			n := rFile.GetFullPath()
			refParsed := ref

			// do we have a relative reference and an exact match on the suffix?
			if strings.HasPrefix(ref, "./") {
				refParsed = strings.ReplaceAll(ref, "./", "")
			}

			if strings.HasSuffix(refParsed, n) {
				node, _ := rFile.GetContentAsYAMLNode()
				if node != nil {
					r := &Reference{
						FullDefinition: n,
						Definition:     n,
						IsRemote:       true,
						RemoteLocation: n,
						Index:          rFile.GetIndex(),
						Node:           node.Content[0],
						ParentNode:     node,
					}
					index.cache.Store(ref, r)
					return r, rFile.GetIndex(), context.WithValue(ctx, CurrentPathKey, rFile.GetFullPath())
				}
			}

			idx := rFile.GetIndex()
			if index.resolver != nil {
				index.resolver.indexesVisited++
			}
			if idx != nil {

				// check mapped refs.
				if r, ok := idx.allMappedRefs[ref]; ok {
					i := index.extractIndex(r)
					return r, i, context.WithValue(ctx, CurrentPathKey, r.RemoteLocation)
				}

				// build a collection of all the inline schemas and search them
				// for the reference.
				var d []*Reference
				d = append(d, idx.allInlineSchemaDefinitions...)
				d = append(d, idx.allRefSchemaDefinitions...)
				d = append(d, idx.allInlineSchemaObjectDefinitions...)
				for _, s := range d {
					if s.FullDefinition == ref {
						i := index.extractIndex(s)
						idx.cache.Store(ref, s)
						index.cache.Store(ref, s)
						return s, i, context.WithValue(ctx, CurrentPathKey, s.RemoteLocation)
					}
				}

				// does component exist in the root?
				node, _ := rFile.GetContentAsYAMLNode()
				if node != nil {
					var found *Reference
					exp := strings.Split(ref, "#/")
					compId := ref

					if len(exp) == 2 {
						compId = fmt.Sprintf("#/%s", exp[1])
						found = FindComponent(node, compId, exp[0], idx)
					}
					if found == nil {
						found = idx.FindComponent(ref)
					}

					if found != nil {
						i := index.extractIndex(found)
						i.cache.Store(ref, found)
						return found, i, context.WithValue(ctx, CurrentPathKey, found.RemoteLocation)
					}
				}
			}
		}
	}

	if index.logger != nil {
		index.logger.Error("unable to locate reference anywhere in the rolodex", "reference", ref)
	}
	return nil, index, ctx
}

func (index *SpecIndex) extractIndex(r *Reference) *SpecIndex {
	idx := r.Index
	if idx != nil && r.Index.GetSpecAbsolutePath() != r.RemoteLocation {
		for i := range r.Index.rolodex.indexes {
			if r.Index.rolodex.indexes[i].GetSpecAbsolutePath() == r.RemoteLocation {
				idx = r.Index.rolodex.indexes[i]
				break
			}
		}
	}
	return idx
}
