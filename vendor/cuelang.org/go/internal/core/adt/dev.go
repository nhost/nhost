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

// This file contains types to help in the transition from the old to new
// evaluation model.

func unreachableForDev(c *OpContext) {
	if c.isDevVersion() {
		panic("unreachable for development version")
	}
}

type combinedFlags uint32

// oldOnly indicates that a Vertex should only be evaluated for the old
// evaluator.
func oldOnly(state vertexStatus) combinedFlags {
	return combinedFlags(state) |
		combinedFlags(ignore)<<8 |
		combinedFlags(allKnown)<<16
}

func combineMode(cond condition, mode runMode) combinedFlags {
	return combinedFlags(mode)<<8 | combinedFlags(cond)<<16
}

func attempt(state vertexStatus, cond condition) combinedFlags {
	return combinedFlags(state) | combineMode(cond, attemptOnly)
}

func require(state vertexStatus, cond condition) combinedFlags {
	return combinedFlags(state) | combineMode(cond, yield)
}

func final(state vertexStatus, cond condition) combinedFlags {
	return combinedFlags(state) | combineMode(cond, finalize)
}

func deprecated(c *OpContext, state vertexStatus) combinedFlags {
	// if c.isDevVersion() {
	// 	panic("calling function may not be used in new evaluator")
	// }
	return combinedFlags(state)
}

func (f combinedFlags) vertexStatus() vertexStatus {
	return vertexStatus(f & 0xff)
}

func (f combinedFlags) withVertexStatus(x vertexStatus) combinedFlags {
	f &^= 0xff
	f |= combinedFlags(x)
	return f
}

func (f combinedFlags) conditions() condition {
	return condition(f >> 16)
}

func (f combinedFlags) runMode() runMode {
	return runMode(f>>8) & 0xff
}

func (f combinedFlags) ignore() bool {
	return f&(combinedFlags(ignore)<<8) != 0
}
