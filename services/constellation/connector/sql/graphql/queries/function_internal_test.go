package queries

import (
	"errors"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// TestBuildFunctionFromClauseEscapesAlias guards against second-order SQL
// injection via a DDL-named function: the derived alias `_fn_<functionName>`
// must double any embedded double quote in both the AS alias and sourceRef so
// the identifier cannot break out of its quoted context.
func TestBuildFunctionFromClauseEscapesAlias(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		functionName   string
		wantSourceRef  string
		wantAliasInSQL string
	}{
		{
			name:           "plain function name",
			functionName:   "get_users",
			wantSourceRef:  `"_fn_get_users"`,
			wantAliasInSQL: `AS "_fn_get_users"`,
		},
		{
			name:           "function name with embedded double quote",
			functionName:   `x") FROM secret;--`,
			wantSourceRef:  `"_fn_x"") FROM secret;--"`,
			wantAliasInSQL: `AS "_fn_x"") FROM secret;--"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			f := newFunction("public", tt.functionName, dialect.NewPostgresDialect())

			result, err := f.buildFunctionFromClause(
				map[string]any{},
				map[string]any{},
				nil,
				1,
			)
			if err != nil {
				t.Fatalf("buildFunctionFromClause returned error: %v", err)
			}

			if result.sourceRef != tt.wantSourceRef {
				t.Errorf("sourceRef = %q, want %q", result.sourceRef, tt.wantSourceRef)
			}

			if !strings.Contains(result.fromClause, tt.wantAliasInSQL) {
				t.Errorf("fromClause = %q, want it to contain %q",
					result.fromClause, tt.wantAliasInSQL)
			}
		})
	}
}

// TestBuildFunctionFromClauseArguments locks in the hybrid PostgreSQL argument
// writer. The notation for each supplied argument is chosen with look-ahead
// against the last supplied *unnamed* argument: arguments at or before it are
// emitted positionally (`$N`) -- even named-capable ones, since PostgreSQL lets
// a named argument be passed positionally and the trailing unnamed argument can
// only bind positionally -- while arguments after it are emitted by name
// (`"argname" := $N`), which keeps binding correct across omitted middle/later
// defaults. Omitted defaulted arguments are dropped entirely (so PostgreSQL
// applies their declared defaults) -- the SQL DEFAULT keyword is invalid in a
// function call and must never be emitted. The only un-callable shape -- and
// thus the only error short of a missing required argument -- is a defaulted
// argument omitted before a later supplied unnamed argument: that leaves an
// unfillable gap in the positional region.
type buildFunctionFromClauseTestCase struct {
	name            string
	functionName    string
	arguments       []*functionArgument
	sessionArgument string
	argsMap         map[string]any
	sessionVars     map[string]any
	wantCall        string
	wantParams      []any
	wantErr         error
	wantErrContains string
}

func TestBuildFunctionFromClauseArguments(t *testing.T) {
	t.Parallel()

	tests := []buildFunctionFromClauseTestCase{
		{
			name: "required arg supplied",
			arguments: []*functionArgument{
				namedFunctionArgument("search", "text", false),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"search": "hello"},
			sessionVars:     nil,
			wantCall:        `"public"."search_news_default"("search" := $1)`,
			wantParams:      []any{"hello"},
			wantErr:         nil,
		},
		{
			name: "trailing default omitted",
			arguments: []*functionArgument{
				namedFunctionArgument("search", "text", false),
				namedFunctionArgument("max_len", "int4", true),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"search": "hello"},
			sessionVars:     nil,
			wantCall:        `"public"."search_news_default"("search" := $1)`,
			wantParams:      []any{"hello"},
			wantErr:         nil,
		},
		{
			name:         "all defaults omitted emits empty call",
			functionName: "all_defaults",
			arguments: []*functionArgument{
				namedFunctionArgument("search", "text", true),
				positionalFunctionArgument("arg_2", "int4", true),
			},
			sessionArgument: "",
			argsMap:         map[string]any{},
			sessionVars:     nil,
			wantCall:        `"public"."all_defaults"()`,
			wantParams:      nil,
			wantErr:         nil,
		},
		{
			name: "trailing default supplied",
			arguments: []*functionArgument{
				namedFunctionArgument("search", "text", false),
				namedFunctionArgument("max_len", "int4", true),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"search": "hello", "max_len": int64(50)},
			sessionVars:     nil,
			wantCall:        `"public"."search_news_default"("search" := $1, "max_len" := $2)`,
			wantParams:      []any{"hello", int64(50)},
			wantErr:         nil,
		},
		{
			// earlier default omitted, later default supplied: the value must
			// bind to "c" via its name, not slide into "b"'s positional slot.
			name:         "earlier default omitted, later default supplied",
			functionName: "f3",
			arguments: []*functionArgument{
				namedFunctionArgument("a", "int4", false),
				namedFunctionArgument("b", "int4", true),
				namedFunctionArgument("c", "int4", true),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"a": int64(1), "c": int64(3)},
			sessionVars:     nil,
			wantCall:        `"public"."f3"("a" := $1, "c" := $2)`,
			wantParams:      []any{int64(1), int64(3)},
			wantErr:         nil,
		},
		{
			// session argument sits before a defaulted argument that is
			// omitted; the session JSON must still bind, the default dropped.
			name:         "session arg with omitted trailing default",
			functionName: "f_session",
			arguments: []*functionArgument{
				namedFunctionArgument("search", "text", false),
				namedFunctionArgument("session", "json", false),
				namedFunctionArgument("max_len", "int4", true),
			},
			sessionArgument: "session",
			argsMap:         map[string]any{"search": "hello"},
			sessionVars:     map[string]any{"x-hasura-user-id": "u1"},
			wantCall: `"public"."f_session"("search" := $1, ` +
				`"session" := $2)`,
			wantParams: []any{"hello", `{"x-hasura-user-id":"u1"}`},
			wantErr:    nil,
		},
		{
			// session argument is positional-only. The session JSON must extend
			// the positional region instead of being emitted as an empty quoted
			// SQL argument name.
			name:         "positional-only session arg supplied",
			functionName: "unnamed_session",
			arguments: []*functionArgument{
				positionalFunctionArgument("arg_1", "text", false),
				positionalFunctionArgument("arg_2", "json", false),
			},
			sessionArgument: "arg_2",
			argsMap:         map[string]any{"arg_1": "hello"},
			sessionVars:     map[string]any{"x-hasura-user-id": "u1"},
			wantCall:        `"public"."unnamed_session"($1, $2)`,
			wantParams:      []any{"hello", `{"x-hasura-user-id":"u1"}`},
			wantErr:         nil,
		},
		{
			// Mixed signature: the leading argument is unnamed-but-required, a
			// later defaulted argument carries a SQL name. The unnamed arg binds
			// positionally; the named arg binds by name. PostgreSQL accepts a
			// positional argument followed by a named one.
			name:         "mixed leading unnamed required and trailing named default supplied",
			functionName: "mixed_f",
			arguments: []*functionArgument{
				positionalFunctionArgument("arg_1", "text", false),
				namedFunctionArgument("max_len", "int4", true),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"arg_1": "hello", "max_len": int64(50)},
			sessionVars:     nil,
			wantCall:        `"public"."mixed_f"($1, "max_len" := $2)`,
			wantParams:      []any{"hello", int64(50)},
			wantErr:         nil,
		},
		{
			// Mixed signature where a named defaulted argument in the middle is
			// omitted and a later named argument is supplied. The leading unnamed
			// arg binds positionally; the later named arg binds by name across the
			// omitted default -- the exact call shape the all-positional writer
			// used to reject.
			name:         "mixed leading unnamed required, middle named default omitted, later named supplied",
			functionName: "mixed_f3",
			arguments: []*functionArgument{
				positionalFunctionArgument("arg_1", "text", false),
				namedFunctionArgument("max_len", "int4", true),
				namedFunctionArgument("offset", "int4", true),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"arg_1": "hello", "offset": int64(3)},
			sessionVars:     nil,
			wantCall:        `"public"."mixed_f3"($1, "offset" := $2)`,
			wantParams:      []any{"hello", int64(3)},
			wantErr:         nil,
		},
		{
			// Mirror of the leading-unnamed shape: a NAMED argument precedes an
			// UNNAMED one, both required and both supplied (PostgreSQL calls this
			// f(1, "hello")). The unnamed trailing arg can only bind positionally,
			// so the named arg ahead of it must also be emitted positionally --
			// PostgreSQL accepts passing a named-capable argument positionally.
			// This is the regression the per-arg writer introduced; it must now
			// emit ($1, $2) with no error.
			name:         "mixed named arg then later unnamed supplied",
			functionName: "mixed_named_then_unnamed",
			arguments: []*functionArgument{
				namedFunctionArgument("limit", "int4", false),
				positionalFunctionArgument("arg_2", "text", false),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"limit": int64(1), "arg_2": "hello"},
			sessionVars:     nil,
			wantCall:        `"public"."mixed_named_then_unnamed"($1, $2)`,
			wantParams:      []any{int64(1), "hello"},
			wantErr:         nil,
		},
		{
			// Mirror error shape: a NAMED defaulted middle argument is omitted
			// while a LATER UNNAMED argument is supplied. The unnamed arg forces
			// the positional region to extend across the omitted slot, but the
			// positional region cannot skip a gap and the unnamed arg cannot be
			// named to escape it -- genuinely un-callable.
			name:         "mixed named default omitted before later unnamed supplied errors",
			functionName: "mixed_gap",
			arguments: []*functionArgument{
				positionalFunctionArgument("arg_1", "int4", false),
				namedFunctionArgument("max_len", "int4", true),
				positionalFunctionArgument("arg_3", "text", false),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"arg_1": int64(1), "arg_3": "hello"},
			sessionVars:     nil,
			wantCall:        "",
			wantParams:      nil,
			wantErrContains: "cannot omit a defaulted function argument",
		},
		{
			// Unnamed PostgreSQL arguments are exposed to GraphQL under generated
			// names, but those generated names are not valid SQL argument names.
			// Keep all-supplied positional-only calls positional.
			name:         "positional-only required args supplied",
			functionName: "unnamed_args",
			arguments: []*functionArgument{
				positionalFunctionArgument("arg_1", "int4", false),
				positionalFunctionArgument("arg_2", "text", false),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"arg_1": int64(1), "arg_2": "hello"},
			sessionVars:     nil,
			wantCall:        `"public"."unnamed_args"($1, $2)`,
			wantParams:      []any{int64(1), "hello"},
			wantErr:         nil,
		},
		{
			name:         "positional-only trailing default omitted",
			functionName: "unnamed_default",
			arguments: []*functionArgument{
				positionalFunctionArgument("arg_1", "int4", false),
				positionalFunctionArgument("arg_2", "int4", true),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"arg_1": int64(1)},
			sessionVars:     nil,
			wantCall:        `"public"."unnamed_default"($1)`,
			wantParams:      []any{int64(1)},
			wantErr:         nil,
		},
		{
			// arg_2 (unnamed, defaulted) is omitted, but the later supplied arg_3
			// is unnamed and forces the positional region to extend across the
			// omitted slot. The positional region cannot skip the gap and arg_3
			// cannot be named to escape it. Genuinely un-callable.
			name:         "positional-only earlier default omitted later supplied errors",
			functionName: "unnamed_f3",
			arguments: []*functionArgument{
				positionalFunctionArgument("arg_1", "int4", false),
				positionalFunctionArgument("arg_2", "int4", true),
				positionalFunctionArgument("arg_3", "int4", true),
			},
			sessionArgument: "",
			argsMap:         map[string]any{"arg_1": int64(1), "arg_3": int64(3)},
			sessionVars:     nil,
			wantCall:        "",
			wantParams:      nil,
			wantErrContains: "cannot omit a defaulted function argument",
		},
		{
			name: "required arg omitted errors",
			arguments: []*functionArgument{
				namedFunctionArgument("search", "text", false),
				namedFunctionArgument("max_len", "int4", true),
			},
			sessionArgument: "",
			argsMap:         map[string]any{},
			sessionVars:     nil,
			wantCall:        "",
			wantParams:      nil,
			wantErr:         errMissingRequiredFunctionArgument,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			runBuildFunctionFromClauseTest(t, tt)
		})
	}
}

func runBuildFunctionFromClauseTest(t *testing.T, tt buildFunctionFromClauseTestCase) {
	t.Helper()

	fnName := tt.functionName
	if fnName == "" {
		fnName = "search_news_default"
	}

	f := newFunction("public", fnName, dialect.NewPostgresDialect())
	f.arguments = tt.arguments
	f.sessionArgument = tt.sessionArgument

	result, err := f.buildFunctionFromClause(
		tt.argsMap, tt.sessionVars, nil, 1,
	)
	if tt.wantErr != nil {
		if !errors.Is(err, tt.wantErr) {
			t.Fatalf("expected error %v, got %v", tt.wantErr, err)
		}

		return
	}

	if tt.wantErrContains != "" {
		if err == nil || !strings.Contains(err.Error(), tt.wantErrContains) {
			t.Fatalf("expected error containing %q, got %v", tt.wantErrContains, err)
		}

		return
	}

	if err != nil {
		t.Fatalf("buildFunctionFromClause returned error: %v", err)
	}

	if strings.Contains(result.fromClause, "DEFAULT") {
		t.Errorf("fromClause must not contain the DEFAULT keyword: %q", result.fromClause)
	}

	wantFrom := tt.wantCall + ` AS "_fn_` + fnName + `"`
	if result.fromClause != wantFrom {
		t.Errorf("fromClause = %q, want %q", result.fromClause, wantFrom)
	}

	if len(result.params) != len(tt.wantParams) {
		t.Fatalf("params = %#v, want %#v", result.params, tt.wantParams)
	}

	for i := range tt.wantParams {
		if result.params[i] != tt.wantParams[i] {
			t.Errorf("params[%d] = %#v, want %#v",
				i, result.params[i], tt.wantParams[i])
		}
	}
}

func namedFunctionArgument(name, sqlType string, hasDefault bool) *functionArgument {
	return &functionArgument{
		Name:       name,
		SQLName:    name,
		SQLType:    sqlType,
		HasDefault: hasDefault,
	}
}

func positionalFunctionArgument(name, sqlType string, hasDefault bool) *functionArgument {
	return &functionArgument{
		Name:       name,
		SQLName:    "",
		SQLType:    sqlType,
		HasDefault: hasDefault,
	}
}
