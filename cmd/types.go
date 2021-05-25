package cmd

type (

	// Authentication credentials structure
	Credentials struct {
		Email string `json:"email"`
		Token string `json:"token"`
	}

	// Authentication validation response
	AuthValidation struct {
		User  User
		Error struct {
			Code  string
			Email string
		}
		Email             string `json:"email"`
		VerificationToken string `json:"verificationToken"`
		VerifiedToken     string `json:"token"`
	}

	// Nhost user structure
	User struct {
		Projects []Project  `json:",omitempty"`
		Teams    []TeamData `json:",omitempty"`
	}

	// Nhost project domains
	Domains struct {
		Hasura string `json:"hasura_domain,omitempty"`
	}

	// Nhost individual team structure
	TeamData struct {
		Team Team `json:",omitempty"`
	}

	Team struct {
		Name     string    `json:",omitempty"`
		Projects []Project `json:",omitempty"`
	}

	// Nhost project structure
	Project struct {
		ID                          string                   `json:"id"`
		UserID                      string                   `json:"user_id"`
		Team                        Team                     `json:",omitempty"`
		TeamID                      string                   `json:"team_id,omitempty"`
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

	// Container service
	Container struct {
		Image       string                 `yaml:",omitempty"`
		Name        string                 "container_name"
		Command     []string               `yaml:",omitempty"`
		Entrypoint  string                 `yaml:",omitempty"`
		Environment map[string]interface{} `yaml:",omitempty"`
		Ports       []string               `yaml:",omitempty"`
		Restart     string                 `yaml:",omitempty"`
		User        string                 `yaml:",omitempty"`
		Volumes     []string               `yaml:",omitempty"`
		DependsOn   []string               `yaml:"depends_on,omitempty"`
		EnvFile     []string               `yaml:"env_file,omitempty"`
		Build       map[string]string      `yaml:",omitempty"`
	}

	// Container services
	Services struct {
		Containers map[string]Container `yaml:"services,omitempty"`
		Version    string               `yaml:",omitempty"`
	}
)
