package functions

import (
	"io/fs"
	"net/http"
	"plugin"

	"github.com/sirupsen/logrus"
)

type (
	Function struct {

		//	Function specific logger.
		//	Recommended to use the same logger used for server.
		log *logrus.Logger

		Route   string
		File    fs.FileInfo
		Path    string
		Handler func(http.ResponseWriter, *http.Request)
		Base    string

		//	File location where built package is stored
		Build string

		//	Location where Node Modules to be searched for
		buildDir     string
		ServerConfig string
		Plugin       *plugin.Plugin
	}
)
