package environment

import (
	"github.com/nhost/cli/logger"
	"github.com/nhost/cli/util"
)

var (

	//	Import commong logger used by the entire utility
	log    = &logger.Log
	status = &util.Writer
)
