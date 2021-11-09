package cmd

import (
	"net/http"

	"github.com/nhost/cli/environment"
	"github.com/nhost/cli/logger"
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

	Client = http.Client{}
	env    = environment.Environment{}

	//	tunnelAddress = "tunnel.mrinalwahal.com"
)
