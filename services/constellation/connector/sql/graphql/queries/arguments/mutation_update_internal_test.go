package arguments

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

func TestUpdate_WriteSQL_SetAndInc(t *testing.T) {
	t.Parallel()

	col := func(name, sqlType string) *core.Column {
		return &core.Column{
			SQLName:     name,
			GraphqlName: name,
			SQLType:     sqlType,
			IsArray:     false,
			IsGenerated: false,
		}
	}

	u := Update{
		Set:          []updateColumn{{Column: col("name", "text"), Value: "Alice"}},
		Inc:          []updateColumn{{Column: col("age", "int"), Value: 1}},
		AppendJSONB:  nil,
		PrependJSONB: nil,
		DeleteKey:    nil,
		DeleteElem:   nil,
		DeleteAtPath: nil,
		Where:        nil,
	}

	var b strings.Builder

	params, idx := u.WriteSQL(&b, nil, 1, &dialect.PostgresDialect{})

	const want = `"name" = $1::text, "age" = "age" + $2::int`
	if b.String() != want {
		t.Errorf("got=%q want=%q", b.String(), want)
	}

	if len(params) != 2 || params[0] != "Alice" || params[1] != 1 {
		t.Errorf("params=%v", params)
	}

	if idx != 3 {
		t.Errorf("idx=%d want=3", idx)
	}
}

func TestUpdate_WriteSQL_JSONBOps(t *testing.T) {
	t.Parallel()

	col := func(name, sqlType string) *core.Column {
		return &core.Column{
			SQLName:     name,
			GraphqlName: name,
			SQLType:     sqlType,
			IsArray:     false,
			IsGenerated: false,
		}
	}

	u := Update{
		Set:          nil,
		Inc:          nil,
		AppendJSONB:  []updateColumn{{Column: col("data", "jsonb"), Value: `{}`}},
		PrependJSONB: []updateColumn{{Column: col("data", "jsonb"), Value: `{}`}},
		DeleteKey:    []updateColumn{{Column: col("data", "jsonb"), Value: "k"}},
		DeleteElem:   []updateColumn{{Column: col("data", "jsonb"), Value: 0}},
		DeleteAtPath: []updateDeleteAtPath{
			{Column: col("data", "jsonb"), Path: []string{"a", "b"}},
		},
		Where: nil,
	}

	var b strings.Builder

	_, _ = u.WriteSQL(&b, nil, 1, &dialect.PostgresDialect{})

	sql := b.String()
	for _, want := range []string{
		`"data" = "data" || $1::jsonb`,  // append
		`"data" = $2::jsonb || "data"`,  // prepend
		`"data" = "data" - $3`,          // delete key
		`"data" = "data" - $4::int`,     // delete elem
		`"data" = "data" #- $5::text[]`, // delete at path
	} {
		if !strings.Contains(sql, want) {
			t.Errorf("missing fragment %q in %q", want, sql)
		}
	}
}
