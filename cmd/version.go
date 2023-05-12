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
	"fmt"
	"reflect"
	"runtime"

	"github.com/nhost/cli/nhost"
	"github.com/spf13/cobra"
)

// versionCmd represents the version command
var versionCmd = &cobra.Command{
	Use:        "version",
	Aliases:    []string{"v"},
	SuggestFor: []string{"upgrade"},
	Short:      "Show the current version of Nhost CLI you have installed",
	Long:       `All softwares have versions. This is Nhost's.`,
	PreRun: func(cmd *cobra.Command, args []string) {
		status.Info(fmt.Sprintf("Nhost CLI %s for %s-%s", Version, runtime.GOOS, runtime.GOARCH))
	},
	Run: func(cmd *cobra.Command, args []string) {
		//	Get all the releases
		releases, err := nhost.GetReleases()
		if err != nil {
			log.Debug(err)
			status.Fatal("Failed to fetch releases")
		}

		//	Search for our required release from the list
		release, err := nhost.SearchRelease(releases, versionForDownload)
		if err != nil {
			log.Debug(err)
			status.Fatal("Failed to fetch release")
		}

		if reflect.DeepEqual(release.TagName, Version) {
			status.Successln("You have the latest version. Hurray!")
		} else {

			//	Update changelog
			changelog, _ := release.Changes(releases)
			release.Body += changelog

			status.Infoln("New version " + release.TagName + " available with following changes")
			fmt.Println(release.Body)
			status.Infoln("Upgrade with `nhost upgrade`")
		}
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)

	//  Here you will define your flags and configuration settings.

	//  Cobra supports Persistent Flags which will work for this command
	//  and all subcommands, e.g.:
	//  versionCmd.PersistentFlags().String("foo", "", "A help for foo")
	versionCmd.PersistentFlags().StringVarP(&nhost.REPOSITORY, "source", "s", nhost.REPOSITORY, "Custom repository source")
	versionCmd.PersistentFlags().StringVarP(&versionForDownload, "compare", "c", "", "Specific version to compare")

	//  Cobra supports local flags which will only run when this command
	//  is called directly, e.g.:
}
