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
	"context"
	"fmt"
	"path"

	"github.com/hashicorp/go-getter"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

// templatesCmd represents the templates command
var templatesCmd = &cobra.Command{
	Use:   "templates",
	Short: "Generate Nhost compatible front-end templates",
	Long: `Choose from the provided list of front-end frameworks
and we will automatically initialize an Nhost compatible
template in that framework for you with all the required
Nhost modules and plugins.

And you can immediately start developing on that template.`,
	Run: func(cmd *cobra.Command, args []string) {

		// initialize templates

		templates := []map[string]string{
			{"key": "NuxtJs", "value": "nuxt"},
			//{"key": "NextJs", "value": "next"},
		}

		// configure interactive prompt template
		promptTemplate := promptui.SelectTemplates{
			Active:   `✔ {{ .key | cyan | bold }}`,
			Inactive: `   {{ .key | cyan }}`,
			Selected: `{{ "✔" | green | bold }} {{ "Selected Template" | bold }}: {{ .key | cyan }}`,
		}

		// propose boilerplate options
		boilerplatePrompt := promptui.Select{
			Label:     "Choose Preferred Template",
			Items:     templates,
			Templates: &promptTemplate,
		}

		index, _, err := boilerplatePrompt.Run()
		if err != nil {
			log.Debug(err)
			log.Fatal("Input prompt failed")
		}

		result := templates[index]["value"]

		// intialize the web project directory
		webDir := path.Join(workingDir, "web")

		// initialize hashicorp go-getter client
		client := &getter.Client{
			Ctx: context.Background(),
			//define the destination to where the directory will be stored. This will create the directory if it doesnt exist
			Dst:  webDir,
			Dir:  true,
			Src:  "github.com/nhost/nhost/templates/",
			Mode: getter.ClientModeDir,
			//define the type of detectors go getter should use, in this case only github is needed
			Detectors: []getter.Detector{
				&getter.GitHubDetector{},
			},
		}

		// append the chosen result template to source URL
		client.Src += result

		//download the files
		if err := client.Get(); err != nil {
			log.WithField("compnent", result).Debug(err)
			log.WithField("compnent", result).Fatal("Failed to download")
		}
		log.WithField("compnent", result).Debug("Template skeleton download complete")

		/*
			// create nuxt project by invoking npm
			npmCLI, err := exec.LookPath("npm")
			if err != nil {
				log.WithField("compnent", result).Debug(err)
				log.WithField("compnent", result).Fatal("Failed to find npm. Is it properly installed?")
			}

			args = []string{npmCLI, "install", "--save-dev"}

			execute := exec.Cmd{
				Path: npmCLI,
				Args: args,
				Dir:  webDir,
			}

			log.WithField("compnent", result).Info("Installing the framework inside your downloaded template")

			if err = execute.Run(); err != nil {
				log.WithField("compnent", result).Debug(err)
				log.WithField("compnent", result).Error("Failed to install framework inside your downloaded template")
				log.WithField("compnent", result).Info("Please install the framework manually with: npm ", execute.Args)
				os.Exit(1)
			}
		*/

		log.WithField("compnent", result).Info("Template generation successful")
		fmt.Println()

		log.Infof("Do install selected framework, do: %vcd web && npm install --save-dev%v", Bold, Reset)
		fmt.Println()
	},
}

func init() {
	rootCmd.AddCommand(templatesCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// templatesCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// templatesCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
