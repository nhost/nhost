package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"
)

func toolGetSQLSchema(connStr string) toolFn {
	return func(ctx context.Context, arguments string, logger *slog.Logger) string {
		args := struct { //nolint:exhaustruct
			Schema string `json:"schema"`
			Table  string `json:"table"`
		}{}
		if err := json.Unmarshal([]byte(arguments), &args); err != nil {
			logger.ErrorContext(
				ctx,
				"failed to decode arguments",
				slog.String("error", err.Error()),
			)

			return "Failed to decode arguments. Expecting a JSON object with a schema and table property."
		}

		sch, err := getSchema(ctx, connStr, fmt.Sprintf("%s.%s", args.Schema, args.Table))
		if err != nil {
			logger.ErrorContext(ctx, "failed to get schema", slog.String("error", err.Error()))
			return fmt.Sprintf("failed to get schema: %s", err)
		}

		return sch
	}
}

func listSQLTables(connStr string) toolFn {
	return func(ctx context.Context, _ string, _ *slog.Logger) string {
		res, err := execCmd(
			ctx, "psql", connStr, "-c", `SELECT table_schema || '.' || table_name AS schema_table
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema', 'hdb_catalog');`,
		)
		if err != nil {
			return fmt.Sprintf("failed to get tables: %s", err)
		}

		return res
	}
}

func execCmd(ctx context.Context, command string, args ...string) (string, error) {
	out := &bytes.Buffer{}
	errOut := &bytes.Buffer{}

	cmd := exec.CommandContext(ctx, command, args...)
	cmd.Stdout = out
	cmd.Stderr = errOut

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("error running command: %w\n%s", err, errOut.String())
	}

	return out.String(), nil
}

func getSchema(ctx context.Context, connStr string, table string) (string, error) {
	out := &bytes.Buffer{}
	errOut := &bytes.Buffer{}

	cmd := exec.CommandContext(
		ctx,
		"pg_dump",
		"--table",
		table,
		"--schema-only",
		connStr,
	)
	cmd.Stdout = out
	cmd.Stderr = errOut

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("error running command: %w\n%s", err, errOut.String())
	}

	outWithoutComments := &bytes.Buffer{}
	for line := range bytes.SplitSeq(out.Bytes(), []byte("\n")) {
		if len(line) > 0 && line[0] != '-' {
			outWithoutComments.Write(line)
			outWithoutComments.WriteByte('\n')
		}
	}

	return outWithoutComments.String(), nil
}
