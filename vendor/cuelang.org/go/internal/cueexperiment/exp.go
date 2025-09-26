package cueexperiment

import (
	"sync"

	"cuelang.org/go/internal/envflag"
)

// Flags holds the set of CUE_EXPERIMENT flags. It is initialized by Init.
//
// When adding, deleting, or modifying entries below,
// update cmd/cue/cmd/help.go as well for `cue help environment`.
var Flags struct {
	Modules bool `envflag:"deprecated,default:true"`

	// YAMLV3Decoder swaps the old internal/third_party/yaml decoder with the new
	// decoder implemented in internal/encoding/yaml on top of yaml.v3.
	// We keep it around for v0.11 for the sake of not breaking users
	// with CUE_EXPERIMENT=yamlv3decoder=1 who must still suppport older CUE versions,
	// but currently the feature is always enabled.
	// TODO(mvdan): remove for v0.12.
	YAMLV3Decoder bool `envflag:"deprecated,default:true"`

	// EvalV3 enables the new evaluator. The new evaluator addresses various
	// performance concerns.
	EvalV3 bool

	// Embed enables file embedding.
	Embed bool

	// DecodeInt64 changes [cuelang.org/go/cue.Value.Decode] to choose
	// `int64` rather than `int` as the default type for CUE integer values
	// to ensure consistency with 32-bit platforms.
	DecodeInt64 bool

	// Enable topological sorting of struct fields
	TopoSort bool
}

// Init initializes Flags. Note: this isn't named "init" because we
// don't always want it to be called (for example we don't want it to be
// called when running "cue help"), and also because we want the failure
// mode to be one of error not panic, which would be the only option if
// it was a top level init function.
func Init() error {
	return initOnce()
}

var initOnce = sync.OnceValue(initAlways)

func initAlways() error {
	return envflag.Init(&Flags, "CUE_EXPERIMENT")
}
