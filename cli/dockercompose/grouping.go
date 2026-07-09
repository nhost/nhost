package dockercompose

import "sort"

var corePriority = map[string]int{ //nolint:gochecknoglobals
	"postgres":  1,
	"graphql":   2,
	"auth":      3,
	"storage":   4,
	"functions": 5,
	"ai":        6,
	"dashboard": 7,
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
	if p, ok := corePriority[name]; ok {
		return p
	}

	return len(corePriority) + 1
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

	sort.Slice(core, func(i, j int) bool {
		return CorePriority(core[i].Service) < CorePriority(core[j].Service)
	})

	return core, infra
}
