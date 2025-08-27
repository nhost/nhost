// Copyright 2022 Princess B33f Heavy Industries / Dave Shanley
// SPDX-License-Identifier: MIT

package v3

import (
	"reflect"
	"slices"

	"github.com/pb33f/libopenapi/datamodel/high"
	"github.com/pb33f/libopenapi/datamodel/low"
	lowV3 "github.com/pb33f/libopenapi/datamodel/low/v3"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
)

const (
	get = iota
	put
	post
	del
	options
	head
	patch
	trace
)

// PathItem represents a high-level OpenAPI 3+ PathItem object backed by a low-level one.
//
// Describes the operations available on a single path. A Path Item MAY be empty, due to ACL constraints.
// The path itself is still exposed to the documentation viewer but they will not know which operations and parameters
// are available.
//   - https://spec.openapis.org/oas/v3.1.0#path-item-object
type PathItem struct {
	Description string                              `json:"description,omitempty" yaml:"description,omitempty"`
	Summary     string                              `json:"summary,omitempty" yaml:"summary,omitempty"`
	Get         *Operation                          `json:"get,omitempty" yaml:"get,omitempty"`
	Put         *Operation                          `json:"put,omitempty" yaml:"put,omitempty"`
	Post        *Operation                          `json:"post,omitempty" yaml:"post,omitempty"`
	Delete      *Operation                          `json:"delete,omitempty" yaml:"delete,omitempty"`
	Options     *Operation                          `json:"options,omitempty" yaml:"options,omitempty"`
	Head        *Operation                          `json:"head,omitempty" yaml:"head,omitempty"`
	Patch       *Operation                          `json:"patch,omitempty" yaml:"patch,omitempty"`
	Trace       *Operation                          `json:"trace,omitempty" yaml:"trace,omitempty"`
	Servers     []*Server                           `json:"servers,omitempty" yaml:"servers,omitempty"`
	Parameters  []*Parameter                        `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Extensions  *orderedmap.Map[string, *yaml.Node] `json:"-" yaml:"-"`
	low         *lowV3.PathItem
}

// NewPathItem creates a new high-level PathItem instance from a low-level one.
func NewPathItem(pathItem *lowV3.PathItem) *PathItem {
	pi := new(PathItem)
	pi.low = pathItem
	pi.Description = pathItem.Description.Value
	pi.Summary = pathItem.Summary.Value
	pi.Extensions = high.ExtractExtensions(pathItem.Extensions)
	var servers []*Server
	for _, ser := range pathItem.Servers.Value {
		servers = append(servers, NewServer(ser.Value))
	}
	pi.Servers = servers

	// build operation async
	type opResult struct {
		method int
		op     *Operation
	}
	opChan := make(chan opResult)
	buildOperation := func(method int, op *lowV3.Operation, c chan opResult) {
		if op == nil {
			c <- opResult{method: method, op: nil}
			return
		}
		c <- opResult{method: method, op: NewOperation(op)}
	}
	// build out operations async.
	go buildOperation(get, pathItem.Get.Value, opChan)
	go buildOperation(put, pathItem.Put.Value, opChan)
	go buildOperation(post, pathItem.Post.Value, opChan)
	go buildOperation(del, pathItem.Delete.Value, opChan)
	go buildOperation(options, pathItem.Options.Value, opChan)
	go buildOperation(head, pathItem.Head.Value, opChan)
	go buildOperation(patch, pathItem.Patch.Value, opChan)
	go buildOperation(trace, pathItem.Trace.Value, opChan)

	if !pathItem.Parameters.IsEmpty() {
		params := make([]*Parameter, len(pathItem.Parameters.Value))
		for i := range pathItem.Parameters.Value {
			params[i] = NewParameter(pathItem.Parameters.Value[i].Value)
		}
		pi.Parameters = params
	}

	complete := false
	opCount := 0
	for !complete {
		opRes := <-opChan
		switch opRes.method {
		case get:
			pi.Get = opRes.op
		case put:
			pi.Put = opRes.op
		case post:
			pi.Post = opRes.op
		case del:
			pi.Delete = opRes.op
		case options:
			pi.Options = opRes.op
		case head:
			pi.Head = opRes.op
		case patch:
			pi.Patch = opRes.op
		case trace:
			pi.Trace = opRes.op
		}

		opCount++
		if opCount == 8 {
			complete = true
		}
	}
	return pi
}

// GoLow returns the low level instance of PathItem, used to build the high-level one.
func (p *PathItem) GoLow() *lowV3.PathItem {
	return p.low
}

// GoLowUntyped will return the low-level PathItem instance that was used to create the high-level one, with no type
func (p *PathItem) GoLowUntyped() any {
	return p.low
}

func (p *PathItem) GetOperations() *orderedmap.Map[string, *Operation] {
	o := orderedmap.New[string, *Operation]()

	// TODO: this is a bit of a hack, but it works for now. We might just want to actually pull the data out of the document as a map and split it into the individual operations

	type op struct {
		name string
		op   *Operation
		line int
	}

	getLine := func(field string, idx int) int {
		if p.GoLow() == nil {
			return idx
		}

		l, ok := reflect.ValueOf(p.GoLow()).Elem().FieldByName(field).Interface().(low.NodeReference[*lowV3.Operation])
		if !ok || l.GetKeyNode() == nil {
			return idx
		}

		return l.GetKeyNode().Line
	}

	ops := []op{}

	if p.Get != nil {
		ops = append(ops, op{name: lowV3.GetLabel, op: p.Get, line: getLine("Get", -8)})
	}
	if p.Put != nil {
		ops = append(ops, op{name: lowV3.PutLabel, op: p.Put, line: getLine("Put", -7)})
	}
	if p.Post != nil {
		ops = append(ops, op{name: lowV3.PostLabel, op: p.Post, line: getLine("Post", -6)})
	}
	if p.Delete != nil {
		ops = append(ops, op{name: lowV3.DeleteLabel, op: p.Delete, line: getLine("Delete", -5)})
	}
	if p.Options != nil {
		ops = append(ops, op{name: lowV3.OptionsLabel, op: p.Options, line: getLine("Options", -4)})
	}
	if p.Head != nil {
		ops = append(ops, op{name: lowV3.HeadLabel, op: p.Head, line: getLine("Head", -3)})
	}
	if p.Patch != nil {
		ops = append(ops, op{name: lowV3.PatchLabel, op: p.Patch, line: getLine("Patch", -2)})
	}
	if p.Trace != nil {
		ops = append(ops, op{name: lowV3.TraceLabel, op: p.Trace, line: getLine("Trace", -1)})
	}

	slices.SortStableFunc(ops, func(a op, b op) int {
		return a.line - b.line
	})

	for _, op := range ops {
		o.Set(op.name, op.op)
	}

	return o
}

// Render will return a YAML representation of the PathItem object as a byte slice.
func (p *PathItem) Render() ([]byte, error) {
	return yaml.Marshal(p)
}

func (p *PathItem) RenderInline() ([]byte, error) {
	d, _ := p.MarshalYAMLInline()
	return yaml.Marshal(d)
}

// MarshalYAML will create a ready to render YAML representation of the PathItem object.
func (p *PathItem) MarshalYAML() (interface{}, error) {
	nb := high.NewNodeBuilder(p, p.low)
	return nb.Render(), nil
}

func (p *PathItem) MarshalYAMLInline() (interface{}, error) {
	nb := high.NewNodeBuilder(p, p.low)

	nb.Resolve = true

	return nb.Render(), nil
}
