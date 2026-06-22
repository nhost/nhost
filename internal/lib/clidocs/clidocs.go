// Package clidocs generates markdown documentation for urfave/cli commands.
// It is a fork of github.com/urfave/cli-docs/v3 that respects DefaultText
// for flags, ensuring generated documentation is deterministic regardless
// of the environment.
package clidocs

import (
	"bytes"
	"fmt"
	"reflect"
	"regexp"
	"slices"
	"sort"
	"strings"
	"text/template"

	"github.com/urfave/cli/v3"
)

// introText is the lead paragraph for the generated reference. It is kept
// separate so each source line stays within the line-length limit; the
// concatenated result is a single Markdown paragraph.
const introText = "The `{{ .Command.Name }}` CLI is the primary tool for developing, " +
	"deploying, and managing Nhost projects. It lets you run your backend locally, " +
	"manage configuration and infrastructure as code, link and deploy projects to " +
	"Nhost Cloud, and provide AI assistants with access to your project through the " +
	"built-in MCP server."

const markdownDocTemplate = `{{if gt .SectionNum 0}}% {{ .Command.Name }} {{ .SectionNum }}

{{end}}` + introText + `

New here? Head over to [Quickstart](/getting-started/quickstart/cli) for CLI installation.

## Usage

` + "```" + `{{ if .Command.UsageText }}
{{ .Command.UsageText }}
{{ else }}
{{ .Command.Name }} [GLOBAL OPTIONS] [command [COMMAND OPTIONS]] [ARGUMENTS...]
{{ end }}` + "```" + `
{{ if .GlobalOptions }}
---

## Global Options

{{ .GlobalOptions }}
{{ end }}{{ if .Commands }}
---

## Commands
{{ range $v := .Commands }}
{{ $v }}{{ end }}{{ end -}}
`

type cliCommandTemplate struct {
	Command       *cli.Command
	SectionNum    int
	Commands      []string
	GlobalOptions string
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
		return fmt.Errorf("failed to parse template: %w", err)
	}

	if err := t.ExecuteTemplate(w, name, &cliCommandTemplate{
		Command:       cmd,
		SectionNum:    0,
		Commands:      prepareCommands(cmd.Commands, 0, cmd.Name),
		GlobalOptions: renderGlobalOptions(cmd.VisibleFlags()),
	}); err != nil {
		return fmt.Errorf("failed to execute template: %w", err)
	}

	return nil
}

// helpName is urfave/cli's reserved name for the auto-generated help command
// and flag, both of which the reference omits.
const helpName = "help"

func prepareCommands(commands []*cli.Command, level int, prefix string) []string {
	var coms []string
	for _, command := range commands {
		// Skip hidden commands and the auto-generated "help" subcommand, which
		// is identical noise under every parent command.
		if command.Hidden || command.Name == helpName {
			continue
		}

		fullCommand := strings.TrimSpace(prefix + " " + command.Name)

		if level == 0 {
			// Top-level commands are rendered as plain group labels with no
			// description. The actual command is listed underneath as its own
			// entry when it is runnable (e.g. `nhost up`, `nhost logs`) or has no
			// subcommands of its own — pure groups (e.g. config) only list their
			// subcommands.
			coms = append(coms, renderGroupHeading(command))

			if command.Action != nil || !hasVisibleSubcommands(command) {
				coms = append(coms, renderEntry(command, fullCommand, 1))
			}

			coms = append(coms, prepareCommands(command.Commands, 1, fullCommand)...)

			continue
		}

		coms = append(coms, renderEntry(command, fullCommand, level))
		coms = append(coms, prepareCommands(command.Commands, level+1, fullCommand)...)
	}

	return coms
}

// renderGroupHeading renders a top-level command as a plain, description-less
// group label (e.g. "config") wrapped so it indents under the Commands section.
func renderGroupHeading(command *cli.Command) string {
	return "---\n\n<div class=\"cli-command cli-l0\">\n\n## " + command.Name + "\n\n</div>\n"
}

