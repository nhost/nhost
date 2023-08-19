package config

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/clienv"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v2"
	"github.com/wI2L/jsondiff"
)

const (
	flagEditor = "editor"
)

func CommandEdit() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "edit",
		Aliases: []string{},
		Usage:   "Edit base configuration or an overlay",
		Action:  edit,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagSubdomain,
				Usage:   "If specified, edit this subdomain's overlay, otherwise edit base configuation",
				EnvVars: []string{"NHOST_SUBDOMAIN"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagEditor,
				Usage:   "Editor to use",
				Value:   "vim",
				EnvVars: []string{"EDITOR"},
			},
		},
	}
}

func editFile(ctx context.Context, editor, filepath string) error {
	cmd := exec.CommandContext(
		ctx,
		editor,
		filepath,
	)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to open editor: %w", err)
	}

	return nil
}

func copyConfig(ce *clienv.CliEnv, dst, overlay string) error {
	var cfg *model.ConfigConfig
	if err := clienv.UnmarshalFile(ce.Path.NhostToml(), &cfg, toml.Unmarshal); err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	var err error
	if clienv.PathExists(ce.Path.Overlay(overlay)) {
		cfg, err = applyJSONPatches(ce, *cfg, overlay)
		if err != nil {
			return fmt.Errorf("failed to apply json patches: %w", err)
		}
	}

	if err := clienv.MarshalFile(cfg, dst, toml.Marshal); err != nil {
		return fmt.Errorf("failed to save temporary file: %w", err)
	}

	return nil
}

func readFile(filepath string) (any, error) {
	f, err := os.Open(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	b, err := io.ReadAll(f)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var v any
	if err := toml.Unmarshal(b, &v); err != nil {
		return nil, fmt.Errorf("failed to unmarshal toml: %w", err)
	}

	return v, nil
}

func generateJSONPatch(origfilepath, newfilepath, dst string) error {
	origo, err := readFile(origfilepath)
	if err != nil {
		return fmt.Errorf("failed to convert original toml to json: %w", err)
	}

	newo, err := readFile(newfilepath)
	if err != nil {
		return fmt.Errorf("failed to convert new toml to json: %w", err)
	}

	patches, err := jsondiff.Compare(origo, newo)
	if err != nil {
		return fmt.Errorf("failed to generate json patch: %w", err)
	}

	dstf, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644) //nolint:gomnd
	if err != nil {
		return fmt.Errorf("failed to open destination file: %w", err)
	}
	defer dstf.Close()

	sort.Slice(patches, func(i, j int) bool {
		return patches[i].Path < patches[j].Path
	})

	dstb, err := json.MarshalIndent(patches, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to prettify json: %w", err)
	}

	if _, err := dstf.Write(dstb); err != nil {
		return fmt.Errorf("failed to write to destination file: %w", err)
	}

	return nil
}

func edit(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	if cCtx.String(flagSubdomain) == "" {
		if err := editFile(cCtx.Context, cCtx.String(flagEditor), ce.Path.NhostToml()); err != nil {
			return fmt.Errorf("failed to edit config: %w", err)
		}
		return nil
	}

	if err := os.MkdirAll(ce.Path.OverlaysFolder(), 0o755); err != nil { //nolint:gomnd
		return fmt.Errorf("failed to create json patches directory: %w", err)
	}

	tmpdir, err := os.MkdirTemp(os.TempDir(), "nhost-jsonpatch")
	if err != nil {
		return fmt.Errorf("failed to create temporary directory: %w", err)
	}
	defer os.RemoveAll(tmpdir)

	tmpfileName := filepath.Join(tmpdir, "nhost.toml")

	if err := copyConfig(ce, tmpfileName, cCtx.String(flagSubdomain)); err != nil {
		return fmt.Errorf("failed to copy config: %w", err)
	}

	if err := editFile(cCtx.Context, cCtx.String(flagEditor), tmpfileName); err != nil {
		return fmt.Errorf("failed to edit config: %w", err)
	}

	if err := generateJSONPatch(
		ce.Path.NhostToml(), tmpfileName, ce.Path.Overlay(cCtx.String(flagSubdomain)),
	); err != nil {
		return fmt.Errorf("failed to generate json patch: %w", err)
	}

	return nil
}
