<h1 align="center">jsondiff</h1>
<br>
<p align="center"><strong>jsondiff</strong> is a Go package for computing the <i>diff</i> between two JSON documents as a series of <a href="https://tools.ietf.org/html/rfc6902">RFC6902</a> (JSON Patch) operations, which is particularly suitable to create the patch response of a Kubernetes Mutating Webhook for example.</p>
<p align="center">
    <a href="https://pkg.go.dev/github.com/wI2L/jsondiff"><img src="https://img.shields.io/static/v1?label=godev&message=reference&color=00add8&logo=go"></a>
    <a href="https://jsondiff.wi2l.pw"><img src="https://img.shields.io/badge/%E2%9A%BE-playground-orange.svg?style=flat"></a>
    <a href="https://goreportcard.com/report/wI2L/jsondiff"><img src="https://goreportcard.com/badge/github.com/wI2L/jsondiff"></a>
    <a href="https://github.com/wI2L/jsondiff/actions"><img src="https://github.com/wI2L/jsondiff/workflows/CI/badge.svg"></a>
    <a href="https://codecov.io/gh/wI2L/jsondiff"><img src="https://codecov.io/gh/wI2L/jsondiff/branch/master/graph/badge.svg"/></a>
    <a href="https://github.com/wI2L/jsondiff/releases"><img src="https://img.shields.io/github/v/tag/wI2L/jsondiff?color=blueviolet&label=version&sort=semver"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
    <a href="https://github.com/avelino/awesome-go"><img src="https://awesome.re/mentioned-badge.svg"></a>
</p>

---

## Usage

First, get the latest version of the library using the following command:

```shell
$ go get github.com/wI2L/jsondiff@latest
```

