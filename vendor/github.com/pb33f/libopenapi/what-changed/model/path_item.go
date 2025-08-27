// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package model

import (
	"reflect"

	"github.com/pb33f/libopenapi/datamodel/low"
	v2 "github.com/pb33f/libopenapi/datamodel/low/v2"
	v3 "github.com/pb33f/libopenapi/datamodel/low/v3"
)

// PathItemChanges represents changes found between to Swagger or OpenAPI PathItem object.
type PathItemChanges struct {
	*PropertyChanges
	GetChanges       *OperationChanges   `json:"get,omitempty" yaml:"get,omitempty"`
	PutChanges       *OperationChanges   `json:"put,omitempty" yaml:"put,omitempty"`
	PostChanges      *OperationChanges   `json:"post,omitempty" yaml:"post,omitempty"`
	DeleteChanges    *OperationChanges   `json:"delete,omitempty" yaml:"delete,omitempty"`
	OptionsChanges   *OperationChanges   `json:"options,omitempty" yaml:"options,omitempty"`
	HeadChanges      *OperationChanges   `json:"head,omitempty" yaml:"head,omitempty"`
	PatchChanges     *OperationChanges   `json:"patch,omitempty" yaml:"patch,omitempty"`
	TraceChanges     *OperationChanges   `json:"trace,omitempty" yaml:"trace,omitempty"`
	ServerChanges    []*ServerChanges    `json:"servers,omitempty" yaml:"servers,omitempty"`
	ParameterChanges []*ParameterChanges `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	ExtensionChanges *ExtensionChanges   `json:"extensions,omitempty" yaml:"extensions,omitempty"`
}

// GetAllChanges returns a slice of all changes made between PathItem objects
func (p *PathItemChanges) GetAllChanges() []*Change {
	var changes []*Change
	changes = append(changes, p.Changes...)
	if p.GetChanges != nil {
		changes = append(changes, p.GetChanges.GetAllChanges()...)
	}
	if p.PutChanges != nil {
		changes = append(changes, p.PutChanges.GetAllChanges()...)
	}
	if p.PostChanges != nil {
		changes = append(changes, p.PostChanges.GetAllChanges()...)
	}
	if p.DeleteChanges != nil {
		changes = append(changes, p.DeleteChanges.GetAllChanges()...)
	}
	if p.OptionsChanges != nil {
		changes = append(changes, p.OptionsChanges.GetAllChanges()...)
	}
	if p.HeadChanges != nil {
		changes = append(changes, p.HeadChanges.GetAllChanges()...)
	}
	if p.PatchChanges != nil {
		changes = append(changes, p.PatchChanges.GetAllChanges()...)
	}
	if p.TraceChanges != nil {
		changes = append(changes, p.TraceChanges.GetAllChanges()...)
	}
	for i := range p.ServerChanges {
		changes = append(changes, p.ServerChanges[i].GetAllChanges()...)
	}
	for i := range p.ParameterChanges {
		changes = append(changes, p.ParameterChanges[i].GetAllChanges()...)
	}
	if p.ExtensionChanges != nil {
		changes = append(changes, p.ExtensionChanges.GetAllChanges()...)
	}
	return changes
}

// TotalChanges returns the total number of changes found between two Swagger or OpenAPI PathItems
func (p *PathItemChanges) TotalChanges() int {
	c := p.PropertyChanges.TotalChanges()
	if p.GetChanges != nil {
		c += p.GetChanges.TotalChanges()
	}
	if p.PutChanges != nil {
		c += p.PutChanges.TotalChanges()
	}
	if p.PostChanges != nil {
		c += p.PostChanges.TotalChanges()
	}
	if p.DeleteChanges != nil {
		c += p.DeleteChanges.TotalChanges()
	}
	if p.OptionsChanges != nil {
		c += p.OptionsChanges.TotalChanges()
	}
	if p.HeadChanges != nil {
		c += p.HeadChanges.TotalChanges()
	}
	if p.PatchChanges != nil {
		c += p.PatchChanges.TotalChanges()
	}
	if p.TraceChanges != nil {
		c += p.TraceChanges.TotalChanges()
	}
	for i := range p.ServerChanges {
		c += p.ServerChanges[i].TotalChanges()
	}
	for i := range p.ParameterChanges {
		c += p.ParameterChanges[i].TotalChanges()
	}
	if p.ExtensionChanges != nil {
		c += p.ExtensionChanges.TotalChanges()
	}
	return c
}

// TotalBreakingChanges returns the total number of breaking changes found between two Swagger or OpenAPI PathItems
func (p *PathItemChanges) TotalBreakingChanges() int {
	c := p.PropertyChanges.TotalBreakingChanges()
	if p.GetChanges != nil {
		c += p.GetChanges.TotalBreakingChanges()
	}
	if p.PutChanges != nil {
		c += p.PutChanges.TotalBreakingChanges()
	}
	if p.PostChanges != nil {
		c += p.PostChanges.TotalBreakingChanges()
	}
	if p.DeleteChanges != nil {
		c += p.DeleteChanges.TotalBreakingChanges()
	}
	if p.OptionsChanges != nil {
		c += p.OptionsChanges.TotalBreakingChanges()
	}
	if p.HeadChanges != nil {
		c += p.HeadChanges.TotalBreakingChanges()
	}
	if p.PatchChanges != nil {
		c += p.PatchChanges.TotalBreakingChanges()
	}
	if p.TraceChanges != nil {
		c += p.TraceChanges.TotalBreakingChanges()
	}
	for i := range p.ServerChanges {
		c += p.ServerChanges[i].TotalBreakingChanges()
	}
	for i := range p.ParameterChanges {
		c += p.ParameterChanges[i].TotalBreakingChanges()
	}
	return c
}

type opCheck struct {
	label   string
	changes *OperationChanges
}

// ComparePathItemsV3 is an OpenAPI typesafe proxy method for ComparePathItems
func ComparePathItemsV3(l, r *v3.PathItem) *PathItemChanges {
	return ComparePathItems(l, r)
}

// ComparePathItems compare a left and right Swagger or OpenAPI PathItem object for changes. If found, returns
// a pointer to PathItemChanges, or returns nil if nothing is found.
func ComparePathItems(l, r any) *PathItemChanges {

	var changes []*Change
	var props []*PropertyCheck

	pc := new(PathItemChanges)

	// Swagger
	if reflect.TypeOf(&v2.PathItem{}) == reflect.TypeOf(l) &&
		reflect.TypeOf(&v2.PathItem{}) == reflect.TypeOf(r) {

		lPath := l.(*v2.PathItem)
		rPath := r.(*v2.PathItem)

		// perform hash check to avoid further processing
		if low.AreEqual(lPath, rPath) {
			return nil
		}

		props = append(props, compareSwaggerPathItem(lPath, rPath, &changes, pc)...)
	}

	// OpenAPI
	if reflect.TypeOf(&v3.PathItem{}) == reflect.TypeOf(l) &&
		reflect.TypeOf(&v3.PathItem{}) == reflect.TypeOf(r) {

		lPath := l.(*v3.PathItem)
		rPath := r.(*v3.PathItem)

		// perform hash check to avoid further processing
		if low.AreEqual(lPath, rPath) {
			return nil
		}

		// description
		props = append(props, &PropertyCheck{
			LeftNode:  lPath.Description.ValueNode,
			RightNode: rPath.Description.ValueNode,
			Label:     v3.DescriptionLabel,
			Changes:   &changes,
			Breaking:  false,
			Original:  lPath,
			New:       lPath,
		})

		// summary
		props = append(props, &PropertyCheck{
			LeftNode:  lPath.Summary.ValueNode,
			RightNode: rPath.Summary.ValueNode,
			Label:     v3.SummaryLabel,
			Changes:   &changes,
			Breaking:  false,
			Original:  lPath,
			New:       lPath,
		})

		compareOpenAPIPathItem(lPath, rPath, &changes, pc)
	}

	CheckProperties(props)
	pc.PropertyChanges = NewPropertyChanges(changes)
	return pc
}

func compareSwaggerPathItem(lPath, rPath *v2.PathItem, changes *[]*Change, pc *PathItemChanges) []*PropertyCheck {

	var props []*PropertyCheck

	totalOps := 0
	opChan := make(chan opCheck)
	// get
	if !lPath.Get.IsEmpty() && !rPath.Get.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Get.Value, rPath.Get.Value, opChan, v3.GetLabel)
	}
	if !lPath.Get.IsEmpty() && rPath.Get.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.GetLabel,
			lPath.Get.ValueNode, nil, true, lPath.Get.Value, nil)
	}
	if lPath.Get.IsEmpty() && !rPath.Get.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.GetLabel,
			nil, rPath.Get.ValueNode, false, nil, rPath.Get.Value)
	}

	// put
	if !lPath.Put.IsEmpty() && !rPath.Put.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Put.Value, rPath.Put.Value, opChan, v3.PutLabel)
	}
	if !lPath.Put.IsEmpty() && rPath.Put.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.PutLabel,
			lPath.Put.ValueNode, nil, true, lPath.Put.Value, nil)
	}
	if lPath.Put.IsEmpty() && !rPath.Put.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.PutLabel,
			nil, rPath.Put.ValueNode, false, nil, lPath.Put.Value)
	}

	// post
	if !lPath.Post.IsEmpty() && !rPath.Post.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Post.Value, rPath.Post.Value, opChan, v3.PostLabel)
	}
	if !lPath.Post.IsEmpty() && rPath.Post.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.PostLabel,
			lPath.Post.ValueNode, nil, true, lPath.Post.Value, nil)
	}
	if lPath.Post.IsEmpty() && !rPath.Post.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.PostLabel,
			nil, rPath.Post.ValueNode, false, nil, lPath.Post.Value)
	}

	// delete
	if !lPath.Delete.IsEmpty() && !rPath.Delete.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Delete.Value, rPath.Delete.Value, opChan, v3.DeleteLabel)
	}
	if !lPath.Delete.IsEmpty() && rPath.Delete.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.DeleteLabel,
			lPath.Delete.ValueNode, nil, true, lPath.Delete.Value, nil)
	}
	if lPath.Delete.IsEmpty() && !rPath.Delete.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.DeleteLabel,
			nil, rPath.Delete.ValueNode, false, nil, lPath.Delete.Value)
	}

	// options
	if !lPath.Options.IsEmpty() && !rPath.Options.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Options.Value, rPath.Options.Value, opChan, v3.OptionsLabel)
	}
	if !lPath.Options.IsEmpty() && rPath.Options.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.OptionsLabel,
			lPath.Options.ValueNode, nil, true, lPath.Options.Value, nil)
	}
	if lPath.Options.IsEmpty() && !rPath.Options.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.OptionsLabel,
			nil, rPath.Options.ValueNode, false, nil, lPath.Options.Value)
	}

	// head
	if !lPath.Head.IsEmpty() && !rPath.Head.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Head.Value, rPath.Head.Value, opChan, v3.HeadLabel)
	}
	if !lPath.Head.IsEmpty() && rPath.Head.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.HeadLabel,
			lPath.Head.ValueNode, nil, true, lPath.Head.Value, nil)
	}
	if lPath.Head.IsEmpty() && !rPath.Head.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.HeadLabel,
			nil, rPath.Head.ValueNode, false, nil, lPath.Head.Value)
	}

	// patch
	if !lPath.Patch.IsEmpty() && !rPath.Patch.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Patch.Value, rPath.Patch.Value, opChan, v3.PatchLabel)
	}
	if !lPath.Patch.IsEmpty() && rPath.Patch.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.PatchLabel,
			lPath.Patch.ValueNode, nil, true, lPath.Patch.Value, nil)
	}
	if lPath.Patch.IsEmpty() && !rPath.Patch.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.PatchLabel,
			nil, rPath.Patch.ValueNode, false, nil, lPath.Patch.Value)
	}

	// parameters
	if !lPath.Parameters.IsEmpty() && !rPath.Parameters.IsEmpty() {
		lParams := lPath.Parameters.Value
		rParams := rPath.Parameters.Value
		lp, rp := extractV2ParametersIntoInterface(lParams, rParams)
		checkParameters(lp, rp, changes, pc)
	}
	if !lPath.Parameters.IsEmpty() && rPath.Parameters.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.ParametersLabel,
			lPath.Parameters.ValueNode, nil, true, lPath.Parameters.Value,
			nil)
	}
	if lPath.Parameters.IsEmpty() && !rPath.Parameters.IsEmpty() {
		breaking := false
		for i := range rPath.Parameters.Value {
			param := rPath.Parameters.Value[i].Value
			if param.Required.Value {
				breaking = true
				break
			}
		}
		CreateChange(changes, PropertyAdded, v3.ParametersLabel,
			nil, rPath.Parameters.ValueNode, breaking, nil,
			rPath.Parameters.Value)
	}

	// collect up operations changes.
	completedOperations := 0
	for completedOperations < totalOps {
		n := <-opChan
		switch n.label {
		case v3.GetLabel:
			pc.GetChanges = n.changes
		case v3.PutLabel:
			pc.PutChanges = n.changes
		case v3.PostLabel:
			pc.PostChanges = n.changes
		case v3.DeleteLabel:
			pc.DeleteChanges = n.changes
		case v3.OptionsLabel:
			pc.OptionsChanges = n.changes
		case v2.HeadLabel:
			pc.HeadChanges = n.changes
		case v2.PatchLabel:
			pc.PatchChanges = n.changes
		}
		completedOperations++

	}
	pc.ExtensionChanges = CompareExtensions(lPath.Extensions, rPath.Extensions)
	return props
}

func extractV2ParametersIntoInterface(l, r []low.ValueReference[*v2.Parameter]) ([]low.ValueReference[low.SharedParameters],
	[]low.ValueReference[low.SharedParameters]) {
	lp := make([]low.ValueReference[low.SharedParameters], len(l))
	rp := make([]low.ValueReference[low.SharedParameters], len(r))
	for i := range l {
		lp[i] = low.ValueReference[low.SharedParameters]{
			Value:     l[i].Value,
			ValueNode: l[i].ValueNode,
		}
	}
	for i := range r {
		rp[i] = low.ValueReference[low.SharedParameters]{
			Value:     r[i].Value,
			ValueNode: r[i].ValueNode,
		}
	}
	return lp, rp
}

func extractV3ParametersIntoInterface(l, r []low.ValueReference[*v3.Parameter]) ([]low.ValueReference[low.SharedParameters],
	[]low.ValueReference[low.SharedParameters]) {
	lp := make([]low.ValueReference[low.SharedParameters], len(l))
	rp := make([]low.ValueReference[low.SharedParameters], len(r))
	for i := range l {
		lp[i] = low.ValueReference[low.SharedParameters]{
			Value:     l[i].Value,
			ValueNode: l[i].ValueNode,
		}
	}
	for i := range r {
		rp[i] = low.ValueReference[low.SharedParameters]{
			Value:     r[i].Value,
			ValueNode: r[i].ValueNode,
		}
	}
	return lp, rp
}

func checkParameters(lParams, rParams []low.ValueReference[low.SharedParameters], changes *[]*Change, pc *PathItemChanges) {

	lv := make(map[string]low.SharedParameters, len(lParams))
	rv := make(map[string]low.SharedParameters, len(rParams))

	for i := range lParams {
		s := lParams[i].Value.GetName().Value
		lv[s] = lParams[i].Value
	}
	for i := range rParams {
		s := rParams[i].Value.GetName().Value
		rv[s] = rParams[i].Value
	}

	var paramChanges []*ParameterChanges
	for n := range lv {
		if _, ok := rv[n]; ok {
			if !low.AreEqual(lv[n], rv[n]) {
				ch := CompareParameters(lv[n], rv[n])
				if ch != nil {
					paramChanges = append(paramChanges, ch)
				}
			}
			continue
		}
		CreateChange(changes, ObjectRemoved, v3.ParametersLabel,
			lv[n].GetName().ValueNode, nil, true, lv[n].GetName().Value,
			nil)

	}
	for n := range rv {
		if _, ok := lv[n]; !ok {
			CreateChange(changes, ObjectAdded, v3.ParametersLabel,
				nil, rv[n].GetName().ValueNode, true, nil,
				rv[n].GetName().Value)
		}
	}
	pc.ParameterChanges = paramChanges
}

func compareOpenAPIPathItem(lPath, rPath *v3.PathItem, changes *[]*Change, pc *PathItemChanges) {

	//var props []*PropertyCheck

	totalOps := 0
	opChan := make(chan opCheck)

	// get
	if !lPath.Get.IsEmpty() && !rPath.Get.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Get.Value, rPath.Get.Value, opChan, v3.GetLabel)
	}
	if !lPath.Get.IsEmpty() && rPath.Get.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.GetLabel,
			lPath.Get.ValueNode, nil, true, lPath.Get.Value, nil)
	}
	if lPath.Get.IsEmpty() && !rPath.Get.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.GetLabel,
			nil, rPath.Get.ValueNode, false, nil, lPath.Get.Value)
	}

	// put
	if !lPath.Put.IsEmpty() && !rPath.Put.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Put.Value, rPath.Put.Value, opChan, v3.PutLabel)
	}
	if !lPath.Put.IsEmpty() && rPath.Put.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.PutLabel,
			lPath.Put.ValueNode, nil, true, lPath.Put.Value, nil)
	}
	if lPath.Put.IsEmpty() && !rPath.Put.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.PutLabel,
			nil, rPath.Put.ValueNode, false, nil, lPath.Put.Value)
	}

	// post
	if !lPath.Post.IsEmpty() && !rPath.Post.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Post.Value, rPath.Post.Value, opChan, v3.PostLabel)
	}
	if !lPath.Post.IsEmpty() && rPath.Post.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.PostLabel,
			lPath.Post.ValueNode, nil, true, lPath.Post.Value, nil)
	}
	if lPath.Post.IsEmpty() && !rPath.Post.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.PostLabel,
			nil, rPath.Post.ValueNode, false, nil, lPath.Post.Value)
	}

	// delete
	if !lPath.Delete.IsEmpty() && !rPath.Delete.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Delete.Value, rPath.Delete.Value, opChan, v3.DeleteLabel)
	}
	if !lPath.Delete.IsEmpty() && rPath.Delete.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.DeleteLabel,
			lPath.Delete.ValueNode, nil, true, lPath.Delete.Value, nil)
	}
	if lPath.Delete.IsEmpty() && !rPath.Delete.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.DeleteLabel,
			nil, rPath.Delete.ValueNode, false, nil, lPath.Delete.Value)
	}

	// options
	if !lPath.Options.IsEmpty() && !rPath.Options.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Options.Value, rPath.Options.Value, opChan, v3.OptionsLabel)
	}
	if !lPath.Options.IsEmpty() && rPath.Options.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.OptionsLabel,
			lPath.Options.ValueNode, nil, true, lPath.Options.Value, nil)
	}
	if lPath.Options.IsEmpty() && !rPath.Options.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.OptionsLabel,
			nil, rPath.Options.ValueNode, false, nil, lPath.Options.Value)
	}

	// head
	if !lPath.Head.IsEmpty() && !rPath.Head.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Head.Value, rPath.Head.Value, opChan, v3.HeadLabel)
	}
	if !lPath.Head.IsEmpty() && rPath.Head.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.HeadLabel,
			lPath.Head.ValueNode, nil, true, lPath.Head.Value, nil)
	}
	if lPath.Head.IsEmpty() && !rPath.Head.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.HeadLabel,
			nil, rPath.Head.ValueNode, false, nil, lPath.Head.Value)
	}

	// patch
	if !lPath.Patch.IsEmpty() && !rPath.Patch.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Patch.Value, rPath.Patch.Value, opChan, v3.PatchLabel)
	}
	if !lPath.Patch.IsEmpty() && rPath.Patch.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.PatchLabel,
			lPath.Patch.ValueNode, nil, true, lPath.Patch.Value, nil)
	}
	if lPath.Patch.IsEmpty() && !rPath.Patch.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.PatchLabel,
			nil, rPath.Patch.ValueNode, false, nil, lPath.Patch.Value)
	}

	// trace
	if !lPath.Trace.IsEmpty() && !rPath.Trace.IsEmpty() {
		totalOps++
		go checkOperation(lPath.Trace.Value, rPath.Trace.Value, opChan, v3.TraceLabel)
	}
	if !lPath.Trace.IsEmpty() && rPath.Trace.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.TraceLabel,
			lPath.Trace.ValueNode, nil, true, lPath.Trace.Value, nil)
	}
	if lPath.Trace.IsEmpty() && !rPath.Trace.IsEmpty() {
		CreateChange(changes, PropertyAdded, v3.TraceLabel,
			nil, rPath.Trace.ValueNode, false, nil, lPath.Trace.Value)
	}

	// servers
	pc.ServerChanges = checkServers(lPath.Servers, rPath.Servers)

	// parameters
	if !lPath.Parameters.IsEmpty() && !rPath.Parameters.IsEmpty() {
		lParams := lPath.Parameters.Value
		rParams := rPath.Parameters.Value
		lp, rp := extractV3ParametersIntoInterface(lParams, rParams)
		checkParameters(lp, rp, changes, pc)
	}

	if !lPath.Parameters.IsEmpty() && rPath.Parameters.IsEmpty() {
		CreateChange(changes, PropertyRemoved, v3.ParametersLabel,
			lPath.Parameters.ValueNode, nil, true, lPath.Parameters.Value,
			nil)
	}
	if lPath.Parameters.IsEmpty() && !rPath.Parameters.IsEmpty() {
		breaking := false
		for i := range rPath.Parameters.Value {
			param := rPath.Parameters.Value[i].Value
			if param.Required.Value {
				breaking = true
				break
			}
		}
		CreateChange(changes, PropertyAdded, v3.ParametersLabel,
			nil, rPath.Parameters.ValueNode, breaking, nil,
			rPath.Parameters.Value)
	}

	// collect up operations changes.
	completedOperations := 0
	for completedOperations < totalOps {
		n := <-opChan
		switch n.label {
		case v3.GetLabel:
			pc.GetChanges = n.changes
		case v3.PutLabel:
			pc.PutChanges = n.changes
		case v3.PostLabel:
			pc.PostChanges = n.changes
		case v3.DeleteLabel:
			pc.DeleteChanges = n.changes
		case v3.OptionsLabel:
			pc.OptionsChanges = n.changes
		case v3.HeadLabel:
			pc.HeadChanges = n.changes
		case v3.PatchLabel:
			pc.PatchChanges = n.changes
		case v3.TraceLabel:
			pc.TraceChanges = n.changes
		}
		completedOperations++
	}
	pc.ExtensionChanges = CompareExtensions(lPath.Extensions, rPath.Extensions)
}

func checkOperation(l, r any, done chan opCheck, method string) {
	done <- opCheck{
		label:   method,
		changes: CompareOperations(l, r),
	}
}
