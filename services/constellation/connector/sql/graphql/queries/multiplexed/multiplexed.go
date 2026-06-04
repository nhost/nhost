// Package multiplexed converts a single GraphQL subscription SQL query into a
// Hasura-style multiplexed query that batches multiple subscribers into one
// poll. Each subscriber's session variables and cursor state are packed into
// a JSON array; the inner query references that array via JSON path operators
// instead of numbered placeholders.
package multiplexed

import (
	json "encoding/json/v2"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

// ErrSessionVarInMultiElementArray is returned by Multiplex when a permission
// session-variable marker is trapped inside a multi-element array parameter
// (e.g. `_in: ["x-hasura-user-id", "<literal>"]` or
// `_has_keys_any: ["x-hasura-key", "<literal>"]`). Such an array maps to a
// single SQL placeholder bound as a whole array, so its session-variable
// element cannot be rewritten into a per-subscriber result_vars JSON path
// without restructuring the array into per-element expressions — which is not
// yet supported. Rather than silently binding the variable's literal name (and
// evaluating the row-level permission against "x-hasura-…" instead of the
// subscriber's session value), the subscription is rejected so the divergence
// is loud rather than a silent wrong/empty result set.
var ErrSessionVarInMultiElementArray = errors.New(
	"session variable in a multi-element array filter is not supported in subscriptions",
)

// paramPattern matches $N optionally followed by ::type or ::type[].
// Only single-dimensional arrays are supported; for input like `$1::uuid[][]`
// the pattern matches `$1::uuid[]` and leaves the trailing `[]` orphaned in
// the SQL, producing a malformed rewrite. No current caller emits
// multi-dimensional arrays, so this is latent rather than active.
var paramPattern = regexp.MustCompile(`\$(\d+)(?:::([a-zA-Z_][a-zA-Z0-9_]*(?:\[\])?))?`)

// Multiplex rewrites op into a Hasura-style multiplexed subscription query and
// returns the final SQL plus the static parameter slice ready for $3+.
//
// Hasura-compatible multiplexing fans out a single SQL query to multiple subscribers
// by UNNEST-ing an array of subscriber IDs and a JSON array of per-subscriber
// variables (session vars, cursor state) into a virtual "_subs" table. The inner
// query references "_subs"."result_vars" via JSON path operators instead of $N
// placeholders for session/cursor values, while static GraphQL variables remain
// as numbered parameters ($3, $4, ...).
//
// Session variables (core.SessionVarValue markers), cursor values
// (core.CursorValue markers), and function session_argument placeholders
// (core.FunctionSessionArgument markers) in op.Parameters are recognised by
// type and rewritten to JSON path expressions accessing _subs.result_vars. Type
// casts are extracted from the SQL pattern $N::type, with function
// session_arguments using the marker's SQLType. The remaining entries form the
// static params slice, renumbered starting at $3 (after $1=sub_ids,
// $2=result_vars). Callers pass that slice as the tail of the parameter list —
// see PrepareParams.
//
// Session-variable classification is purely by marker type, never by sniffing a
// parameter's string value: a user-supplied where/_set/_in/by_pk literal that
// happens to begin with "x-hasura-" is ordinary data and is left as a static
// parameter, matching Hasura (which tracks session-variable positions
// structurally).
func Multiplex(op core.SQLOperation) (string, []any, error) {
	innerSQL, staticParams, err := rewriteMultiplexedSQL(op)
	if err != nil {
		return "", nil, err
	}

	return buildMultiplexedSQL(op.Name, innerSQL), staticParams, nil
}

// rewriteMultiplexedSQL converts a regular core.SQLOperation into its inner
// multiplexed form: the SQL with session, cursor, and function session_argument
// parameter references rewritten to JSON path expressions, and the residual
// static parameters (renumbered to start at $3). It returns
// ErrSessionVarInMultiElementArray when a session-variable marker is trapped
// inside a multi-element array parameter that cannot be rewritten into a single
// result_vars lookup.
func rewriteMultiplexedSQL(op core.SQLOperation) (string, []any, error) {
	if len(op.Parameters) == 0 {
		return op.SQL, nil, nil
	}

	sessionVarIndices := make(map[int]string)
	cursorVarIndices := make(map[int]string)
	functionSessionArgumentIndices := make(map[int]string)
	staticParamOldIndices := make([]int, 0)

	for i, param := range op.Parameters {
		paramIdx := i + 1

		if varName, ok := extractSessionVarName(param); ok {
			sessionVarIndices[paramIdx] = varName
		} else if cursorVal, ok := param.(core.CursorValue); ok {
			cursorVarIndices[paramIdx] = cursorVal.ColumnName
		} else if sessionArg, ok := param.(core.FunctionSessionArgument); ok {
			functionSessionArgumentIndices[paramIdx] = sessionArg.SQLType
		} else if containsSessionVarMarker(param) {
			// extractSessionVarName recognises a lone (or single-element-array)
			// session-variable marker above; if a marker survives here it is
			// trapped inside a multi-element array param that cannot be rewritten
			// to a result_vars path, so reject the subscription rather than bind
			// the variable's literal name.
			return "", nil, fmt.Errorf(
				"%w: parameter %d",
				ErrSessionVarInMultiElementArray,
				paramIdx,
			)
		} else {
			staticParamOldIndices = append(staticParamOldIndices, paramIdx)
		}
	}

	// In Hasura-style SQL: $1 = sub_ids, $2 = result_vars (JSON), $3+ = static params.
	const staticParamOffset = 3

	staticParamMapping := make(map[int]int)

	for i, oldIdx := range staticParamOldIndices {
		staticParamMapping[oldIdx] = staticParamOffset + i
	}

	staticParams := make([]any, len(staticParamOldIndices))
	for i, oldIdx := range staticParamOldIndices {
		staticParams[i] = op.Parameters[oldIdx-1]
	}

	innerSQL := rewriteSQLForMultiplexing(
		op.SQL,
		sessionVarIndices,
		cursorVarIndices,
		functionSessionArgumentIndices,
		staticParamMapping,
	)

	return innerSQL, staticParams, nil
}

// extractSessionVarName extracts the session-variable name from a parameter
// that is a core.SessionVarValue marker (or a single-element array wrapping
// one, the shape a scalar session variable in an `_in` filter can take).
// Classification is by marker type only: a plain string is never treated as a
// session variable, even when it begins with "x-hasura-", because such a value
// is user-supplied data rather than a permission session-variable reference.
// The marker is produced exclusively by the subscription cohort managers (see
// core.SessionVarValue), so it cannot originate from user input.
func extractSessionVarName(param any) (string, bool) {
	switch v := param.(type) {
	case core.SessionVarValue:
		return v.Name, true
	case []any:
		if len(v) == 1 {
			if sv, ok := v[0].(core.SessionVarValue); ok {
				return sv.Name, true
			}
		}
	case []core.SessionVarValue:
		if len(v) == 1 {
			return v[0].Name, true
		}
	}

	return "", false
}

// containsSessionVarMarker reports whether param is, or transitively contains,
// a core.SessionVarValue marker. extractSessionVarName already recognises a lone
// marker and a single-element array wrapping one (the rewritable shapes); this
// detects a marker trapped in a multi-element array, where it cannot be reduced
// to a single result_vars path. rewriteMultiplexedSQL rejects such params rather
// than letting a marker reach the driver (pgx cannot encode it) or silently
// binding the variable's literal name.
func containsSessionVarMarker(param any) bool {
	switch v := param.(type) {
	case core.SessionVarValue:
		return true
	case []any:
		return slices.ContainsFunc(v, containsSessionVarMarker)
	case []core.SessionVarValue:
		return len(v) > 0
	}

	return false
}

// rewriteSQLForMultiplexing rewrites SQL to use JSON path extraction for session variables,
// cursor variables, and whole-session function arguments, then renumbers the
// remaining parameters. It extracts types from SQL patterns like $N::type.
func rewriteSQLForMultiplexing(
	sql string,
	sessionVarIndices map[int]string,
	cursorVarIndices map[int]string,
	functionSessionArgumentIndices map[int]string,
	staticParamMapping map[int]int,
) string {
	const (
		paramIdxGroup = 1
		typeGroup     = 2
	)

	return paramPattern.ReplaceAllStringFunc(sql, func(match string) string {
		matches := paramPattern.FindStringSubmatch(match)

		paramIdx, err := strconv.Atoi(matches[paramIdxGroup])
		if err != nil {
			return match
		}

		pgType := matches[typeGroup]
		if pgType == "" {
			pgType = "text"
		}

		if varName, isSession := sessionVarIndices[paramIdx]; isSession {
			return `(("_subs"."result_vars" #>> '{session,` + varName + `}')::` + pgType + `)`
		}

		if colName, isCursor := cursorVarIndices[paramIdx]; isCursor {
			return `(("_subs"."result_vars" #>> '{cursor,` + colName + `}')::` + pgType + `)`
		}

		if sqlType, isFunctionSessionArgument := functionSessionArgumentIndices[paramIdx]; isFunctionSessionArgument {
			return `(("_subs"."result_vars" -> 'session')::` +
				functionSessionArgumentCast(sqlType, matches[typeGroup]) + `)`
		}

		if newIdx, exists := staticParamMapping[paramIdx]; exists {
			if pgType != "text" {
				return "$" + strconv.Itoa(newIdx) + "::" + pgType
			}

			return "$" + strconv.Itoa(newIdx)
		}

		return match
	})
}

// functionSessionArgumentCast picks the SQL type to cast the rewritten
// _subs.result_vars->'session' expression to. The marker's sqlType (from
// introspection) is authoritative and effectively always set; an inline
// placeholderType (the ::type parsed from the $N placeholder) is a fallback,
// and "json" is the last resort because a json value casts cleanly to
// json/jsonb/text.
func functionSessionArgumentCast(sqlType, placeholderType string) string {
	if sqlType != "" {
		return sqlType
	}

	if placeholderType != "" {
		return placeholderType
	}

	return "json"
}

// buildMultiplexedSQL wraps innerSQL in the Hasura-style UNNEST-with-JSON
// envelope. The result can be executed with an array of subscription IDs and
// JSON result_vars.
//
// Structure:
//
//	SELECT "_subs"."result_id", "_fld_resp"."root" AS "result"
//	FROM UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars")
//	LEFT OUTER JOIN LATERAL (...inner query...) AS "_fld_resp" ON ('true')
func buildMultiplexedSQL(fieldName, innerSQL string) string {
	var sql strings.Builder

	sql.WriteString(`SELECT "_subs"."result_id", "_fld_resp"."root" AS "result" FROM `)
	sql.WriteString(`UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars") `)
	sql.WriteString(`LEFT OUTER JOIN LATERAL (SELECT json_build_object('`)
	sql.WriteString(fieldName)
	sql.WriteString(`', (`)

	sql.WriteString(innerSQL)

	sql.WriteString(`)) AS "root") AS "_fld_resp" ON ('true')`)

	return sql.String()
}

// PrepareParams prepares parameters for multiplexed query execution. The
// optional cursorValues map carries stream-subscription cursor state; pass nil
// for non-stream subscriptions.
//
// Parameters:
//   - subscriptionIDs: ordered list of subscription IDs
//   - sessionVarArrays: map of session var name -> array of values (one per subscription)
//   - cursorValues: map of cursor column name -> value (same for all subscribers initially), or nil
//
// Returns params ready for pgx.Query: [subIDs, resultVarsJSON]. Static GraphQL
// parameters from the source operation should be appended by the caller.
//
// Each subscriber's variables are packed into a JSON object:
//
//	{"session": {"x-hasura-user-id": "uuid-value"}, "cursor": {"id": "uuid-value"}}
func PrepareParams(
	subscriptionIDs []string,
	sessionVarArrays map[string][]any,
	cursorValues map[string]any,
) []any {
	const fixedParams = 2

	params := make([]any, 0, fixedParams)

	params = append(params, subscriptionIDs)

	resultVars := make([]string, len(subscriptionIDs))
	for i := range subscriptionIDs {
		resultVars[i] = buildResultVarsJSON(i, sessionVarArrays, cursorValues)
	}

	params = append(params, resultVars)

	return params
}

// buildResultVarsJSON builds the JSON object for a single subscriber's
// session variables and (optional) cursor values.
// Format: {"session": {...}, "cursor": {...}}.
func buildResultVarsJSON(
	subscriberIndex int,
	sessionVarArrays map[string][]any,
	cursorValues map[string]any,
) string {
	var sb strings.Builder

	sb.WriteString(`{`)
	sb.WriteString(`"session":{`)
	writeSessionVarsJSON(&sb, subscriberIndex, sessionVarArrays)
	sb.WriteString(`}`)

	if len(cursorValues) > 0 {
		sb.WriteString(`,"cursor":{`)
		writeCursorVarsJSON(&sb, cursorValues)
		sb.WriteString(`}`)
	}

	sb.WriteString(`}`)

	return sb.String()
}

// writeSessionVarsJSON writes session variable key-value pairs as JSON into the builder.
//
// Keys (varName) originate from HTTP X-Hasura-* request headers
// (controller/middleware/session.go) or from JWT claim names declared in
// metadata, neither of which is permitted to contain `"` or `\` by the
// surrounding contract. As a belt-and-braces guard against an upstream
// regression we fall back to json.Marshal for any key that contains those
// characters; everything else is written raw to avoid an allocation per key
// in the multiplex poll path. Values still go through json.Marshal to handle
// escaping correctly.
func writeSessionVarsJSON(
	sb *strings.Builder,
	subscriberIndex int,
	sessionVarArrays map[string][]any,
) {
	first := true

	for varName, arr := range sessionVarArrays {
		if !first {
			sb.WriteString(",")
		}

		first = false

		writeJSONKey(sb, varName)

		if subscriberIndex >= len(arr) {
			sb.WriteString("null")

			continue
		}

		val := arr[subscriberIndex]

		valStr := fmt.Sprintf("%v", val)

		// json.Marshal of a string fails only on invalid UTF-8. Falling back to
		// "null" preserves well-formed JSON; the downstream effect is the same
		// as the upstream "subscriberIndex >= len(arr)" branch above (missing
		// permission), which is the safe default for malformed input.
		jsonVal, err := json.Marshal(valStr)
		if err != nil {
			sb.WriteString("null")

			continue
		}

		sb.Write(jsonVal)
	}
}

// writeCursorVarsJSON writes cursor value key-value pairs as JSON into the builder.
//
// Keys (colName) originate from introspected SQL column names — which the
// surrounding contract forbids from containing `"` or `\` — and we fall back
// to json.Marshal via writeJSONKey for any key that violates that contract.
//
// Values are routed through json.Marshal so that numeric, time.Time and
// string cursor values all serialise to their natural JSON form. The inner
// SQL relies on the `#>>` text-extraction operator and casts the result, so
// the receiver tolerates either quoted or unquoted scalars — but routing
// through json.Marshal removes the silent assumption that callers only ever
// hand us strings, and produces well-formed JSON when a value's %v rendering
// would otherwise embed `"` or be unparseable (e.g. time.Time's default
// rendering is not RFC3339).
func writeCursorVarsJSON(sb *strings.Builder, cursorValues map[string]any) {
	first := true

	for colName, val := range cursorValues {
		if !first {
			sb.WriteString(",")
		}

		first = false

		writeJSONKey(sb, colName)

		if val == nil {
			sb.WriteString("null")

			continue
		}

		// json.Marshal can fail for unsupported types (channels, funcs,
		// recursive structures); production cursor values are scalars from a
		// prior SQL row so this is defensive. Emit "null" rather than malformed
		// JSON so the downstream `#>>` extraction returns NULL deterministically.
		jsonVal, err := json.Marshal(val)
		if err != nil {
			sb.WriteString("null")

			continue
		}

		sb.Write(jsonVal)
	}
}

// writeJSONKey writes name as a JSON object key followed by ':'. Names are
// expected to come from controlled sources (HTTP X-Hasura-* headers, JWT
// claim configuration, or introspected SQL column names) and are written raw
// for performance. Anything that JSON forbids in a raw string — `"`, `\`,
// control bytes (< 0x20), or invalid UTF-8 — falls back to json.Marshal as a
// defensive guard against an upstream regression. The fallback also runs if
// Marshal itself fails, in which case we emit a sentinel "\"\"" key to keep
// the surrounding object well-formed.
func writeJSONKey(sb *strings.Builder, name string) {
	if needsJSONStringEscape(name) {
		jsonKey, err := json.Marshal(name)
		if err == nil {
			sb.Write(jsonKey)
			sb.WriteString(`:`)

			return
		}

		sb.WriteString(`"":`)

		return
	}

	sb.WriteString(`"`)
	sb.WriteString(name)
	sb.WriteString(`":`)
}

// needsJSONStringEscape reports whether s contains any byte that JSON forbids
// in a raw string literal: the two structural characters (`"`, `\`), any
// control byte below 0x20, or any byte outside ASCII that would require
// UTF-8 validation. The conservative cutoff (any byte >= 0x80) routes all
// non-ASCII through json.Marshal so invalid UTF-8 cannot reach the wire.
func needsJSONStringEscape(s string) bool {
	for i := range len(s) {
		c := s[i]
		if c < 0x20 || c == '"' || c == '\\' || c >= 0x80 {
			return true
		}
	}

	return false
}

// ExtractInitialCursorValues extracts the initial cursor values from StreamCursors metadata.
// Returns a map of column name -> initial value, suitable for PrepareParams.
func ExtractInitialCursorValues(cursors []core.StreamCursorInfo) map[string]any {
	if len(cursors) == 0 {
		return nil
	}

	result := make(map[string]any, len(cursors))
	for _, cursor := range cursors {
		result[cursor.ColumnName] = cursor.InitialValue
	}

	return result
}
