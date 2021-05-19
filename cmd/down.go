/*
Copyright © 2021 NAME HERE <EMAIL ADDRESS>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package cmd

import (
	"os/exec"

	"github.com/spf13/cobra"
)

// downCmd represents the down command
var downCmd = &cobra.Command{
	Use:   "down",
	Short: "Stop and remove local Nhost backend started by \"nhost dev\"",
	Long:  `Stop and remove local Nhost backend started by \"nhost dev\".`,
	Run: func(cmd *cobra.Command, args []string) {

		// run docker-compose up
		execute := exec.Command(
			"docker",
			"rm",
			"nhost_postgres",
			"nhost_hasura",
			"nhost_hbp",
			"nhost_minio",
			"nhost_api",
			"||",
			"true",
		)
		if err := execute.Run(); err != nil {
			throwError(err, "failed to stop nhost docker services", true)
			// [MAJOR] apply cleanup
		}

		printMessage("Local Nhost backend is now down!", "success")
	},
}

func init() {
	rootCmd.AddCommand(downCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// downCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// downCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
