// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"fmt"
	"reflect"
	"strings"
	"sync"

	"github.com/pb33f/libopenapi/orderedmap"
	"github.com/pb33f/libopenapi/utils"

	"github.com/pb33f/libopenapi/datamodel/low"
	"gopkg.in/yaml.v3"
)

const (
	HashPh    = "%x"
	EMPTY_STR = ""
)

var changeMutex sync.Mutex

// CreateChange is a generic function that will create a Change of type T, populate all properties if set, and then
// add a pointer to Change[T] in the slice of Change pointers provided
func CreateChange(changes *[]*Change, changeType int, property string, leftValueNode, rightValueNode *yaml.Node,
	breaking bool, originalObject, newObject any,
) *[]*Change {
	// create a new context for the left and right nodes.
	ctx := CreateContext(leftValueNode, rightValueNode)
	c := &Change{
		Context:    ctx,
		ChangeType: changeType,
		Property:   property,
		Breaking:   breaking,
	}
	// if the left is not nil, we have an original value
	if leftValueNode != nil && leftValueNode.Value != "" {
		c.Original = leftValueNode.Value
	}
	// if the right is not nil, then we have a new value
	if rightValueNode != nil && rightValueNode.Value != "" {
		c.New = rightValueNode.Value
	}
	// original and new objects
	c.OriginalObject = originalObject
	c.NewObject = newObject

	// add the change to supplied changes slice
	changeMutex.Lock()
	*changes = append(*changes, c)
	changeMutex.Unlock()
	return changes
}

// CreateContext will return a pointer to a ChangeContext containing the original and new line and column numbers
// of the left and right value nodes.
func CreateContext(l, r *yaml.Node) *ChangeContext {
	ctx := new(ChangeContext)
	if l != nil {
		ctx.OriginalLine = &l.Line
		ctx.OriginalColumn = &l.Column
	}
	if r != nil {
		ctx.NewLine = &r.Line
		ctx.NewColumn = &r.Column
	}
	return ctx
}

func FlattenLowLevelOrderedMap[T any](
	lowMap *orderedmap.Map[low.KeyReference[string], low.ValueReference[T]],
) map[string]*low.ValueReference[T] {
	flat := make(map[string]*low.ValueReference[T])

	for k, l := range lowMap.FromOldest() {
		flat[k.Value] = &l
	}
	return flat
}

// CountBreakingChanges counts the number of changes in a slice that are breaking
func CountBreakingChanges(changes []*Change) int {
	b := 0
	for i := range changes {
		if changes[i].Breaking {
			b++
		}
	}
	return b
}

// CheckForObjectAdditionOrRemoval will check for the addition or removal of an object from left and right maps.
// The label is the key to look for in the left and right maps.
//
// To determine this a breaking change for an addition then set breakingAdd to true (however I can't think of many
// scenarios that adding things should break anything). Removals are generally breaking, except for non contract
// properties like descriptions, summaries and other non-binding values, so a breakingRemove value can be tuned for
// these circumstances.
func CheckForObjectAdditionOrRemoval[T any](l, r map[string]*low.ValueReference[T], label string, changes *[]*Change,
	breakingAdd, breakingRemove bool,
) {
	var left, right T
	if CheckSpecificObjectRemoved(l, r, label) {
		left = l[label].GetValue()
		CreateChange(changes, ObjectRemoved, label, l[label].GetValueNode(), nil,
			breakingRemove, left, nil)
	}
	if CheckSpecificObjectAdded(l, r, label) {
		right = r[label].GetValue()
		CreateChange(changes, ObjectAdded, label, nil, r[label].GetValueNode(),
			breakingAdd, nil, right)
	}
}

// CheckSpecificObjectRemoved returns true if a specific value is not in both maps.
func CheckSpecificObjectRemoved[T any](l, r map[string]*T, label string) bool {
	return l[label] != nil && r[label] == nil
}

// CheckSpecificObjectAdded returns true if a specific value is not in both maps.
func CheckSpecificObjectAdded[T any](l, r map[string]*T, label string) bool {
	return l[label] == nil && r[label] != nil
}

