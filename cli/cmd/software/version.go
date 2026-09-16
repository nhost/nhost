package software

import (
	"context"
	"fmt"
	"runtime"
	"strings"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/nhost/nhost/cli/software"
	"github.com/urfave/cli/v3"
)

func CommandVersion() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "version",
		Aliases: []string{},
		Usage:   "Show the current version of Nhost CLI you have installed",
		Action:  commandVersion,
	}
}

func checkCLIVersion(
	ctx context.Context,
	ce *clienv.CliEnv,
	curVersion string,
) error {
	mgr := software.NewManager()

	releases, err := mgr.GetReleases(ctx, curVersion)
	if err != nil {
		return fmt.Errorf("failed to get releases: %w", err)
	}

	if len(releases) == 0 {
		ce.Infoln(
			"✅ Nhost CLI %s for %s-%s is already on the latest version",
			curVersion, runtime.GOOS, runtime.GOARCH,
		)

		return nil
	}

	latest := releases[0]
	if latest.TagName == curVersion {
		return nil
	}

	ce.Warnln("🟡 A new version of Nhost CLI is available: %s", latest.TagName)
	ce.Println("   You can upgrade the CLI by running `nhost sw upgrade`")
	ce.Println("   More info: https://github.com/nhost/nhost/cli/releases")

	return nil
}

// serviceVersion is one configured component and the version it runs.
type serviceVersion struct {
	software  graphql.SoftwareTypeEnum
	version   string
	changelog string
}

const nhostReleasesURL = "https://github.com/nhost/nhost/releases"

// servicesToCheck returns the components worth reporting on for cfg. With the
// engine enabled, auth and storage are not deployed and mimir rejects
// per-service versions, so reporting on them would be advice about absent
// containers that the user could not act on anyway; the engine's own version
// is what governs all three.
//
// cfg must be nil or a result of schema.Fill, which guarantees a concrete
// version for every section it contains. Only the engine version is guarded
// for callers that construct a config by hand.
func servicesToCheck(cfg *model.ConfigConfig) []serviceVersion {
	if cfg == nil {
		return nil
	}

	services := make([]serviceVersion, 0, 5) //nolint:mnd

	if engine := cfg.GetExperimental().GetNhost(); engine != nil {
		if version := engine.GetVersion(); version != nil {
			services = append(services, serviceVersion{
				software:  graphql.SoftwareTypeEnumEngine,
				version:   *version,
				changelog: nhostReleasesURL,
			})
		}
	} else {
		services = append(services,
			serviceVersion{
				software:  graphql.SoftwareTypeEnumAuth,
				version:   *cfg.GetAuth().GetVersion(),
				changelog: nhostReleasesURL,
			},
			serviceVersion{
				software:  graphql.SoftwareTypeEnumStorage,
				version:   *cfg.GetStorage().GetVersion(),
				changelog: nhostReleasesURL,
			},
		)
	}

	services = append(services,
		serviceVersion{
			software:  graphql.SoftwareTypeEnumPostgreSQL,
			version:   *cfg.GetPostgres().GetVersion(),
			changelog: "https://hub.docker.com/r/nhost/postgres",
		},
		serviceVersion{
			software:  graphql.SoftwareTypeEnumHasura,
			version:   *cfg.GetHasura().GetVersion(),
			changelog: "",
		},
	)

	if cfg.GetAi() != nil {
		services = append(services, serviceVersion{
			software:  graphql.SoftwareTypeEnumGraphite,
			version:   *cfg.GetAi().GetVersion(),
			changelog: "",
		})
	}

	return services
}

func checkServiceVersion(
	ce *clienv.CliEnv,
	software graphql.SoftwareTypeEnum,
	curVersion string,
	availableVersions *graphql.GetSoftwareVersions,
	changelog string,
) {
	recommendedVersions := make([]string, 0, 5) //nolint:mnd

	for _, v := range availableVersions.GetSoftwareVersions() {
		if *v.GetSoftware() == software && v.GetVersion() == curVersion {
			ce.Infoln("✅ %s is already on a recommended version: %s", software, curVersion)
			return
		} else if *v.GetSoftware() == software {
			recommendedVersions = append(recommendedVersions, v.GetVersion())
		}
	}

	// Nothing to recommend means the cloud publishes no versions for this
	// component, so there is no advice to give.
	if len(recommendedVersions) == 0 {
		return
	}

	ce.Warnln(
		"🟡 %s is not on a recommended version. Recommended: %s",
		software, strings.Join(recommendedVersions, ", "),
	)

	if changelog != "" {
		ce.Println("   More info: %s", changelog)
	}
}

func CheckVersions(
	ctx context.Context,
	ce *clienv.CliEnv,
	cfg *model.ConfigConfig,
	appVersion string,
) error {
	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return fmt.Errorf(
			"failed to parse secrets, make sure secret values are between quotes: %w",
			err,
		)
	}

	cl, err := ce.GetNhostPublicClient()
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	// XXX(meh): Do not publish Engine rows in software_versions until a CLI
	// release containing that enum value has shipped and been adopted. Older
	// CLIs reject the entire response when strict enum decoding sees Engine.
	swv, err := cl.GetSoftwareVersions(ctx)
	if err != nil {
		return fmt.Errorf("failed to get software versions: %w", err)
	}

	for _, service := range servicesToCheck(cfg) {
		checkServiceVersion(ce, service.software, service.version, swv, service.changelog)
	}

	return checkCLIVersion(ctx, ce, appVersion)
}

func commandVersion(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	var (
		cfg *model.ConfigConfig
		err error
	)

	if clienv.PathExists(ce.Path.NhostToml()) && clienv.PathExists(ce.Path.Secrets()) {
		var secrets model.Secrets
		if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
			return fmt.Errorf(
				"failed to parse secrets, make sure secret values are between quotes: %w",
				err,
			)
		}

		cfg, err = config.Validate(ce, "local", secrets)
		if err != nil {
			return fmt.Errorf("failed to validate config: %w", err)
		}
	} else {
		ce.Warnln("🟡 No Nhost project found")
	}

	return CheckVersions(ctx, ce, cfg, cmd.Root().Version)
}
