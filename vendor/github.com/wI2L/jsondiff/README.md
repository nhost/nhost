<h1 align="center">jsondiff</h1>
<br>
<p align="center"><strong>jsondiff</strong> is a Go package for computing the <i>diff</i> between two JSON documents as a series of <a href="https://tools.ietf.org/html/rfc6902">RFC6902</a> (JSON Patch) operations, which is particularly suitable to create the patch response of a Kubernetes Mutating Webhook for example.</p>
<p align="center">
    <a href="https://pkg.go.dev/github.com/wI2L/jsondiff"><img src="https://img.shields.io/static/v1?label=godev&message=reference&color=00add8&logo=go"></a>
    <a href="https://jsondiff-play-wi2l.vercel.app/"><img src="https://img.shields.io/badge/%E2%9A%BE-playground-orange.svg?style=flat"></a>
    <a href="https://goreportcard.com/report/wI2L/jsondiff"><img src="https://goreportcard.com/badge/github.com/wI2L/jsondiff"></a>
    <a href="https://codecov.io/gh/wI2L/jsondiff"><img src="https://codecov.io/gh/wI2L/jsondiff/branch/master/graph/badge.svg"/></a>
    <a href="https://github.com/wI2L/jsondiff/actions/workflows/ci.yml"><img src="https://github.com/wI2L/jsondiff/actions/workflows/ci.yml/badge.svg?branch=master"/></a>
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

