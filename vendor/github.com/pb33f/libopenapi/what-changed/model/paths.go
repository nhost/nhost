// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"reflect"
	"sync"

	"github.com/pb33f/libopenapi/datamodel/low"
	v2 "github.com/pb33f/libopenapi/datamodel/low/v2"
	v3 "github.com/pb33f/libopenapi/datamodel/low/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
)

// PathsChanges represents changes found between two Swagger or OpenAPI Paths Objects.
type PathsChanges struct {
	*PropertyChanges
	PathItemsChanges map[string]*PathItemChanges `json:"pathItems,omitempty" yaml:"pathItems,omitempty"`
	ExtensionChanges *ExtensionChanges           `json:"extensions,omitempty" yaml:"extensions,omitempty"`
}

// GetAllChanges returns a slice of all changes made between Paths objects
func (p *PathsChanges) GetAllChanges() []*Change {
	var changes []*Change
	changes = append(changes, p.Changes...)
	for k := range p.PathItemsChanges {
		changes = append(changes, p.PathItemsChanges[k].GetAllChanges()...)
	}
	if p.ExtensionChanges != nil {
		changes = append(changes, p.ExtensionChanges.GetAllChanges()...)
	}
	return changes
}

// TotalChanges returns the total number of changes between two Swagger or OpenAPI Paths Objects
func (p *PathsChanges) TotalChanges() int {
	c := p.PropertyChanges.TotalChanges()
	for k := range p.PathItemsChanges {
		c += p.PathItemsChanges[k].TotalChanges()
	}
	if p.ExtensionChanges != nil {
		c += p.ExtensionChanges.TotalChanges()
	}
	return c
}

// TotalBreakingChanges returns tht total number of changes found between two Swagger or OpenAPI Path Objects
func (p *PathsChanges) TotalBreakingChanges() int {
	c := p.PropertyChanges.TotalBreakingChanges()
	for k := range p.PathItemsChanges {
		c += p.PathItemsChanges[k].TotalBreakingChanges()
	}
	return c
}

// ComparePaths compares a left and right Swagger or OpenAPI Paths Object for changes. If found, returns a pointer
// to a PathsChanges instance. Returns nil if nothing is found.
func ComparePaths(l, r any) *PathsChanges {
	var changes []*Change

	pc := new(PathsChanges)
	pathChanges := make(map[string]*PathItemChanges)

	// Swagger
	if reflect.TypeOf(&v2.Paths{}) == reflect.TypeOf(l) &&
		reflect.TypeOf(&v2.Paths{}) == reflect.TypeOf(r) {

		lPath := l.(*v2.Paths)
		rPath := r.(*v2.Paths)

		// perform hash check to avoid further processing
		if low.AreEqual(lPath, rPath) {
			return nil
		}

		lKeys := make(map[string]low.ValueReference[*v2.PathItem])
		rKeys := make(map[string]low.ValueReference[*v2.PathItem])
		for k, v := range lPath.PathItems.FromOldest() {
			lKeys[k.Value] = v
		}
		for k, v := range rPath.PathItems.FromOldest() {
			rKeys[k.Value] = v
		}

		// run every comparison in a thread.
		var mLock sync.Mutex
		compare := func(path string, _ map[string]*PathItemChanges, l, r *v2.PathItem, doneChan chan struct{}) {
			if !low.AreEqual(l, r) {
				mLock.Lock()
				pathChanges[path] = ComparePathItems(l, r)
				mLock.Unlock()
			}
			doneChan <- struct{}{}
		}

		doneChan := make(chan struct{})
		pathsChecked := 0

		for k := range lKeys {
			if _, ok := rKeys[k]; ok {
				go compare(k, pathChanges, lKeys[k].Value, rKeys[k].Value, doneChan)
				pathsChecked++
				continue
			}
			g, p := lPath.FindPathAndKey(k)
			CreateChange(&changes, ObjectRemoved, v3.PathLabel,
				g.KeyNode, nil, true,
				p.Value, nil)
		}

		for k := range rKeys {
			if _, ok := lKeys[k]; !ok {
				g, p := rPath.FindPathAndKey(k)
				CreateChange(&changes, ObjectAdded, v3.PathLabel,
					nil, g.KeyNode, false,
					nil, p.Value)
			}
		}

		// wait for the things to be done.
		completedChecks := 0
		for completedChecks < pathsChecked {
			<-doneChan
			completedChecks++
		}
		if len(pathChanges) > 0 {
			pc.PathItemsChanges = pathChanges
		}

		pc.ExtensionChanges = CompareExtensions(lPath.Extensions, rPath.Extensions)
	}

	// OpenAPI
	if reflect.TypeOf(&v3.Paths{}) == reflect.TypeOf(l) &&
		reflect.TypeOf(&v3.Paths{}) == reflect.TypeOf(r) {

		lPath := l.(*v3.Paths)
		rPath := r.(*v3.Paths)

		// perform hash check to avoid further processing
		if low.AreEqual(lPath, rPath) {
			return nil
		}

		lKeys := make(map[string]low.ValueReference[*v3.PathItem])
		rKeys := make(map[string]low.ValueReference[*v3.PathItem])

		if lPath != nil && lPath.PathItems != nil {
			for k, v := range lPath.PathItems.FromOldest() {
				lKeys[k.Value] = v
			}
		}
		if rPath != nil && rPath.PathItems != nil {
			for k, v := range rPath.PathItems.FromOldest() {
				rKeys[k.Value] = v
			}
		}

		// run every comparison in a thread.
		var mLock sync.Mutex
		compare := func(path string, _ map[string]*PathItemChanges, l, r *v3.PathItem, doneChan chan struct{}) {
			if !low.AreEqual(l, r) {
				mLock.Lock()
				pathChanges[path] = ComparePathItems(l, r)
				mLock.Unlock()
			}
			doneChan <- struct{}{}
		}

		doneChan := make(chan struct{})
		pathsChecked := 0

		for k := range lKeys {
			if _, ok := rKeys[k]; ok {
				go compare(k, pathChanges, lKeys[k].Value, rKeys[k].Value, doneChan)
				pathsChecked++
				continue
			}
			g, p := lPath.FindPathAndKey(k)
			CreateChange(&changes, ObjectRemoved, v3.PathLabel,
				g.KeyNode, nil, true,
				p.Value, nil)
		}

		for k := range rKeys {
			if _, ok := lKeys[k]; !ok {
				g, p := rPath.FindPathAndKey(k)
				CreateChange(&changes, ObjectAdded, v3.PathLabel,
					nil, g.KeyNode, false,
					nil, p.Value)
			}
		}
		// wait for the things to be done.
		completedChecks := 0
		for completedChecks < pathsChecked {
			<-doneChan
			completedChecks++
		}
		if len(pathChanges) > 0 {
			pc.PathItemsChanges = pathChanges
		}

		var lExt, rExt *orderedmap.Map[low.KeyReference[string], low.ValueReference[*yaml.Node]]
		if lPath != nil {
			lExt = lPath.Extensions
		}
		if rPath != nil {
			rExt = rPath.Extensions
		}

		pc.ExtensionChanges = CompareExtensions(lExt, rExt)
	}
	pc.PropertyChanges = NewPropertyChanges(changes)
	return pc
}
