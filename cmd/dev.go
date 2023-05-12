/*
MIT License

Copyright (c) Nhost

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

package cmd

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strings"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/config"
	"github.com/nhost/cli/hasura"
	"github.com/nhost/cli/internal/generichelper"
	"github.com/nhost/cli/internal/git"
	"github.com/nhost/cli/internal/ports"
	nhostssl "github.com/nhost/cli/internal/ssl"
	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/nhost/compose"
	"github.com/nhost/cli/nhost/secrets"
	"github.com/nhost/cli/nhost/service"
	flag "github.com/spf13/pflag"
	"github.com/spf13/viper"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	v2cmd "github.com/nhost/cli/v2/cmd"
	"github.com/spf13/cobra"
)

var (
	//  signal interruption channel
	stopCh      = make(chan os.Signal, 1)
	exitCode    = 0
	uiTypeValue string
)

var userDefinedHasuraCli string

type uiType string

func (u uiType) IsHasura() bool {
	return u == uiTypeHasura
}

func (u uiType) IsNhost() bool {
	return u == uiTypeNhost
}

func (u uiType) String() string {
	return string(u)
}

const (
	// flags
	userDefinedHasuraCliFlag = "hasuracli"
	startTimeoutFlag         = "start-timeout"
	uiTypeFlag               = "ui"

	// ui types
	uiTypeHasura uiType = "hasura"
	uiTypeNhost  uiType = "nhost"
)

// devCmd represents the dev command
var devCmd = &cobra.Command{
	Use:        "dev [-p port]",
	Aliases:    []string{"up"},
	SuggestFor: []string{"list", "init"},
	Short:      "Start local development environment",
	Long:       `Initialize a local Nhost environment for development and testing.`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		//  check if nhost/ exists
		if !util.PathExists(nhost.NHOST_DIR) {
			status.Infoln("Initialize new app by running 'nhost init'")
			return errors.New("app not found in this directory")
		}

		if err := nhost.EnsureProjectNameFileExists(); err != nil {
			return err
		}

		return nil
	},
	PostRunE: func(cmd *cobra.Command, args []string) error {
		// get current PWD
		pwd, err := os.Getwd()
		if err != nil {
			log.Debug(err)
			return err
		}

		return os.RemoveAll(path.Join(pwd, ".nhost", "traefik"))
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		// add a line-break after the command
		fmt.Println()

		if err := checkHostnames(); err != nil {
			os.Exit(1)
		}

		ctx, cancel := context.WithCancel(cmd.Context())
		defer cancel()

		if !util.PathExists(nhost.CONFIG_PATH) {
			fmt.Printf("\nConfig file '%s' wasn't found. Would you like to generate a new one from the cloud? [Yn]: ", nhost.CONFIG_PATH)

			for {
				r := bufio.NewReader(os.Stdin)
				fmt.Print(">  ")

				input, err := r.ReadString('\n')
				if err != nil {
					return err
				}

				input = strings.TrimSpace(strings.ToLower(input))

				if input == "n" {
					log.Info("Please first run 'nhost config pull' to get the new config format.")
					os.Exit(0)
				}

				if input == "y" || input == "" {
					if err := v2cmd.ConfigPullCmd().RunE(nil, nil); err != nil {
						return err
					}
					break
				}
			}
		}

		secr, err := secrets.ParseFile(filepath.Join(util.WORKING_DIR, ".secrets"))
		if err != nil {
			return fmt.Errorf("failed to get local secrets: %v", err)
		}

		confData, err := os.ReadFile(nhost.CONFIG_PATH)
		if err != nil {
			return fmt.Errorf("failed to read config file: %v", err)
		}

		conf, err := config.ValidateAndResolve(confData, secr)
		if err != nil {
			return fmt.Errorf("failed to resolve config: %v", err)
		}

		projectName, err := nhost.GetDockerComposeProjectName()
		if err != nil {
			return err
		}

		ports, err := getPorts(cmd.Flags())
		if err != nil {
			return fmt.Errorf("failed to get ports: %v", err)
		}

		debug := logger.DEBUG

		hasuraVersion := generichelper.DerefPtr(conf.GetHasura().GetVersion())

		hc, err := hasura.InitClient(compose.HasuraConsoleHostname(ports.GraphQL()), conf.GetHasura().GetAdminSecret(), hasuraVersion, viper.GetString(userDefinedHasuraCliFlag), nil)
		if err != nil {
			return fmt.Errorf("failed to init hasura client: %v", err)
		}

		startTimeout, err := cmd.Flags().GetDuration(startTimeoutFlag)
		if err != nil {
			return fmt.Errorf("failed to get start-timeout value: %v", err)
		}

		gitRefGetter, err := git.NewReferenceGetterWithFallback()
		if err != nil {
			return fmt.Errorf("failed to init git ref getter: %v", err)
		}

		gitBranchName, err := gitRefGetter.RefName()
		if err != nil {
			return fmt.Errorf("failed to get git branch name: %v", err)
		}

		cwd, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("failed to get current working directory: %v", err)
		}

		dcMgr, err := service.NewDockerComposeManager(
			nhostssl.NewNhostSSLCert(),
			conf,
			cwd,
			hc,
			ports,
			gitBranchName,
			projectName,
			log,
			status,
			debug,
		)
		if err != nil {
			return fmt.Errorf("failed to init docker compose manager: %v", err)
		}

		launcher := service.NewLauncher(dcMgr, hc, ports, status, log)

		if err = launcher.Init(); err != nil {
			return err
		}

		signal.Notify(stopCh, syscall.SIGINT, syscall.SIGTERM)

		go func() {
			err = launcher.Start(ctx, startTimeout, debug)

			if ctx.Err() == context.Canceled {
				return
			}

			if err != nil {
				status.Errorln("Failed to start services")
				log.WithError(err).Error("Failed to start services")
				cancel()
				exitCode = 1
				return
			}

			if !noBrowser {
				openURL := launcher.HasuraConsoleURL()

				if uiType(uiTypeValue).IsNhost() {
					openURL = compose.DashboardHostname(ports.Dashboard())
				}

				_ = openbrowser(openURL)
			}

			fmt.Println()
			configurationWarnings(conf)
		}()

		// handle cancellation or termination signals
		select {
		case <-ctx.Done():
			cancel()
			_ = launcher.Terminate(context.Background())
			os.Exit(exitCode)
		case <-stopCh:
			cancel()
			exitCtx, exitCancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer exitCancel()

			status.Executing("Exiting...")
			log.Debug("Exiting...")

			_ = launcher.Terminate(exitCtx)
		}

		return nil
	},
}

func checkHostnames() error {
	hostnames := []string{
		compose.HostLocalDbNhostRun,
		compose.HostLocalGraphqlNhostRun,
		compose.HostLocalHasuraNhostRun,
		compose.HostLocalAuthNhostRun,
		compose.HostLocalStorageNhostRun,
		compose.HostLocalFunctionsNhostRun,
	}

	for _, hostname := range hostnames {
		_, err := net.LookupIP(hostname)
		if err != nil {
			logger.DEBUG = false
			fmt.Println(fmt.Sprintf(`Failed to resolve '%s' hostname

Please make sure you have an internet connection and try again.

If you don't have an internet connection, you can add the following lines to /etc/hosts:

%s
`, hostname, offlineConfigForSSLHostnames(hostnames)))
			return fmt.Errorf("failed to resolve '%s' hostname: %v", hostname, err)
		}
	}

	return nil
}

func offlineConfigForSSLHostnames(hostnames []string) string {
	lines := []string{}
	for _, hostname := range hostnames {
		lines = append(lines, fmt.Sprintf("127.0.0.1	%s", hostname))
	}
	return strings.Join(lines, "\n")
}

func getPorts(fs *flag.FlagSet) (*ports.Ports, error) {
	var (
		proxyPort, sslProxyPort, dbPort, graphqlPort, hasuraConsolePort, hasuraAPIPort, smtpPort, minioS3Port, dashboardPort, mailhogPort uint32
		err                                                                                                                               error
	)

	if proxyPort, err = fs.GetUint32(ports.FlagPortProxy); err != nil {
		return nil, err
	}

	if sslProxyPort, err = fs.GetUint32(ports.FlagSSLPortProxy); err != nil {
		return nil, err
	}

	if dbPort, err = fs.GetUint32(ports.FlagPortDB); err != nil {
		return nil, err
	}

	if graphqlPort, err = fs.GetUint32(ports.FlagPortGraphQL); err != nil {
		return nil, err
	}

	if hasuraConsolePort, err = fs.GetUint32(ports.FlagPortHasuraConsole); err != nil {
		return nil, err
	}

	if hasuraAPIPort, err = fs.GetUint32(ports.FlagPortHasuraConsoleAPI); err != nil {
		return nil, err
	}

	if smtpPort, err = fs.GetUint32(ports.FlagPortSMTP); err != nil {
		return nil, err
	}

	if minioS3Port, err = fs.GetUint32(ports.FlagPortMinioS3); err != nil {
		return nil, err
	}

	if dashboardPort, err = fs.GetUint32(ports.FlagPortDashboard); err != nil {
		return nil, err
	}

	if mailhogPort, err = fs.GetUint32(ports.FlagPortMailhog); err != nil {
		return nil, err
	}

	return ports.NewPorts(
		proxyPort,
		sslProxyPort,
		dbPort,
		graphqlPort,
		hasuraConsolePort,
		hasuraAPIPort,
		smtpPort,
		minioS3Port,
		dashboardPort,
		mailhogPort,
	), nil
}

type Printer struct {
	*tabwriter.Writer
}

func newPrinter() *Printer {
	t := tabwriter.NewWriter(os.Stdout, 1, 1, 1, ' ', 0)
	return &Printer{
		Writer: t,
	}
}

func (p *Printer) print(loc, head, tail string) {
	switch loc {
	case "header":
		fmt.Fprintln(p)
		//	fmt.Fprintln(p, "---\t\t-----")
	case "footer":
		//	fmt.Fprintln(p, "---\t\t-----")
	case "info":
		status.Info(head)
	default:
		fmt.Fprintf(p, "%v\t\t%v", head, tail)
		fmt.Fprintln(p)
	}
}

func (p *Printer) close() {
	p.Flush()
	fmt.Println()
}

func init() {
	rootCmd.AddCommand(devCmd)

	devCmd.PersistentFlags().Uint32P(ports.FlagPortProxy, "p", ports.DefaultProxyPort, "Port for dev proxy")
	devCmd.PersistentFlags().Uint32(ports.FlagSSLPortProxy, ports.DefaultSSLProxyPort, "SSL port for dev proxy")
	devCmd.PersistentFlags().Uint32(ports.FlagPortDB, ports.DefaultDBPort, "Port for database")
	devCmd.PersistentFlags().Uint32(ports.FlagPortGraphQL, ports.DefaultGraphQLPort, "Port for graphql server")
	devCmd.PersistentFlags().Uint32(ports.FlagPortHasuraConsole, ports.DefaultHasuraConsolePort, "Port for hasura console")
	devCmd.PersistentFlags().Uint32(ports.FlagPortHasuraConsoleAPI, ports.DefaultHasuraConsoleAPIPort, "Port for serving hasura migrate API")
	devCmd.PersistentFlags().Uint32(ports.FlagPortSMTP, ports.DefaultSMTPPort, "Port for smtp server")
	devCmd.PersistentFlags().Uint32(ports.FlagPortMinioS3, ports.DefaultS3MinioPort, "S3 port for minio")
	devCmd.PersistentFlags().Uint32(ports.FlagPortDashboard, ports.DefaultDashboardPort, "Port for dashboard UI")
	devCmd.PersistentFlags().Uint32(ports.FlagPortMailhog, ports.DefaultMailhogPort, "Port for mailhog UI")
	devCmd.PersistentFlags().Duration(startTimeoutFlag, 10*time.Minute, "Timeout for starting services")
	devCmd.PersistentFlags().BoolVar(&noBrowser, "no-browser", false, "Don't open browser windows automatically")
	devCmd.PersistentFlags().StringVar(&uiTypeValue, uiTypeFlag, uiTypeHasura.String(), "UI type, possible values: [hasura, nhost]")

	devCmd.PersistentFlags().StringVar(&userDefinedHasuraCli, userDefinedHasuraCliFlag, viper.GetString(userDefinedHasuraCliFlag), "User-defined path for hasura-cli binary")
	viper.BindPFlag(userDefinedHasuraCliFlag, devCmd.PersistentFlags().Lookup(userDefinedHasuraCliFlag))
}

func configurationWarnings(c *model.ConfigConfig) {
	smtpHost := c.Provider.GetSmtp().GetHost()
	smtpPort := c.Provider.GetSmtp().GetPort()

	if smtpHost != "" && smtpHost != "mailhog" && strings.Contains(smtpHost, "mailhog") {
		fmt.Printf("WARNING: [provider.smtp] \"host\" field has a value \"%s\", please set the value to \"mailhog\" if you want CLI to catch the mails\n", smtpHost)
	}

	if smtpPort != 1025 && strings.Contains(smtpHost, "mailhog") {
		fmt.Printf("WARNING: [provider.smtp] \"port\" field has a value \"%d\", please set the value to \"1025\" if you want mailhog to work properly\n", smtpPort)
	}
}
