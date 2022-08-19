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
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"reflect"
	"strings"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/nhost/cli/hasura"
	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/nhost/service"
	flag "github.com/spf13/pflag"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/spf13/cobra"
)

var (
	//  signal interruption channel
	stopCh   = make(chan os.Signal, 1)
	exitCode = 0
)

const (
	// default ports
	defaultProxyPort            = 1337
	defaultDBPort               = 5432
	defaultGraphQLPort          = 8080
	defaultHasuraConsolePort    = 9695
	defaultHasuraConsoleApiPort = 9693
	defaultSMTPPort             = 1025
	defaultS3MinioPort          = 9000
	defaultMailhogPort          = 8025
)

//  devCmd represents the dev command
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
	RunE: func(cmd *cobra.Command, args []string) error {
		// add a line-break after the command
		fmt.Println()

		ctx, cancel := context.WithCancel(cmd.Context())
		defer cancel()

		config, err := nhost.GetConfiguration()
		if err != nil {
			return err
		}

		projectName, err := nhost.GetDockerComposeProjectName()
		if err != nil {
			return err
		}

		env, err := nhost.Env()
		if err != nil {
			return fmt.Errorf("failed to read .env.development: %v", err)
		}

		ports, err := getPorts(cmd.Flags())
		if err != nil {
			return fmt.Errorf("failed to get ports: %v", err)
		}

		debug := logger.DEBUG
		hc, err := hasura.InitClient(fmt.Sprintf("http://localhost:%d", ports.GraphQL()), util.ADMIN_SECRET, nil)
		if err != nil {
			return fmt.Errorf("failed to init hasura client: %v", err)
		}

		launcher := service.NewLauncher(
			service.NewDockerComposeManager(config, hc, ports, env, nhost.GetCurrentBranch(),
				projectName,
				log,
				status,
				debug,
			),
			hc, ports, status, log)

		if err = launcher.Init(); err != nil {
			return err
		}

		signal.Notify(stopCh, syscall.SIGINT, syscall.SIGTERM)

		go func() {
			err = launcher.Start(ctx, debug)

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
				_ = openbrowser(launcher.HasuraConsoleURL())
			}

			fmt.Println()
			configurationWarnings(config)
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

func getPorts(fs *flag.FlagSet) (nhost.Ports, error) {
	var proxyPort, dbPort, graphqlPort, hasuraConsolePort, hasuraConsoleApiPort, smtpPort, minioS3Port, mailhogPort uint32
	var err error

	if proxyPort, err = fs.GetUint32(nhost.PortProxy); err != nil {
		return nil, err
	}

	if dbPort, err = fs.GetUint32(nhost.PortDB); err != nil {
		return nil, err
	}

	if graphqlPort, err = fs.GetUint32(nhost.PortGraphQL); err != nil {
		return nil, err
	}

	if hasuraConsolePort, err = fs.GetUint32(nhost.PortHasuraConsole); err != nil {
		return nil, err
	}

	if hasuraConsoleApiPort, err = fs.GetUint32(nhost.PortHasuraConsoleAPI); err != nil {
		return nil, err
	}

	if smtpPort, err = fs.GetUint32(nhost.PortSMTP); err != nil {
		return nil, err
	}

	if minioS3Port, err = fs.GetUint32(nhost.PortMinioS3); err != nil {
		return nil, err
	}

	if mailhogPort, err = fs.GetUint32(nhost.PortMailhog); err != nil {
		return nil, err
	}

	return nhost.NewPorts(proxyPort, dbPort, graphqlPort, hasuraConsolePort, hasuraConsoleApiPort, smtpPort, minioS3Port, mailhogPort), nil
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

	devCmd.PersistentFlags().Uint32P(nhost.PortProxy, "p", defaultProxyPort, "Port for dev proxy")
	devCmd.PersistentFlags().Uint32(nhost.PortDB, defaultDBPort, "Port for database")
	devCmd.PersistentFlags().Uint32(nhost.PortGraphQL, defaultGraphQLPort, "Port for graphql server")
	devCmd.PersistentFlags().Uint32(nhost.PortHasuraConsole, defaultHasuraConsolePort, "Port for hasura console")
	devCmd.PersistentFlags().Uint32(nhost.PortHasuraConsoleAPI, defaultHasuraConsoleApiPort, "Port for serving hasura migrate API")
	devCmd.PersistentFlags().Uint32(nhost.PortSMTP, defaultSMTPPort, "Port for smtp server")
	devCmd.PersistentFlags().Uint32(nhost.PortMinioS3, defaultS3MinioPort, "S3 port for minio")
	devCmd.PersistentFlags().Uint32(nhost.PortMailhog, defaultMailhogPort, "Port for mailhog UI")
	devCmd.PersistentFlags().BoolVar(&noBrowser, "no-browser", false, "Don't open browser windows automatically")
}

func configurationWarnings(c *nhost.Configuration) {
	// warn about deprecated fields
	for name, svc := range c.Services {
		if svc != nil && svc.Version != nil && svc.Version.(string) != "" {
			fmt.Printf("WARNING: [services.%s.version] \"version\" field is not used anymore, please use \"image\" instead or let CLI use the default version\n", name)
		}
	}

	// check auth smtp config
	if smtp, ok := c.Auth["smtp"]; ok { //nolint:nestif
		v := reflect.ValueOf(smtp)
		if v.Kind() == reflect.Map {
			for _, key := range v.MapKeys() {
				if key.Interface().(string) != "host" {
					continue
				}

				hostValue := v.MapIndex(key).Interface().(string)
				if hostValue != "" && hostValue != "mailhog" && strings.Contains(hostValue, "mailhog") {
					fmt.Printf("WARNING: [auth.smtp.host] \"host\" field has a value \"%s\", please set the value to \"mailhog\" if you want CLI to spin up a container for mail catching\n", hostValue)
				}
			}
		}
	}
}
