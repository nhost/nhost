package software

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/nhost/nhost/cli/software"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

func CommandVersion() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "version",
		Aliases: []string{},
		Usage:   "Show the current version of Nhost CLI you have installed",
		Action:  commandVersion,
	}
}

func styledCheck(name, version, extra string, ok bool) string {
	if ok {
		check := lipgloss.NewStyle().Foreground(clienv.ANSIColorGreen).Render("✓")

		return fmt.Sprintf("%s %s\t%s\t%s", check, name, version, extra)
	}

	cross := lipgloss.NewStyle().Foreground(clienv.ANSIColorRed).Render("✗")

	return fmt.Sprintf(
		"%s %s\t%s\t%s",
		cross, name, version,
		lipgloss.NewStyle().Foreground(clienv.ANSIColorYellow).Render(extra),
	)
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

	isTTY := term.IsTerminal(int(os.Stdout.Fd()))

	if len(releases) == 0 {
		msg := fmt.Sprintf(
			"Nhost CLI %s for %s-%s",
			curVersion, runtime.GOOS, runtime.GOARCH,
		)

		if isTTY {
			ce.Println("%s", styledCheck(msg, "", "(latest)", true))
		} else {
			ce.Infoln(
				"✅ Nhost CLI %s for %s-%s is already on the latest version",
				curVersion, runtime.GOOS, runtime.GOARCH,
			)
		}

		return nil
	}

	latest := releases[0]
	if latest.TagName == curVersion {
		return nil
	}

	if isTTY {
		ce.Println(
			"%s",
			styledCheck("Nhost CLI", curVersion, "(latest: "+latest.TagName+")", false),
		)
	} else {
		ce.Warnln("🟡 A new version of Nhost CLI is available: %s", latest.TagName)
	}

	ce.Println("   You can upgrade the CLI by running `nhost sw upgrade`")
	ce.Println("   More info: https://github.com/nhost/nhost/cli/releases")

	return nil
}

func checkServiceVersion(
	ce *clienv.CliEnv,
	sw graphql.SoftwareTypeEnum,
	curVersion string,
	availableVersions *graphql.GetSoftwareVersions,
	changelog string,
) {
	isTTY := term.IsTerminal(int(os.Stdout.Fd()))
	recommendedVersions := make([]string, 0, 5) //nolint:mnd

	for _, v := range availableVersions.GetSoftwareVersions() {
		if *v.GetSoftware() == sw && v.GetVersion() == curVersion {
			printServiceMatch(ce, sw, curVersion, isTTY)

			return
		} else if *v.GetSoftware() == sw {
			recommendedVersions = append(recommendedVersions, v.GetVersion())
		}
	}

	printServiceMismatch(ce, sw, curVersion, recommendedVersions, changelog, isTTY)
}

func printServiceMatch(
	ce *clienv.CliEnv,
	sw graphql.SoftwareTypeEnum,
	curVersion string,
	isTTY bool,
) {
	if isTTY {
		ce.Println(
			"%s",
			styledCheck(string(sw), curVersion, "(recommended)", true),
		)
	} else {
		ce.Infoln("✅ %s is already on a recommended version: %s", sw, curVersion)
	}
}

func printServiceMismatch(
	ce *clienv.CliEnv,
	sw graphql.SoftwareTypeEnum,
	curVersion string,
	recommended []string,
	changelog string,
	isTTY bool,
) {
	if isTTY {
		extra := fmt.Sprintf("(recommended: %s)", strings.Join(recommended, ", "))
		ce.Println("%s", styledCheck(string(sw), curVersion, extra, false))
	} else {
		ce.Warnln(
			"🟡 %s is not on a recommended version. Recommended: %s",
			sw, strings.Join(recommended, ", "),
		)
	}

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

	swv, err := cl.GetSoftwareVersions(ctx)
	if err != nil {
		return fmt.Errorf("failed to get software versions: %w", err)
	}

	checkServiceVersion(
		ce, graphql.SoftwareTypeEnumAuth, *cfg.GetAuth().GetVersion(), swv,
		"https://github.com/nhost/nhost/releases",
	)
	checkServiceVersion(
		ce, graphql.SoftwareTypeEnumStorage, *cfg.GetStorage().GetVersion(), swv,
		"https://github.com/nhost/nhost/releases",
	)
	checkServiceVersion(
		ce, graphql.SoftwareTypeEnumPostgreSQL, *cfg.GetPostgres().GetVersion(), swv,
		"https://hub.docker.com/r/nhost/postgres",
	)
	checkServiceVersion(ce, graphql.SoftwareTypeEnumHasura, *cfg.GetHasura().GetVersion(), swv, "")

	if cfg.GetAi() != nil {
		checkServiceVersion(
			ce, graphql.SoftwareTypeEnumGraphite, *cfg.GetAi().GetVersion(), swv, "",
		)
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
