# YAML marshaling and unmarshaling support for Go

[![Lint](https://github.com/oasdiff/yaml/actions/workflows/lint.yaml/badge.svg)](https://github.com/oasdiff/yaml/actions/workflows/lint.yaml)
[![Test Go](https://github.com/oasdiff/yaml/actions/workflows/test.yaml/badge.svg)](https://github.com/oasdiff/yaml/actions/workflows/test.yaml)
[![Go Report Card](https://goreportcard.com/badge/github.com/oasdiff/yaml)](https://goreportcard.com/report/github.com/oasdiff/yaml)
![Latest Tag](https://img.shields.io/github/v/tag/oasdiff/yaml)

## Fork
This fork is an improved version of the invopop/yaml package, designed to include line and column location information for YAML elements during unmarshalling.

Origin tracking uses a two-pass approach:
1. `Unmarshal` decodes the YAML and extracts `__origin__` metadata injected by the underlying [oasdiff/yaml3](https://github.com/oasdiff/yaml3) decoder, returning an `*OriginTree` alongside the decoded struct.
2. The caller walks the `OriginTree` to apply file/line/column information to the decoded Go structs.

`Unmarshal` is the single public unmarshal entry point. Pass `DecodeOpts{}` for a plain decode, or set fields to opt into origin tracking or YAML 1.1 timestamp-resolution suppression:

```go
// Plain decode (no origin tracking, default YAML 1.1 behaviour):
_, err := yaml.Unmarshal(data, &v, yaml.DecodeOpts{})

// Decode with origin tracking:
tree, err := yaml.Unmarshal(data, &v, yaml.DecodeOpts{
    Origin: yaml.OriginOpt{Enabled: true, File: "myfile.yaml"},
})

// Decode with timestamp resolution suppressed (date-shaped scalars stay strings):
_, err := yaml.Unmarshal(data, &v, yaml.DecodeOpts{DisableTimestamps: true})
```

The returned `*OriginTree` mirrors the YAML document structure. Each node holds a compact `[]any` sequence with the file, key name, line, column, and locations of scalar fields and sequence items within that mapping. When `Origin.Enabled` is false, `nil` is returned for the tree with no overhead.

## Introduction

A wrapper around [go-yaml](https://github.com/go-yaml/yaml) designed to enable a better way of handling YAML when marshaling to and from structs.

This is a fork and split of the original [ghodss/yaml](https://github.com/ghodss/yaml) repository which no longer appears to be maintained.

In short, this library first converts YAML to JSON using go-yaml and then uses `json.Marshal` and `json.Unmarshal` to convert to or from the struct. This means that it effectively reuses the JSON struct tags as well as the custom JSON methods `MarshalJSON` and `UnmarshalJSON` unlike go-yaml. For a detailed overview of the rationale behind this method, [see this blog post](https://web.archive.org/web/20150812020634/http://ghodss.com/2014/the-right-way-to-handle-yaml-in-golang/).

## Compatibility

This package uses [go-yaml](https://github.com/go-yaml/yaml) and therefore supports [everything go-yaml supports](https://github.com/go-yaml/yaml#compatibility).

Tested against Go versions 1.14 and onwards.

## Caveats

**Caveat #1:** When using `yaml.Marshal` and `yaml.Unmarshal`, binary data should NOT be preceded with the `!!binary` YAML tag. If you do, go-yaml will convert the binary data from base64 to native binary data, which is not compatible with JSON. You can still use binary in your YAML files though - just store them without the `!!binary` tag and decode the base64 in your code (e.g. in the custom JSON methods `MarshalJSON` and `UnmarshalJSON`). This also has the benefit that your YAML and your JSON binary data will be decoded exactly the same way. As an example:

```
BAD:
	exampleKey: !!binary gIGC

GOOD:
	exampleKey: gIGC
... and decode the base64 data in your code.
```

**Caveat #2:** When using `YAMLToJSON` directly, maps with keys that are maps will result in an error since this is not supported by JSON. This error will occur in `Unmarshal` as well since you can't unmarshal map keys anyways since struct fields can't be keys.

## Installation and usage

To install, run:

```
$ go get github.com/oasdiff/yaml
```

And import using:

```
import "github.com/oasdiff/yaml"
```

Usage is very similar to the JSON library:

```go
package main

import (
	"fmt"

	"github.com/oasdiff/yaml"
)

type Person struct {
	Name string `json:"name"` // Affects YAML field names too.
	Age  int    `json:"age"`
}

func main() {
	// Marshal a Person struct to YAML.
	p := Person{"John", 30}
	y, err := yaml.Marshal(p)
	if err != nil {
		fmt.Printf("err: %v\n", err)
		return
	}
	fmt.Println(string(y))
	/* Output:
	age: 30
	name: John
	*/

	// Unmarshal the YAML back into a Person struct.
	var p2 Person
	_, err = yaml.Unmarshal(y, &p2, yaml.DecodeOpts{})
	if err != nil {
		fmt.Printf("err: %v\n", err)
		return
	}
	fmt.Println(p2)
	/* Output:
	{John 30}
	*/
}
```

`yaml.YAMLToJSON` and `yaml.JSONToYAML` methods are also available:

```go
package main

import (
	"fmt"

	"github.com/oasdiff/yaml"
)

func main() {
	j := []byte(`{"name": "John", "age": 30}`)
	y, err := yaml.JSONToYAML(j)
	if err != nil {
		fmt.Printf("err: %v\n", err)
		return
	}
	fmt.Println(string(y))
	/* Output:
	name: John
	age: 30
	*/
	j2, err := yaml.YAMLToJSON(y)
	if err != nil {
		fmt.Printf("err: %v\n", err)
		return
	}
	fmt.Println(string(j2))
	/* Output:
	{"age":30,"name":"John"}
	*/
}
```
