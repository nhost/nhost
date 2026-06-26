# oapi-codegen/runtime

⚠️ This README may be for the latest development version, which may
contain unreleased changes. Please ensure you're looking at the README for the latest release version.

This package provides helper functions for marshaling and unmarshalling HTTP
parameters in headers, cookies, and query arguments in various formats, as well
as functions for reading and writing form encoded data representing models.

You won't need to use this package directly, since it's imported be the boilerplate
from `oapi-codegen`, however, you do need to use the correct version needed by
the code generator, since it makes assumptions about runtime behavior.

## Parameter Handling

OpenAPI 3.x parameters are characterized by three orthogonal attributes:
**style**, **location**, and **explode**. The serialized form on the wire is
determined by the combination of all three.

### Styles

Parameters come in the following styles (all defined by the OpenAPI 3.x spec):

- **`simple`** — comma-separated values. The default for path and header
  parameters.
- **`label`** — values prefixed with `.`, separated by `.` (explode) or `,`
  (no explode). Path parameters only.
- **`matrix`** — values prefixed with `;name=`, repeated (explode) or
  comma-separated (no explode). Path parameters only.
- **`form`** — `name=value` pairs joined with `&`. The default for query and
  cookie parameters.
- **`spaceDelimited`** — array elements joined by literal spaces (no
  explode); behaves identically to `form` when exploded. Query parameters,
  arrays only.
- **`pipeDelimited`** — array elements joined by literal `|` (no explode);
  behaves identically to `form` when exploded. Query parameters, arrays
  only.
- **`deepObject`** — nested bracket notation, e.g. `name[field]=value`.
  Query parameters, objects only, must be exploded.

### Locations

Each style is only valid in specific parameter locations:

| Location | Allowed styles |
|----------|---------------|
| `path`   | `simple`, `label`, `matrix` |
| `query`  | `form`, `spaceDelimited`, `pipeDelimited`, `deepObject` |
| `header` | `simple` |
| `cookie` | `form` |

### Explode

Each style can be `explode: true` or `explode: false`, which changes how
multi-value parameters (arrays and objects) are packed.

<table>
<thead>
<tr>
<th>Style</th><th>Type</th><th><code>explode: false</code></th><th><code>explode: true</code></th>
</tr>
</thead>
<tbody>
<tr><td rowspan="3"><code>simple</code></td>
  <td>primitive <code>5</code></td><td><code>5</code></td><td><code>5</code></td></tr>
<tr><td>array <code>[3,4,5]</code></td><td><code>3,4,5</code></td><td><code>3,4,5</code></td></tr>
<tr><td>object <code>{role:"admin", firstName:"Alex"}</code></td><td><code>firstName,Alex,role,admin</code></td><td><code>firstName=Alex,role=admin</code></td></tr>

<tr><td rowspan="3"><code>label</code></td>
  <td>primitive <code>5</code></td><td><code>.5</code></td><td><code>.5</code></td></tr>
<tr><td>array <code>[3,4,5]</code></td><td><code>.3,4,5</code></td><td><code>.3.4.5</code></td></tr>
<tr><td>object <code>{role:"admin", firstName:"Alex"}</code></td><td><code>.firstName,Alex,role,admin</code></td><td><code>.firstName=Alex.role=admin</code></td></tr>

<tr><td rowspan="3"><code>matrix</code></td>
  <td>primitive <code>5</code></td><td><code>;id=5</code></td><td><code>;id=5</code></td></tr>
<tr><td>array <code>[3,4,5]</code></td><td><code>;id=3,4,5</code></td><td><code>;id=3;id=4;id=5</code></td></tr>
<tr><td>object <code>{role:"admin", firstName:"Alex"}</code></td><td><code>;id=firstName,Alex,role,admin</code></td><td><code>;firstName=Alex;role=admin</code></td></tr>

<tr><td rowspan="3"><code>form</code></td>
  <td>primitive <code>5</code></td><td><code>id=5</code></td><td><code>id=5</code></td></tr>
<tr><td>array <code>[3,4,5]</code></td><td><code>id=3,4,5</code></td><td><code>id=3&amp;id=4&amp;id=5</code></td></tr>
<tr><td>object <code>{role:"admin", firstName:"Alex"}</code></td><td><code>id=firstName,Alex,role,admin</code></td><td><code>firstName=Alex&amp;role=admin</code></td></tr>

<tr><td rowspan="3"><code>spaceDelimited</code></td>
  <td>primitive</td><td colspan="2"><em>not supported</em></td></tr>
<tr><td>array <code>[3,4,5]</code></td><td><code>id=3 4 5</code></td><td><code>id=3&amp;id=4&amp;id=5</code></td></tr>
<tr><td>object</td><td colspan="2"><em>not supported</em></td></tr>

<tr><td rowspan="3"><code>pipeDelimited</code></td>
  <td>primitive</td><td colspan="2"><em>not supported</em></td></tr>
<tr><td>array <code>[3,4,5]</code></td><td><code>id=3|4|5</code></td><td><code>id=3&amp;id=4&amp;id=5</code></td></tr>
<tr><td>object</td><td colspan="2"><em>not supported</em></td></tr>

<tr><td rowspan="3"><code>deepObject</code></td>
  <td>primitive</td><td colspan="2"><em>not supported</em></td></tr>
