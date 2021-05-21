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
	"strings"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

// reset approval flag
var yes bool

// resetCmd represents the reset command
var resetCmd = &cobra.Command{
	Use:   "reset",
	Short: "A brief description of your command",
	Long: `A longer description that spans multiple lines and likely contains examples
and usage of using your command. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
	Run: func(cmd *cobra.Command, args []string) {

		if !yes {

			// warn the user of consequences
			printMessage("this is irreversible will remove all installed Nhost config from this project", "danger")

			// configure interative prompt
			prompt := promptui.Prompt{
				Label:     "Are you sure you want to proceed?",
				IsConfirm: true,
			}

			response, err := prompt.Run()
			if err != nil {
				throwError(err, "prompt aborted", true)
			}

			if strings.ToLower(response) == "y" || strings.ToLower(response) == "yes" {
				yes = true
			}
		}

		if yes {

			if err := deleteAllPaths(dotNhost); err != nil {
				throwError(err, "couldn't delete "+dotNhost+"\nplease delete them manually", true)
			}

			if err := deleteAllPaths(nhostDir); err != nil {
				throwError(err, "couldn't delete "+nhostDir+"\nplease delete them manually", true)
			}
		}

		// signify reset completion
		printMessage("nhost/ and .nhost/ permanently removed from this project", "warn")
	},
}

func init() {
	rootCmd.AddCommand(resetCmd)

	// Here you will define your flags and configuration settings.
	resetCmd.PersistentFlags().BoolVarP(&yes, "yes", "y", false, "Bypass approval prompt and proceed ahead with reset")

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// resetCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// resetCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
