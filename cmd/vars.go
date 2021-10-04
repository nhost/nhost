package cmd

import (
	"net/http"

	"github.com/mrinalwahal/cli/environment"
	"github.com/mrinalwahal/cli/logger"
)

const (

	// initialize console colours
	Bold  = "\033[1m"
	Reset = "\033[0m"
	Green = "\033[32m"
	// Blue = "\033[34m"
	Yellow = "\033[33m"
	Cyan   = "\033[36m"
	Red    = "\033[31m"
	Gray   = "\033[37;2m"
	// White = "\033[97m"

	ErrNotLoggedIn = "Please login with `nhost login`"
	ErrLoggedIn    = "You are already logged in, first logout with `nhost logout`"
)

var (
	// Utility build version
	Version string

	cfgFile string
	log     = &logger.Log

	Client = http.Client{}
	env    = environment.Environment{}

	//	tunnelAddress = "tunnel.mrinalwahal.com"
)
