// Copyright 2023 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package adt

import (
	"bytes"
	"fmt"
	"html/template"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// RecordDebugGraph records debug output in ctx if there was an anomaly
// discovered.
func RecordDebugGraph(ctx *OpContext, v *Vertex, name string) {
	graph, hasError := CreateMermaidGraph(ctx, v, true)
	if hasError {
		if ctx.ErrorGraphs == nil {
			ctx.ErrorGraphs = map[string]string{}
		}
		path := ctx.PathToString(v.Path())
		ctx.ErrorGraphs[path] = graph
	}
}

var (
	// DebugDeps enables dependency tracking for debugging purposes.
	// It is off by default, as it adds a significant overhead.
	//
	// TODO: hook this init CUE_DEBUG, once we have set this up as a single
	// environment variable. For instance, CUE_DEBUG=matchdeps=1.
	DebugDeps = false

	OpenGraphs = false

	// MaxGraphs is the maximum number of debug graphs to be opened. To avoid
	// confusion, a panic will be raised if this number is exceeded.
	MaxGraphs = 10

	numberOpened = 0
)

// OpenNodeGraph takes a given mermaid graph and opens it in the system default
// browser.
func OpenNodeGraph(title, path, code, out, graph string) {
	if !OpenGraphs {
		return
	}
	if numberOpened > MaxGraphs {
		panic("too many debug graphs opened")
	}
	numberOpened++

	err := os.MkdirAll(path, 0777)
	if err != nil {
		log.Fatal(err)
	}
	url := filepath.Join(path, "graph.html")

	w, err := os.Create(url)
	if err != nil {
		log.Fatal(err)
	}
	defer w.Close()

	data := struct {
		Title string
		Code  string
		Out   string
		Graph string
	}{
		Title: title,
		Code:  code,
		Out:   out,
		Graph: graph,
	}

	tmpl := template.Must(template.New("").Parse(`
	<!DOCTYPE html>
	<html>
	<head>
		<title>{{.Title}}</title>
		<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
		<script>mermaid.initialize({startOnLoad:true});</script>
		<style>
			.container {
				display: flex;
				flex-direction: column;
				align-items: stretch;
			}
			.row {
				display: flex;
				flex-direction: row;
			}
			// ...
		</style>
	</head>
	<body>
		<div class="mermaid">{{.Graph}}</div>
		<div class="row">
			<div class="column">
				<h1><b>Input</b></h1>
				<pre>{{.Code}}</pre>
			</div>
			<div class="column">
				<h1><b>Output</b></h1>
				<pre>{{.Out}}</pre>
			</div>
		</div>
	</body>
	</html>
`))

	err = tmpl.Execute(w, data)
	if err != nil {
		log.Fatal(err)
	}

	openBrowser(url)
}

// openDebugGraph opens a browser with a graph of the state of the given Vertex
// and all its dependencies that have not completed processing.
// DO NOT DELETE: this is used to insert during debugging of the evaluator
// to inspect a node.
func openDebugGraph(ctx *OpContext, v *Vertex, name string) {
	graph, _ := CreateMermaidGraph(ctx, v, true)
	path := filepath.Join(".debug", "TestX", name)
	OpenNodeGraph(name, path, "in", "out", graph)
}

// depKind is a type of dependency that is tracked with incDependent and
// decDependent. For each there should be matching pairs passed to these
// functions. The debugger, when used, tracks and verifies that these
// dependencies are balanced.
type depKind int

//go:generate go run golang.org/x/tools/cmd/stringer -type=depKind

const (
	// PARENT dependencies are used to track the completion of parent
	// closedContexts within the closedness tree.
	PARENT depKind = iota + 1

	// ARC dependencies are used to track the completion of corresponding
	// closedContexts in parent Vertices.
	ARC

	// NOTIFY dependencies keep a note while dependent conjuncts are collected
	NOTIFY // root node of source

	// TASK dependencies are used to track the completion of a task.
	TASK

	// DISJUNCT is used to mark an incomplete disjunct.
	DISJUNCT

	// EVAL tracks that the conjunct associated with a closeContext has been
	// inserted using scheduleConjunct. A closeContext may not be deleted
	// as long as the conjunct has not been evaluated yet.
	// This prevents a node from being released if an ARC decrement happens
	// before a node is evaluated.
	EVAL

	// COMP tracks pending arcs in comprehensions.
	COMP

	// ROOT dependencies are used to track that all nodes of parents are
	// added to a tree.
	ROOT // Always refers to self.

	// INIT dependencies are used to hold ownership of a closeContext during
	// initialization and prevent it from being finalized when scheduling a
	// node's conjuncts.
	INIT

	// DEFER is used to track recursive processing of a node.
	DEFER // Always refers to self.

	// SHARED is used to track shared nodes. The processing of shared nodes may
	// change until all other conjuncts have been processed.
	SHARED

	// TEST is used for testing notifications.
	TEST // Always refers to self.
)

// ccDep is used to record counters which is used for debugging only.
// It is purpose is to be precise about matching inc/dec as well as to be able
// to traverse dependency.
type ccDep struct {
	dependency  *closeContext
	kind        depKind
	decremented bool

	// task keeps a reference to a task for TASK dependencies.
	task *task
	// taskID indicates the sequence number of a task within a scheduler.
	taskID int
}

func (c *closeContext) addDependent(ctx *OpContext, kind depKind, dependant *closeContext) *ccDep {
	if !DebugDeps {
		return nil
	}

	if dependant == nil {
		dependant = c
	}

	if ctx.LogEval > 1 {
		ctx.Logf(ctx.vertex, "INC(%s) %v %p parent: %p %d\n", kind, c.Label(), c, c.parent, c.conjunctCount)
	}

	dep := &ccDep{kind: kind, dependency: dependant}
	c.dependencies = append(c.dependencies, dep)

	return dep
}

// matchDecrement checks that this decrement matches a previous increment.
func (c *closeContext) matchDecrement(ctx *OpContext, v *Vertex, kind depKind, dependant *closeContext) {
	if !DebugDeps {
		return
	}

	if dependant == nil {
		dependant = c
	}

	if ctx.LogEval > 1 {
		ctx.Logf(ctx.vertex, "DEC(%s) %v %p %d\n", kind, c.Label(), c, c.conjunctCount)
	}

	for _, d := range c.dependencies {
		if d.kind != kind {
			continue
		}
		if d.dependency != dependant {
			continue
		}
		// Only one typ-dependant pair possible.
		if d.decremented {
			// There might be a duplicate entry, so continue searching.
			continue
		}

		d.decremented = true
		return
	}

	panic(fmt.Sprintf("unmatched decrement: %s", kind))
}

// mermaidContext is used to create a dependency analysis for a node.
type mermaidContext struct {
	ctx *OpContext
	v   *Vertex

	all bool

	hasError bool

	// roots maps the root closeContext of any Vertex to the analysis data
	// for that Vertex.
	roots map[*closeContext]*mermaidVertex

	// processed indicates whether the node in question has been processed
	// by the dependency analysis.
	processed map[*closeContext]bool

	// inConjuncts indicates whether a node is explicitly referenced by
	// a Conjunct. These nodes are visualized with an additional circle.
	inConjuncts map[*closeContext]bool

	// ccID maps a closeContext to a unique ID.
	ccID map[*closeContext]string

	w io.Writer

	// vertices lists an analysis of all nodes related to the analyzed node.
	// The first node is the node being analyzed itself.
	vertices []*mermaidVertex
}

type mermaidVertex struct {
	f     Feature
	w     *bytes.Buffer
	tasks *bytes.Buffer
	intra *bytes.Buffer
}

// CreateMermaidGraph creates an analysis of relations and values involved in
// nodes with unbalanced increments. The graph is in Mermaid format.
func CreateMermaidGraph(ctx *OpContext, v *Vertex, all bool) (graph string, hasError bool) {
	if !DebugDeps {
		return "", false
	}

	buf := &strings.Builder{}

	m := &mermaidContext{
		ctx:         ctx,
		v:           v,
		roots:       map[*closeContext]*mermaidVertex{},
		processed:   map[*closeContext]bool{},
		inConjuncts: map[*closeContext]bool{},
		ccID:        map[*closeContext]string{},
		w:           buf,
		all:         all,
	}

	io.WriteString(m.w, "graph TD\n")
	io.WriteString(m.w, "   classDef err fill:#e01010,stroke:#000000,stroke-width:3,font-size:medium\n")

	indent(m.w, 1)
	fmt.Fprintf(m.w, "style %s stroke-width:5\n\n", m.vertexID(v))
	// Trigger descent on first vertex. This may include other vertices when
	// traversing closeContexts if they have dependencies on such vertices.
	m.vertex(v)

	// Close and flush all collected vertices.
	for i, v := range m.vertices {
		v.closeVertex()
		if i == 0 || len(m.ccID) > 0 {
			m.w.Write(v.w.Bytes())
		}
	}

	return buf.String(), m.hasError
}

// vertex creates a blob of Mermaid graph representing one vertex. It has
// the following shape (where ptr(x) means pointer of x):
//
//		subgraph ptr(v)
//		   %% root note if ROOT has not been decremented.
//		   root((cc1)) -|R|-> ptr(cc1)
//
//		   %% closedness graph dependencies
//		   ptr(cc1)
//		   ptr(cc2) -|P|-> ptr(cc1)
//		   ptr(cc2) -|E|-> ptr(cc1) %% mid schedule
//
//		   %% tasks
//		   subgraph tasks
//		      ptr(cc3)
//		      ptr(cc4)
//		      ptr(cc5)
//		   end
//
//		   %% outstanding tasks and the contexts they depend on
//		   ptr(cc3) -|T|-> ptr(cc2)
//
//		   subgraph notifications
//		      ptr(cc6)
//		      ptr(cc7)
//		   end
//		end
//		%% arcs from nodes to nodes in other vertices
//		ptr(cc1) -|A|-> ptr(cc10)
//		ptr(vx) -|N|-> ptr(cc11)
//
//
//	 A vertex has the following name: path(v); done
//
//	 Each closeContext has the following info: ptr(cc); cc.count
func (m *mermaidContext) vertex(v *Vertex) *mermaidVertex {
	root := v.rootCloseContext(m.ctx)

	vc := m.roots[root]
	if vc != nil {
		return vc
	}

	vc = &mermaidVertex{
		f:     v.Label,
		w:     &bytes.Buffer{},
		intra: &bytes.Buffer{},
	}
	m.vertices = append(m.vertices, vc)

	m.tagReferencedConjuncts(v.Conjuncts)

	m.roots[root] = vc
	w := vc.w

	var status string
	switch {
	case v.Status() == finalized:
		status = "finalized"
	case v.state == nil:
		status = "ready"
	default:
		status = v.state.scheduler.state.String()
	}
	path := m.vertexPath(v)
	if v.ArcType != ArcMember {
		path += fmt.Sprintf("/%v", v.ArcType)
	}

	indentOnNewline(w, 1)
	fmt.Fprintf(w, "subgraph %s[%s: %s]\n", m.vertexID(v), path, status)

	m.cc(root)

	return vc
}

func (m *mermaidContext) tagReferencedConjuncts(a []Conjunct) {
	for _, c := range a {
		m.inConjuncts[c.CloseInfo.cc] = true

		if g, ok := c.x.(*ConjunctGroup); ok {
			m.tagReferencedConjuncts([]Conjunct(*g))
		}
	}
}

func (v *mermaidVertex) closeVertex() {
	w := v.w

	if v.tasks != nil {
		indent(v.tasks, 2)
		fmt.Fprintf(v.tasks, "end\n")
		w.Write(v.tasks.Bytes())
	}

	// TODO: write all notification sources (or is this just the node?)

	indent(w, 1)
	fmt.Fprintf(w, "end\n")
}

func (m *mermaidContext) task(d *ccDep) string {
	v := d.dependency.src

	// This must already exist.
	vc := m.vertex(v)

	if vc.tasks == nil {
		vc.tasks = &bytes.Buffer{}
		indentOnNewline(vc.tasks, 2)
		fmt.Fprintf(vc.tasks, "subgraph %s_tasks[tasks]\n", m.vertexID(v))
	}

	if d.task != nil && v != d.task.node.node {
		panic("inconsistent task")
	}
	taskID := fmt.Sprintf("%s_%d", m.vertexID(v), d.taskID)
	var state string
	var completes condition
	var kind string
	if d.task != nil {
		state = d.task.state.String()[:2]
		completes = d.task.completes
		kind = d.task.run.name
	}
	indentOnNewline(vc.tasks, 3)
	fmt.Fprintf(vc.tasks, "%s(%d", taskID, d.taskID)
	indentOnNewline(vc.tasks, 4)
	io.WriteString(vc.tasks, state)
	indentOnNewline(vc.tasks, 4)
	io.WriteString(vc.tasks, kind)
	indentOnNewline(vc.tasks, 4)
	fmt.Fprintf(vc.tasks, "%x)\n", completes)

	if s := d.task.blockedOn; s != nil {
		m.vertex(s.node.node)
		fmt.Fprintf(m.w, "%s_tasks == BLOCKED ==> %s\n", m.vertexID(s.node.node), taskID)
	}

	return taskID
}

func (m *mermaidContext) cc(cc *closeContext) {
	if m.processed[cc] {
		return
	}
	m.processed[cc] = true

	// This must already exist.
	v := m.vertex(cc.src)

	// Dependencies at different scope levels.
	global := m.w
	node := v.w

	for _, d := range cc.dependencies {
		indentLevel := 2
		var w io.Writer
		var name, link string

		switch {
		case !d.decremented:
			link = fmt.Sprintf(`--%s-->`, d.kind.String())
		case m.all:
			link = fmt.Sprintf("-. %s .->", d.kind.String()[0:1])
		default:
			continue
		}

		// Only include still outstanding nodes.
		switch d.kind {
		case PARENT:
			w = node
			name = m.pstr(d.dependency)
		case EVAL, ARC, NOTIFY, DISJUNCT, COMP:
			w = global
			indentLevel = 1
			name = m.pstr(d.dependency)

		case TASK:
			w = node
			taskID := "disjunct"
			if d.task != nil {
				taskID = m.task(d)
			}
			name = fmt.Sprintf("%s((%d))", taskID, d.taskID)
		case ROOT, INIT, SHARED:
			w = node
			src := cc.src
			if v.f != src.Label {
				panic("incompatible labels")
			}
			name = fmt.Sprintf("root_%s", m.vertexID(src))
		}

		if w != nil {
			dst := m.pstr(cc)
			indent(w, indentLevel)
			fmt.Fprintf(w, "%s %s %s\n", name, link, dst)
		}

		// If the references count is 0, all direct dependencies must have
		// completed as well. In this case, descending into each of them should
		// not end up printing anything. In case of any bugs, these nodes will
		// show up as unattached nodes.

		if dep := d.dependency; dep != nil && dep != cc {
			m.cc(dep)
		}
	}
}

func (m *mermaidContext) vertexPath(v *Vertex) string {
	path := m.ctx.PathToString(v.Path())
	if path == "" {
		return "_"
	}
	return path
}

const sigPtrLen = 6

func (m *mermaidContext) vertexID(v *Vertex) string {
	s := fmt.Sprintf("%p", v)
	return "v" + s[len(s)-sigPtrLen:]
}

func (m *mermaidContext) pstr(cc *closeContext) string {
	if id, ok := m.ccID[cc]; ok {
		return id
	}

	ptr := fmt.Sprintf("%p", cc)
	ptr = ptr[len(ptr)-sigPtrLen:]
	id := fmt.Sprintf("cc%s", ptr)
	m.ccID[cc] = id

	v := m.vertex(cc.src)

	w := v.w

	indent(w, 2)
	w.WriteString(id)

	var open, close = "((", "))"
	if m.inConjuncts[cc] {
		open, close = "(((", ")))"
	}

	w.WriteString(open)
	w.WriteString("cc")
	if cc.conjunctCount > 0 {
		fmt.Fprintf(w, " c:%d: d:%d", cc.conjunctCount, cc.disjunctCount)
	}
	indentOnNewline(w, 3)
	w.WriteString(ptr)

	flags := &bytes.Buffer{}
	addFlag := func(test bool, flag byte) {
		if test {
			flags.WriteByte(flag)
		}
	}
	addFlag(cc.isDefOrig, '#')
	addFlag(cc.isEmbed, 'E')
	addFlag(cc.isClosed, 'c')
	addFlag(cc.isClosedOnce, 'C')
	addFlag(cc.isTotal, 'o')
	flags.WriteByte(cc.arcType.String()[0])
	io.Copy(w, flags)

	// Show the origin of the closeContext.
	indentOnNewline(w, 3)
	ptr = fmt.Sprintf("%p", cc.origin)
	if cc.origin != nil {
		ptr = ptr[len(ptr)-sigPtrLen:]
	}
	w.WriteString("R:")
	w.WriteString(ptr)

	w.WriteString(close)

	switch {
	case cc.conjunctCount == 0:
	case cc.conjunctCount <= cc.disjunctCount:
		// TODO: Extra checks for disjunctions?
		// E.g.: cc.src is not a disjunction
	default:
		// If cc.conjunctCount > cc.disjunctCount.
		// TODO: count the number of non-decremented DISJUNCT dependencies.
		fmt.Fprintf(w, ":::err")
		if cc.src == m.v {
			m.hasError = true
		}
	}

	w.WriteString("\n")

	return id
}

func indentOnNewline(w io.Writer, level int) {
	w.Write([]byte{'\n'})
	indent(w, level)
}

func indent(w io.Writer, level int) {
	for i := 0; i < level; i++ {
		io.WriteString(w, "   ")
	}
}

// openBrowser opens the given URL in the default browser.
func openBrowser(url string) {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}

	err := cmd.Start()
	if err != nil {
		log.Fatal(err)
	}
	go cmd.Wait()
}
