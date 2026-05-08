package clidocs

import (
	"encoding/json"
	"reflect"
	"time"

	"github.com/urfave/cli/v3"
)

type CmdJSON struct {
	Name        string      `json:"name"`
	Aliases     []string    `json:"aliases,omitempty"`
	Usage       string      `json:"usage,omitempty"`
	UsageText   string      `json:"usageText,omitempty"`
	Description string      `json:"description,omitempty"`
	Category    string      `json:"category,omitempty"`
	Agent       *AgentHints `json:"agent,omitempty"`
	Flags       []FlagJSON  `json:"flags,omitempty"`
	Args        []ArgJSON   `json:"args,omitempty"`
	Commands    []CmdJSON   `json:"commands,omitempty"`
}

type FlagJSON struct {
	Name        string   `json:"name"`
	Aliases     []string `json:"aliases,omitempty"`
	Usage       string   `json:"usage,omitempty"`
	Type        string   `json:"type"`
	ItemType    string   `json:"itemType,omitempty"`
	Default     any      `json:"default,omitempty"`
	DefaultText string   `json:"defaultText,omitempty"`
	EnvVars     []string `json:"envVars,omitempty"`
	Required    bool     `json:"required,omitempty"`
	TakesValue  bool     `json:"takesValue"`
	TakesFile   bool     `json:"takesFile,omitempty"`
}

type ArgJSON struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	ItemType  string `json:"itemType,omitempty"`
	UsageText string `json:"usageText,omitempty"`
	Min       int    `json:"min,omitempty"`
	Max       int    `json:"max,omitempty"`
	Default   any    `json:"default,omitempty"`
}

func ToJSON(cmd *cli.Command) ([]byte, error) {
	out := buildCmd(cmd)
	return json.MarshalIndent(out, "", "  ")
}

func buildCmd(cmd *cli.Command) CmdJSON {
	out := CmdJSON{
		Name:        cmd.Name,
		Aliases:     cmd.Aliases,
		Usage:       cmd.Usage,
		UsageText:   cmd.UsageText,
		Description: cmd.Description,
		Category:    cmd.Category,
		Agent:       extractAgentHints(cmd),
	}

	for _, f := range cmd.VisibleFlags() {
		df, ok := f.(cli.DocGenerationFlag)
		if !ok {
			continue
		}
		names := f.Names()
		fj := FlagJSON{
			Name:        names[0],
			Usage:       df.GetUsage(),
			DefaultText: df.GetDefaultText(),
			EnvVars:     df.GetEnvVars(),
			TakesValue:  df.TakesValue(),
		}
		if len(names) > 1 {
			fj.Aliases = names[1:]
		}
		fillFlagMeta(f, &fj)
		fj.Type, fj.ItemType, fj.Default = inspectValueField(f)
		out.Flags = append(out.Flags, fj)
	}

	for _, a := range cmd.Arguments {
		out.Args = append(out.Args, buildArg(a))
	}

	for _, sub := range cmd.Commands {
		if sub.Hidden {
			continue
		}
		out.Commands = append(out.Commands, buildCmd(sub))
	}

	return out
}

func buildArg(a cli.Argument) ArgJSON {
	aj := ArgJSON{
		UsageText: a.Usage(),
	}
	v := reflect.ValueOf(a)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() == reflect.Struct {
		if name := v.FieldByName("Name"); name.IsValid() && name.Kind() == reflect.String {
			aj.Name = name.String()
		}
		if mn := v.FieldByName("Min"); mn.IsValid() && mn.CanInt() {
			aj.Min = int(mn.Int())
		}
		if mx := v.FieldByName("Max"); mx.IsValid() && mx.CanInt() {
			aj.Max = int(mx.Int())
		}
	}
	aj.Type, aj.ItemType, aj.Default = inspectValueField(a)
	return aj
}

func fillFlagMeta(f cli.Flag, fj *FlagJSON) {
	v := reflect.ValueOf(f)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return
	}
	if r := v.FieldByName("Required"); r.IsValid() && r.Kind() == reflect.Bool {
		fj.Required = r.Bool()
	}
	if tf := v.FieldByName("TakesFile"); tf.IsValid() && tf.Kind() == reflect.Bool {
		fj.TakesFile = tf.Bool()
	}
}

func inspectValueField(x any) (jsonType, itemType string, def any) {
	v := reflect.ValueOf(x)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return "string", "", nil
	}
	val := v.FieldByName("Value")
	if !val.IsValid() {
		return "string", "", nil
	}
	t, item := schemaType(val.Type())

	var d any
	if val.IsValid() && val.CanInterface() {
		iv := val.Interface()
		if !reflect.DeepEqual(iv, reflect.Zero(val.Type()).Interface()) {
			d = normalizeDefault(iv)
		}
	}
	return t, item, d
}

func schemaType(t reflect.Type) (string, string) {
	if t == reflect.TypeOf(time.Duration(0)) {
		return "duration", ""
	}
	if t == reflect.TypeOf(time.Time{}) {
		return "timestamp", ""
	}
	switch t.Kind() {
	case reflect.Bool:
		return "boolean", ""
	case reflect.String:
		return "string", ""
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "integer", ""
	case reflect.Float32, reflect.Float64:
		return "number", ""
	case reflect.Slice, reflect.Array:
		inner, _ := schemaType(t.Elem())
		return "array", inner
	case reflect.Map:
		return "object", ""
	default:
		return "string", ""
	}
}

func normalizeDefault(v any) any {
	switch x := v.(type) {
	case time.Duration:
		return x.String()
	case time.Time:
		return x.Format(time.RFC3339)
	default:
		return v
	}
}
