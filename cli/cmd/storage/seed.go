package storage

import "github.com/urfave/cli/v3"

func CommandSeed() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "seed",
		Aliases: []string{},
		Usage:   "Snapshot a bucket's files (create) or restore them (apply)",
		Description: "Storage seeds are file snapshots tied to existing storage.files metadata. " +
			"`create` downloads every uploaded row's content for a bucket; `apply` uploads " +
			"those files back into a target environment whose metadata is already in place.",
		Commands: []*cli.Command{
			CommandCreate(),
			CommandApply(),
		},
	}
}
