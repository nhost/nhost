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
	"github.com/nhost/cli/hasura"
	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/nhost/service"
	flag "github.com/spf13/pflag"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/spf13/cobra"
)

var (
	//  signal interruption channel
	stop = make(chan os.Signal, 1)
)

const (
	// default ports
	defaultProxyPort            = 1337
	defaultDBPort               = 5432
	defaultGraphQLPort          = 8080
	defaultHasuraConsolePort    = 9695
	defaultHasuraConsoleApiPort = 9693
	defaultSMTPPort             = 1025
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

		// check if pid file exists
		pidFile := filepath.Join(nhost.DOT_NHOST_DIR, "pid")
		if util.PathExists(pidFile) {
			status.Infoln("Another instance of nhost seems to be running. Please stop it first with 'nhost down'")
			return fmt.Errorf("another instance of nhost seems to be running, please stop it first with 'nhost down'")
		}

		// write pid file
		pid := os.Getpid()
		err := os.WriteFile(pidFile, []byte(strconv.Itoa(pid)), 0644)
		if err != nil {
			status.Error("Failed to write pid file")
			return err
		}

		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		var mgr service.Manager
		var consoleP *os.Process
		var consoleCmd *exec.Cmd

		defer func() {
			// remove pid file
			pidFile := filepath.Join(nhost.DOT_NHOST_DIR, "pid")
			_ = os.Remove(pidFile)
		}()

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

		hc, err := hasura.InitClient(fmt.Sprintf("http://localhost:%d", ports.GraphQL()), util.ADMIN_SECRET, nil)
		debug := logger.DEBUG
		mgr = service.NewDockerComposeManager(config, hc, ports, env, nhost.GetCurrentBranch(), projectName, log, status, debug)

		signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

		go func() {
			err = mgr.SyncExec(ctx, func(ctx context.Context) error {
				startCtx, cancel := context.WithTimeout(ctx, time.Minute*3)
				defer cancel()

				// stop just in case there are any leftover containers
				err := mgr.Stop(ctx)
				if err != nil {
					return err
				}

				if err := ports.EnsurePortsAvailable(); err != nil {
					return err
				}

				err = mgr.Start(startCtx)
				if err != nil {
					return err
				}

				// start the console
				consoleCmd = hc.RunConsoleCmd(ctx, ports.HasuraConsole(), ports.HasuraConsoleAPI(), debug)
				consoleP = consoleCmd.Process
				err = consoleCmd.Start()
				if err != nil && ctx.Err() != context.Canceled {
					return err
				}

				err = consoleWaiter(ctx, mgr.HasuraConsoleURL(), 10*time.Second)
				if err != nil {
					// if console isn't reachable return the error which will cause another retry
					if consoleP != nil {
						_ = consoleP.Kill()
						_ = consoleCmd.Wait()
					}
					return err
				}

				return nil
			})

			if ctx.Err() == context.Canceled {
				return
			}

			if err != nil {
				status.Errorln("Failed to start services")
				log.WithError(err).Error("Failed to start services")
				os.Exit(1)
			}

			if !noBrowser {
				_ = openbrowser(mgr.HasuraConsoleURL())
			}
		}()

		// wait for stop signal
		<-stop
		cancel()

		exitCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		status.Executing("Exiting...")
		log.Debug("Exiting...")
		err = mgr.SyncExec(exitCtx, func(ctx context.Context) error {
			if consoleP != nil {
				_ = consoleP.Kill()
				// Wait releases any resources associated with the command
				_ = consoleCmd.Wait()
			}
			return mgr.Stop(exitCtx)
		})
		if err != nil {
			status.Errorln("Failed to stop services")
		}

		return nil
	},
}

func getPorts(fs *flag.FlagSet) (nhost.Ports, error) {
	var proxyPort, dbPort, graphqlPort, hasuraConsolePort, hasuraConsoleApiPort, smtpPort uint32
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

	return nhost.NewPorts(proxyPort, dbPort, graphqlPort, hasuraConsolePort, hasuraConsoleApiPort, smtpPort), nil
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

// consoleWaiter waits for the hasura console to be reachable
func consoleWaiter(ctx context.Context, endpoint string, timeout time.Duration) error {
	t := time.After(timeout)

	ticker := time.NewTicker(100 * time.Millisecond)

	for range ticker.C {
		select {
		case <-ctx.Done():
			return nil
		case <-t:
			return fmt.Errorf("timeout: hasura console is not ready, please run the command again")
		default:
			resp, err := http.Get(endpoint)
			if err == nil {
				_ = resp.Body.Close()
			}
			if resp != nil && resp.StatusCode == http.StatusOK && err == nil {
				return nil
			}
		}
	}

	return nil
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
	devCmd.PersistentFlags().BoolVar(&noBrowser, "no-browser", false, "Don't open browser windows automatically")
}
