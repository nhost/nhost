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

	projectDirs := []string{"/", "pages", "components", "assets", "layouts", "middleware", "plugins", "static", "store"}

	// create all frontend directories
	for _, dir := range projectDirs {
		if !pathExists(path.Join(projectDir, dir)) {
			if err := os.MkdirAll(path.Join(projectDir, dir), os.ModePerm); err != nil {
				return err
			}
		}
	}

	// create or append to package.json
	f, err := os.Create(path.Join(projectDir, "package.json"))
	if err != nil {
		return err
	}

	defer f.Close()

	log.Debug("Writing package.json")

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

	log.Debug("Installing NuxtJs in your boilerplate")

	if err = execute.Run(); err != nil {
		return err
	}

	// create index.vue file to be served at "/"
	f, err = os.Create(path.Join(projectDir, "pages", "index.vue"))
	if err != nil {
		return err
	}

	defer f.Close()

	log.Debug("Writing index file to serve at '/'")

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

		args := []string{npmCLI, "install", "--save", module, "-d"}

		execute := exec.Cmd{
			Path: npmCLI,
			Args: args,
			Dir:  projectDir,
		}

		log.Debugf("Installing %s module in your Nuxt project", module)

		if err = execute.Run(); err != nil {
			return err
		}

	}

	f, err = os.Create(path.Join(projectDir, "nuxt.config.js"))
	if err != nil {
		return err
	}

	defer f.Close()

	log.Debug("Writing nuxt.config.js file")

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

	log.Info("Creating Nhost apollo plugin configuration")

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

	log.Info("Creating Nhost apollo websocket client plugin")

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

	log.Debug("Genearting nuxt.config.js file with your Nhost specific domains")

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
`, marshalled)
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

	log.Debug("Generating Nuxt Apollo config with your Nhost specific project domains")

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
