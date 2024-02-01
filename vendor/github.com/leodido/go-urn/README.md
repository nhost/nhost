[![Build](https://img.shields.io/circleci/build/github/leodido/go-urn?style=for-the-badge)](https://app.circleci.com/pipelines/github/leodido/go-urn) [![Coverage](https://img.shields.io/codecov/c/github/leodido/go-urn.svg?style=for-the-badge)](https://codecov.io/gh/leodido/go-urn) [![Documentation](https://img.shields.io/badge/godoc-reference-blue.svg?style=for-the-badge)](https://godoc.org/github.com/leodido/go-urn)

**A parser for URNs**.

> As seen on [RFC 2141](https://tools.ietf.org/html/rfc2141#ref-1).

[API documentation](https://godoc.org/github.com/leodido/go-urn).

Starting with version 1.3 this library also supports [RFC 7643 SCIM URNs](https://datatracker.ietf.org/doc/html/rfc7643#section-10).

## Installation

```
go get github.com/leodido/go-urn
```

## Features

1. RFC 2141 URNs parsing (default)
2. RFC 7643 SCIM URNs parsing
3. Fallback mode: first try to parse the input as a RFC 7643 SCIM URN, then fallback to RFC 2141 URN generic format.
4. Normalization as per RFC 2141
4. Lexical equivalence as per RFC 2141
5. Precise, fine-grained errors

## Performances

This implementation results to be really fast.

Usually below ½ microsecond on my machine<sup>[1](#mymachine)</sup>.

Notice it also performs, while parsing:

1. fine-grained and informative erroring
2. specific-string normalization

```
Parse/ok/00/urn:a:b______________________________________/-10    71113568    84.88 ns/op    211 B/op    3 allocs/op
Parse/ok/01/URN:foo:a123,456_____________________________/-10    49303754    126.1 ns/op    232 B/op    6 allocs/op
Parse/ok/02/urn:foo:a123%2c456___________________________/-10    46723497    122.1 ns/op    240 B/op    6 allocs/op
Parse/ok/03/urn:ietf:params:scim:schemas:core:2.0:User___/-10    34231863    175.1 ns/op    312 B/op    6 allocs/op
Parse/ok/04/urn:ietf:params:scim:schemas:extension:enterp/-10    25406808    233.6 ns/op    344 B/op    6 allocs/op
Parse/ok/05/urn:ietf:params:scim:schemas:extension:enterp/-10    22353264    265.6 ns/op    376 B/op    6 allocs/op
Parse/ok/06/urn:burnout:nss______________________________/-10    52932087    112.9 ns/op    224 B/op    6 allocs/op
Parse/ok/07/urn:abcdefghilmnopqrstuvzabcdefghilm:x_______/-10    45005554    134.3 ns/op    243 B/op    4 allocs/op
Parse/ok/08/urn:urnurnurn:urn____________________________/-10    46788519    124.7 ns/op    229 B/op    6 allocs/op
Parse/ok/09/urn:ciao:@!=%2c(xyz)+a,b.*@g=$_'_____________/-10    39037539    153.8 ns/op    264 B/op    6 allocs/op
Parse/ok/10/URN:x:abc%1dz%2f%3az_________________________/-10    45692990    121.4 ns/op    243 B/op    5 allocs/op
Parse/no/11/URN:-xxx:x___________________________________/-10    26935477    221.1 ns/op    355 B/op    5 allocs/op
Parse/no/12/urn::colon:nss_______________________________/-10    25088925    232.4 ns/op    355 B/op    5 allocs/op
Parse/no/13/urn:abcdefghilmnopqrstuvzabcdefghilmn:specifi/-10    21206989    295.1 ns/op    355 B/op    5 allocs/op
Parse/no/14/URN:a!?:x____________________________________/-10    26705482    223.5 ns/op    355 B/op    5 allocs/op
Parse/no/15/urn:urn:NSS__________________________________/-10    31609467    202.1 ns/op    307 B/op    5 allocs/op
Parse/no/16/urn:white_space:NSS__________________________/-10    26144792    232.2 ns/op    355 B/op    5 allocs/op
Parse/no/17/urn:concat:no_spaces_________________________/-10    23717426    251.1 ns/op    346 B/op    6 allocs/op
Parse/no/18/urn:a:/______________________________________/-10    27442077    221.9 ns/op    339 B/op    5 allocs/op
Parse/no/19/urn:UrN:NSS__________________________________/-10    32096002    187.4 ns/op    307 B/op    5 allocs/op
```

* <a name="mymachine">[1]</a>: Apple M1 Pro


## Example

For more examples take a look at the [examples file](examples_test.go).


```go
package main

import (
	"fmt"
	"github.com/leodido/go-urn"
)

func main() {
	var uid = "URN:foo:a123,456"

    // Parse the input string as a RFC 2141 URN only
	u, e := urn.NewMachine().Parse(uid)
	if e != nil {
		fmt.Errorf(err)

		return
	}

	fmt.Println(u.ID)
	fmt.Println(u.SS)

	// Output:
	// foo
	// a123,456
}
```

```go
package main

import (
	"fmt"
	"github.com/leodido/go-urn"
)

func main() {
	var uid = "URN:foo:a123,456"

    // Parse the input string as a RFC 2141 URN only
	u, ok := urn.Parse([]byte(uid))
	if !ok {
		panic("error parsing urn")
	}

	fmt.Println(u.ID)
	fmt.Println(u.SS)

	// Output:
	// foo
	// a123,456
}
```

```go
package main

import (
	"fmt"
	"github.com/leodido/go-urn"
)

func main() {
	input := "urn:ietf:params:scim:api:messages:2.0:ListResponse"

	// Parsing the input string as a RFC 7643 SCIM URN
	u, ok := urn.Parse([]byte(input), urn.WithParsingMode(urn.RFC7643Only))
	if !ok {
		panic("error parsing urn")
	}

	fmt.Println(u.IsSCIM())
	scim := u.SCIM()
	fmt.Println(scim.Type.String())
	fmt.Println(scim.Name)
	fmt.Println(scim.Other)

	// Output:
	// true
	// api
	// messages
	// 2.0:ListResponse
}
```