package appconfig

import (
	"errors"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

var ErrVersionBelowMinimum = errors.New("version is below the minimum supported version")

// Service identifies a service whose version has a minimum.
type Service string

const (
	ServiceAuth    Service = "auth"
	ServiceStorage Service = "storage"
	ServiceHasura  Service = "hasura"
)

// MinVersion is the oldest version of a service that a new app or a version
// change can use.
type MinVersion struct {
	Service Service
	Minimum string
}

// MinVersions returns the platform's minimum supported versions.
func MinVersions() []MinVersion {
	return []MinVersion{
		{Service: ServiceAuth, Minimum: "0.49.0"},
		{Service: ServiceStorage, Minimum: "0.14.0"},
		// Hasura images are tagged with -ce, and semver orders v2.48.0-ce before v2.48.0.
		{Service: ServiceHasura, Minimum: "v2.48.0-ce"},
	}
}

func serviceVersion(cfg *model.ConfigConfig, service Service) string {
	var v *string

	switch service {
	case ServiceAuth:
		v = cfg.GetAuth().GetVersion()
	case ServiceStorage:
		v = cfg.GetStorage().GetVersion()
	case ServiceHasura:
		v = cfg.GetHasura().GetVersion()
	}

	if v == nil {
		return ""
	}

	return *v
}

// CheckMinVersions refuses new apps and version changes below a minimum. oldCfg
// is nil for new apps. Apps already below a minimum keep working until they
// change that version. Non-semver versions, such as dev builds, are allowed.
func CheckMinVersions(rules []MinVersion, oldCfg, newCfg *model.ConfigConfig) error {
	var errs []error

	for _, rule := range rules {
		version := serviceVersion(newCfg, rule.Service)
		if version == "" || (oldCfg != nil && version == serviceVersion(oldCfg, rule.Service)) {
			continue
		}

		if CompareVersions(version, rule.Minimum) < 0 {
			errs = append(errs, fmt.Errorf(
				"%s %s: %w %s, older versions miss security and stability fixes",
				rule.Service, version, ErrVersionBelowMinimum, rule.Minimum,
			))
		}
	}

	return errors.Join(errs...)
}
