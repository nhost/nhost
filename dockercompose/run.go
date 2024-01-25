package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

func runVolumeName(
	runName string,
	volumeName string,
	branchName string,
) string {
	return fmt.Sprintf("%s-run-%s-%s", branchName, runName, volumeName)
}

func run(
	cfg *model.ConfigRunServiceConfig,
	branchName string,
) *Service {
	env := map[string]string{}
	for _, e := range cfg.GetEnvironment() {
		env[e.GetName()] = e.GetValue()
	}

	ports := make([]Port, 0, len(cfg.GetPorts()))
	for _, p := range cfg.GetPorts() {
		if deptr(p.GetPublish()) {
			proto := "tcp"
			if p.GetType() == "udp" {
				proto = p.GetType()
			}
			ports = append(ports, Port{
				Mode:      "ingress",
				Target:    uint(p.GetPort()),
				Published: fmt.Sprintf("%d", p.GetPort()),
				Protocol:  proto,
			})
		}
	}

	volumes := make([]Volume, 0, len(cfg.GetResources().GetStorage()))
	for _, s := range cfg.GetResources().GetStorage() {
		volumes = append(volumes, Volume{
			Type:     "volume",
			Source:   runVolumeName(cfg.GetName(), s.GetName(), branchName),
			Target:   s.GetPath(),
			ReadOnly: ptr(false),
		})
	}

	return &Service{
		Image:       cfg.GetImage().GetImage(),
		DependsOn:   map[string]DependsOn{},
		EntryPoint:  cfg.GetCommand(),
		Command:     []string{},
		Environment: env,
		ExtraHosts:  extraHosts(),
		HealthCheck: nil,
		Labels:      map[string]string{},
		Ports:       ports,
		Restart:     "always",
		Volumes:     volumes,
		WorkingDir:  nil,
	}
}
