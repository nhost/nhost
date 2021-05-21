package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"os"
	"os/exec"
	"path"
)

func generateNuxtBoilerplate(project, projectDir, nhostBackendDomain, nhostHasuraEndpoint string) error {

	// create frontend dir
	if !pathExists(projectDir) {

		if VERBOSE {
			Print("initializing frontend code directories...", "info")
		}
		// if it doesn't exist, then create it
		if err := os.MkdirAll(projectDir, os.ModePerm); err != nil {
			return err
		}
	}

	// create or append to package.json
	f, err := os.Create(path.Join(projectDir, "package.json"))
	if err != nil {
		return err
	}

	defer f.Close()

	if VERBOSE {
		Print("writing package.json...", "info")
	}

	if _, err = f.WriteString(getPackageDotJSON(project)); err != nil {
		return err
	}
	f.Sync()

	// create nuxt project by invoking npm
	npmCLI, err := exec.LookPath("npm")
	if err != nil {
		return err
	}

	args := []string{npmCLI, "install", "nuxt"}

	execute := exec.Cmd{
		Path: npmCLI,
		Args: args,
		Dir:  projectDir,
	}

	if VERBOSE {
		Print("installing NuxtJs in your frontend code...", "info")
	}

	if err = execute.Run(); err != nil {
		return err
	}

	// create "pages" directory
	pagesDir := path.Join(projectDir, "pages")
	if err := os.MkdirAll(pagesDir, os.ModePerm); err != nil {
		return err
	}

	// create or append to package.json
	f, err = os.Create(path.Join(pagesDir, "index.html"))
	if err != nil {
		return err
	}

	defer f.Close()

	if VERBOSE {
		Print("writing index.html file...", "info")
	}

	// prepare html template
	var writer bytes.Buffer

	t, _ := template.New("foo").Parse(`<html><body>{{define "T"}}You know why you are awesome?{{.}}!{{end}}</body></html>`)
	if err = t.ExecuteTemplate(&writer, "T", "Because you just used Nhost to setup a full-stack project in 5 minutes!"); err != nil {
		return err
	}

	if _, err = f.WriteString(writer.String()); err != nil {
		return err
	}
	f.Sync()

	// write nuxt.config.js

	// but before install required modules
	modules := []string{"@nuxtjs/apollo", "@nhost/nuxt"}

	for _, module := range modules {

		args := []string{npmCLI, "install", module, "-d"}

		execute := exec.Cmd{
			Path: npmCLI,
			Args: args,
			Dir:  projectDir,
		}

		if VERBOSE {
			Print(fmt.Sprintf("installing %s module in your Nuxt project...", module), "info")
		}

		if err = execute.Run(); err != nil {
			return err
		}

	}

	f, err = os.Create(path.Join(projectDir, "nuxt.config.js"))
	if err != nil {
		return err
	}

	defer f.Close()

	if VERBOSE {
		Print("writing nuxt.config.js file...", "info")
	}

	if _, err = f.WriteString(getNuxtConfig(project, nhostBackendDomain, modules)); err != nil {
		return err
	}
	f.Sync()

	// create "plugins" directory
	pluginsDir := path.Join(projectDir, "plugins")
	if err := os.MkdirAll(pluginsDir, os.ModePerm); err != nil {
		return err
	}

	// create "nhost-apollo-config.js"
	f, err = os.Create(path.Join(pluginsDir, "nhost-apollo-config.js"))
	if err != nil {
		return err
	}

	defer f.Close()

	if VERBOSE {
		Print("creating Nhost apollo plugin configuration...", "info")
	}

	if _, err = f.WriteString(getNhostApolloConfig(nhostHasuraEndpoint)); err != nil {
		return err
	}
	f.Sync()

	// create "nhost-apollo-ws-client.js"
	f, err = os.Create(path.Join(pluginsDir, "nhost-apollo-ws-client.js"))
	if err != nil {
		return err
	}

	defer f.Close()

	if VERBOSE {
		Print("creating Nhost apollo websocket client plugin...", "info")
	}

	if _, err = f.WriteString(getNhostApolloClientPlugin()); err != nil {
		return err
	}
	f.Sync()

	return nil
}

func getPackageDotJSON(project string) string {
	return fmt.Sprintf(`
	{
		"name": "%s",
		"scripts": {
		  "dev": "nuxt",
		  "build": "nuxt build",
		  "generate": "nuxt generate",
		  "start": "nuxt start"
		}
	  }	  
	`, project)
}

func getNuxtConfig(project, nhostURL string, modules []string) string {

	config := map[string]interface{}{
		"head": map[string]interface{}{
			"title": project,
			"htmlAttrs": map[string]string{
				"lang": "en",
			},
			"meta": []map[string]string{
				{"charset": "utf-8"},
				{"name": "viewport", "content": "width=device-width, initial-scale=1"},
				{"name": "description", "content": "", "hid": "description"},
			},
		},
		"components": true,
		"modules":    modules,
		"plugins": []map[string]string{
			{"source": "~/plugins/nhost-apollo-ws-client.js", "mode": "client"},
		},
		"apollo": map[string]interface{}{
			"clientConfigs": map[string]string{
				"default": "~/plugins/nhost-apollo-config.js",
			},
		},
		"nhost": []map[string]interface{}{
			{
				"baseURL": nhostURL,
				"routes": map[string]interface{}{
					"home":   "/dashboard",
					"logout": "/login",
				},
			},
		},
		"router": map[string]interface{}{"middleware": []string{"nhost/auth"}},
	}

	bytes, _ := json.MarshalIndent(config, "", " ")
	marshalled, _ := json.Marshal(bytes)

	return fmt.Sprintf(`
export default 
	%v,
`, string(marshalled))
}

func getNhostApolloClientPlugin() string {
	return `
	export default(ctx) => {
		const subscriptionClient = ctx.app.apolloProvider.defaultClient.wsClient;
	  
		ctx.$nhost.auth.onAuthStateChanged((state) => {
		  if (subscriptionClient.status === 1) {
			subscriptionClient.close();
			subscriptionClient.tryReconnect();
		  }
		});
	  
		ctx.$nhost.auth.onTokenChanged(() => {
		  if (subscriptionClient.status === 1) {
			subscriptionClient.tryReconnect();
		  }
		})
	  }	
`
}

func getNhostApolloConfig(hasuraEndpoint string) string {

	config := map[string]interface{}{
		"httpEndpoint": fmt.Sprintf("'https://%s/v1/graphql'", hasuraEndpoint),
		"wsEndpoint":   fmt.Sprintf("'wss://%s/v1/graphql'", hasuraEndpoint),
		"getAuth":      fmt.Sprint("`() => `Bearer ${ctx.$nhost.auth.getJWTToken()}`"),
	}
	bytes, _ := json.MarshalIndent(config, "", " ")
	marshalled, _ := json.Marshal(bytes)

	return fmt.Sprintf(`
export default(ctx) => {
	return %v
  }
`, string(marshalled))
}
