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
	"os"
	"os/exec"
	"path/filepath"

	"github.com/hashicorp/go-getter"
	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var entity string
var choice string

type Entity struct {
	Name      string
	Value     string
	Source    string
	Command   []string
	Templates []Template
	NextSteps string
	Manual    string
	Ignore    []string
}

type Template struct {
	Name  string
	Value string
}

// templatesCmd represents the templates command
var templatesCmd = &cobra.Command{
	Use:     "templates",
	Aliases: []string{"t"},
	Short:   "Generate Nhost compatible front-end templates",
	Long: `Choose from the provided list of front-end choices
and we will automatically initialize an Nhost compatible
template in that choice for you with all the required
Nhost modules and plugins.

And you can immediately start developing on that template.`,
	Run: func(cmd *cobra.Command, args []string) {

		samCLI, err := exec.LookPath("sam")
		if err != nil {
			log.Debug(err)
			log.Fatal("Failed to find AWS SAM utility. Is it properly installed?")
		}

		var selected Entity

		entities := []Entity{
			{
				Name:   "Web or Front-end",
				Value:  "web",
				Source: "github.com/nhost/nhost/templates/",
				Templates: []Template{
					{Name: "NuxtJs", Value: "nuxt"},
					{Name: "NextJs", Value: "next"},
					{Name: "ReactJs", Value: "react"},
				},
				NextSteps: "Use `cd web && npm install --save-dev`",
				Manual:    "git clone github.com/nhost/nhost/templates/" + choice,
			},
			{
				Name:      "API or Nhost Functions",
				Value:     "api",
				Command:   []string{samCLI, "init", "-o", nhost.WORKING_DIR, "-n", "api", "--app-template", "hello-world", "-p", "Zip"},
				NextSteps: "Start testing API with `nhost dev`",

				// Sample SAM initialization command
				Manual: "sam init -o . -n api --app-template hello-world -p Zip",
				Ignore: []string{".aws-sam"},
			},
		}

		// configure interactive prompt template
		promptTemplate := promptui.SelectTemplates{
			Active:   `✔ {{ .Name | cyan | bold }}`,
			Inactive: `   {{ .Name | cyan }}`,
			Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}`,
		}

		// if the user hasn't supplied an entity,
		// provide a prompt for it
		if len(entity) == 0 {

			// propose boilerplate options
			boilerplatePrompt := promptui.Select{
				Label:     "Choose Entity",
				Items:     entities,
				Templates: &promptTemplate,
			}

			index, _, err := boilerplatePrompt.Run()
			if err != nil {
				log.Fatal("Aborted")
			}

			selected = entities[index]

		} else {

			ok := false
			for _, item := range entities {
				if item.Value == entity {
					selected = item
					ok = true
					break
				}
			}
			if !ok {
				log.WithField("component", choice).Fatal("No such entity available")
			}
		}

		if selected.Source != "" {

			// if the use has specified choice flag,
			// then skip the selection prompt

			if len(choice) == 0 {

				// propose boilerplate options
				boilerplatePrompt := promptui.Select{
					Label:     "Choose Preferred Template",
					Items:     selected.Templates,
					Templates: &promptTemplate,
				}

				index, _, err := boilerplatePrompt.Run()
				if err != nil {
					log.Fatal("Aborted")
				}

				choice = selected.Templates[index].Value

			} else {

				ok := false
				for _, item := range selected.Templates {
					if item.Value == choice {
						ok = true
					}
				}
				if !ok {
					log.WithField("component", choice).Fatal("No such framework found")
				}
			}

			destination, err := filepath.Abs(selected.Value)
			if err != nil {
				log.Debug(err)
				log.Fatal("Failed to parse clone destionation")
			}

			// initialize hashicorp go-getter client
			client := &getter.Client{
				Ctx: context.Background(),
				//define the destination to where the directory will be stored. This will create the directory if it doesnt exist
				Dst:  destination,
				Dir:  true,
				Src:  selected.Source,
				Mode: getter.ClientModeDir,
				//define the type of detectors go getter should use, in this case only github is needed
				Detectors: []getter.Detector{
					&getter.GitHubDetector{},
				},
			}

			// append the chosen result template to source URL
			client.Src += choice

			//download the files
			if err := client.Get(); err != nil {
				log.WithField("compnent", selected.Value).Debug(err)
				log.WithField("compnent", selected.Value).Error("Failed to clone template")
				log.WithField("compnent", selected.Value).Info("Please install it manually with: ", selected.Manual)
				os.Exit(1)
			}

		} else {

			execute := exec.Cmd{
				Path:   samCLI,
				Args:   selected.Command,
				Dir:    nhost.WORKING_DIR,
				Stdin:  os.Stdin,
				Stdout: os.Stdout,
			}

			if err := execute.Run(); err != nil {
				log.WithField("compnent", selected.Value).Debug(err)
				log.WithField("compnent", selected.Value).Error("Failed to clone template")
				log.WithField("compnent", selected.Value).Info("Please install it manually with: ", selected.Manual)
				os.Exit(1)
			}
		}

		// if there are any ignore files,
		// append them to .gitignore

		for _, file := range selected.Ignore {

			if err = writeToFile(filepath.Join(nhost.WORKING_DIR, ".gitignore"), "\n"+file, "end"); err != nil {
				log.Debug(err)
				log.Warnf("Failed to add `%s` to .gitignore", file)
			}
		}

		log.WithField("compnent", selected.Value).Info("Template generated successfully")
		fmt.Println()

		// advise the user about next steps
		log.Info(selected.NextSteps)
	},
}

/*
// fetches list of templates from nhost/nhost/templates
func getTemplates(url string) ([]string, error) {

	var response []string

	resp, err := http.Get(url)
	if err != nil {
		return response, err
	}

	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return response, err
	}

	var raw map[string]interface{}
	if err = json.Unmarshal(body, &raw); err != nil {
		return response, err
	}

	var list []map[string]interface{}
	tree, err := json.Marshal(raw["tree"])
	if err != nil {
		return response, err
	}

	if err = json.Unmarshal(tree, &list); err != nil {
		return response, err
	}

	for _, item := range list {
		response = append(response, item["path"].(string))
	}

	return response, nil
}
*/

func init() {
	rootCmd.AddCommand(templatesCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// templatesCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	templatesCmd.Flags().StringVarP(&choice, "choice", "c", "", "Choice of template to clone")
	templatesCmd.Flags().StringVarP(&entity, "entity", "e", "", "Entity to clone the template for [web/api]")
}
