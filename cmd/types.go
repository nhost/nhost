package cmd

type (

	// Authentication validation response
	HasuraResponse struct {
		Path  string `json:"path"`
		Error string `json:"error"`
		Code  string `json:"code"`
	}

	// Container service
	Container struct {
		Image               string
		Name                string
		Command             []string
		Entrypoint          string
		Environment         map[string]interface{}
		Ports               []string
		Restart             string
		User                string
		Volumes             []string
		DependsOn           []string `yaml:"depends_on,omitempty"`
		EnvFile             []string `yaml:"env_file,omitempty"`
		Build               map[string]string
		HealthCheckEndpoint string
	}

	/*
		// Container services
		Services struct {
			Containers map[string]Container `yaml:"services,omitempty"`
			Version    string
		}
	*/

	ExecResult struct {
		StdOut   string
		StdErr   string
		ExitCode int
	}

	// GitHub Release API reponse structure
	Release struct {
		URL         string  `json:",omitempty"`
		Name        string  `json:",omitempty"`
		TagName     string  `json:"tag_name,omitempty"`
		Prerelease  string  `json:",omitempty"`
		CreatedAt   string  `json:",omitempty"`
		PublishedAt string  `json:",omitempty"`
		Body        string  `json:",omitempty"`
		Assets      []Asset `json:",omitempty"`
	}

	// GitHub Release API Assets structure
	Asset struct {
		URL                string `json:",omitempty"`
		Name               string `json:",omitempty"`
		ID                 string `json:",omitempty"`
		Label              string `json:",omitempty"`
		BrowserDownloadURL string `json:"browser_download_url,omitempty"`
		Size               int    `json:",omitempty"`
	}
)