// CheckProperties will iterate through a slice of PropertyCheck pointers of type T. The method is a convenience method
// for running checks on the following methods in order:
//
//	CheckPropertyAdditionOrRemoval
//	CheckForModification
func CheckProperties(properties []*PropertyCheck) {
	// todo: make this async to really speed things up.
	for _, n := range properties {
		CheckPropertyAdditionOrRemoval(n.LeftNode, n.RightNode, n.Label, n.Changes, n.Breaking, n.Original, n.New)
		CheckForModification(n.LeftNode, n.RightNode, n.Label, n.Changes, n.Breaking, n.Original, n.New)
	}
}

// CheckPropertyAdditionOrRemoval will run both CheckForRemoval (first) and CheckForAddition (second)
func CheckPropertyAdditionOrRemoval[T any](l, r *yaml.Node,
	label string, changes *[]*Change, breaking bool, orig, new T,
) {
	CheckForRemoval[T](l, r, label, changes, breaking, orig, new)
	CheckForAddition[T](l, r, label, changes, breaking, orig, new)
}

// CheckForRemoval will check left and right yaml.Node instances for changes. Anything that is found missing on the
// right, but present on the left, is considered a removal. A new Change[T] will be created with the type
//
//	PropertyRemoved
//
// The Change is then added to the slice of []Change[T] instances provided as a pointer.
func CheckForRemoval[T any](l, r *yaml.Node, label string, changes *[]*Change, breaking bool, orig, new T) {
	if l != nil && l.Value != "" && (r == nil || r.Value == "" && !utils.IsNodeArray(r) && !utils.IsNodeMap(r)) {
		CreateChange(changes, PropertyRemoved, label, l, r, breaking, orig, new)
		return
	}
	if l != nil && r == nil {
		CreateChange(changes, PropertyRemoved, label, l, nil, breaking, orig, nil)
	}
}

// CheckForAddition will check left and right yaml.Node instances for changes. Anything that is found missing on the
// left, but present on the left, is considered an addition. A new Change[T] will be created with the type
//
//	PropertyAdded
//
// The Change is then added to the slice of []Change[T] instances provided as a pointer.
func CheckForAddition[T any](l, r *yaml.Node, label string, changes *[]*Change, breaking bool, orig, new T) {
	if (l == nil || l.Value == "") && (r != nil && (r.Value != "" || utils.IsNodeArray(r)) || utils.IsNodeMap(r)) {
		if r != nil {
			if l != nil && (len(l.Content) < len(r.Content)) && len(l.Content) <= 0 {
				CreateChange(changes, PropertyAdded, label, l, r, breaking, orig, new)
			}
			if l == nil {
				CreateChange(changes, PropertyAdded, label, l, r, breaking, orig, new)
			}
		}
	}
}

// CheckForModification will check left and right yaml.Node instances for changes. Anything that is found in both
// sides, but vary in value is considered a modification.
//
// If there is a change in value the function adds a change type of Modified.
//
// The Change is then added to the slice of []Change[T] instances provided as a pointer.
func CheckForModification[T any](l, r *yaml.Node, label string, changes *[]*Change, breaking bool, orig, new T) {
	if l != nil && l.Value != "" && r != nil && r.Value != "" && (r.Value != l.Value || r.Tag != l.Tag) {
		CreateChange(changes, Modified, label, l, r, breaking, orig, new)
		return
	}
	if l != nil && utils.IsNodeArray(l) && r != nil && !utils.IsNodeArray(r) {
		CreateChange(changes, Modified, label, l, r, breaking, orig, new)
		return
	}
	if l != nil && !utils.IsNodeArray(l) && r != nil && utils.IsNodeArray(r) {
		CreateChange(changes, Modified, label, l, r, breaking, orig, new)
		return
	}
	if l != nil && utils.IsNodeMap(l) && r != nil && !utils.IsNodeMap(r) {
		CreateChange(changes, Modified, label, l, r, breaking, orig, new)
		return
	}
	if l != nil && !utils.IsNodeMap(l) && r != nil && utils.IsNodeMap(r) {
		CreateChange(changes, Modified, label, l, r, breaking, orig, new)
		return
	}
	if l != nil && utils.IsNodeArray(l) && r != nil && utils.IsNodeArray(r) {
		if len(l.Content) != len(r.Content) {
			CreateChange(changes, Modified, label, l, r, breaking, orig, new)
			return
		}

		// there is no way to know how to compare the content of the array, without
		// rendering the yaml.Node to a string and comparing the string.
		leftBytes, _ := yaml.Marshal(l)
		rightBytes, _ := yaml.Marshal(r)

		if string(leftBytes) != string(rightBytes) {
			CreateChange(changes, Modified, label, l, r, breaking, orig, new)
		}
		return
	}
	if l != nil && utils.IsNodeMap(l) && r != nil && utils.IsNodeMap(r) {
		// there is no way to know how to compare the content of the map, without
		// rendering the yaml.Node to a string and comparing the string.
		leftBytes, _ := yaml.Marshal(l)
		rightBytes, _ := yaml.Marshal(r)

		if string(leftBytes) != string(rightBytes) {
			CreateChange(changes, Modified, label, l, r, breaking, orig, new)
		}
		return
	}
}

