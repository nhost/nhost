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
	"math/bits"
)

// The CUE scheduler schedules tasks for evaluation.
//
// A task is a computation unit associated with a single node. Each task may
// depend on knowing certain properties of one or more fields, namely:
//
//  - whether the field exists
//  - the scalar value of a field, if any
//  - the set of all conjuncts
//  - the set of all sub fields
//  - the recursively evaluated value
//
// Each task, in turn, may mark itself as providing knowledge about one or more
// of these properties. If it is not known upfront whether a task may contribute
// to a certain property, it must mark itself as (potentially) contributing to
// this property.
//
//
// DEPENDENCY GRAPH
//
// A task may depend on zero or more fields, including the field for which it
// is defined. The graph of all dependencies is defined as follows:
//
// - Each task and each <field, property> pair is a node in the graph.
// - A task T for field F that (possibly) computes property P for F is
//   represented by an edge from <F, P> to T.
// - A task T for field F that depends on property P of field G is represented
//   by an edge from <G, P> to T.
//
// It is an evaluation cycle for a task T if there is a path from any task T to
// itself in the dependency graph. Processing will stop in the even of such a
// cycle. In such case, the scheduler will commence an unblocking mechanism.
//
// As a general rule, once a node is detected to be blocking, it may no longer
// become more specific. In other words, it is "frozen".
// The unblocking consists of two phases: the scheduler will first freeze and
// unblock all blocked nodes for the properties marked as autoUnblock-ing in
// taskContext. Subsequently all tasks that are unblocked by this will run.
// In the next phase all remaining tasks are unblocked.
// See taskContext.autoUnblock for more information.
//
// Note that some tasks, like references, may depend on other fields without
// requiring a certain property. These do not count as dependencies.

// A taskContext manages the task memory and task stack.
// It is typically associated with an OpContext.
type taskContext struct {
	// stack tracks the current execution of tasks. This is a stack as tasks
	// may trigger the evaluation of other tasks to complete.
	stack []*task

	// blocking lists all tasks that were blocked during a round of evaluation.
	// Evaluation finalized one node at a time, which includes the evaluation
	// of all nodes necessary to evaluate that node. Any task that is blocked
	// during such a round of evaluation is recorded here. Any mutual cycles
	// will result in unresolved tasks. At the end of such a round, computation
	// can be frozen and the tasks unblocked.
	blocking []*task

	// counterMask marks which conditions use counters. Other conditions are
	// handled by signals only.
	counterMask condition

	// autoUnblock marks the flags that get unblocked automatically when there
	// is a deadlock between nodes. These are properties that may become
	// meaningful once it is known that a value may not become more specific.
	// An example of this is the property "scalar". If something is not a scalar
	// yet, and it is known that the value may never become more specific, it is
	// known that this value is never will become a scalar, thus effectively
	// making it known.
	autoUnblock condition

	// This is called upon completion of states, allowing other states to be
	// updated atomically.
	complete func(s *scheduler) condition
}

func (p *taskContext) current() *task {
	if len(p.stack) == 0 {
		return nil
	}
	return p.stack[len(p.stack)-1]
}

func (p *taskContext) pushTask(t *task) {
	p.stack = append(p.stack, t)
}

func (p *taskContext) popTask() {
	p.stack = p.stack[:len(p.stack)-1]
}

func (p *taskContext) newTask() *task {
	// TODO: allocate from pool.
	return &task{}
}

type taskState uint8

const (
	taskREADY taskState = iota

	taskRUNNING // processing conjunct(s)
	taskWAITING // task is blocked on a property of an arc to hold
	taskSUCCESS
	taskFAILED
	taskCANCELLED
)

type schedState uint8

const (
	schedREADY schedState = iota

	schedRUNNING    // processing conjunct(s)
	schedFINALIZING // all tasks completed, run new tasks immediately
	schedSUCCESS
	schedFAILED
)

func (s schedState) done() bool { return s >= schedSUCCESS }

func (s taskState) String() string {
	switch s {
	case taskREADY:
		return "READY"
	case taskRUNNING:
		return "RUNNING"
	case taskWAITING:
		return "WAITING"
	case taskSUCCESS:
		return "SUCCESS"
	case taskFAILED:
		return "FAILED"
	default:
		return "UNKNOWN"
	}
}

