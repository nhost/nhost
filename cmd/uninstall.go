/*
MIT License

Copyright (c) Nhost

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

package cmd

import (
	"os"
	"os/exec"
	"path/filepath"

	"github.com/manifoldco/promptui"
	"github.com/nhost/cli-go/nhost"
	"github.com/nhost/cli-go/util"
	"github.com/spf13/cobra"
)

// initialize flag to bypass approval prompt
var approve bool

// uninstallCmd removed Nhost CLI from system
var uninstallCmd = &cobra.Command{
	Use:   "uninstall",
	Short: "Remove the installed CLI from system permanently",
	Long: `Remove the installed CLI from system permanently
but without hurting local Nhost apps and their data.`,
	Run: func(cmd *cobra.Command, args []string) {

		log.Warn("This will permanently remove the installed CLI utility")
		log.Info("This, however, won't affect your existing Nhost apps and their data")

		// if the use has not pre-approved the uninstall,
		// take the user's approval manually
		if !approve {

			// configure interative prompt
			prompt := promptui.Prompt{
				Label:     "Are you sure you want to continue",
				IsConfirm: true,
			}

			_, err := prompt.Run()
			if err != nil {
				os.Exit(0)
			}

		}

		// first delete the Nhost Root directory
		if err := util.DeleteAllPaths(nhost.ROOT); err != nil {
			log.Debug(err)
			log.Fatal("Failed to delete ", filepath.Base(nhost.ROOT))
		}

		// now delete the installed binary
		cli, err := exec.LookPath("nhost")
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to find `nhost` installed in the system")
		}
		if err := util.DeletePath(cli); err != nil {
			log.Debug(err)
			log.Fatal("Failed to delete the installed binary from ", cli)
		}

		// remove NHOST ROOT Dir as well
		if err := util.DeleteAllPaths(nhost.ROOT); err != nil {
			log.Debug(err)
			log.Fatal("Failed to delete Nhost root directory", nhost.ROOT)
		}

		log.Info("Uninstall complete! We are sad to see you go :(")
	},
}

func init() {
	rootCmd.AddCommand(uninstallCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	uninstallCmd.Flags().BoolVarP(&approve, "approve", "a", false, "Approve uninstall")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
}
