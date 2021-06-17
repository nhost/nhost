package hasura

import (
	"bytes"
	"fmt"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/mrinalwahal/cli/nhost"
)

type migrateCreateOptions struct {
	name string
	// Flags
	fromServer     bool
	sqlFile        string
	sqlServer      bool
	metaDataFile   string
	metaDataServer bool
	schemaNames    []string
	upSQL          string
	downSQL        string
}

type Migration struct {
	Name      string
	Version   int64
	SQLFile   string
	SQLServer bool
	Location  string
	Data      []byte
}

func (m *Migration) Init() Migration {

	var response Migration
	response.Version = getTime()
	response.Location = path.Join(nhost.MIGRATIONS_DIR, fmt.Sprintf("%v_%v", response.Version, m.Name))

	return response
}

func getTime() int64 {
	startTime := time.Now()
	return startTime.UnixNano() / int64(time.Millisecond)
}

func (m *Migration) Format(data string) string {

	var buffer bytes.Buffer

	// write a custom constraint creation function to SQL
	// explain the reason...
	customConstraintFunc := `CREATE OR REPLACE FUNCTION create_constraint_if_not_exists (t_name text, c_name text, constraint_sql text)
RETURNS void
AS
$BODY$
	BEGIN
	-- Look for our constraint
	IF NOT EXISTS (SELECT constraint_name
					FROM information_schema.constraint_column_usage
					WHERE constraint_name = c_name) THEN
		EXECUTE 'ALTER TABLE ' || t_name || ' ADD CONSTRAINT ' || c_name || ' ' || constraint_sql;
	END IF;
	END;
$BODY$
LANGUAGE plpgsql VOLATILE;

`

	buffer.WriteString(customConstraintFunc)

	// search and replace ADD Constraints for all schemas

	// Compile the expression once, usually at init time.
	// Use raw strings to avoid having to quote the backslashes.

	expression := regexp.MustCompile(`ALTER TABLE ONLY (["'\w.]*)([\s]*) ADD CONSTRAINT (["'\w]*) ([\w \(\);]*)`)
	replacement := "SELECT create_constraint_if_not_exists('%v', '%v', '%v');"

	results := expression.FindAllStringSubmatch(data, -1)

	for _, result := range results {

		var values []interface{}

		for _, index := range []int{1, 3, 4} {
			values = append(values, result[index])
		}

		data = strings.ReplaceAll(data, result[0], fmt.Sprintf(replacement, values...))
	}

	// repeat the procedure to replace triggers

	expression = regexp.MustCompile(`CREATE TRIGGER ([\w]*) BEFORE UPDATE ON ([\w.]*) FOR EACH ROW EXECUTE FUNCTION ([\w.\(\);]*)`)
	replacement = `DROP TRIGGER IF EXISTS %v ON %v;
CREATE TRIGGER %v BEFORE UPDATE ON %v FOR EACH ROW EXECUTE FUNCTION %v
`

	results = expression.FindAllStringSubmatch(data, -1)

	for _, result := range results {

		var values []interface{}

		for _, index := range []int{1, 2, 1, 2, 3} {
			values = append(values, result[index])
		}

		data = strings.ReplaceAll(data, result[0], fmt.Sprintf(replacement, values...))
	}

	/*
		// repeat the same for removing stdin
		expression = regexp.MustCompile(`COPY ([\w.]*) ([(\w_,.) ]*) FROM stdin;([^\n]*\n+)..+`)
		replacement = ""

		results = expression.FindAllStringSubmatch(data, -1)

		for _, result := range results {

			var values []interface{}

			data = strings.ReplaceAll(data, result[0], fmt.Sprintf(replacement, values...))
		}
	*/

	// before applying migrations
	// replace all existing function calls inside migration
	// from "CREATE FUNCTION" to "CREATE OR REPLACE FUNCTION"
	// explan the reason behind this...

	data = strings.ReplaceAll(data, "CREATE FUNCTION", "CREATE OR REPLACE FUNCTION")

	// repeat the same search and replace
	// for "CREATE TABLE" by appending "IF NOT EXISTS" to it
	// explan the reason behind this...

	data = strings.ReplaceAll(data, "CREATE TABLE", "CREATE TABLE IF NOT EXISTS")

	// repeat the same for SCHEMAS
	data = strings.ReplaceAll(data, "CREATE SCHEMA", "CREATE SCHEMA IF NOT EXISTS")
	buffer.WriteString(data)

	return buffer.String()
}

func (m *Migration) AddExtensions(extensions []string) []byte {

	var buffer bytes.Buffer

	for index, extension := range extensions {
		extensions[index] = fmt.Sprintf(`CREATE EXTENSION IF NOT EXISTS %s;`, extension)
	}

	extensionsWriteToFile := strings.Join(extensions, "\n")

	// add an additional line break to efficiently shift the buffer
	extensionsWriteToFile += "\n"

	// write extensions to beginning of SQL file of init migration
	buffer.WriteString(extensionsWriteToFile)

	buffer.Write(m.Data)

	return buffer.Bytes()
}