The benchmarks were run 10x (statistics computed with [benchstat](https://pkg.go.dev/golang.org/x/perf/cmd/benchstat)) on a MacBook Pro 15", with the following specs:

```
OS : macOS Sequoia (15.1)
CPU: Apple M1 Max
Go : go version go1.23.2 darwin/arm64
```

<details><summary>Output</summary><br><pre>
goos: darwin
goarch: arm64
pkg: github.com/wI2L/jsondiff
cpu: Apple M1 Max

Small/DifferReset/default-10                 1.239µ ± 1%
Small/Differ/default-10                      1.462µ ± 0%
Small/DifferReset/default-unordered-10       1.303µ ± 1%
Small/Differ/default-unordered-10            1.642µ ± 1%
Small/DifferReset/invertible-10              1.250µ ± 1%
Small/Differ/invertible-10                   1.595µ ± 1%
Small/DifferReset/factorize-10               2.034µ ± 1%
Small/Differ/factorize-10                    2.357µ ± 1%
Small/DifferReset/rationalize-10             1.317µ ± 0%
Small/Differ/rationalize-10                  1.543µ ± 0%
Small/DifferReset/equivalent-10              1.236µ ± 1%
Small/Differ/equivalent-10                   1.460µ ± 1%
Small/DifferReset/equivalent-unordered-10    1.336µ ± 1%
Small/Differ/equivalent-unordered-10         1.565µ ± 1%
Small/DifferReset/factor+ratio-10            2.109µ ± 1%
Small/Differ/factor+ratio-10                 2.442µ ± 0%
Small/DifferReset/all-10                     2.188µ ± 1%
Small/Differ/all-10                          2.650µ ± 0%
Small/DifferReset/all-unordered-10           2.296µ ± 2%
Small/Differ/all-unordered-10                2.751µ ± 0%
Medium/DifferReset/default-10                3.597µ ± 1%
Medium/Differ/default-10                     4.178µ ± 1%
Medium/DifferReset/default-unordered-10      3.891µ ± 1%
Medium/Differ/default-unordered-10           4.753µ ± 0%
Medium/DifferReset/invertible-10             3.644µ ± 1%
Medium/Differ/invertible-10                  4.562µ ± 1%
Medium/DifferReset/factorize-10              6.361µ ± 1%
Medium/Differ/factorize-10                   7.266µ ± 1%
Medium/DifferReset/rationalize-10            3.903µ ± 1%
Medium/Differ/rationalize-10                 4.270µ ± 1%
Medium/DifferReset/equivalent-10             6.748µ ± 4%
Medium/Differ/equivalent-10                  8.547µ ± 0%
Medium/DifferReset/equivalent-unordered-10   6.630µ ± 2%
Medium/Differ/equivalent-unordered-10        8.554µ ± 1%
Medium/DifferReset/factor+ratio-10           6.598µ ± 1%
Medium/Differ/factor+ratio-10                7.300µ ± 1%
Medium/DifferReset/all-10                    9.829µ ± 3%
Medium/Differ/all-10                         12.27µ ± 0%
Medium/DifferReset/all-unordered-10          9.818µ ± 1%
Medium/Differ/all-unordered-10               12.28µ ± 1%
geomean                                      3.281µ

Small/DifferReset/default-10                   216.0 ± 0%
Small/Differ/default-10                      1.164Ki ± 0%
Small/DifferReset/default-unordered-10         312.0 ± 0%
Small/Differ/default-unordered-10            2.008Ki ± 0%
Small/DifferReset/invertible-10                216.0 ± 0%
Small/Differ/invertible-10                   1.914Ki ± 0%
Small/DifferReset/factorize-10                 400.0 ± 0%
Small/Differ/factorize-10                    1.734Ki ± 0%
Small/DifferReset/rationalize-10               224.0 ± 0%
Small/Differ/rationalize-10                  1.172Ki ± 0%
Small/DifferReset/equivalent-10                216.0 ± 0%
Small/Differ/equivalent-10                   1.164Ki ± 0%
Small/DifferReset/equivalent-unordered-10      216.0 ± 0%
Small/Differ/equivalent-unordered-10         1.164Ki ± 0%
Small/DifferReset/factor+ratio-10              408.0 ± 0%
Small/Differ/factor+ratio-10                 1.742Ki ± 0%
Small/DifferReset/all-10                       408.0 ± 0%
Small/Differ/all-10                          2.492Ki ± 0%
Small/DifferReset/all-unordered-10             520.0 ± 0%
Small/Differ/all-unordered-10                2.602Ki ± 0%
Medium/DifferReset/default-10                  624.0 ± 0%
Medium/Differ/default-10                     3.812Ki ± 0%
Medium/DifferReset/default-unordered-10        848.0 ± 0%
Medium/Differ/default-unordered-10           7.031Ki ± 0%
Medium/DifferReset/invertible-10               624.0 ± 0%
Medium/Differ/invertible-10                  6.812Ki ± 0%
Medium/DifferReset/factorize-10              1.372Ki ± 0%
Medium/Differ/factorize-10                   5.654Ki ± 0%
Medium/DifferReset/rationalize-10              672.0 ± 0%
Medium/Differ/rationalize-10                 2.359Ki ± 0%
Medium/DifferReset/equivalent-10             1.359Ki ± 0%
Medium/Differ/equivalent-10                  4.562Ki ± 0%
Medium/DifferReset/equivalent-unordered-10   1.359Ki ± 0%
Medium/Differ/equivalent-unordered-10        4.562Ki ± 0%
Medium/DifferReset/factor+ratio-10           1.419Ki ± 0%
Medium/Differ/factor+ratio-10                4.200Ki ± 0%
Medium/DifferReset/all-10                    2.170Ki ± 0%
Medium/Differ/all-10                         6.451Ki ± 0%
Medium/DifferReset/all-unordered-10          2.169Ki ± 0%
Medium/Differ/all-unordered-10               6.450Ki ± 0%
geomean                                      1.277Ki

Small/DifferReset/default-10                 9.000 ± 0%
Small/Differ/default-10                      13.00 ± 0%
Small/DifferReset/default-unordered-10       13.00 ± 0%
Small/Differ/default-unordered-10            18.00 ± 0%
Small/DifferReset/invertible-10              9.000 ± 0%
Small/Differ/invertible-10                   14.00 ± 0%
Small/DifferReset/factorize-10               21.00 ± 0%
Small/Differ/factorize-10                    27.00 ± 0%
Small/DifferReset/rationalize-10             10.00 ± 0%
Small/Differ/rationalize-10                  14.00 ± 0%
Small/DifferReset/equivalent-10              9.000 ± 0%
Small/Differ/equivalent-10                   13.00 ± 0%
Small/DifferReset/equivalent-unordered-10    9.000 ± 0%
Small/Differ/equivalent-unordered-10         13.00 ± 0%
Small/DifferReset/factor+ratio-10            22.00 ± 0%
Small/Differ/factor+ratio-10                 28.00 ± 0%
Small/DifferReset/all-10                     22.00 ± 0%
Small/Differ/all-10                          29.00 ± 0%
Small/DifferReset/all-unordered-10           25.00 ± 0%
Small/Differ/all-unordered-10                32.00 ± 0%
Medium/DifferReset/default-10                18.00 ± 0%
Medium/Differ/default-10                     24.00 ± 0%
Medium/DifferReset/default-unordered-10      26.00 ± 0%
Medium/Differ/default-unordered-10           33.00 ± 0%
Medium/DifferReset/invertible-10             18.00 ± 0%
Medium/Differ/invertible-10                  25.00 ± 0%
Medium/DifferReset/factorize-10              55.00 ± 0%
Medium/Differ/factorize-10                   64.00 ± 0%
Medium/DifferReset/rationalize-10            22.00 ± 0%
Medium/Differ/rationalize-10                 27.00 ± 0%
Medium/DifferReset/equivalent-10             26.00 ± 0%
Medium/Differ/equivalent-10                  32.00 ± 0%
Medium/DifferReset/equivalent-unordered-10   26.00 ± 0%
Medium/Differ/equivalent-unordered-10        32.00 ± 0%
Medium/DifferReset/factor+ratio-10           59.00 ± 0%
Medium/Differ/factor+ratio-10                67.00 ± 0%
Medium/DifferReset/all-10                    67.00 ± 0%
Medium/Differ/all-10                         76.00 ± 0%
Medium/DifferReset/all-unordered-10          67.00 ± 0%
Medium/Differ/all-unordered-10               76.00 ± 0%
geomean                                      24.36
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