// renderEntry renders a single command as an inline-code heading (its full
// invocation, e.g. `nhost dev compose`) followed by its description, aliases,
// and options table. It does not recurse into subcommands.
func renderEntry(command *cli.Command, fullCommand string, level int) string {
	badges, desc := splitBadges(command.Usage)

	var b strings.Builder

	// Wrap the entry so it indents as a block; the badge and heading sit at the
	// wrapper's left edge.
	fmt.Fprintf(&b, "<div class=\"cli-command cli-l%d\">\n\n", level)

	if badges != "" {
		b.WriteString(badges + "\n\n")
	}

	fmt.Fprintf(&b, "%s `%s`\n\n", strings.Repeat("#", level+2), fullCommand) //nolint:mnd

	// Inner wrapper indents the description, aliases, and options under the
	// heading.
	b.WriteString("<div class=\"cli-body\">\n\n")

	// Description and aliases share a single line (aliases trailing it).
	line := ""
	if desc != "" {
		line = strings.TrimRight(codeify(collapseSpaces(desc)), ".") + "."
	}

	if aliases := command.Names()[1:]; len(aliases) > 0 {
		quoted := make([]string, 0, len(aliases))
		for _, alias := range aliases {
			quoted = append(quoted, "`"+alias+"`")
		}

		if line != "" {
			line += " "
		}

		line += "*Aliases: " + strings.Join(quoted, ", ") + "*"
	}

	if line != "" {
		b.WriteString(line + "\n\n")
	}

	if table := renderOptionTable(command.VisibleFlags(), false); table != "" {
		b.WriteString(table + "\n")
	}

	b.WriteString("</div>\n\n</div>\n")

	return b.String()
}

// hasVisibleSubcommands reports whether a command has any non-hidden subcommand
// other than the auto-generated help command.
func hasVisibleSubcommands(command *cli.Command) bool {
	for _, sc := range command.Commands {
		if !sc.Hidden && sc.Name != helpName {
			return true
		}
	}

	return false
}

// splitBadges extracts status markers from a command's usage, returning the
// rendered badge <span> elements (space-separated) and the remaining
// description text. To add a status (e.g. alpha), add a row to the table below
// and an optional `.cli-badge-<label>` colour rule in the docs site CSS; the
// base `.cli-badge` style already renders an unknown badge as a neutral pill.
func splitBadges(usage string) (string, string) {
	markers := []struct{ marker, label string }{
		{"[EXPERIMENTAL]", "Experimental"},
		{"(BETA)", "Beta"},
	}

	badges := make([]string, 0, len(markers))
	desc := strings.TrimSpace(usage)

	for _, m := range markers {
		if !strings.Contains(desc, m.marker) {
			continue
		}

		badges = append(badges, badge(m.label))
		desc = strings.TrimSpace(strings.ReplaceAll(desc, m.marker, ""))
	}

	return strings.Join(badges, " "), desc
}

// badge renders a status label as the inline <span> styled by the docs site.
func badge(label string) string {
	return fmt.Sprintf(
		`<span class="cli-badge cli-badge-%s">%s</span>`,
		strings.ToLower(label),
		label,
	)
}

// renderOptionTable renders a command's flags as a header-less two-column table
// (option, description); the empty header row is hidden by the docs site CSS.
// The ubiquitous --help flag is omitted unless includeHelp is set. Returns an
// empty string when there are no rows.
func renderOptionTable(flags []cli.Flag, includeHelp bool) string {
	rows := optionRows(flags, includeHelp)
	if len(rows) == 0 {
		return ""
	}

	return "| | |\n| --- | --- |\n" + strings.Join(rows, "\n") + "\n"
}

// renderGlobalOptions renders the root command's flags as an option table.
func renderGlobalOptions(flags []cli.Flag) string {
	return renderOptionTable(flags, true)
}

// optionRows renders each flag as a Markdown table row. The ubiquitous --help
// flag is omitted unless includeHelp is set.
func optionRows(flags []cli.Flag, includeHelp bool) []string {
	rows := []string{}
	for _, f := range flags {
		flag, ok := f.(cli.DocGenerationFlag)
		if !ok {
			continue
		}

		if !includeHelp && isHelpFlag(f) {
			continue
		}

		token := flagNames(f)
		if flag.TakesValue() {
			token += `=""`
		}

		rows = append(rows, "| `"+token+"` | "+flagDescription(flag)+" |")
	}

	sort.Strings(rows)

	return rows
}

