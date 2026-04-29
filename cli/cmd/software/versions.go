package software

import (
	"context"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/cli/project/env"
)

// ServiceVersion holds version info for a single service.
type ServiceVersion struct {
	Service     string
	Current     string
	Recommended string
	OK          bool
}

func serviceToCompose(sw graphql.SoftwareTypeEnum) string {
	switch sw {
	case graphql.SoftwareTypeEnumAuth:
		return "auth"
	case graphql.SoftwareTypeEnumStorage:
		return "storage"
	case graphql.SoftwareTypeEnumPostgreSQL:
		return "postgres"
	case graphql.SoftwareTypeEnumHasura:
		return "graphql"
	case graphql.SoftwareTypeEnumGraphite:
		return "ai"
	default:
		return ""
	}
}

func getServiceVersion(
	sw graphql.SoftwareTypeEnum,
	curVersion string,
	swv *graphql.GetSoftwareVersions,
) ServiceVersion {
	recommended := make([]string, 0)

	for _, v := range swv.GetSoftwareVersions() {
		if *v.GetSoftware() == sw && v.GetVersion() == curVersion {
			return ServiceVersion{
				Service:     serviceToCompose(sw),
				Current:     curVersion,
				Recommended: "",
				OK:          true,
			}
		} else if *v.GetSoftware() == sw {
			recommended = append(recommended, v.GetVersion())
		}
	}

	rec := ""
	if len(recommended) > 0 {
		rec = recommended[0]
	}

	return ServiceVersion{
		Service:     serviceToCompose(sw),
		Current:     curVersion,
		Recommended: rec,
		OK:          false,
	}
}

// GetServiceVersions returns version info for all configured services.
func GetServiceVersions(
	ctx context.Context,
	ce *clienv.CliEnv,
	cfg *model.ConfigConfig,
) (map[string]ServiceVersion, error) {
	if cfg == nil {
		return nil, nil
	}

	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return nil, fmt.Errorf("failed to parse secrets: %w", err)
	}

	cl, err := ce.GetNhostPublicClient()
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	swv, err := cl.GetSoftwareVersions(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get versions: %w", err)
	}

	result := make(map[string]ServiceVersion)

	pairs := []struct {
		sw      graphql.SoftwareTypeEnum
		version string
	}{
		{graphql.SoftwareTypeEnumAuth, *cfg.GetAuth().GetVersion()},
		{graphql.SoftwareTypeEnumStorage, *cfg.GetStorage().GetVersion()},
		{graphql.SoftwareTypeEnumPostgreSQL, *cfg.GetPostgres().GetVersion()},
		{graphql.SoftwareTypeEnumHasura, *cfg.GetHasura().GetVersion()},
	}

	if cfg.GetAi() != nil {
		pairs = append(pairs, struct {
			sw      graphql.SoftwareTypeEnum
			version string
		}{graphql.SoftwareTypeEnumGraphite, *cfg.GetAi().GetVersion()})
	}

	for _, p := range pairs {
		sv := getServiceVersion(p.sw, p.version, swv)
		result[sv.Service] = sv
	}

	return result, nil
}
