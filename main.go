package main

import (
	"os"

	"github.com/nhost/hasura-storage/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
