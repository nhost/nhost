package vips

// #include <glib.h>
import "C"
import (
	"log"
)

// LogLevel is the enum controlling logging message verbosity.
type LogLevel int

// The logging verbosity levels classify and filter logging messages.
// From most to least verbose, they are debug, info, message, warning, critical and error.
const (
	LogLevelError    LogLevel = C.G_LOG_LEVEL_ERROR
	LogLevelCritical LogLevel = C.G_LOG_LEVEL_CRITICAL
	LogLevelWarning  LogLevel = C.G_LOG_LEVEL_WARNING
	LogLevelMessage  LogLevel = C.G_LOG_LEVEL_MESSAGE
	LogLevelInfo     LogLevel = C.G_LOG_LEVEL_INFO
	LogLevelDebug    LogLevel = C.G_LOG_LEVEL_DEBUG
)

// Three global variables which keep state of the current logging handler
// function, desired verbosity for logging and whether defaults have been
// overridden. Set by LoggingSettings()
var (
	currentLoggingHandlerFunction LoggingHandlerFunction
	currentLoggingVerbosity       LogLevel
	currentLoggingOverridden      bool
)

// govipsLoggingHandler is the private bridge function exported to the C library
// and called by glib and libvips for each logging message. It will call govipsLog
// which in turn will filter based on verbosity and direct the messages to the
// currently chosen LoggingHandlerFunction.
//
//export govipsLoggingHandler
func govipsLoggingHandler(messageDomain *C.char, messageLevel C.int, message *C.char) {
	govipsLog(C.GoString(messageDomain), LogLevel(messageLevel), C.GoString(message))
}

// LoggingHandlerFunction is a function which will be called for each log message.
// By default, govips sends logging messages to os.Stderr. If you want to log elsewhere
// such as to a file or to a state variable which you inspect yourself, define a new
// logging handler function and set it via LoggingSettings().
type LoggingHandlerFunction func(messageDomain string, messageLevel LogLevel, message string)

// LoggingSettings sets the logging handler and logging verbosity for govips.
// The handler function is the function which will be called for each log message.
// You can define one yourself to log somewhere else besides the default (stderr).
// Use nil as handler to use standard logging handler.
// Verbosity is the minimum logLevel you want to log. Default is logLevelInfo
// due to backwards compatibility but it's quite verbose for a library.
// Suggest setting it to at least logLevelWarning. Use logLevelDebug for debugging.
func LoggingSettings(handler LoggingHandlerFunction, verbosity LogLevel) {
	currentLoggingOverridden = true
	govipsLoggingSettings(handler, verbosity)
}

func govipsLoggingSettings(handler LoggingHandlerFunction, verbosity LogLevel) {
	if handler == nil {
		currentLoggingHandlerFunction = defaultLoggingHandlerFunction
	} else {
		currentLoggingHandlerFunction = handler
	}

	currentLoggingVerbosity = verbosity
	// TODO turn on debugging in libvips and redirect to handler when setting verbosity to debug
	// This way debugging information would go to the same channel as all other logging
}

func defaultLoggingHandlerFunction(messageDomain string, messageLevel LogLevel, message string) {
	var messageLevelDescription string
	switch messageLevel {
	case LogLevelError:
		messageLevelDescription = "error"
	case LogLevelCritical:
		messageLevelDescription = "critical"
	case LogLevelWarning:
		messageLevelDescription = "warning"
	case LogLevelMessage:
		messageLevelDescription = "message"
	case LogLevelInfo:
		messageLevelDescription = "info"
	case LogLevelDebug:
		messageLevelDescription = "debug"
	}

	log.Printf("[%v.%v] %v", messageDomain, messageLevelDescription, message)
}

// govipsLog is the default function used to log debug or error messages internally in govips.
// It's used by all govips functionality directly, as well as by glib and libvips via the C bridge.
func govipsLog(messageDomain string, messageLevel LogLevel, message string) {
	if messageLevel <= currentLoggingVerbosity {
		currentLoggingHandlerFunction(messageDomain, messageLevel, message)
	}
}
