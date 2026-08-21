package create

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
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

	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("failed to stat %s: %w", path, err)
	}

	if err := os.WriteFile(path, out, info.Mode().Perm()); err != nil {
		return fmt.Errorf("failed to write %s: %w", path, err)
	}

	return nil
}

// copyDir copies a local template directory tree into dst, skipping build and
// VCS artifacts. Used by --template-path for offline/dev scaffolding.
func copyDir(src, dst string) error {
	err := filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
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
			case "node_modules", ".next", "dist", ".output", ".tanstack", ".git":
				return fs.SkipDir
			}

			target, err := safeJoin(dst, rel)
			if err != nil {
				return err
			}

			if err := os.MkdirAll(target, 0o755); err != nil { //nolint:mnd
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

		target, err := safeJoin(dst, rel)
		if err != nil {
			return err
		}

		return copyFile(p, target, info.Mode().Perm())
	})
	if err != nil {
		return fmt.Errorf("failed to copy template directory: %w", err)
	}

	return nil
}

func copyFile(src, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("failed to open %s: %w", src, err)
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil { //nolint:mnd
		return fmt.Errorf("failed to create directory: %w", err)
	}

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
	if err != nil {
		return fmt.Errorf("failed to create %s: %w", dst, err)
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return fmt.Errorf("failed to copy %s: %w", dst, err)
	}

	return nil
}

// safeJoin joins name under base, rejecting absolute paths and `..` escapes.
func safeJoin(base, name string) (string, error) {
	clean := path.Clean(filepath.ToSlash(name))
	if path.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", fmt.Errorf("refusing path traversal in path %q", name) //nolint:err113
	}

	return filepath.Join(base, filepath.FromSlash(clean)), nil
}
