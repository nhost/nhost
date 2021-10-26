package logger

import (
	"io"
	"os"
	"time"

	"github.com/mattn/go-colorable"
	"github.com/sirupsen/logrus"
)

var (
	Log   = *logrus.New()
	DEBUG bool
	JSON  bool

	LOG_FILE = ""
)

func Init() {

	//  initialize the Logger for all commands,
	//  including subcommands

	Log.SetOutput(colorable.NewColorableStdout())

	//  initialize Logger formatter
	formatter := &Formatter{
		HideKeys:      true,
		ShowFullLevel: true,
		FieldsOrder:   []string{"component", "category"},
		Timestamps:    false,
	}

	//  if DEBUG flag is true, show Logger level to debug
	if DEBUG {
		Log.SetLevel(logrus.DebugLevel)
	}

	//  if JSON flag has been supplied,
	//  format the Logs to JSON
	if JSON {
		Log.SetFormatter(&logrus.JSONFormatter{
			TimestampFormat: time.Stamp,
		})
	} else {

		//  otherwise set the pre-configured formatter
		Log.SetFormatter(formatter)
	}

	//  if the user has specified a Log write,
	//simultaneously write Logs to that file as well
	//  along with stdOut

	if LOG_FILE != "" {

		formatter.Timestamps = true
		formatter.NoColors = true

		logFile, err := os.OpenFile(LOG_FILE, os.O_CREATE|os.O_APPEND|os.O_RDWR, 0666)
		if err != nil {
			Log.Fatal(err)
		}
		mw := io.MultiWriter(os.Stdout, logFile)
		Log.SetOutput(mw)
	}

}
