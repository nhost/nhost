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
	"path/filepath"

	"github.com/manifoldco/promptui"
	"github.com/mrinalwahal/cli/nhost"
	"github.com/spf13/cobra"
)

var (
	entity   string
	choice   string
	selected Entity

	// configure interactive prompt template
	templatesPromptTemplate = promptui.SelectTemplates{
		Active:   `✔ {{ .Name | cyan | bold }}`,
		Inactive: `   {{ .Name | cyan }}`,
		Selected: `{{ "✔" | green | bold }} {{ "Selected" | bold }}: {{ .Name | cyan }}`,
	}
)

type Entity struct {
	Name        string
	Value       string
	Source      string
	Command     []string
	Templates   []Template
	NextSteps   string
	Manual      string
	Ignore      []string
	Destination string
	Default     bool
}

//	Returns boolean, if entity contains templates or not.
func (e *Entity) contains(choice string) bool {

	for _, item := range e.Templates {
		if item.Value == choice {
			return true
		}
	}

	return false
}

//	Returns boolean, if entity exists or not.
func exists(list []Entity, child string) bool {

	for _, item := range list {
		if item.Value == child {
			return true
		}
	}

	return false
}

type Template struct {
	Name  string
	Value string
}

var entities = []Entity{
	{
		Name:        "Web or Front-end",
		Value:       "web",
		Destination: nhost.WEB_DIR,
		Source:      "github.com/nhost/nhost/templates/web/",
		Templates: []Template{
			{Name: "NuxtJs", Value: "nuxt"},
			{Name: "NextJs", Value: "next"},
			{Name: "ReactJs", Value: "react"},
		},
		NextSteps: "Use `cd web && npm install`",
		Manual:    "git clone github.com/nhost/nhost/templates/web/" + choice,
	},
	{
		Name:        "Functions",
		Value:       "functions",
		Destination: nhost.API_DIR,
		Source:      "github.com/nhost/nhost/templates/functions/",
		Templates: []Template{
			{Name: "Golang", Value: "go"},
			{Name: "NodeJs", Value: "node"},
		},
		NextSteps: "",
		Manual:    "git clone github.com/nhost/nhost/templates/functions/" + choice,
	},
	{
		Name:        "Emails",
		Value:       "emails",
		Default:     true,
		Destination: nhost.EMAILS_DIR,
		Source:      "github.com/nhost/hasura-auth/email-templates/",
		/*
			Templates: []Template{
				{Name: "Passwordless", Value: "passwordless"},
				{Name: "Reset Email", Value: "reset-email"},
				{Name: "Reset Password", Value: "reset-password"},
				{Name: "Verify Email", Value: "verify-email"},
			},
		*/
		Manual: "git clone github.com/nhost/hasura-auth/email-templates/" + choice,
	},
}

// templatesCmd represents the templates command
var templatesCmd = &cobra.Command{
	Use:    "templates",
	Hidden: true,
	Short:  "Clone Nhost compatible ready-made templates",
	Long: `Choose from the provided list of framework choices
and we will automatically initialize an Nhost compatible
template in that choice for you with all the required
Nhost modules and plugins.

And you can immediately start developing on that template.`,
	PreRun: func(cmd *cobra.Command, args []string) {

		// if the user hasn't supplied an entity,
		// provide a prompt for it
		if len(entity) == 0 {

			// propose boilerplate options
			boilerplatePrompt := promptui.Select{
				Label:     "Type of template",
				Items:     entities,
				Templates: &templatesPromptTemplate,
			}

			index, _, err := boilerplatePrompt.Run()
			if err != nil {
				os.Exit(0)
			}

			selected = entities[index]

		} else if !exists(entities, entity) {
			log.WithField("component", entity).Fatal("No such entity available")
		}

	},
	Run: func(cmd *cobra.Command, args []string) {

		// if the use has specified choice flag,
		// then skip the selection prompt

		if len(choice) == 0 {

			if len(selected.Templates) > 0 {

				// propose boilerplate options
				boilerplatePrompt := promptui.Select{
					Label:     "Choose Preferred Template",
					Items:     selected.Templates,
					Templates: &templatesPromptTemplate,
				}

				index, _, err := boilerplatePrompt.Run()
				if err != nil {
					os.Exit(0)
				}

				choice = selected.Templates[index].Value
			}

		} else if !selected.contains(choice) {
			log.WithField("component", choice).Fatal("No such framework found")
		}

		// append the chosen result template to source URL
		selected.Source += choice

		// clone the data
		if err := clone(selected.Source, selected.Destination); err != nil {
			log.WithField("compnent", selected.Value).Debug(err)
			log.WithField("compnent", selected.Value).Error("Failed to clone template")
			log.WithField("compnent", selected.Value).Info("Please install it manually with: ", selected.Manual)
			os.Exit(1)
		}

		// if there are any ignore files,
		// append them to .gitignore

		for _, file := range selected.Ignore {
			if err := writeToFile(filepath.Join(nhost.WORKING_DIR, ".gitignore"), "\n"+file, "end"); err != nil {
				log.Debug(err)
				log.Warnf("Failed to add `%s` to .gitignore", file)
			}
		}

	},
	PostRun: func(cmd *cobra.Command, args []string) {
		log.WithField("compnent", selected.Value).Info("Template cloned successfully")
		if selected.NextSteps != "" {
			log.Info(selected.NextSteps)
		}
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
	// templatesCmd.Flags().BoolVarP(&allChoices, "all", "a", false, "Clone all templates")
	templatesCmd.Flags().StringVarP(&entity, "entity", "e", "", "Entity to clone the template for [web/api]")
}
