package appconfig

import "github.com/nhost/be/services/mimir/model"

const (
	secretPostgresRootUsername = "root_username"
	secretPostgresRootPassword = "root_password"
)

func PostgresEnv( //nolint:funlen
	config *model.ConfigConfig,
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

	if config.GetPostgres().GetSettings() != nil {
		env = append(env, []EnvVar{
			{
				Name:  "JIT",
				Value: Stringify(*config.GetPostgres().GetSettings().GetJit()),
			},
			{
				Name:  "MAX_CONNECTIONS",
				Value: Stringify(*config.GetPostgres().GetSettings().GetMaxConnections()),
			},
			{
				Name:  "SHARED_BUFFERS",
				Value: Stringify(*config.GetPostgres().GetSettings().GetSharedBuffers()),
			},
			{
				Name:  "EFFECTIVE_CACHE_SIZE",
				Value: Stringify(*config.GetPostgres().GetSettings().GetEffectiveCacheSize()),
			},
			{
				Name:  "MAINTENANCE_WORK_MEM",
				Value: Stringify(*config.GetPostgres().GetSettings().GetMaintenanceWorkMem()),
			},
			{
				Name: "CHECKPOINT_COMPLETION_TARGET",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetCheckpointCompletionTarget(),
				),
			},
			{
				Name:  "WAL_BUFFERS",
				Value: Stringify(*config.GetPostgres().GetSettings().GetWalBuffers()),
			},
			{
				Name:  "DEFAULT_STATISTICS_TARGET",
				Value: Stringify(*config.GetPostgres().GetSettings().GetDefaultStatisticsTarget()),
			},
			{
				Name:  "RANDOM_PAGE_COST",
				Value: Stringify(*config.GetPostgres().GetSettings().GetRandomPageCost()),
			},
			{
				Name:  "EFFECTIVE_IO_CONCURRENCY",
				Value: Stringify(*config.GetPostgres().GetSettings().GetEffectiveIOConcurrency()),
			},
			{
				Name:  "WORK_MEM",
				Value: Stringify(*config.GetPostgres().GetSettings().GetWorkMem()),
			},
			{
				Name:  "HUGE_PAGES",
				Value: Stringify(*config.GetPostgres().GetSettings().GetHugePages()),
			},
			{
				Name:  "MIN_WAL_SIZE",
				Value: Stringify(*config.GetPostgres().GetSettings().GetMinWalSize()),
			},
			{
				Name:  "MAX_WAL_SIZE",
				Value: Stringify(*config.GetPostgres().GetSettings().GetMaxWalSize()),
			},
			{
				Name:  "MAX_WORKER_PROCESSES",
				Value: Stringify(*config.GetPostgres().GetSettings().GetMaxWorkerProcesses()),
			},
			{
				Name: "MAX_PARALLEL_WORKERS_PER_GATHER",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetMaxParallelWorkersPerGather(),
				),
			},
			{
				Name:  "MAX_PARALLEL_WORKERS",
				Value: Stringify(*config.GetPostgres().GetSettings().GetMaxParallelWorkers()),
			},
			{
				Name: "MAX_PARALLEL_MAINTENANCE_WORKERS",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetMaxParallelMaintenanceWorkers(),
				),
			},
		}...)
	}

	return env, nil
}
