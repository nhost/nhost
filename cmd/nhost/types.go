package nhost

type (

	// Authentication validation response
	Response struct {
		Project           Project `json:",omitempty"`
		User              User
		Error             Error
		Email             string `json:"email"`
		VerificationToken string `json:"verificationToken"`
		VerifiedToken     string `json:"token"`
	}

	// Error structure
	Error struct {
		Code  string
		Email string
	}

	// Nhost individual team structure
	TeamData struct {
		Team Team `json:",omitempty"`
	}

	Team struct {
		Name     string    `json:",omitempty"`
		ID       string    `json:",omitempty"`
		Projects []Project `json:",omitempty"`
	}

	// Nhost project structure
	Project struct {
		ID                          string                   `json:"id" yaml:"project_id"`
		UserID                      string                   `json:"user_id"`
		Team                        Team                     `json:",omitempty"`
		TeamID                      string                   `json:"team_id,omitempty"`
		Type                        string                   `json:",omitempty"`
		Name                        string                   `json:"name"`
		HasuraGQEVersion            string                   `json:"hasura_gqe_version,omitempty"`
		BackendVersion              string                   `json:"backend_version,omitempty"`
		HasuraGQEAdminSecret        string                   `json:"hasura_gqe_admin_secret,omitempty"`
		PostgresVersion             string                   `json:"postgres_version,omitempty"`
		HasuraGQECustomEnvVariables map[string]string        `json:"hasura_gqe_custom_env_variables,omitempty"`
		BackendUserFields           string                   `json:"backend_user_fields,omitempty"`
		HBPDefaultAllowedUserRoles  string                   `json:"hbp_DEFAULT_ALLOWED_USER_ROLES,omitempty"`
		HBPRegistrationCustomFields string                   `json:"hbp_REGISTRATION_CUSTOM_FIELDS,omitempty"`
		HBPAllowedUserRoles         string                   `json:"hbp_allowed_user_roles,omitempty"`
		ProjectDomains              Domains                  `json:"project_domain"`
		ProjectEnvVars              []map[string]interface{} `json:"project_env_vars,omitempty"`
	}

	// Nhost project domains
	Domains struct {
		Hasura string `json:"hasura_domain,omitempty"`
	}

	// Nhost user structure
	User struct {
		ID       string     `json:",omitempty"`
		Projects []Project  `json:",omitempty"`
		Teams    []TeamData `json:",omitempty"`
	}

	// Nhost config.yaml root structure
	Configuration struct {
		MetadataDirectory string                 `yaml:"metadata_directory,omitempty"`
		Services          map[string]Service     `yaml:",omitempty"`
		Authentication    Authentication         `yaml:",omitempty"`
		Version           int                    `yaml:",omitempty"`
		Environment       map[string]interface{} `yaml:",omitempty"`
	}

	// Nhost config.yaml authentication structure
	Authentication struct {
		Endpoints struct {
			Failure string `yaml:"provider_failure_redirect,omitempty"`
			Success string `yaml:"provider_success_redirect,omitempty"`
		} `yaml:",omitempty"`
		Providers map[string]interface{} `yaml:",omitempty"`
	}

	// Nhost config.yaml service structure
	Service struct {
		Port        int         `yaml:",omitempty"`
		ConsolePort int         `yaml:"console_port,omitempty"`
		Version     interface{} `yaml:",omitempty"`
		Image       string      `yaml:",omitempty"`
		User        string      `yaml:",omitempty"`
		Password    string      `yaml:",omitempty"`
		AdminSecret interface{} `yaml:"admin_secret,omitempty"`
	}

	// .nhost/nhost.yaml information
	Information struct {
		ProjectID string `yaml:"project_id,omitempty"`
	}

	// Nhost servers structure
	Server struct {
		ID          string
		Name        string
		CountryCode string
		City        string
	}

	// Authentication credentials structure
	Credentials struct {
		Email string `json:"email"`
		Token string `json:"token"`
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
