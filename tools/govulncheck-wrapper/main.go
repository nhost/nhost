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

// collectFixes returns module@version pairs that, when fed to `go get`, raise
// each vulnerable module to its OSV-reported fixed version. Only non-allowlisted
// findings are considered; for modules referenced by multiple findings the
// highest fixed version (by semver) wins so a later `go get` cannot downgrade
// an earlier one.
func collectFixes(
	findingsMap map[string][]*finding, blocked []string,
) []string {
	maxFix := make(map[string]string)

	for _, id := range blocked {
		for _, f := range findingsMap[id] {
			if f.FixedVersion == "" || len(f.Trace) == 0 {
				continue
			}

			mod := f.Trace[0].Module
			if mod == "" {
				continue
			}

			cur, ok := maxFix[mod]
			if !ok || semver.Compare(f.FixedVersion, cur) > 0 {
				maxFix[mod] = f.FixedVersion
			}
		}
	}

	pairs := make([]string, 0, len(maxFix))
	for mod, ver := range maxFix {
		pairs = append(pairs, mod+"@"+ver)
	}

	sort.Strings(pairs)

	return pairs
}

func runCmd(name string, args ...string) error {
	cmd := exec.CommandContext(context.Background(), name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("running %s %s: %w", name, strings.Join(args, " "), err)
	}

	return nil
}

// applyFixes runs `go get` for each module@version pair, then `go mod tidy`
// and `go mod vendor` so go.sum and vendor/ stay in sync. No-op when there
// is nothing to bump.
func applyFixes(pairs []string) error {
	if len(pairs) == 0 {
		fmt.Fprintln(os.Stdout, "No Go security updates needed.")

		return nil
	}

	fmt.Fprintln(os.Stdout, "Bumping:")

	for _, pair := range pairs {
		fmt.Fprintf(os.Stdout, "  %s\n", pair)
	}

	for _, pair := range pairs {
		if err := runCmd("go", "get", pair); err != nil {
			return err
		}
	}

	if err := runCmd("go", "mod", "tidy"); err != nil {
		return err
	}

	if err := runCmd("go", "mod", "vendor"); err != nil {
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
		if err := applyFixes(collectFixes(findingsMap, blocked)); err != nil {
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
