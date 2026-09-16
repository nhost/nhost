package create

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

var pkgNameRE = regexp.MustCompile(`"name"\s*:\s*"[^"]*"`)

// patchPackageJSONName rewrites the first "name" field of a package.json in
// place, preserving the rest of the file byte-for-byte.
func patchPackageJSONName(path, name string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", path, err)
	}

	loc := pkgNameRE.FindIndex(data)
	if loc == nil {
		return nil
	}

	out := make([]byte, 0, len(data))
	out = append(out, data[:loc[0]]...)
	out = append(out, fmt.Sprintf("%q: %q", "name", name)...)
	out = append(out, data[loc[1]:]...)

	return overwriteFile(path, out)
}

// overwriteFile replaces the contents of an existing file, keeping its
// permissions.
func overwriteFile(path string, data []byte) error {
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("failed to stat %s: %w", path, err)
	}

	// G703 reports this write as taint-reachable, but stageProject is the only
	// caller and always builds path under the staging directory it created.
	if err := os.WriteFile(path, data, info.Mode().Perm()); err != nil { //nolint:gosec
		return fmt.Errorf("failed to write %s: %w", path, err)
	}

	return nil
}

// agentContextDocs lists the scaffolded Markdown files an agent reads to learn
// how to run the project, as patterns relative to the project root. They ship
// with pnpm invocations.
func agentContextDocs() []string {
	return []string{
		"AGENTS.md",
		"CLAUDE.md",
		"README.md",
		"SKILLS.md",
		filepath.Join(".claude", "skills", "*", "SKILL.md"),
	}
}

// retargetPackageManagerDocs rewrites the pnpm commands in the scaffolded
// context files to pm. Without it an agent follows AGENTS.md literally and runs
// `pnpm install` in a project whose lockfile belongs to another package
// manager, recreating the pnpm-lock.yaml stageProject just removed.
func retargetPackageManagerDocs(root, pm string) error {
	commands, err := pnpmCommandRE(filepath.Join(root, "frontend", "package.json"))
	if err != nil {
		return err
	}

	for _, pattern := range agentContextDocs() {
		matches, err := filepath.Glob(filepath.Join(root, pattern))
		if err != nil {
			return fmt.Errorf("failed to list %s: %w", pattern, err)
		}

		for _, path := range matches {
			if err := retargetFile(path, commands, pm); err != nil {
				return err
			}
		}
	}

	return nil
}

// pnpmCommandRE builds the pattern for the `pnpm <command>` invocations this
// project can actually contain: `install` plus every script in package.json.
// Matching known commands rather than any following word leaves prose that
// merely mentions pnpm alone.
func pnpmCommandRE(packageJSON string) (*regexp.Regexp, error) {
	data, err := os.ReadFile(packageJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to read %s: %w", packageJSON, err)
	}

	var pkg struct {
		Scripts map[string]string `json:"scripts"`
	}

	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", packageJSON, err)
	}

	commands := make([]string, 0, len(pkg.Scripts)+1)
	commands = append(commands, "install")

	for script := range pkg.Scripts {
		commands = append(commands, script)
	}

	// Longest first, then alphabetically: alternation is leftmost-first, so
	// `codegen` must not shadow `codegen:types`, and map order must not leak
	// into the generated files.
	slices.SortFunc(commands, func(a, b string) int {
		if d := len(b) - len(a); d != 0 {
			return d
		}

		return strings.Compare(a, b)
	})

	for i, command := range commands {
		commands[i] = regexp.QuoteMeta(command)
	}

	re, err := regexp.Compile(`\bpnpm (` + strings.Join(commands, "|") + `)\b`)
	if err != nil {
		return nil, fmt.Errorf("failed to build the pnpm command pattern: %w", err)
	}

	return re, nil
}

// retargetFile rewrites every pnpm command in a single Markdown file, leaving
// the file untouched when it has none.
func retargetFile(path string, commands *regexp.Regexp, pm string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", path, err)
	}

	out := commands.ReplaceAllFunc(data, func(match []byte) []byte {
		command := string(commands.FindSubmatch(match)[1])
		if command == "install" {
			return []byte(pm + " install")
		}

		return []byte(packageManagerScript(pm, command))
	})

	if bytes.Equal(out, data) {
		return nil
	}

	return overwriteFile(path, out)
}

// copyDir copies a local template directory tree into dst, skipping build and
// VCS artifacts. Used by --template-path for offline/dev scaffolding.
func copyDir(src, dst string) error {
	if err := os.MkdirAll(dst, 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Every write goes through a root so a symlinked component under dst cannot
	// redirect it outside the destination tree between the walk and the write.
	root, err := os.OpenRoot(dst)
	if err != nil {
		return fmt.Errorf("failed to open %s: %w", dst, err)
	}
	defer root.Close()

	err = filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return fmt.Errorf("failed to walk %s: %w", p, err)
		}

		rel, err := filepath.Rel(src, p)
		if err != nil {
			return fmt.Errorf("failed to compute relative path: %w", err)
		}

		if rel == "." {
			return nil
		}

		if d.IsDir() {
			switch d.Name() {
			case "node_modules", ".next", ".git":
				return fs.SkipDir
			}

			if err := root.MkdirAll(rel, 0o755); err != nil { //nolint:mnd
				return fmt.Errorf("failed to create directory: %w", err)
			}

			return nil
		}

		if d.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("refusing to copy symlink %s", p) //nolint:err113
		}

		info, err := d.Info()
		if err != nil {
			return fmt.Errorf("failed to stat %s: %w", p, err)
		}

		// Ensure owner-write so the scaffolded project stays editable even when
		// the template source is read-only (e.g. copied from the read-only Nix
		// store). Postprocessing also rewrites files such as package.json.
		mode := info.Mode().Perm() | 0o200 //nolint:mnd

		return copyFile(p, root, rel, mode)
	})
	if err != nil {
		return fmt.Errorf("failed to copy template directory: %w", err)
	}

	return nil
}

// copyFile copies src to rel inside dst, which confines the write to the
// destination tree.
func copyFile(src string, dst *os.Root, rel string, mode os.FileMode) error {
	target := filepath.Join(dst.Name(), rel)

	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("failed to open %s: %w", src, err)
	}
	defer in.Close()

	if parent := filepath.Dir(rel); parent != "." {
		if err := dst.MkdirAll(parent, 0o755); err != nil { //nolint:mnd
			return fmt.Errorf("failed to create directory: %w", err)
		}
	}

	out, err := dst.OpenFile(rel, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
	if err != nil {
		return fmt.Errorf("failed to create %s: %w", target, err)
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return fmt.Errorf("failed to copy %s: %w", target, err)
	}

	return nil
}
