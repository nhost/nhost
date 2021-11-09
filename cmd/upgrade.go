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
	"os"
	"os/exec"
	"os/user"
	"runtime"

	"github.com/hashicorp/go-getter"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/spf13/cobra"
)

var versionForDownload string

//  upgradeCmd represents the upgrade command
var upgradeCmd = &cobra.Command{
	Use:        "upgrade",
	SuggestFor: []string{"version"},
	Short:      "Upgrade this version of Nhost CLI to latest version",
	Long: `Automatically check for the latest available version of this
CLI and upgrade to it.`,
	PreRun: func(cmd *cobra.Command, args []string) {

		switch runtime.GOOS {
		case "windows":
			log.Warn("Make sure you are running this environment with root privileges")
		default:
			if !isRoot() {
				log.Fatal("Run this command with root/sudo permissions")
			}
		}
	},
	Run: func(cmd *cobra.Command, args []string) {

		//	Get all the releases
		releases, err := nhost.GetReleases()
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch releases")
		}

		//	Search for our required release from the list
		release, err := nhost.SearchRelease(releases, versionForDownload)
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to fetch release")
		}

		if release.TagName == Version {
			log.WithField("component", release.TagName).Info("You have the latest version. Hurray!")
		} else {
			log.WithField("component", release.TagName).Info("Downloading new version")

			asset := release.Asset()

			//	If there is no asset for our runtime,
			//	then abort
			if asset.BrowserDownloadURL == "" {
				log.WithField("component", release.TagName).Fatal("Version not yet available. Try again in a moment!")
			}

			//  Fetch installed binary location
			target, err := os.Executable()
			if err != nil {
				log.Error("Failed to find installed CLI")
				log.Info("Please download it manually from: github.com/%s", nhost.REPOSITORY)
				os.Exit(0)
			}

			//	Delete the existing CLI
			if err = os.Remove(target); err != nil {
				log.Fatal("Failed to remove existing CLI from: ", target)
			}

			//  Initialize hashicorp go-getter client
			client := &getter.Client{
				Ctx:  context.Background(),
				Dst:  target,
				Src:  asset.BrowserDownloadURL,
				Mode: getter.ClientModeFile,
			}

			//  Download the files
			if err := client.Get(); err != nil {
				log.WithField("compnent", release.TagName).Debug(err)
				log.WithField("compnent", release.TagName).Fatal("Failed to download release")
			}
		}
	},
	PostRun: func(cmd *cobra.Command, args []string) {

		//  Check new version
		target, _ := os.Executable()
		if output, err := exec.Command(target, "version").CombinedOutput(); err != nil {
			log.Infof("Check new version with: %vnhost version%v", util.Bold, util.Reset)
		} else {
			os.Stdout.Write(output)
		}
	},
}

func isRoot() bool {
	switch runtime.GOOS {
	case "windows":
		/*
			var sid *windows.SID

			//  Although this looks scary, it is directly copied from the
			//  official windows documentation. The Go API for this is a
			//  direct wrap around the official C++ API.
			//  See https://docs.microsoft.com/en-us/windows/desktop/api/securitybaseapi/nf-securitybaseapi-checktokenmembership
			err := windows.AllocateAndInitializeSid(
				&windows.SECURITY_NT_AUTHORITY,
				2,
				windows.SECURITY_BUILTIN_DOMAIN_RID,
				windows.DOMAIN_ALIAS_RID_ADMINS,
				0, 0, 0, 0, 0, 0,
				&sid)
			if err != nil {
				log.Debug("SID Error: %s", err)
				return false
			}

			//  This appears to cast a null pointer so I'm not sure why this
			//  works, but this guy says it does and it Works for Me™:
			//  https://github.com/golang/go/issues/28804#issuecomment-438838144
			token := windows.Token(0)

			member, err := token.IsMember(sid)
			if err != nil {
				log.Debug("Token Membership Error: %s", err)
				return false
			}
			return member
		*/
	default:
		currentUser, err := user.Current()
		if err != nil {
			log.Debug(err)
			return false
		}
		return currentUser.Username == "root"
	}
	return false
}

func init() {
	rootCmd.AddCommand(upgradeCmd)

	//  Here you will define your flags and configuration settings.

	//  Cobra supports Persistent Flags which will work for this command
	//  and all subcommands, e.g.:
	upgradeCmd.PersistentFlags().StringVarP(&nhost.REPOSITORY, "source", "s", nhost.REPOSITORY, "Custom repository source")
	upgradeCmd.PersistentFlags().StringVarP(&versionForDownload, "version", "v", "", "Specific version to download")

	//  Cobra supports local flags which will only run when this command
	//  is called directly, e.g.:
	//  upgradeCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
