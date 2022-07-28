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
	"errors"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/util"
	"github.com/spf13/cobra"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
)

//  devCmd represents the dev command
var downCmd = &cobra.Command{
	Use:   "down",
	Short: "Stop local development environment",
	Long:  `Stops and removes containers`,
	PreRunE: func(cmd *cobra.Command, args []string) error {
		//  check if nhost/ exists
		if !util.PathExists(nhost.NHOST_DIR) {
			status.Infoln("Initialize new app by running 'nhost init'")
			return errors.New("app not found in this directory")
		}

		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		pidFile := filepath.Join(nhost.DOT_NHOST_DIR, "pid")
		if !util.PathExists(pidFile) {
			status.Infoln("No running instance found")
			return nil
		}

		d, err := ioutil.ReadFile(pidFile)
		if err != nil {
			status.Errorln(err.Error())
			return err
		}

		pid, err := strconv.Atoi(string(d))
		if err != nil {
			status.Errorln(err.Error())
			return err
		}

		_ = syscall.Kill(pid, syscall.SIGINT)

		// check if process is still running
		ticker := time.NewTicker(time.Second)
		timeout := time.After(2 * time.Minute)
		for range ticker.C {
			select {
			case <-timeout:
				status.Errorln("Timeout waiting for process to stop")
				os.Exit(1)
			default:
				err = syscall.Kill(pid, syscall.Signal(0))
				if err != nil {
					// check if process is still running
					if err == syscall.ESRCH {
						status.Infoln("Process stopped")
						// remove the pid file
						_ = os.Remove(pidFile)
						return nil
					}

					status.Errorln(err.Error())
				}
			}
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(downCmd)
}