func (s schedState) String() string {
	switch s {
	case schedREADY:
		return "READY"
	case schedRUNNING:
		return "RUNNING"
	case schedFINALIZING:
		return "FINALIZING"
	case schedSUCCESS:
		return "SUCCESS"
	case schedFAILED:
		return "FAILED"
	default:
		return "UNKNOWN"
	}
}

// runMode indicates how to proceed after a condition could not be met.
type runMode uint8

//go:generate go run golang.org/x/tools/cmd/stringer -type=runMode

const (
	// ignore indicates that the new evaluator should not do any processing.
	// This is mostly used in the transition from old to new evaluator and
	// should probably eventually be removed.
	ignore runMode = 1 + iota

	// attemptOnly indicates that execution should continue even if the
	// condition is not met.
	attemptOnly

	// yield means that execution should be yielded if the condition is not met.
	// That is, the task is marked as a dependency and control is returned to
	// the runloop. The task will resume once the dependency is met.
	yield

	// finalize means that uncompleted tasks should be turned into errors to
	// complete the evaluation of a Vertex.
	finalize
)

// condition is a bit mask of states that a task may depend on.
//
// There are generally two types of states: states that are met if all tasks
// that contribute to that state are completed (counter states), and states that
// are met if some global set of conditions are met.
type condition uint16

const (
	// allKnown indicates that all possible states are completed.
	allKnown condition = 0x7fff

	// neverKnown is a special condition that is never met. It can be used to
	// mark a task as impossible to complete.
	neverKnown condition = 0x8000
)

func (c condition) meets(x condition) bool {
	return c&x == x
}

const numCompletionStates = 10 // TODO: make this configurable

// A scheduler represents the set of outstanding tasks for a node.
type scheduler struct {
	ctx  *OpContext
	node *nodeContext

	state schedState

	// completed is bit set of completed states.
	completed condition

	// needs specifies all the states needed to complete tasks in this scheduler.
	needs condition

	// provided specifies all the states that are provided by tasks added
	// to this scheduler.
	provided condition // TODO: rename to "provides"? To be consistent with "needs".

	// frozen indicates all states that are frozen. These bits should be checked
	// before making a node more specific.
	// TODO: do we need a separate field for this, or can we use completed?
	frozen condition

	// isFrozen indicates if freeze was called explicitly.
	//
	// TODO: rename to isExplicitlyFrozen if it turns out we need both frozen
	// and isFrozen. We probably do not. Check once the implementation of the
	// new evaluator is complete.
	isFrozen bool

	// counters keeps track of the number of uncompleted tasks that are
	// outstanding for each of the possible conditions. A state is
	// considered completed if the corresponding counter reaches zero.
	counters [numCompletionStates]int

	// tasks lists all tasks that were scheduled for this scheduler.
	// The list only contains tasks that are associated with this node.
	// TODO: rename to queue and taskPos to nextQueueIndex.
	tasks   []*task
	taskPos int

	// blocking is a list of tasks that are blocked on the completion of
	// the indicate conditions. This can hold tasks from other nodes or tasks
	// originating from this node itself.
	blocking []*task
}

func (s *scheduler) clear() {
	// TODO(perf): free tasks into task pool

	// Any tasks blocked on this scheduler are unblocked once the scheduler is cleared.
	// Otherwise they might signal a cleared scheduler, which can panic.
	//
	// TODO(mvdan,mpvl): In principle, all blocks should have been removed when a scheduler
	// is cleared. Perhaps this can happen when the scheduler is stopped prematurely.
	// For now, this solution seems to work OK.
	for _, t := range s.blocking {
		t.blockedOn = nil
		t.blockCondition = neverKnown
	}

	*s = scheduler{
		ctx:      s.ctx,
		tasks:    s.tasks[:0],
		blocking: s.blocking[:0],
	}
}

// cloneInto initializes the state of dst to be the same as s.
//
// NOTE: this is deliberately not a pointer receiver: this approach allows
// cloning s into dst while preserving the buffers of dst and not having to
// explicitly clone any non-buffer fields.
func (s scheduler) cloneInto(dst *scheduler) {
	s.tasks = append(dst.tasks, s.tasks...)
	s.blocking = append(dst.blocking, s.blocking...)

	*dst = s
}

// incrementCounts adds the counters for each condition.
// See also decrementCounts.
func (s *scheduler) incrementCounts(x condition) {
	x &= s.ctx.counterMask

	for {
		n := bits.TrailingZeros16(uint16(x))
		if n == 16 {
			break
		}
		bit := condition(1 << n)
		x &^= bit

		s.counters[n]++
	}
}

