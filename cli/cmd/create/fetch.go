package create

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

var (
	errTemplateNotDirectory = errors.New("template path is not a directory")
	// Every template supplies a frontend app, and the scaffolding reads
	// frontend/package.json to set the project name and to rewrite the
	// package-manager commands in the docs.
	errTemplateMissingFrontend = errors.New("template has no frontend/package.json")
	gitLookPath                = exec.LookPath //nolint:gochecknoglobals // test seam for git availability
)

func fetchTemplate(
	ctx context.Context,
	repo string,
	ref string,
	tmpl template,
	staging string,
) error {
	gitPath, err := gitLookPath("git")
	if err != nil {
		return fmt.Errorf(
			"git is required to fetch templates from %s at %s; install git or use --template-path for a local template: %w",
			repo,
			ref,
			err,
		)
	}

	tmpClone, err := os.MkdirTemp("", "nhost-create-template-*")
	if err != nil {
		return fmt.Errorf("failed to create temporary clone directory: %w", err)
	}
	defer os.RemoveAll(tmpClone)

	if err := cloneTemplateRepo(ctx, gitPath, repo, ref, tmpClone); err != nil {
		return err
	}

	if err := sparseCheckoutTemplate(ctx, gitPath, tmpClone, tmpl); err != nil {
		return err
	}

	src := filepath.Join(tmpClone, "templates", tmpl.name)
	if info, err := os.Stat(src); err != nil {
		return fmt.Errorf(
			"template %q was not found in %s at %s: %w",
			tmpl.name,
			repo,
			ref,
			err,
		)
	} else if !info.IsDir() {
		return fmt.Errorf(
			"template %q in %s at %s: %w",
			tmpl.name,
			repo,
			ref,
			errTemplateNotDirectory,
		)
	}

	if err := copyDir(src, staging); err != nil {
		return fmt.Errorf("failed to copy fetched template %q: %w", tmpl.name, err)
	}

	return nil
}

func cloneTemplateRepo(ctx context.Context, gitPath, repo, ref, tmpClone string) error {
	cmd := exec.CommandContext(
		ctx,
		gitPath,
		"clone",
		"--depth",
		"1",
		"--filter=blob:none",
		"--sparse",
		"--branch",
		ref,
		"--",
		repo,
		tmpClone,
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		// The default ref is this CLI's release tag, so a ref that does not
		// resolve is only recoverable through the override; both are hidden.
		return fmt.Errorf(
			"failed to clone templates repo %s at %s: %w\n%s\n"+
				"if that ref does not exist, pick another with --templates-ref or NHOST_CREATE_TEMPLATES_REF",
			repo,
			ref,
			err,
			bytes.TrimSpace(out),
		)
	}

	return nil
}

func sparseCheckoutTemplate(ctx context.Context, gitPath, tmpClone string, tmpl template) error {
	templatePath := filepath.ToSlash(filepath.Join("templates", tmpl.name))

	cmd := exec.CommandContext(
		ctx,
		gitPath,
		"-C",
		tmpClone,
		"sparse-checkout",
		"set",
		templatePath,
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to sparse-checkout template %q: %w\n%s", tmpl.name, err, out)
	}

	return nil
}
