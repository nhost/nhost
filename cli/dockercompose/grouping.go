package dockercompose

import "sort"

var coreOrder = []string{ //nolint:gochecknoglobals
	"postgres",
	"graphql",
	"constellation",
	"auth",
	"storage",
	"functions",
	"ai",
	"dashboard",
}

var infraServices = map[string]bool{ //nolint:gochecknoglobals
	"console":      true,
	"configserver": true,
	"minio":        true,
	"traefik":      true,
	"mailhog":      true,
}

// IsInfraService reports whether a service is considered infrastructure
// (as opposed to a core Nhost service).
func IsInfraService(name string) bool {
	return infraServices[name]
}

// CorePriority returns the sort priority for a core service. Lower comes
// first. Unknown services sort after known ones.
func CorePriority(name string) int {
	for i, s := range coreOrder {
		if s == name {
			return i
		}
	}

	return len(coreOrder)
}

// GroupServices splits services into core and infrastructure lists. Core
// services are sorted by CorePriority; infra services keep input order.
func GroupServices(services []ServiceStatus) ([]ServiceStatus, []ServiceStatus) {
	var core, infra []ServiceStatus

	for _, svc := range services {
		if IsInfraService(svc.Service) {
			infra = append(infra, svc)
		} else {
			core = append(core, svc)
		}
	}

	sort.SliceStable(core, func(i, j int) bool {
		return CorePriority(core[i].Service) < CorePriority(core[j].Service)
	})

	return core, infra
}
