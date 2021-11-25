package cmd

import (
	"net/http"

	"github.com/nhost/cli/environment"
	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/util"
)

const (
	ErrNotLoggedIn = "Please login with `nhost login`"
	ErrLoggedIn    = "You are already logged in, first logout with `nhost logout`"
)

var (
	//  Utility build version
	Version string

	cfgFile string
	log     = &logger.Log
	status  = &util.Writer

	Client = http.Client{}
	env    = environment.Environment{}

	path string

	//	tunnelAddress = "tunnel.mrinalwahal.com"
)