// decrementCounts decrements the counters for each condition. If a counter for
// a condition reaches zero, it means that condition is met and all blocking
// tasks depending on that state can be run.
func (s *scheduler) decrementCounts(x condition) {
	x &= s.ctx.counterMask

	var completed condition
	for {
		n := bits.TrailingZeros16(uint16(x))
		if n == 16 {
			break
		}
		bit := condition(1 << n)
		x &^= bit

		s.counters[n]--
		if s.counters[n] == 0 {
			completed |= bit
		}
	}

	s.signal(completed)
}

// finalize runs all tasks and signals that the scheduler is done upon
// completion for the given signals.
func (s *scheduler) finalize(completed condition) {
	// Do not panic on cycle detection. Instead, post-process the tasks
	// by collecting and marking cycle errors.
	s.process(allKnown, finalize)
	s.signal(completed)
	if s.state == schedRUNNING {
		if s.meets(s.needs) {
			s.state = schedSUCCESS
		} else {
			s.state = schedFAILED
		}
	}
}

// process advances a scheduler by executing tasks that are required.
// Depending on mode, if the scheduler is blocked on a condition, it will
// forcefully unblock the tasks.
func (s *scheduler) process(needs condition, mode runMode) bool {
	c := s.ctx

	// Update completions, if necessary.
	if f := c.taskContext.complete; f != nil {
		s.signal(f(s))
	}

	if s.ctx.LogEval > 0 && len(s.tasks) > 0 {
		if v := s.tasks[0].node.node; v != nil {
			c.nest++
			c.Logf(v, "START Process %v -- mode: %v", v.Label, mode)
			defer func() {
				c.Logf(v, "END Process")
				c.nest--
			}()
		}
	}

	// hasRunning := false
	s.state = schedRUNNING
	// Use variable instead of range, because s.tasks may grow during processes.

processNextTask:
	for s.taskPos < len(s.tasks) {
		t := s.tasks[s.taskPos]
		s.taskPos++

		if t.state != taskREADY {
			// TODO(perf): Figure out how it is possible to reach this and if we
			// should optimize.
			// panic("task not READY")
		}

		switch {
		case t.state == taskRUNNING:
			// TODO: we could store the current referring node that caused
			// the cycle and then proceed up the stack to mark all tasks
			// that re involved in the cycle as well. Further, we could
			// mark the cycle as a generation counter, instead of a boolean
			// value, so that it will be trivial reconstruct a detailed cycle
			// report when generating an error message.

		case t.state != taskREADY:

		default:
			runTask(t, mode)
		}
	}

	switch mode {
	default: // case attemptOnly:
		return s.meets(needs)

	case yield:
		if s.meets(needs) {
			return true
		}
		c.current().waitFor(s, needs)
		s.yield()
		panic("unreachable")

	case finalize:
		// remainder of function
	}

unblockTasks:
	// Unblocking proceeds in three stages. Each of the stages may cause
	// formerly blocked tasks to become unblocked. To ensure that unblocking
	// tasks do not happen in an order-dependent way, we want to ensure that we
	// have unblocked all tasks from one phase, before commencing to the next.

	// The types of the node can no longer be altered. We can unblock the
	// relevant states first to finish up any tasks that were just waiting for
	// types, such as lists.
	for _, t := range c.blocking {
		if t.blockedOn != nil {
			t.blockedOn.signal(s.ctx.autoUnblock)
		}
	}

	// Mark all remaining conditions as "frozen" before actually running the
	// tasks. Doing this before running the remaining tasks ensures that we get
	// the same errors, regardless of the order in which tasks are unblocked.
	for _, t := range c.blocking {
		if t.blockedOn != nil {
			t.blockedOn.freeze(t.blockCondition)
			t.unblocked = true
		}
	}

	// Run the remaining blocked tasks.
	numBlocked := len(c.blocking)
	for _, t := range c.blocking {
		if t.blockedOn != nil && !t.defunct {
			n, cond := t.blockedOn, t.blockCondition
			t.blockedOn, t.blockCondition = nil, neverKnown
			n.signal(cond)
			runTask(t, attemptOnly) // Does this need to be final? Probably not if we do a fixed point computation.
		}
	}

	// The running of tasks above may result in more tasks being added to the
	// queue. Process these first before continuing.
	if s.taskPos < len(s.tasks) {
		goto processNextTask
	}

	// Similarly, the running of tasks may result in more tasks being blocked.
	// Ensure we processed them all.
	if numBlocked < len(c.blocking) {
		goto unblockTasks
	}

	c.blocking = c.blocking[:0]

	return true
}

