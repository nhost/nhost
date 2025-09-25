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
			Name:       "POSTGRES_DB",
			Value:      database,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "PGDATA",
			Value:      "/var/lib/postgresql/data/pgdata",
			IsSecret:   false,
			SecretName: "",
		},
	}

	if config.GetPostgres().GetSettings() != nil {
		env = append(env, []EnvVar{
			{
				Name:       "JIT",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetJit()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "MAX_CONNECTIONS",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetMaxConnections()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "SHARED_BUFFERS",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetSharedBuffers()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "EFFECTIVE_CACHE_SIZE",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetEffectiveCacheSize()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "MAINTENANCE_WORK_MEM",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetMaintenanceWorkMem()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name: "CHECKPOINT_COMPLETION_TARGET",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetCheckpointCompletionTarget(),
				),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "WAL_BUFFERS",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetWalBuffers()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name: "DEFAULT_STATISTICS_TARGET",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetDefaultStatisticsTarget(),
				),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "RANDOM_PAGE_COST",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetRandomPageCost()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name: "EFFECTIVE_IO_CONCURRENCY",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetEffectiveIOConcurrency(),
				),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "WORK_MEM",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetWorkMem()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "HUGE_PAGES",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetHugePages()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "MIN_WAL_SIZE",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetMinWalSize()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "MAX_WAL_SIZE",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetMaxWalSize()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "MAX_WORKER_PROCESSES",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetMaxWorkerProcesses()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name: "MAX_PARALLEL_WORKERS_PER_GATHER",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetMaxParallelWorkersPerGather(),
				),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name:       "MAX_PARALLEL_WORKERS",
				Value:      Stringify(*config.GetPostgres().GetSettings().GetMaxParallelWorkers()),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name: "MAX_PARALLEL_MAINTENANCE_WORKERS",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetMaxParallelMaintenanceWorkers(),
				),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name: "WAL_LEVEL",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetWalLevel(),
				),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name: "MAX_WAL_SENDERS",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetMaxWalSenders(),
				),
				IsSecret:   false,
				SecretName: "",
			},
			{
				Name: "MAX_REPLICATION_SLOTS",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetMaxReplicationSlots(),
				),
				IsSecret:   false,
				SecretName: "",
			},
			{ //nolint:exhaustruct
				Name: "ARCHIVE_TIMEOUT",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetArchiveTimeout(),
				),
			},
			{
				Name: "TRACK_IO_TIMING",
				Value: Stringify(
					*config.GetPostgres().GetSettings().GetTrackIoTiming(),
				),
				IsSecret:   false,
				SecretName: "",
			},
		}...)
	}

	return env, nil
}