// flagDescription builds the description cell for a flag: usage text followed
// by its default and environment variables as separate sentences, with
// monospace where safe.
func flagDescription(flag cli.DocGenerationFlag) string {
	parts := []string{}

	if usage := codeify(collapseSpaces(flag.GetUsage())); usage != "" {
		parts = append(parts, strings.TrimRight(usage, ".")+".")
	}

	if value := getFlagDefaultValue(flag); value != "" {
		parts = append(parts, "Default: "+code(value)+".")
	}

	if envVars := flag.GetEnvVars(); len(envVars) > 0 {
		for i, v := range envVars {
			envVars[i] = "`$" + v + "`"
		}

		parts = append(parts, "Env: "+strings.Join(envVars, ", ")+".")
	}

	return strings.Join(parts, " ")
}

// codeifyRE matches technical tokens in free text that read better as inline
// code: paths/format strings (containing a slash), <placeholders>, ENV_VARS,
// and X-Header-Names.
var codeifyRE = regexp.MustCompile(
	`[\w./$=:~\[\]-]*/[\w./$=:~\[\]-]+` +
		`|<[^<>\s]+>` +
		`|\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b` +
		`|\bX-[A-Za-z]+(?:-[A-Za-z]+)+\b`,
)

// codeify wraps recognized technical tokens in free text in inline code,
// keeping trailing sentence punctuation outside the code span. Angle brackets in
// the surrounding (non-code) text are escaped so the result is MDX-safe.
func codeify(s string) string {
	var b strings.Builder

	last := 0
	for _, loc := range codeifyRE.FindAllStringIndex(s, -1) {
		b.WriteString(escapeAngles(s[last:loc[0]]))

		match := s[loc[0]:loc[1]]

		trail := ""
		for len(match) > 0 {
			c := match[len(match)-1]
			if c != '.' && c != ',' {
				break
			}

			trail = string(c) + trail
			match = match[:len(match)-1]
		}

		b.WriteString(code(match) + trail)

		last = loc[1]
	}

	b.WriteString(escapeAngles(s[last:]))

	return b.String()
}

// escapeAngles makes free text MDX-safe by escaping the angle brackets it would
// otherwise parse as JSX. Inline code spans are exempt (see code).
func escapeAngles(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")

	return strings.ReplaceAll(s, ">", "&gt;")
}

// code wraps a token in inline-code backticks. Angle brackets are kept literal:
// MDX renders them verbatim inside a code span, so no escaping is needed (unlike
// the surrounding free text; see codeify).
func code(token string) string {
	token = strings.ReplaceAll(token, "`", "")

	return "`" + token + "`"
}

// collapseSpaces flattens any embedded whitespace (newlines, tabs, runs of
// spaces) into single spaces and escapes pipe characters so the text is safe
// to drop into a Markdown table cell.
func collapseSpaces(s string) string {
	return strings.ReplaceAll(strings.Join(strings.Fields(s), " "), "|", `\|`)
}

// isHelpFlag reports whether a flag is the standard help flag.
func isHelpFlag(f cli.Flag) bool {
	return slices.Contains(f.Names(), helpName)
}

// flagNames returns a command's flag names joined by ", ", each prefixed with
// the appropriate "-" or "--" depending on length.
func flagNames(f cli.Flag) string {
	names := make([]string, 0, len(f.Names()))
	for _, s := range f.Names() {
		trimmed := strings.TrimSpace(s)
		if len(trimmed) > 1 {
			names = append(names, "--"+trimmed)
		} else {
			names = append(names, "-"+trimmed)
		}
	}

	return strings.Join(names, ", ")
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
	}

	ref = ref.Elem()

	if ref.Kind() != reflect.Struct {
		return ""
	}

	if val := ref.FieldByName("Value"); val.IsValid() && val.Type().Kind() != reflect.Bool {
		return fmt.Sprintf("%v", val.Interface())
	}

	return ""
}
