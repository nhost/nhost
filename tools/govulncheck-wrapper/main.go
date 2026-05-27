package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sort"
	"strings"

	"golang.org/x/mod/semver"
	"gopkg.in/yaml.v3"
)

type config struct {
	AllowList []string `yaml:"allow_list"`
}

type message struct {
	OSV     *osvEntry `json:"osv,omitempty"`
	Finding *finding  `json:"finding,omitempty"`
}

type osvEntry struct {
	ID      string   `json:"id"`
	Aliases []string `json:"aliases,omitempty"`
	Summary string   `json:"summary"`
}

type finding struct {
	OSV          string  `json:"osv"`
	FixedVersion string  `json:"fixed_version,omitempty"`
	Trace        []frame `json:"trace,omitempty"`
}

type frame struct {
	Module   string `json:"module,omitempty"`
	Version  string `json:"version,omitempty"`
	Package  string `json:"package,omitempty"`
	Function string `json:"function,omitempty"`
}

func loadConfig(path string) (map[string]bool, error) {
	allow := make(map[string]bool)

	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return allow, nil
		}

		return nil, fmt.Errorf("reading %s: %w", path, err)
	}

	var cfg config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", path, err)
	}

	for _, id := range cfg.AllowList {
		allow[id] = true
	}

	return allow, nil
}

func parseMessages(
	r io.Reader,
) (map[string]*osvEntry, map[string][]*finding) {
	osvMap := make(map[string]*osvEntry)
	findingsMap := make(map[string][]*finding)

	dec := json.NewDecoder(r)

	for {
		var msg message
		if err := dec.Decode(&msg); err != nil {
			if !errors.Is(err, io.EOF) {
				fmt.Fprintf(
					os.Stderr,
					"warning: error parsing govulncheck output: %v\n",
					err,
				)
			}

			break
		}

		if msg.OSV != nil {
			osvMap[msg.OSV.ID] = msg.OSV
		}

		if msg.Finding != nil {
			findingsMap[msg.Finding.OSV] = append(
				findingsMap[msg.Finding.OSV], msg.Finding,
			)
		}
	}

	return osvMap, findingsMap
}

func runGovulncheck(
	args []string,
) (map[string]*osvEntry, map[string][]*finding, error) {
	cmdArgs := make([]string, 0, len(args)+1)
	cmdArgs = append(cmdArgs, "-json")
	cmdArgs = append(cmdArgs, args...)

	cmd := exec.CommandContext(context.Background(), "govulncheck", cmdArgs...)
	cmd.Stderr = os.Stderr

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, nil, fmt.Errorf("creating pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, nil, fmt.Errorf("starting govulncheck: %w", err)
	}

	osvMap, findingsMap := parseMessages(stdout)

	cmdErr := cmd.Wait()
	if len(findingsMap) == 0 && len(osvMap) == 0 && cmdErr != nil {
		return nil, nil, fmt.Errorf("govulncheck failed: %w", cmdErr)
	}

	return osvMap, findingsMap, nil
}

func printVulnerability(
	w io.Writer, id string, osv *osvEntry, findings []*finding,
) {
	if osv != nil {
		fmt.Fprintf(w, "\n  %s: %s\n", id, osv.Summary)

		if len(osv.Aliases) > 0 {
			fmt.Fprintf(w, "    Aliases: %s\n", strings.Join(osv.Aliases, ", "))
		}
	} else {
		fmt.Fprintf(w, "\n  %s\n", id)
	}

	for _, f := range findings {
		if f.FixedVersion != "" {
			fmt.Fprintf(w, "    Fixed in: %s\n", f.FixedVersion)
		}

		if len(f.Trace) > 0 {
			t := f.Trace[0]
			if t.Module != "" && t.Version != "" {
				fmt.Fprintf(w, "    Module: %s@%s\n", t.Module, t.Version)
			}

			if t.Package != "" {
				fmt.Fprintf(w, "    Package: %s\n", t.Package)
			}

			if t.Function != "" {
				fmt.Fprintf(w, "    Function: %s\n", t.Function)
			}
		}
	}
}

// isToolchainModule reports whether the given module name is a govulncheck
// pseudo-module that cannot be bumped via `go get` and instead requires a
// manual Go toolchain upgrade (handled outside this wrapper, e.g. by bumping
// the nix overlay that installs Go).
func isToolchainModule(mod string) bool {
	return mod == "stdlib" || mod == "toolchain"
}

