package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sort"
	"strings"

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

		return nil, err
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

func runGovulncheck(
	args []string,
) (map[string]*osvEntry, map[string][]*finding, error) {
	cmdArgs := make([]string, 0, len(args)+1)
	cmdArgs = append(cmdArgs, "-json")
	cmdArgs = append(cmdArgs, args...)

	cmd := exec.Command("govulncheck", cmdArgs...) //nolint:gosec
	cmd.Stderr = os.Stderr

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, nil, fmt.Errorf("creating pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, nil, fmt.Errorf("starting govulncheck: %w", err)
	}

	osvMap := make(map[string]*osvEntry)
	findingsMap := make(map[string][]*finding)

	dec := json.NewDecoder(stdout)

	for {
		var msg message
		if err := dec.Decode(&msg); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}

			fmt.Fprintf(os.Stderr, "warning: error parsing govulncheck output: %v\n", err)

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

	cmdErr := cmd.Wait()
	if len(findingsMap) == 0 && len(osvMap) == 0 && cmdErr != nil {
		return nil, nil, fmt.Errorf("govulncheck failed: %w", cmdErr)
	}

	return osvMap, findingsMap, nil
}

func printVulnerability(
	id string, osv *osvEntry, findings []*finding,
) {
	if osv != nil {
		fmt.Printf("\n  %s: %s\n", id, osv.Summary)

		if len(osv.Aliases) > 0 {
			fmt.Printf("    Aliases: %s\n", strings.Join(osv.Aliases, ", "))
		}
	} else {
		fmt.Printf("\n  %s\n", id)
	}

	for _, f := range findings {
		if f.FixedVersion != "" {
			fmt.Printf("    Fixed in: %s\n", f.FixedVersion)
		}

		if len(f.Trace) > 0 {
			t := f.Trace[0]
			if t.Module != "" && t.Version != "" {
				fmt.Printf("    Module: %s@%s\n", t.Module, t.Version)
			}

			if t.Package != "" {
				fmt.Printf("    Package: %s\n", t.Package)
			}

			if t.Function != "" {
				fmt.Printf("    Function: %s\n", t.Function)
			}
		}
	}
}

func main() {
	configPath := flag.String(
		"config", "govulncheck.yaml", "path to allowlist config file",
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

	if len(allowed) > 0 {
		fmt.Println("Allowed vulnerabilities (from allowlist):")

		for _, id := range allowed {
			summary := id
			if osv, ok := osvMap[id]; ok && osv.Summary != "" {
				summary = fmt.Sprintf("%s: %s", id, osv.Summary)
			}

			fmt.Printf("  - %s\n", summary)
		}

		fmt.Println()
	}

	if len(blocked) > 0 {
		fmt.Println("Vulnerabilities found:")

		for _, id := range blocked {
			printVulnerability(id, osvMap[id], findingsMap[id])
		}

		fmt.Println()
		os.Exit(1)
	}

	fmt.Println("No unallowed vulnerabilities found.")
}
