# YAML support for the Go language

Fork
----
This fork is an improved version of the go-yaml/yaml package, enhanced to inject `__origin__` metadata into YAML mapping nodes during decoding, recording the file, line, and column of each key.

To enable origin tracking, call `Origin` on the decoder before decoding:

```go
dec := yaml.NewDecoder(r)
dec.Origin(true, "myfile.yaml")

var v interface{}
dec.Decode(&v)
// Each decoded map now contains a synthetic "__origin__" key whose value is
// a compact []interface{} sequence:
//   [file, key_name, key_line, key_col, nf, f1_name, f1_delta, f1_col, ..., ns, s1_name, s1_count, (name, delta, col)×count, ...]
// where nf = number of scalar/sequence fields, ns = number of sequences with item locations,
// and deltas are line offsets from key_line.
```

Origin nodes are synthetic: their key node has `Line == 0` (since real YAML lines are 1-based), which allows callers to detect and strip them. The [oasdiff/yaml](https://github.com/oasdiff/yaml) package uses this to build an `OriginTree` before JSON conversion, keeping `__origin__` entirely out of the decoded struct.

Introduction
------------

The yaml package enables Go programs to comfortably encode and decode YAML
values. It was developed within [Canonical](https://www.canonical.com) as
part of the [juju](https://juju.ubuntu.com) project, and is based on a
pure Go port of the well-known [libyaml](http://pyyaml.org/wiki/LibYAML)
C library to parse and generate YAML data quickly and reliably.

Compatibility
-------------

The yaml package supports most of YAML 1.2, but preserves some behavior
from 1.1 for backwards compatibility.

Specifically, as of v3 of the yaml package:

 - YAML 1.1 bools (_yes/no, on/off_) are supported as long as they are being
   decoded into a typed bool value. Otherwise they behave as a string. Booleans
   in YAML 1.2 are _true/false_ only.
 - Octals encode and decode as _0777_ per YAML 1.1, rather than _0o777_
   as specified in YAML 1.2, because most parsers still use the old format.
   Octals in the  _0o777_ format are supported though, so new files work.
 - Does not support base-60 floats. These are gone from YAML 1.2, and were
   actually never supported by this package as it's clearly a poor choice.

Installation and usage
----------------------

The import path for the package is *github.com/oasdiff/yaml3*.

To install it, run:

    go get github.com/oasdiff/yaml3

API documentation
-----------------

  - [https://pkg.go.dev/github.com/oasdiff/yaml3](https://pkg.go.dev/github.com/oasdiff/yaml3)


License
-------

The yaml package is licensed under the MIT and Apache License 2.0 licenses.
Please see the LICENSE file for details.


Example
-------

```Go
package main

import (
        "fmt"
        "log"

        "github.com/oasdiff/yaml3"
)

var data = `
a: Easy!
b:
  c: 2
  d: [3, 4]
`

// Note: struct fields must be public in order for unmarshal to
// correctly populate the data.
type T struct {
        A string
        B struct {
                RenamedC int   `yaml:"c"`
                D        []int `yaml:",flow"`
        }
}

func main() {
        t := T{}
    
        err := yaml.Unmarshal([]byte(data), &t)
        if err != nil {
                log.Fatalf("error: %v", err)
        }
        fmt.Printf("--- t:\n%v\n\n", t)
    
        d, err := yaml.Marshal(&t)
        if err != nil {
                log.Fatalf("error: %v", err)
        }
        fmt.Printf("--- t dump:\n%s\n\n", string(d))
    
        m := make(map[interface{}]interface{})
    
        err = yaml.Unmarshal([]byte(data), &m)
        if err != nil {
                log.Fatalf("error: %v", err)
        }
        fmt.Printf("--- m:\n%v\n\n", m)
    
        d, err = yaml.Marshal(&m)
        if err != nil {
                log.Fatalf("error: %v", err)
        }
        fmt.Printf("--- m dump:\n%s\n\n", string(d))
}
```

This example will generate the following output:

```
--- t:
{Easy! {2 [3 4]}}

--- t dump:
a: Easy!
b:
  c: 2
  d: [3, 4]


--- m:
map[a:Easy! b:map[c:2 d:[3 4]]]

--- m dump:
a: Easy!
b:
  c: 2
  d:
  - 3
  - 4
```