// CheckMapForChanges checks a left and right low level map for any additions, subtractions or modifications to
// values. The compareFunc argument should reference the correct comparison function for the generic type.
func CheckMapForChanges[T any, R any](expLeft, expRight *orderedmap.Map[low.KeyReference[string], low.ValueReference[T]],
	changes *[]*Change, label string, compareFunc func(l, r T) R,
) map[string]R {
	return CheckMapForChangesWithComp(expLeft, expRight, changes, label, compareFunc, true)
}

// CheckMapForAdditionRemoval checks a left and right low level map for any additions or subtractions, but not modifications
func CheckMapForAdditionRemoval[T any](expLeft, expRight *orderedmap.Map[low.KeyReference[string], low.ValueReference[T]],
	changes *[]*Change, label string,
) any {
	// do nothing
	doNothing := func(l, r T) any {
		return nil
	}
	// Adding purely to make sure code is called for coverage.
	var l, r T
	doNothing(l, r)
	// end of coverage code.
	return CheckMapForChangesWithComp(expLeft, expRight, changes, label, doNothing, false)
}

// CheckMapForChangesWithComp checks a left and right low level map for any additions, subtractions or modifications to
// values. The compareFunc argument should reference the correct comparison function for the generic type. The compare
// bit determines if the comparison should be run or not.
func CheckMapForChangesWithComp[T any, R any](expLeft, expRight *orderedmap.Map[low.KeyReference[string], low.ValueReference[T]],
	changes *[]*Change, label string, compareFunc func(l, r T) R, compare bool,
) map[string]R {
	// stop concurrent threads screwing up changes.
	var chLock sync.Mutex

	lHashes := make(map[string]string)
	rHashes := make(map[string]string)
	lValues := make(map[string]low.ValueReference[T])
	rValues := make(map[string]low.ValueReference[T])

	for k, v := range expLeft.FromOldest() {
		lHashes[k.Value] = low.GenerateHashString(v.Value)
		lValues[k.Value] = v
	}

	for k, v := range expRight.FromOldest() {
		rHashes[k.Value] = low.GenerateHashString(v.Value)
		rValues[k.Value] = v
	}

	expChanges := make(map[string]R)

	checkLeft := func(k string, doneChan chan struct{}, f, g map[string]string, p, h map[string]low.ValueReference[T]) {
		rhash := g[k]
		if rhash == "" {
			chLock.Lock()
			if p[k].GetValueNode().Value == "" {
				p[k].GetValueNode().Value = k
			}
			CreateChange(changes, ObjectRemoved, label,
				p[k].GetValueNode(), nil, true,
				p[k].GetValue(), nil)
			chLock.Unlock()
			doneChan <- struct{}{}
			return
		}
		if f[k] == g[k] {
			doneChan <- struct{}{}
			return
		}
		// run comparison.
		if compare {
			chLock.Lock()
			ch := compareFunc(p[k].Value, h[k].Value)
			// incorrect map results were being generated causing panics.
			// https://github.com/pb33f/libopenapi/issues/61
			if !reflect.ValueOf(&ch).Elem().IsZero() {
				expChanges[k] = ch
			}
			chLock.Unlock()
		}
		doneChan <- struct{}{}
	}

	doneChan := make(chan struct{})
	count := 0

	// check left example hashes
	for k := range lHashes {
		count++
		go checkLeft(k, doneChan, lHashes, rHashes, lValues, rValues)
	}

	// check right example hashes
	for k := range rHashes {
		count++
		go checkRightValue(k, doneChan, lHashes, rValues, changes, label, &chLock)
	}

	// wait for all done signals.
	completed := 0
	for completed < count {
		<-doneChan
		completed++

	}
	return expChanges
}

