// Package clidocs generates markdown documentation for urfave/cli commands.
// It is a fork of github.com/urfave/cli-docs/v3 that respects DefaultText
// for flags, ensuring generated documentation is deterministic regardless
// of the environment.
package clidocs

import (
	"bytes"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"text/template"

	"github.com/urfave/cli/v3"
)

const markdownDocTemplate = `{{if gt .SectionNum 0}}% {{ .Command.Name }} {{ .SectionNum }}

{{end}}# NAME

{{ .Command.Name }}{{ if .Command.Usage }} - {{ .Command.Usage }}{{ end }}

# SYNOPSIS

{{ .Command.Name }}
{{ if .SynopsisArgs }}
` + "```" + `
{{ range $v := .SynopsisArgs }}{{ $v }}{{ end }}` + "```" + `
{{ end }}{{ if .Command.Description }}
# DESCRIPTION

{{ .Command.Description }}
{{ end }}
**Usage**:

` + "```" + `{{ if .Command.UsageText }}
{{ .Command.UsageText }}
{{ else }}
{{ .Command.Name }} [GLOBAL OPTIONS] [command [COMMAND OPTIONS]] [ARGUMENTS...]
{{ end }}` + "```" + `
{{ if .GlobalArgs }}
# GLOBAL OPTIONS
{{ range $v := .GlobalArgs }}
{{ $v }}{{ end }}
{{ end }}{{ if .Commands }}
# COMMANDS
{{ range $v := .Commands }}
{{ $v }}{{ end }}{{ end -}}
`

type cliCommandTemplate struct {
	Command      *cli.Command
	SectionNum   int
	Commands     []string
	GlobalArgs   []string
	SynopsisArgs []string
}

// ToMarkdown creates a markdown string for the *cli.Command.
func ToMarkdown(cmd *cli.Command) (string, error) {
	var w bytes.Buffer
	if err := writeDocTemplate(cmd, &w); err != nil {
		return "", err
	}
	return w.String(), nil
}

func writeDocTemplate(cmd *cli.Command, w *bytes.Buffer) error {
	const name = "cli"
	t, err := template.New(name).Parse(markdownDocTemplate)
	if err != nil {
		return err
	}

	return t.ExecuteTemplate(w, name, &cliCommandTemplate{
		Command:      cmd,
		SectionNum:   0,
		Commands:     prepareCommands(cmd.Commands, 0),
		GlobalArgs:   prepareArgsWithValues(cmd.VisibleFlags()),
		SynopsisArgs: prepareArgsSynopsis(cmd.VisibleFlags()),
	})
}

func prepareCommands(commands []*cli.Command, level int) []string {
	var coms []string
	for _, command := range commands {
		if command.Hidden {
			continue
		}

		usageText := prepareUsageText(command)
		usage := prepareUsage(command, usageText)

		prepared := fmt.Sprintf("%s %s\n\n%s%s",
			strings.Repeat("#", level+2),
			strings.Join(command.Names(), ", "),
			usage,
			usageText,
		)

		flags := prepareArgsWithValues(command.VisibleFlags())
		if len(flags) > 0 {
			prepared += fmt.Sprintf("\n%s", strings.Join(flags, "\n"))
		}

		coms = append(coms, prepared)

		if len(command.Commands) > 0 {
			coms = append(
				coms,
				prepareCommands(command.Commands, level+1)...,
			)
		}
	}

	return coms
}

func prepareArgsWithValues(flags []cli.Flag) []string {
	return prepareFlags(flags, ", ", "**", "**", `""`, true)
}

func prepareArgsSynopsis(flags []cli.Flag) []string {
	return prepareFlags(flags, "|", "[", "]", "[value]", false)
}

func prepareFlags(
	flags []cli.Flag,
	sep, opener, closer, value string,
	addDetails bool,
) []string {
	args := []string{}
	for _, f := range flags {
		flag, ok := f.(cli.DocGenerationFlag)
		if !ok {
			continue
		}
		modifiedArg := opener

		for _, s := range f.Names() {
			trimmed := strings.TrimSpace(s)
			if len(modifiedArg) > len(opener) {
				modifiedArg += sep
			}
			if len(trimmed) > 1 {
				modifiedArg += fmt.Sprintf("--%s", trimmed)
			} else {
				modifiedArg += fmt.Sprintf("-%s", trimmed)
			}
		}
		modifiedArg += closer
		if flag.TakesValue() {
			modifiedArg += fmt.Sprintf("=%s", value)
		}

		if addDetails {
			modifiedArg += flagDetails(flag)
		}

		args = append(args, modifiedArg+"\n")
	}
	sort.Strings(args)
	return args
}

func flagDetails(flag cli.DocGenerationFlag) string {
	description := flag.GetUsage()
	value := getFlagDefaultValue(flag)
	if value != "" {
		description += " (default: " + value + ")"
	}
	if envVars := flag.GetEnvVars(); len(envVars) > 0 {
		for i, v := range envVars {
			envVars[i] = "$" + v
		}
		description += " [" + strings.Join(envVars, ", ") + "]"
	}
	return ": " + description
}

func prepareUsageText(command *cli.Command) string {
	if command.UsageText == "" {
		return ""
	}

	preparedUsageText := strings.Trim(command.UsageText, "\n")

	var usageText string
	if strings.Contains(preparedUsageText, "\n") {
		for _, ln := range strings.Split(preparedUsageText, "\n") {
			usageText += fmt.Sprintf("    %s\n", ln)
		}
	} else {
		usageText = fmt.Sprintf(">%s\n", preparedUsageText)
	}

	return usageText
}

func prepareUsage(command *cli.Command, usageText string) string {
	if command.Usage == "" {
		return ""
	}

	usage := command.Usage + "\n"
	if usageText != "" {
		usage += "\n"
	}

	return usage
}

// getFlagDefaultValue returns the default value for a flag.
// Unlike the upstream cli-docs implementation, this checks
// GetDefaultText() first, allowing flags to provide a stable
// display value independent of the runtime-computed default.
func getFlagDefaultValue(f cli.DocGenerationFlag) string {
	if !f.TakesValue() {
		return ""
	}

	if dt := f.GetDefaultText(); dt != "" {
		return dt
	}

	if v, ok := f.(interface{ GetValue() string }); ok {
		return v.GetValue()
	}

	ref := reflect.ValueOf(f)
	if ref.Kind() != reflect.Ptr {
		return ""
	} else {
		ref = ref.Elem()
	}

	if ref.Kind() != reflect.Struct {
		return ""
	}

	if val := ref.FieldByName("Value"); val.IsValid() && val.Type().Kind() != reflect.Bool {
		return fmt.Sprintf("%v", val.Interface())
	}

	return ""
}
