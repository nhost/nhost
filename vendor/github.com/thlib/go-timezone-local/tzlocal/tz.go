package tzlocal

import (
	"fmt"
	"os"
	"time"
)

// EnvTZ will return the TZ env value if it is set, go will revert any invalid timezone to UTC
func EnvTZ() (string, bool) {
	if name, ok := os.LookupEnv("TZ"); ok {
		// Go treats blank as UTC
		if name == "" {
			return "UTC", true
		}
		_, err := time.LoadLocation(name)
		// Go treats invalid as UTC
		if err != nil {
			return "UTC", true
		}
		return name, true
	}
	return "", false
}

// RuntimeTZ get the full timezone name of the local machine
func RuntimeTZ() (string, error) {

	// Get the timezone from the TZ env variable
	if name, ok := EnvTZ(); ok {
		return name, nil
	}

	// Get the timezone from the system file
	name, err := LocalTZ()
	if err != nil {
		err = fmt.Errorf("failed to get local machine timezone: %w", err)
		return "", err
	}

	return name, err
}