func checkRightValue[T any](k string, doneChan chan struct{}, f map[string]string, p map[string]low.ValueReference[T],
	changes *[]*Change, label string, lock *sync.Mutex,
) {
	lhash := f[k]
	if lhash == "" {
		lock.Lock()
		if p[k].GetValueNode().Value == "" {
			p[k].GetValueNode().Value = k // this is kinda dirty, but I don't want to duplicate code so sue me.
		}
		CreateChange(changes, ObjectAdded, label,
			nil, p[k].GetValueNode(), false,
			nil, p[k].GetValue())
		lock.Unlock()
	}
	doneChan <- struct{}{}
}

// ExtractStringValueSliceChanges will compare two low level string slices for changes.
func ExtractStringValueSliceChanges(lParam, rParam []low.ValueReference[string],
	changes *[]*Change, label string, breaking bool,
) {
	lKeys := make([]string, len(lParam))
	rKeys := make([]string, len(rParam))
	lValues := make(map[string]low.ValueReference[string])
	rValues := make(map[string]low.ValueReference[string])
	for i := range lParam {
		lKeys[i] = strings.ToLower(lParam[i].Value)
		lValues[lKeys[i]] = lParam[i]
	}
	for i := range rParam {
		rKeys[i] = strings.ToLower(rParam[i].Value)
		rValues[rKeys[i]] = rParam[i]
	}
	for i := range lValues {
		if _, ok := rValues[i]; !ok {
			CreateChange(changes, PropertyRemoved, label,
				lValues[i].ValueNode,
				nil,
				breaking,
				lValues[i].Value,
				nil)
		}
	}
	for i := range rValues {
		if _, ok := lValues[i]; !ok {
			CreateChange(changes, PropertyAdded, label,
				nil,
				rValues[i].ValueNode,
				false,
				nil,
				rValues[i].Value)
		}
	}
}

func toString(v any) string {
	if y, ok := v.(*yaml.Node); ok {
		copy := *y
		_ = copy.Encode(&copy)
		return fmt.Sprint(copy)
	}

	return fmt.Sprint(v)
}

// ExtractRawValueSliceChanges will compare two low level interface{} slices for changes.
func ExtractRawValueSliceChanges[T any](lParam, rParam []low.ValueReference[T],
	changes *[]*Change, label string, breaking bool,
) {
	lKeys := make([]string, len(lParam))
	rKeys := make([]string, len(rParam))
	lValues := make(map[string]low.ValueReference[T])
	rValues := make(map[string]low.ValueReference[T])
	for i := range lParam {
		lKeys[i] = strings.ToLower(toString(lParam[i].Value))
		lValues[lKeys[i]] = lParam[i]
	}
	for i := range rParam {
		rKeys[i] = strings.ToLower(toString(rParam[i].Value))
		rValues[rKeys[i]] = rParam[i]
	}
	for i := range lValues {
		if _, ok := rValues[i]; !ok {
			CreateChange(changes, PropertyRemoved, label,
				lValues[i].ValueNode,
				nil,
				breaking,
				lValues[i].Value,
				nil)
		}
	}
	for i := range rValues {
		if _, ok := lValues[i]; !ok {
			CreateChange(changes, PropertyAdded, label,
				nil,
				rValues[i].ValueNode,
				false,
				nil,
				rValues[i].Value)
		}
	}
}
