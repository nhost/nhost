package main_test

// The drift test holds every file family that cites rule IDs to the IDs the
// rules doc and the scope files define, and holds the tool's embedded copies
// of the exclusion list and the resolution table to their fences in the
// rules doc. It reads the real files by paths relative to this directory,
// because the Nix check has no `.git` to find the repository root by.

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/writing/internal/resolve"
	"github.com/nhost/nhost/tools/writing/internal/rubric"
	"github.com/nhost/nhost/tools/writing/internal/ruleid"
)

const (
	rulesDir   = "../../.claude/writing"
	valeDir    = "../../.vale/styles/Nhost"
	rubricPath = "rubric/rubric.yaml"
	deltasGlob = "calibration/docs/*/deltas.md"
)

// deltaRowRe matches a numbered row of a deltas table.
var deltaRowRe = regexp.MustCompile(`(?m)^\| *[0-9]+ *\|.*$`)

func definedIDs(t *testing.T) ruleid.Set {
	t.Helper()

	ids, err := ruleid.Load(rulesDir)
	if err != nil {
		t.Fatalf("loading defined rule IDs: %v", err)
	}

	if len(ids.IDs()) == 0 {
		t.Fatalf("no rule IDs defined under %s", rulesDir)
	}

	return ids
}

func glob(t *testing.T, pattern string) []string {
	t.Helper()

	files, err := filepath.Glob(pattern)
	if err != nil {
		t.Fatalf("globbing %s: %v", pattern, err)
	}

	if len(files) == 0 {
		t.Fatalf("no files match %s", pattern)
	}

	return files
}

func read(t *testing.T, path string) []byte {
	t.Helper()

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}

	return data
}

// undefined returns the cited IDs that ids does not define, once each.
func undefined(ids ruleid.Set, cited []string) []string {
	var missing []string

	for _, id := range cited {
		if !ids.Has(id) && !slices.Contains(missing, id) {
			missing = append(missing, id)
		}
	}

	return missing
}

// fence returns what `sed -n '/^```<lang>$/,/^```$/p' | sed '1d;$d'` prints
// for src: the lines of every `<lang>` fence, without the first opening and
// the last closing line.
func fence(src []byte, lang string) string {
	var out []string

	inside := false

	for line := range strings.Lines(string(src)) {
		text := strings.TrimSuffix(line, "\n")

		switch {
		case !inside && text == "```"+lang:
			inside = true

			out = append(out, line)
		case inside:
			out = append(out, line)
			inside = text != "```"
		}
	}

	if len(out) < 2 {
		return ""
	}

	return strings.Join(out[1:len(out)-1], "")
}

func TestDriftRubric(t *testing.T) {
	t.Parallel()

	ids := definedIDs(t)

	if _, err := rubric.Load(rubricPath, ids); err != nil {
		t.Errorf("rubric.Load: %v", err)
	}

	if missing := undefined(ids, ruleid.Citations(read(t, rubricPath))); len(missing) > 0 {
		t.Errorf("%s cites undefined rule IDs: %s", rubricPath, strings.Join(missing, ", "))
	}
}

func TestDriftDeltas(t *testing.T) {
	t.Parallel()

	ids := definedIDs(t)

	for _, file := range glob(t, deltasGlob) {
		t.Run(file, func(t *testing.T) {
			t.Parallel()

			rows := deltaRowRe.FindAll(read(t, file), -1)
			if len(rows) == 0 {
				t.Fatalf("%s has no delta rows", file)
			}

			for _, row := range rows {
				cited := ruleid.Citations(row)
				if len(cited) == 0 {
					t.Errorf("row cites no rule ID: %s", row)
				}

				if missing := undefined(ids, cited); len(missing) > 0 {
					t.Errorf(
						"row cites undefined rule IDs %s: %s",
						strings.Join(missing, ", "),
						row,
					)
				}
			}
		})
	}
}

func TestDriftValeMessages(t *testing.T) {
	t.Parallel()

	ids := definedIDs(t)

	for _, file := range glob(t, filepath.Join(valeDir, "*.yml")) {
		t.Run(filepath.Base(file), func(t *testing.T) {
			t.Parallel()

			var rule struct {
				Message string `yaml:"message"`
			}
			if err := yaml.Unmarshal(read(t, file), &rule); err != nil {
				t.Fatalf("parsing %s: %v", file, err)
			}

			cited := ruleid.Citations([]byte(rule.Message))
			if len(cited) == 0 {
				t.Errorf("message cites no rule ID: %q", rule.Message)
			}

			if missing := undefined(ids, cited); len(missing) > 0 {
				t.Errorf(
					"message cites undefined rule IDs %s: %q",
					strings.Join(missing, ", "),
					rule.Message,
				)
			}
		})
	}
}

func TestDriftVoicesCiteNoIDs(t *testing.T) {
	t.Parallel()

	for _, file := range glob(t, filepath.Join(rulesDir, "voices", "*.md")) {
		t.Run(filepath.Base(file), func(t *testing.T) {
			t.Parallel()

			if cited := ruleid.Citations(read(t, file)); len(cited) > 0 {
				t.Errorf("voice profile cites rule IDs: %s", strings.Join(cited, ", "))
			}
		})
	}
}

func TestDriftEmbeddedFences(t *testing.T) {
	t.Parallel()

	rules := read(t, filepath.Join(rulesDir, "rules.md"))

	tests := []struct {
		name     string
		lang     string
		embedded string
	}{
		{name: "exclusion list", lang: "text", embedded: resolve.ExclusionList()},
		{name: "resolution table", lang: "markdown", embedded: resolve.TableMarkdown()},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			want := fence(rules, tt.lang)
			if want == "" {
				t.Fatalf("rules.md has no %q fence", tt.lang)
			}

			if diff := cmp.Diff(want, tt.embedded); diff != "" {
				t.Errorf(
					"embedded %s differs from the %q fence in rules.md (-rules +embedded):\n%s",
					tt.name,
					tt.lang,
					diff,
				)
			}
		})
	}
}

func TestFence(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		src  string
		lang string
		want string
	}{
		{
			name: "one fence",
			src:  "intro\n```text\na/**\nb.mdx\n```\nafter\n```markdown\n| x |\n```\n",
			lang: "text",
			want: "a/**\nb.mdx\n",
		},
		{
			name: "other language",
			src:  "intro\n```text\na/**\n```\n```markdown\n| x |\n```\n",
			lang: "markdown",
			want: "| x |\n",
		},
		{
			name: "two fences are concatenated, as sed does",
			src:  "```text\na\n```\n```text\nb\n```\n",
			lang: "text",
			want: "a\n```\n```text\nb\n",
		},
		{
			name: "an indented or tagged fence does not open",
			src:  "  ```text\na\n```\n```texts\nb\n```\n",
			lang: "text",
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := fence([]byte(tt.src), tt.lang); got != tt.want {
				t.Errorf("fence() = %q, want %q", got, tt.want)
			}
		})
	}
}
