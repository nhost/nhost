package appconfig

const (
	secretPostgresRootUsername = "root_username"
	secretPostgresRootPassword = "root_password"
)

func PostgresEnv(
	database string,
	username string,
	password string,
) ([]EnvVar, error) {
	env := []EnvVar{
		{
			Name:       "POSTGRES_USER",
			Value:      username,
			SecretName: secretPostgresRootUsername,
			IsSecret:   true,
		},
		{
			Name:       "POSTGRES_PASSWORD",
			Value:      password,
			SecretName: secretPostgresRootPassword,
			IsSecret:   true,
		},
		{
			Name:  "POSTGRES_DB",
			Value: database,
		},
		{
			Name:  "PGDATA",
			Value: "/var/lib/postgresql/data/pgdata",
		},
	}

	return env, nil
}
