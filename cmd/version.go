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
	"runtime"

	"github.com/nhost/cli-go/nhost"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

// versionCmd represents the version command
var versionCmd = &cobra.Command{
	Use:     "version",
	Aliases: []string{"v"},
	Short:   "Show the current version of Nhost CLI you have installed",
	Long:    `All softwares have versions. This is Nhost's.`,
	Run: func(cmd *cobra.Command, args []string) {

		log.WithFields(logrus.Fields{
			"os":   runtime.GOOS,
			"arch": runtime.GOARCH,
		}).Info(Version)

		if repoSource == "" {
			repoSource = nhost.REPOSITORY
		}

		release, err := nhost.LatestRelease(repoSource)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch latest release")
		}

		if release.TagName == Version {
			log.Info("You have the latest version. Hurray!")
		} else {
			log.WithField("component", release.TagName).Info("New version available")
			log.Info("Upgrade with `nhost upgrade`")
		}
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// versionCmd.PersistentFlags().String("foo", "", "A help for foo")
	versionCmd.PersistentFlags().StringVarP(&repoSource, "source", "s", "", "Custom repository source")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
}