// yield causes the current task to be suspended until the given conditions
// are met.
func (s *scheduler) yield() {
	panic(s)
}

// meets reports whether all needed completion states in s are met.
func (s *scheduler) meets(needs condition) bool {
	s.node.assertInitialized()

	if s.state != schedREADY {
		// Automatically qualify for conditions that are not provided by this node.
		// NOTE: in the evaluator this is generally not the case, as tasks my still
		// be added during evaluation until all ancestor nodes are evaluated. This
		// can be encoded by the scheduler by adding a state "ancestorsCompleted".
		// which all other conditions depend on.
		needs &= s.provided
	}
	return s.completed&needs == needs
}

// blockOn marks a state as uncompleted.
func (s *scheduler) blockOn(cond condition) {
	// TODO:  should we allow this to be used for counters states?
	// if s.ctx.counterMask&cond != 0 {
	// 	panic("cannot block on counter states")
	// }
	s.provided |= cond
}

// signal causes tasks that are blocking on the given completion to be run
// for this scheduler. Tasks are only run if the completion state was not
// already reached before.
func (s *scheduler) signal(completed condition) {
	was := s.completed
	s.completed |= completed
	if was == s.completed {
		s.frozen |= completed
		return
	}

	s.completed |= s.ctx.complete(s)
	s.frozen |= completed

	// TODO: this could benefit from a linked list where tasks are removed
	// from the list before being run.
	for _, t := range s.blocking {
		if t.blockCondition&s.completed == t.blockCondition {
			// Prevent task from running again.
			t.blockCondition = neverKnown
			t.blockedOn = nil
			runTask(t, attemptOnly) // TODO: does this ever need to be final?
			// TODO: should only be run once for each blocking queue.
		}
	}
}

// freeze indicates no more tasks satisfying the given condition may be added.
// It is also used to freeze certain elements of the task.
func (s *scheduler) freeze(c condition) {
	s.frozen |= c
	s.completed |= c
	s.ctx.complete(s)
	s.isFrozen = true
}

// signalDoneAdding signals that no more tasks will be added to this scheduler.
// This allows unblocking tasks that depend on states for which there are no
// tasks in this scheduler.
func (s *scheduler) signalDoneAdding() {
	s.signal(s.needs &^ s.provided)
}

// runner defines properties of a type of task, including a function to run it.
type runner struct {
	name string

	// The mode argument indicates whether the scheduler
	// of this field is finalizing. It is passed as a component of the required
	// state to various evaluation methods.
	f func(ctx *OpContext, t *task, mode runMode)

	// completes indicates which states this tasks contributes to.
	completes condition

	// needes indicates which states of the corresponding node need to be
	// completed before this task can be run.
	needs condition

	// a lower priority indicates a preference to run a task before tasks
	// of a higher priority.
	priority int8
}

type task struct {
	state taskState

	completes condition // cycles may alter the completion mask. TODO: is this still true?

	// defunct indicates that this task is no longer relevant. This is the case
	// when it has not yet been run before it is copied into a disjunction.
	defunct bool

	// unblocked indicates this task was unblocked by force.
	unblocked bool

	// The following fields indicate what this task is blocked on, including
	// the scheduler, which conditions it is blocking on, and the stack of
	// tasks executed leading to the block.

	// blockedOn cannot be needed in a clone for a disjunct, because as long
	// as the disjunct is unresolved, its value cannot contribute to another
	// scheduler.
	blockedOn      *scheduler
	blockCondition condition
	blockStack     []*task // TODO: use; for error reporting.

	err *Bottom

	// The node from which this conjunct originates.
	node *nodeContext

	run *runner // TODO: use struct to make debugging easier?

	// The Conjunct processed by this task.
	env *Environment
	id  CloseInfo // TODO: rename to closeInfo?
	x   Node      // The conjunct Expression or Value.

	// For Comprehensions:
	comp *envComprehension
	leaf *Comprehension
}