// collectFixes returns module@version pairs that, when fed to `go get`, raise
// each vulnerable module to its OSV-reported fixed version. Only non-allowlisted
// findings are considered; for modules referenced by multiple findings the
// highest fixed version (by semver) wins so a later `go get` cannot downgrade
// an earlier one.
//
// Findings whose module is a Go toolchain pseudo-module (`stdlib`, `toolchain`)
// are returned in a separate slice: feeding `stdlib@vX.Y.Z` to `go get` would
// abort the entire fix run, so the caller logs them as requiring a manual
// toolchain upgrade and continues bumping the remaining modules.
func collectFixes(
	findingsMap map[string][]*finding, blocked []string,
) ([]string, []string) {
	maxFix := make(map[string]string)
	maxToolchainFix := make(map[string]string)

	for _, id := range blocked {
		for _, f := range findingsMap[id] {
			if f.FixedVersion == "" || len(f.Trace) == 0 {
				continue
			}

			mod := f.Trace[0].Module
			if mod == "" {
				continue
			}

			target := maxFix
			if isToolchainModule(mod) {
				target = maxToolchainFix
			}

			cur, ok := target[mod]
			if !ok || semver.Compare(f.FixedVersion, cur) > 0 {
				target[mod] = f.FixedVersion
			}
		}
	}

	pairs := make([]string, 0, len(maxFix))
	for mod, ver := range maxFix {
		pairs = append(pairs, mod+"@"+ver)
	}

	sort.Strings(pairs)

	toolchainPairs := make([]string, 0, len(maxToolchainFix))
	for mod, ver := range maxToolchainFix {
		toolchainPairs = append(toolchainPairs, mod+"@"+ver)
	}

	sort.Strings(toolchainPairs)

	return pairs, toolchainPairs
}

// cmdRunner runs an external command and returns an error if it fails. It is
// abstracted so applyFixes can be unit-tested without shelling out.
type cmdRunner func(name string, args ...string) error

func runCmd(name string, args ...string) error {
	cmd := exec.CommandContext(context.Background(), name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("running %s %s: %w", name, strings.Join(args, " "), err)
	}

	return nil
}

// applyFixes raises each module@version pair via `go mod edit -require`, then
// runs `go mod tidy` and `go mod vendor` so go.sum and vendor/ stay in sync.
// No-op when there is nothing to bump. Toolchain pairs are logged but not
// edited into go.mod because they cannot be bumped that way; they require a
// manual Go toolchain upgrade (e.g. via the nix overlay).
//
// `go mod edit -require` is used instead of `go get pkg@version` because
// `go get` resolves its argument as a package path and walks up to the owning
// module. For modules whose path has an intermediate module versioned on a
// different major track (e.g. go.opentelemetry.io/otel/exporters/otlp/otlpmetric
// is v0.x while its otlpmetrichttp submodule is v1.x), that walk-up overshoots
// to the v1.x root module, which does not contain the package, and `go get`
// fails. `go mod edit -require` sets the requirement on the exact module path
// directly, and the subsequent `go mod tidy` resolves the rest of the graph.
func applyFixes(pairs, toolchainPairs []string, run cmdRunner) error {
	for _, pair := range toolchainPairs {
		fmt.Fprintf(
			os.Stdout,
			"manual Go toolchain upgrade required for %s\n",
			pair,
		)
	}

	if len(pairs) == 0 {
		fmt.Fprintln(os.Stdout, "No Go security updates needed.")

		return nil
	}

	fmt.Fprintln(os.Stdout, "Bumping:")

	for _, pair := range pairs {
		fmt.Fprintf(os.Stdout, "  %s\n", pair)
	}

	for _, pair := range pairs {
		if err := run("go", "mod", "edit", "-require="+pair); err != nil {
			return err
		}
	}

	if err := run("go", "mod", "tidy"); err != nil {
		return err
	}

	if err := run("go", "mod", "vendor"); err != nil {
		return err
	}

	return nil
}

func classifyFindings(
	findingsMap map[string][]*finding, allow map[string]bool,
) ([]string, []string) {
	var allowed, blocked []string

	for id := range findingsMap {
		if allow[id] {
			allowed = append(allowed, id)
		} else {
			blocked = append(blocked, id)
		}
	}

	sort.Strings(allowed)
	sort.Strings(blocked)

	return allowed, blocked
}

func main() {
	configPath := flag.String(
		"config", "govulncheck.yaml", "path to allowlist config file",
	)
	fix := flag.Bool(
		"fix", false,
		"bump non-allowlisted findings via `go get`, then run `go mod tidy` and `go mod vendor`",
	)

	flag.Parse()

	allow, err := loadConfig(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(2) //nolint:mnd
	}

	osvMap, findingsMap, err := runGovulncheck(flag.Args())
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(2) //nolint:mnd
	}

	allowed, blocked := classifyFindings(findingsMap, allow)

	if *fix {
		pairs, toolchainPairs := collectFixes(findingsMap, blocked)
		if err := applyFixes(pairs, toolchainPairs, runCmd); err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(2) //nolint:mnd
		}

		return
	}

	if len(allowed) > 0 {
		fmt.Fprintln(os.Stdout, "Allowed vulnerabilities (from allowlist):")

		for _, id := range allowed {
			summary := id
			if osv, ok := osvMap[id]; ok && osv.Summary != "" {
				summary = fmt.Sprintf("%s: %s", id, osv.Summary)
			}

			fmt.Fprintf(os.Stdout, "  - %s\n", summary)
		}

		fmt.Fprintln(os.Stdout)
	}

	if len(blocked) > 0 {
		fmt.Fprintln(os.Stdout, "Vulnerabilities found:")

		for _, id := range blocked {
			printVulnerability(os.Stdout, id, osvMap[id], findingsMap[id])
		}

		fmt.Fprintln(os.Stdout)
		os.Exit(1)
	}

	fmt.Fprintln(os.Stdout, "No unallowed vulnerabilities found.")
}