<tr><td>array <code>[3,4,5]</code></td><td colspan="2"><code>id[0]=3&amp;id[1]=4&amp;id[2]=5</code> (explode required)</td></tr>
<tr><td>object <code>{role:"admin", firstName:"Alex"}</code></td><td colspan="2"><code>id[firstName]=Alex&amp;id[role]=admin</code> (explode required)</td></tr>
</tbody>
</table>

> The above outputs are shown unescaped for readability. In real use, values
> destined for query parameters are passed through `url.QueryEscape` (or
> `url.PathEscape` for path parameters), so reserved characters and
> non-ASCII bytes are percent-encoded on the wire.

### Parameter Limitations

The OpenAPI 3.x parameter styles are convenient but each has at least one
sharp edge. The list below documents behaviors that surprise users and the
cases where round-tripping is not possible in principle.

#### Encoding

- **Query and path values are percent-encoded.** Reserved characters
  (`&`, `=`, `#`, `?`, etc.) and non-ASCII bytes are escaped via
  `url.QueryEscape` / `url.PathEscape`. Spaces in query values are encoded
  as `+` (form-urlencoded convention), matching `url.Values.Encode()`.
- **Header values are passed through raw.** Per RFC 7230 §3.2.6, header
  field values may contain visible ASCII plus space/tab; bytes ≥ `0x80` are
  `obs-text` and explicitly marked obsolete in RFC 9110. There is no
  generally-agreed mechanism for transporting non-ASCII text in arbitrary
  header values (RFC 8187 covers only header *parameters* like
  `Content-Disposition` `filename*=`). If your spec puts non-ASCII or
  control characters into a header parameter, the wire format is
  RFC-noncompliant and proxies may strip or reject the request.
- **Cookie values are passed through raw.** Per RFC 6265 §4.1.1, cookie
  values may not contain `CTL`, whitespace, `"`, `,`, `;`, `\`, or any byte
  ≥ `0x80`. Most cookie libraries URL-encode by convention, but this
  package does not — if your spec puts spaces or non-ASCII into a cookie
  parameter, the value will not be RFC 6265-conformant.
- **Map keys are percent-encoded for `deepObject` only.** For `simple`,
  `label`, `matrix`, and `form` styles, map keys are emitted raw. If your
  map keys are non-ASCII or contain URL-reserved characters, the wire
  representation will not be encoded.
- **`allowReserved`** (`StyleParamOptions.AllowReserved`) is a query-only
  option per the OpenAPI 3.x spec, and only applies to *values*, not
  parameter names or map keys.

#### `deepObject`

- **Bracket notation is structural, not data.** `MarshalDeepObject`
  percent-encodes literal `[` and `]` inside values and map keys as `%5B`
  / `%5D` on the wire. However, once a server calls `url.ParseQuery`, those
  escapes are decoded back to `[` and `]` — at which point a key like
  `p[a[b]]` is ambiguous between `{p: {a: {b: ...}}}` and
  `{p: {"a[b]": ...}}`. `UnmarshalDeepObject` cannot distinguish these
  cases and adopts the same greedy left-to-right parse used by qs (Node),
  Rails `Rack::Utils.parse_nested_query`, and similar libraries: every
  unescaped `[` opens a new nesting level. **Literal `[` and `]` inside
  map keys cannot be round-tripped.** Use a different separator in
  user-supplied keys if this matters to you.
- **OpenAPI 3.x defines `deepObject` only for object schemas.** This
  package extends it to maps and arrays for convenience (arrays are
  numerically indexed: `p[0]`, `p[1]`, …), but other tooling may not
  accept that wire form.
- **`deepObject` requires `explode: true`.** Non-exploded `deepObject` has
  no well-defined wire format; an error is returned.

#### `spaceDelimited` / `pipeDelimited`

- **Array-only.** Per the OpenAPI spec, these styles only apply to arrays
  of primitives. Passing a primitive or object returns an error.
- **Exploded form degenerates to `form`.** When `explode: true`, the
  separator becomes `&` (not space or pipe), so the output is
  byte-identical to `form` exploded. The space/pipe separator only takes
  effect when `explode: false`. This is per the OpenAPI spec, but it
  surprises many users.
- **Unexploded `spaceDelimited` is RFC-fragile.** Literal spaces in a
  query string are tolerated by most parsers but are not RFC 3986-
  conformant; `+` would be the form-urlencoded canonical form for space,
  but `spaceDelimited` is defined to use literal `%20`-equivalent space
  (the value bytes themselves are then encoded normally).

#### Type-conversion edge cases

- **`null`** in a struct field marshals to the literal string `"null"` in
  `deepObject` output. There is no distinct OpenAPI representation for
  absent vs. JSON-null in query parameters.
- **`time.Time` and `types.Date`** are formatted via RFC 3339 and
  `2006-01-02` respectively when used as primitives in any style. If you
  want a different format, wrap the field in a type that implements
  `encoding.TextMarshaler`.
- **`types.UUID`** stringifies to the canonical hyphenated 36-character
  form; query/path location escaping is a no-op (UUIDs are in the
  unreserved set).
- **`json.Marshaler` is consulted for structs**, then the result is
  re-decoded with `UseNumber()` and re-styled. Numbers therefore retain
  their original precision, but the round-trip through JSON means struct
  field tags are honored (not raw Go field names).