func (s *scheduler) insertTask(t *task) {
	completes := t.run.completes
	needs := t.run.needs

	s.needs |= needs
	s.provided |= completes

	if needs&completes != 0 {
		panic("task depends on its own completion")
	}
	t.completes = completes

	if s.state == schedFINALIZING {
		runTask(t, finalize)
		return
	}

	s.incrementCounts(completes)
	if cc := t.id.cc; cc != nil {
		// may be nil for "group" tasks, such as processLists.
		dep := cc.incDependent(t.node.ctx, TASK, nil)
		if dep != nil {
			dep.taskID = len(s.tasks)
			dep.task = t
		}
	}
	s.tasks = append(s.tasks, t)

	// Sort by priority. This code is optimized for the case that there are
	// very few tasks with higher priority. This loop will almost always
	// terminate within 0 or 1 iterations.
	for i := len(s.tasks) - 1; i > s.taskPos; i-- {
		if s.tasks[i-1].run.priority <= s.tasks[i].run.priority {
			break
		}
		s.tasks[i], s.tasks[i-1] = s.tasks[i-1], s.tasks[i]
	}

	if s.completed&needs != needs {
		t.waitFor(s, needs)
	}
}

func runTask(t *task, mode runMode) {
	if t.defunct {
		if t.state != taskCANCELLED {
			t.state = taskCANCELLED
			if t.id.cc != nil {
				t.id.cc.decDependent(t.node.ctx, TASK, nil)
			}
		}
		return
	}
	t.node.Logf("============ RUNTASK %v %v", t.run.name, t.x)
	ctx := t.node.ctx

	switch t.state {
	case taskSUCCESS, taskFAILED:
		return
	case taskRUNNING:
		// TODO: should we mark this as a cycle?
	}

	defer func() {
		if n := t.node; n.toComplete {
			n.toComplete = false
			n.completeNodeTasks(attemptOnly)
		}

		switch r := recover().(type) {
		case nil:
		case *scheduler:
			// Task must be WAITING.
			if t.state == taskRUNNING {
				t.state = taskSUCCESS // XXX: something else? Do we known the dependency?
				if t.err != nil {
					t.state = taskFAILED
				}
			}
		default:
			panic(r)
		}
	}()

	defer ctx.PopArc(ctx.PushArc(t.node.node))

	// TODO: merge these two mechanisms once we get rid of the old evaluator.
	ctx.pushTask(t)
	defer ctx.popTask()
	if t.env != nil {
		id := t.id
		// This is done to avoid struct args from passing fields up.
		// Use [task.updateCI] to get the current CloseInfo with this field
		// restored.
		id.cc = nil
		s := ctx.PushConjunct(MakeConjunct(t.env, t.x, id))
		defer ctx.PopState(s)
	}

	t.state = taskRUNNING
	// A task may have recorded an error on a previous try. Clear it.
	t.err = nil

	t.run.f(ctx, t, mode)

	if t.state != taskWAITING {
		t.blockedOn = nil
		t.blockCondition = neverKnown

		// TODO: always reporting errors in the current task would avoid us
		// having to collect and assign errors here.
		t.err = CombineErrors(nil, t.err, ctx.Err())
		if t.err == nil {
			t.state = taskSUCCESS
		} else {
			t.state = taskFAILED
		}
		t.node.addBottom(t.err) // TODO: replace with something more principled.

		if t.id.cc != nil {
			t.id.cc.decDependent(ctx, TASK, nil)
		}
		t.node.decrementCounts(t.completes)
		t.completes = 0 // safety
	}
}

// updateCI stitches back the closeContext that more removed from the CloseInfo
// before in the given CloseInfo.
func (t *task) updateCI(ci CloseInfo) CloseInfo {
	ci.cc = t.id.cc
	return ci
}

// waitFor blocks task t until the needs for scheduler s are met.
func (t *task) waitFor(s *scheduler, needs condition) {
	if s.meets(needs) {
		panic("waiting for condition that already completed")
	}
	// TODO: this line causes the scheduler state to fail if tasks are blocking
	// on it. Is this desirable? At the very least we should then ensure that
	// the scheduler where the tasks originate from will fail in that case.
	s.needs |= needs

	t.state = taskWAITING

	t.blockCondition = needs
	t.blockedOn = s
	s.blocking = append(s.blocking, t)
	s.ctx.blocking = append(s.ctx.blocking, t)
}