> [!IMPORTANT]
> Requires Go1.21+, due to the usage of the [`hash/maphash`](https://golang.org/pkg/hash/maphash/) package, and the `any/min/max` keyword/builtins.

### Example use cases

#### Kubernetes Dynamic Admission Controller

The typical use case within an application is to compare two values of the same type that represents the source and desired target of a JSON document. A concrete application of that would be to generate the patch returned by a Kubernetes [dynamic admission controller](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/) to mutate a resource. Thereby, instead of generating the operations, just copy the source in order to apply the required changes and delegate the patch generation to the library.

For example, given the following `corev1.Pod` value that represents a Kubernetes [demo pod](https://raw.githubusercontent.com/kubernetes/website/master/content/en/examples/application/shell-demo.yaml) containing a single container:

```go
import corev1 "k8s.io/api/core/v1"

pod := corev1.Pod{
    Spec: corev1.PodSpec{
        Containers: []corev1.Container{{
            Name:  "webserver",
            Image: "nginx:latest",
            VolumeMounts: []corev1.VolumeMount{{
                Name:      "shared-data",
                MountPath: "/usr/share/nginx/html",
            }},
        }},
        Volumes: []corev1.Volume{{
            Name: "shared-data",
            VolumeSource: corev1.VolumeSource{
                EmptyDir: &corev1.EmptyDirVolumeSource{
                    Medium: corev1.StorageMediumMemory,
                },
            },
        }},
    },
}
```

The first step is to copy the original pod value. The `corev1.Pod` type defines a `DeepCopy` method, which is handy, but for other types, a [shallow copy is discouraged](https://medium.com/@alenkacz/shallow-copy-of-a-go-struct-in-golang-is-never-a-good-idea-83be60106af8), instead use a specific library, such as [ulule/deepcopier](https://github.com/ulule/deepcopier). Alternatively, if you don't require to keep the original value, you can marshal it to JSON using `json.Marshal` to store a pre-encoded copy of the document, and mutate the value.

```go
newPod := pod.DeepCopy()
// or
podBytes, err := json.Marshal(pod)
if err != nil {
    // handle error
}
```

Secondly, make some changes to the pod spec. Here we modify the image and the *storage medium* used by the pod's volume `shared-data`.

```go
// Update the image of the webserver container.
newPod.Spec.Containers[0].Image = "nginx:1.19.5-alpine"

// Switch storage medium from memory to default.
newPod.Spec.Volumes[0].EmptyDir.Medium = corev1.StorageMediumDefault
```

Finally, generate the patch that represents the changes relative to the original value. Note that when the `Compare` function is called, the `source` and `target` parameters are first marshaled using the `encoding/json` package (or a custom func) in order to obtain their final JSON representation, prior to comparing them.

```go
import "github.com/wI2L/jsondiff"

patch, err := jsondiff.Compare(pod, newPod)
if err != nil {
    // handle error
}
b, err := json.MarshalIndent(patch, "", "    ")
if err != nil {
    // handle error
}
os.Stdout.Write(b)
```

The output is similar to the following:

```json
[{
    "op": "replace",
    "path": "/spec/containers/0/image",
    "value": "nginx:1.19.5-alpine"
}, {
    "op": "remove",
    "path": "/spec/volumes/0/emptyDir/medium"
}]
```

The JSON patch can then be used in the response payload of you Kubernetes [webhook](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#response).

##### Optional fields gotcha

Note that the above example is used for simplicity, but in a real-world admission controller, you should create the diff from the raw bytes of the `AdmissionReview.AdmissionRequest.Object.Raw` field. As pointed out by user [/u/terinjokes](https://www.reddit.com/user/terinjokes/) on Reddit, due to the nature of Go structs, the "hydrated" `corev1.Pod` object may contain "optional fields", resulting in a patch that state added/changed values that the Kubernetes API server doesn't know about. Below is a quote of the original comment:

> Optional fields being ones that are a struct type, but are not pointers to those structs. These will exist when you unmarshal from JSON, because of how Go structs work, but are not in the original JSON. Comparing between the unmarshaled and copied versions can generate add and change patches below a path not in the original JSON, and the API server will reject your patch.

A realistic usage would be similar to the following snippet:

```go
podBytes, err := json.Marshal(pod)
if err != nil {
    // handle error
}
// req is a k8s.io/api/admission/v1.AdmissionRequest object
jsondiff.CompareJSON(req.AdmissionRequest.Object.Raw, podBytes)
```

Mutating the original pod object or a copy is up to you, as long as you use the raw bytes of the `AdmissionReview` object to generate the patch.

You can find a detailed description of that problem and its resolution in this GitHub [issue](https://github.com/kubernetes-sigs/kubebuilder/issues/510).

##### Outdated package version

There's also one other downside to the above example. If your webhook does not have the latest version of the `client-go` package, or whatever package that contains the types for the resource you're manipulating, all fields not known in that version will be deleted.

For example, if your webhook mutate `Service` resources, a user could set the field `.spec.allocateLoadBalancerNodePort` in Kubernetes 1.20 to disable allocating a node port for services with `Type=LoadBalancer`. However, if the webhook is still using the v1.19.x version of the `k8s.io/api/core/v1` package that define the `Service` type, instead of simply ignoring this field, a `remove` operation will be generated for it.

### Options

If more control over the diff behaviour is required, you can pass a variadic list of functional options as the third argument of the `Compare` and `CompareJSON` functions.

Note that any combination of options can be used without issues, ***unless specified***.

**Table of contents**

- [Factorization](#operations-factorization)
- [Rationalization](#operations-rationalization)
- [Invertible patch](#invertible-patch)
- [Equivalence](#equivalence)
- [LCS (array comparison)](#lcs-longest-common-subsequence)
- [Ignores](#ignores)
- [Marshal/Unmarshal functions](#marshalfunc--unmarshalfunc)

#### Operations factorization

By default, when computing the difference between two JSON documents, the package does not produce `move` or `copy` operations. To enable the factorization of value removals and additions as moves and copies, you should use the functional option `Factorize()`. Factorization reduces the number of operations generated, which inevitably reduce the size of the patch once it is marshaled as JSON.

For instance, given the following document:

```json
{
    "a": [ 1, 2, 3 ],
    "b": { "foo": "bar" }
}
```

In order to obtain this updated version:

```json
{
    "a": [ 1, 2, 3 ],
    "c": [ 1, 2, 3 ],
    "d": { "foo": "bar" }
}
```

The package generates the following patch:

```json
[
    { "op": "remove", "path": "/b" },
    { "op": "add", "path": "/c", "value": [ 1, 2, 3 ] },
    { "op": "add", "path": "/d", "value": { "foo": "bar" } }
]
```

If we take the previous example and generate the patch with factorization enabled, we then get a different patch,  containing `copy` and `move` operations instead:

```json
[
    { "op": "copy", "from": "/a", "path": "/c" },
    { "op": "move", "from": "/b", "path": "/d" }
]
```

#### Operations rationalization

The default method used to compare two JSON documents is a recursive comparison. This produce one or more operations for each difference found. On the other hand, in certain situations, it might be beneficial to replace a set of operations representing several changes inside a JSON node by a single replace operation targeting the parent node, in order to reduce the "size" of the patch (the length in bytes of the JSON representation of the patch).

For that purpose, you can use the `Rationalize()` option. It uses a simple weight function to decide which patch is best (it marshals both sets of operations to JSON and looks at the length of bytes to keep the smaller footprint).

Let's illustrate that with the following document:

```json
{
    "a": { "b": { "c": { "1": 1, "2": 2, "3": 3 } } }
}
```

In order to obtain this updated version:

```json
{
    "a": { "b": { "c": { "x": 1, "y": 2, "z": 3 } } }
}
```

The expected output is one remove/add operation combo for each children field of the object located at path `a.b.c`:

```json
[
    { "op": "remove", "path": "/a/b/c/1" },
    { "op": "remove", "path": "/a/b/c/2" },
    { "op": "remove", "path": "/a/b/c/3" },
    { "op": "add", "path": "/a/b/c/x", "value": 1 },
    { "op": "add", "path": "/a/b/c/y", "value": 2 },
    { "op": "add", "path": "/a/b/c/z", "value": 3 }
]
```

If we also enable factorization, as seen above, we can reduce the number of operations by half:

```json
[
    { "op": "move", "from": "/a/b/c/1", "path": "/a/b/c/x" },
    { "op": "move", "from": "/a/b/c/2", "path": "/a/b/c/y" },
    { "op": "move", "from": "/a/b/c/3", "path": "/a/b/c/z" }
]
```

And finally, with rationalization enabled, those operations are replaced with a single `replace` of the parent object:

```json
[
    { "op": "replace", "path": "/a/b/c", "value": { "x": 1, "y": 2, "z": 3 } }
]
```

##### Input compaction

Reducing the size of a JSON Patch is usually beneficial when it needs to be sent on the wire (HTTP request with the `application/json-patch+json` media type for example). As such, the package assumes that the desired JSON representation of a patch is a compact ("minified") JSON document.

When the `Rationalize()` option is enabled, the package pre-process the JSON input given to the `CompareJSON*` functions. If your inputs are already compact JSON documents, you **should** also use the `SkipCompact()` option to instruct the package to skip the compaction step, resulting in a *nice and free* performance improvement.

##### In-place compaction

By default, the package will not modify the JSON documents given to the `CompareJSON*` function. Instead, a copy of the `target` byte slice argument is created and then compacted to remove insignificant spaces.

To avoid an extra allocation, you can use the `InPlaceCompaction()` option to allow the package to *take ownership* of the `target` byte slice and modify it directly. **Note that you should not update it concurrently with a call to the `CompareJSON*` functions.**

#### Invertible patch

Using the functional option `Invertible()`, it is possible to instruct the diff generator to precede each `remove` and `replace` operation with a `test` operation. Such patches can be inverted to return a patched document to its original form.

However, note that it comes with one limitation. `copy` operations cannot be inverted, as they are ambiguous (the reverse of a `copy` is a `remove`, which could then become either an `add` or a `copy`). As such, using this option disable the generation of `copy` operations (if option `Factorize()` is used) and replace them with `add` operations, albeit potentially at the cost of increased patch size.

For example, let's generate the diff between those two JSON documents:

```json
{
    "a": "1",
    "b": "2"
}
```
```json
{
    "a": "3",
    "c": "4"
}
```

The patch is similar to the following:

```json
[
    { "op": "test", "path": "/a", "value": "1" },
    { "op": "replace", "path": "/a", "value": "3" },
    { "op": "test", "path": "/b", "value": "2" },
    { "op": "remove", "path": "/b" },
    { "op": "add", "path": "/c", "value": "4" }
]
```

As you can see, the `remove` and `replace` operations are preceded with a `test` operation which assert/verify the `value` of the previous `path`. On the other hand, the `add` operation can be reverted to a remove operation directly and doesn't need to be preceded by a `test`.

[Run this example](https://pkg.go.dev/github.com/wI2L/jsondiff#example-Invertible).

Finally, as a side example, if we were to use the `Rationalize()` option in the context of the previous example, the output would be shorter, but the generated patch would still remain invertible:

```json
[
    { "op": "test", "path": "", "value": { "a": "1", "b": "2" } },
    { "op": "replace", "path": "", "value": { "a": "3", "c": "4" } }
]
```

#### Equivalence

Some data types, such as arrays, can be deeply unequal and equivalent at the same time.

Take the following JSON documents:
```json
[
    "a", "b", "c", "d"
]
```
```json
[
    "d", "c", "b", "a"
]
```

The root arrays of each document are not equal because the values differ at each index. However, they are equivalent in terms of content:
- they have the same length
- the elements of the first can be found in the second, the same number of times for each

For such situations, you can use the `Equivalent()` option to instruct the diff generator to skip the generation of operations that would otherwise be added to the patch to represent the differences between the two arrays.

#### LCS (Longest Common Subsequence)

> [!WARNING]
> This is a new/experimental option, which might be promoted as the default behavior in the future.

The default algorithm used to compare arrays is naive and can generate a lot of operations. For example, if a single element located *in the middle* of the array is deleted, all items to its right will be shifted one position to the left, generating one `replace` operation per item.

The `LCS()` option instruct the diff generator to compute the [Longest common subsequence](https://en.wikipedia.org/wiki/Longest_common_subsequence) of the source and target arrays, and use it to generate a list of operations that is more succinct and more faithfully represents the differences.

#### Ignores

> [!WARNING]
> This option is experimental and might be revised in the future.

The `Ignores()` option allows to exclude one or more JSON fields/values from the *generated diff*. The fields must be identified using the JSON Pointer (RFC6901) string syntax.

The option accepts a variadic list of JSON Pointers, which all individually represent a value in the source document. However, if the value does not exist in the source document, the value will be considered to be in the target document, which allows to *ignore* `add` operations.

For example, let's generate the diff between those two JSON documents:

```json
{
    "A": "bar",
    "B": "baz",
    "C": "foo"
}
```

```json
{
    "A": "rab",
    "B": "baz",
    "D": "foo"
}
```

Without the `Ignores()` option, the output patch is the following:

```json
[
    { "op": "replace", "path": "/A", "value": "rab" },
    { "op": "remove", "path": "/C" },
    { "op": "add", "path": "/D", "value": "foo" }
]
```

Using the option with the following pointers list, we can ignore some of the fields that were updated, added or removed:

```go
jsondiff.Ignores("/A", "/B", "/C")
```

The resulting patch is empty, because all changes are ignored.

[Run this example](https://pkg.go.dev/github.com/wI2L/jsondiff#example-Ignores).

> See the actual [testcases](testdata/tests/options/ignore.json) for more examples.

#### MarshalFunc / UnmarshalFunc

By default, the package uses the `json.Marshal` and `json.Unmarshal` functions from the standard library's `encoding` package, to marshal and unmarshal objects to/from JSON.  If you wish to use another package for performance reasons, or simply to customize the encoding/decoding behavior, you can use the `MarshalFunc` and `UnmarshalFunc` options to configure it.

The prototype of the function argument accepted by these options is the same as the official `json.Marshal` and `json.Unmarshal` functions.

##### Custom decoder

In the following example, the `UnmarshalFunc` option is used to set up a custom JSON [`Decoder`](https://pkg.go.dev/encoding/json#Decoder) with the [`UserNumber`](https://pkg.go.dev/encoding/json#Decoder.UseNumber) flag enabled, to decode JSON numbers as [`json.Number`](https://pkg.go.dev/encoding/json#Decoder.UseNumber) instead of `float64`:

```go
patch, err := jsondiff.CompareJSON(
    source,
    target,
    jsondiff.UnmarshalFunc(func(b []byte, v any) error {
        dec := json.NewDecoder(bytes.NewReader(b))
        dec.UseNumber()
        return dec.Decode(v)
    }),
)
```

## Benchmarks

A couple of benchmarks that compare the performance for different JSON document sizes are provided to give a rough estimate of the cost of each option. You can find the JSON documents used by those benchmarks in the directory [testdata/benchs](testdata/benchs).

If you'd like to run the benchmarks yourself, use the following command:

```shell
go get github.com/cespare/prettybench
go test -bench=. | prettybench
```

### Results

The benchmarks were run 10x (statistics computed with [benchstat](https://godoc.org/golang.org/x/perf/cmd/benchstat)) on a MacBook Pro 15", with the following specs:

```
OS : macOS Big Sur (11.7.6)
CPU: 2.6 GHz Intel Core i7
Mem: 16GB 1600 MHz
Go : go version go1.20.4 darwin/amd64
```

<details><summary>Output</summary><br><pre>
name                                       time/op
Small/DifferReset/default-8                2.15µs ± 0%
Small/Differ/default-8                     2.57µs ± 1%
Small/DifferReset/default-unordered-8      2.31µs ± 1%
Small/Differ/default-unordered-8           2.95µs ± 0%
Small/DifferReset/invertible-8             2.18µs ± 1%
Small/Differ/invertible-8                  2.82µs ± 1%
Small/DifferReset/factorize-8              3.53µs ± 0%
Small/Differ/factorize-8                   4.11µs ± 0%
Small/DifferReset/rationalize-8            2.29µs ± 0%
Small/Differ/rationalize-8                 2.73µs ± 1%
Small/DifferReset/equivalent-8             2.14µs ± 1%
Small/Differ/equivalent-8                  2.57µs ± 1%
Small/DifferReset/equivalent-unordered-8   2.32µs ± 1%
Small/Differ/equivalent-unordered-8        2.76µs ± 1%
Small/DifferReset/factor+ratio-8           3.67µs ± 1%
Small/Differ/factor+ratio-8                4.26µs ± 1%
Small/DifferReset/all-8                    3.77µs ± 0%
Small/Differ/all-8                         4.59µs ± 0%
Small/DifferReset/all-unordered-8          3.99µs ± 1%
Small/Differ/all-unordered-8               4.82µs ± 0%
Medium/DifferReset/default-8               6.23µs ± 0%
Medium/Differ/default-8                    7.30µs ± 1%
Medium/DifferReset/default-unordered-8     6.81µs ± 1%
Medium/Differ/default-unordered-8          8.52µs ± 1%
Medium/DifferReset/invertible-8            6.32µs ± 1%
Medium/Differ/invertible-8                 8.09µs ± 0%
Medium/DifferReset/factorize-8             11.3µs ± 1%
Medium/Differ/factorize-8                  13.0µs ± 1%
Medium/DifferReset/rationalize-8           6.91µs ± 1%
Medium/Differ/rationalize-8                7.66µs ± 1%
Medium/DifferReset/equivalent-8            10.0µs ± 1%
Medium/Differ/equivalent-8                 11.1µs ± 1%
Medium/DifferReset/equivalent-unordered-8  11.0µs ± 1%
Medium/Differ/equivalent-unordered-8       12.1µs ± 0%
Medium/DifferReset/factor+ratio-8          11.8µs ± 0%
Medium/Differ/factor+ratio-8               13.1µs ± 0%
Medium/DifferReset/all-8                   16.1µs ± 1%
Medium/Differ/all-8                        17.9µs ± 1%
Medium/DifferReset/all-unordered-8         17.7µs ± 1%
Medium/Differ/all-unordered-8              19.5µs ± 0%
<br>name                                       alloc/op
Small/DifferReset/default-8                  216B ± 0%
Small/Differ/default-8                     1.19kB ± 0%
Small/DifferReset/default-unordered-8        312B ± 0%
Small/Differ/default-unordered-8           1.99kB ± 0%
Small/DifferReset/invertible-8               216B ± 0%
Small/Differ/invertible-8                  1.90kB ± 0%
Small/DifferReset/factorize-8                400B ± 0%
Small/Differ/factorize-8                   1.78kB ± 0%
Small/DifferReset/rationalize-8              224B ± 0%
Small/Differ/rationalize-8                 1.20kB ± 0%
Small/DifferReset/equivalent-8               216B ± 0%
Small/Differ/equivalent-8                  1.19kB ± 0%
Small/DifferReset/equivalent-unordered-8     216B ± 0%
Small/Differ/equivalent-unordered-8        1.19kB ± 0%
Small/DifferReset/factor+ratio-8             408B ± 0%
Small/Differ/factor+ratio-8                1.78kB ± 0%
Small/DifferReset/all-8                      408B ± 0%
Small/Differ/all-8                         2.49kB ± 0%
Small/DifferReset/all-unordered-8            520B ± 0%
Small/Differ/all-unordered-8               2.60kB ± 0%
Medium/DifferReset/default-8                 624B ± 0%
Medium/Differ/default-8                    3.71kB ± 0%
Medium/DifferReset/default-unordered-8       848B ± 0%
Medium/Differ/default-unordered-8          7.01kB ± 0%
Medium/DifferReset/invertible-8              624B ± 0%
Medium/Differ/invertible-8                 6.78kB ± 0%
Medium/DifferReset/factorize-8             1.41kB ± 0%
Medium/Differ/factorize-8                  5.60kB ± 0%
Medium/DifferReset/rationalize-8             672B ± 0%
Medium/Differ/rationalize-8                2.35kB ± 0%
Medium/DifferReset/equivalent-8            1.39kB ± 0%
Medium/Differ/equivalent-8                 4.48kB ± 0%
Medium/DifferReset/equivalent-unordered-8  1.49kB ± 0%
Medium/Differ/equivalent-unordered-8       4.58kB ± 0%
Medium/DifferReset/factor+ratio-8          1.45kB ± 0%
Medium/Differ/factor+ratio-8               4.24kB ± 0%
Medium/DifferReset/all-8                   2.22kB ± 0%
Medium/Differ/all-8                        6.41kB ± 0%
Medium/DifferReset/all-unordered-8         2.36kB ± 0%
Medium/Differ/all-unordered-8              6.55kB ± 0%
<br>name                                       allocs/op
Small/DifferReset/default-8                  9.00 ± 0%
Small/Differ/default-8                       13.0 ± 0%
Small/DifferReset/default-unordered-8        13.0 ± 0%
Small/Differ/default-unordered-8             18.0 ± 0%
Small/DifferReset/invertible-8               9.00 ± 0%
Small/Differ/invertible-8                    14.0 ± 0%
Small/DifferReset/factorize-8                21.0 ± 0%
Small/Differ/factorize-8                     27.0 ± 0%
Small/DifferReset/rationalize-8              10.0 ± 0%
Small/Differ/rationalize-8                   14.0 ± 0%
Small/DifferReset/equivalent-8               9.00 ± 0%
Small/Differ/equivalent-8                    13.0 ± 0%
Small/DifferReset/equivalent-unordered-8     9.00 ± 0%
Small/Differ/equivalent-unordered-8          13.0 ± 0%
Small/DifferReset/factor+ratio-8             22.0 ± 0%
Small/Differ/factor+ratio-8                  28.0 ± 0%
Small/DifferReset/all-8                      22.0 ± 0%
Small/Differ/all-8                           29.0 ± 0%
Small/DifferReset/all-unordered-8            25.0 ± 0%
Small/Differ/all-unordered-8                 32.0 ± 0%
Medium/DifferReset/default-8                 18.0 ± 0%
Medium/Differ/default-8                      24.0 ± 0%
Medium/DifferReset/default-unordered-8       26.0 ± 0%
Medium/Differ/default-unordered-8            33.0 ± 0%
Medium/DifferReset/invertible-8              18.0 ± 0%
Medium/Differ/invertible-8                   25.0 ± 0%
Medium/DifferReset/factorize-8               55.0 ± 0%
Medium/Differ/factorize-8                    64.0 ± 0%
Medium/DifferReset/rationalize-8             22.0 ± 0%
Medium/Differ/rationalize-8                  27.0 ± 0%
Medium/DifferReset/equivalent-8              26.0 ± 0%
Medium/Differ/equivalent-8                   32.0 ± 0%
Medium/DifferReset/equivalent-unordered-8    30.0 ± 0%
Medium/Differ/equivalent-unordered-8         36.0 ± 0%
Medium/DifferReset/factor+ratio-8            59.0 ± 0%
Medium/Differ/factor+ratio-8                 67.0 ± 0%
Medium/DifferReset/all-8                     67.0 ± 0%
Medium/Differ/all-8                          76.0 ± 0%
Medium/DifferReset/all-unordered-8           74.0 ± 0%
Medium/Differ/all-unordered-8                83.0 ± 0%
</pre></details>

## Credits

This package has been inspired by existing implementations of JSON Patch/diff algorithms in various languages:

- [cujojs/jiff](https://github.com/cujojs/jiff)
- [Starcounter-Jack/JSON-Patch](https://github.com/Starcounter-Jack/JSON-Patch)
- [java-json-tools/json-patch](https://github.com/java-json-tools/json-patch)
- [Lattyware/elm-json-diff](https://github.com/Lattyware/elm-json-diff)
- [espadrine/json-diff](https://github.com/espadrine/json-diff)
- [`Algorithm::Diff`](https://metacpan.org/pod/Algorithm::Diff)

## License

The code is licensed under the **MIT** license. [Read this](https://www.tldrlegal.com/license/mit-license) or see the [LICENSE](LICENSE) file.