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
	"context"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"runtime"
	"strings"

	"github.com/hashicorp/go-getter"
	"github.com/spf13/cobra"
)

// upgradeCmd represents the upgrade command
var upgradeCmd = &cobra.Command{
	Use:   "upgrade",
	Short: "Upgrade this utility to latest version",
	Long: `Automatically check for the latest available version of this
	utility and upgrade to it.`,
	Run: func(cmd *cobra.Command, args []string) {

		release, err := getLatestRelease()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch latest release")
		}

		if release.TagName == BuildVersion {
			log.WithField("component", release.TagName).Info("You already have the latest version. Hurray!")
		} else {
			log.WithField("component", release.TagName).Info("New version available")

			downloadURL := getAssetURL(release)

			// initialize hashicorp go-getter client
			client := &getter.Client{
				Ctx: context.Background(),
				//define the destination to where the directory will be stored. This will create the directory if it doesnt exist
				Dst:  workingDir,
				Dir:  false,
				Src:  downloadURL,
				Mode: getter.ClientModeDir,
			}

			//download the files
			if err := client.Get(); err != nil {
				log.WithField("compnent", release.TagName).Debug(err)
				log.WithField("compnent", release.TagName).Fatal("Failed to download release")
			}

			log.WithField("compnent", release.TagName).Info("New release downloaded in current working directory")
			log.Infof("Use it with: %v./nhost -- help%v", Bold, Reset)
		}
	},
}

// generates asset name depending on OS and Arch
func getAssetURL(release Release) string {

	payload := []string{"nhost", release.TagName, runtime.GOOS, runtime.GOARCH}

	var response string

	for _, asset := range release.Assets {
		if strings.Contains(asset.BrowserDownloadURL, strings.Join(payload, "-")) {
			response += asset.BrowserDownloadURL
			break
		}
	}

	return response
}

// fetches the details of latest binary release
func getLatestRelease() (Release, error) {

	var response Release

	resp, err := http.Get("https://api.github.com/repos/mrinalwahal/cli/releases/latest")
	if err != nil {
		return response, err
	}

	// read our opened xmlFile as a byte array.
	body, _ := ioutil.ReadAll(resp.Body)

	defer resp.Body.Close()

	json.Unmarshal(body, &response)

	return response, nil
}

func init() {
	rootCmd.AddCommand(upgradeCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// upgradeCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// upgradeCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
