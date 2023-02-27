package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
)

const (
	envAuthSmtpHost   = "AUTH_SMTP_HOST"
	envAuthSmtpPort   = "AUTH_SMTP_PORT"
	envAuthSmtpUser   = "AUTH_SMTP_USER"
	envAuthSmtpPass   = "AUTH_SMTP_PASS"
	envAuthSmtpSecure = "AUTH_SMTP_SECURE"
	envAuthSmtpSender = "AUTH_SMTP_SENDER"
)

func (c Config) mailhogServiceEnvs() env {
	authEnv := c.authServiceEnvs()

	e := env{
		"SMTP_HOST":   authEnv[envAuthSmtpHost],
		"SMTP_PORT":   authEnv[envAuthSmtpPort],
		"SMTP_PASS":   authEnv[envAuthSmtpPass],
		"SMTP_USER":   authEnv[envAuthSmtpUser],
		"SMTP_SECURE": authEnv[envAuthSmtpSecure],
		"SMTP_SENDER": authEnv[envAuthSmtpSender],
	}

	e.merge(c.serviceConfigEnvs(SvcMailhog))
	e.mergeWithSlice(c.dotenv)
	return e
}

func (c Config) runMailhogService() bool {
	if conf, ok := c.nhostConfig.Services[SvcMailhog]; ok && conf != nil {
		if conf.NoContainer {
			return false
		}
	}

	authEnv := c.authServiceEnvs()

	return authEnv[envAuthSmtpHost] == SvcMailhog
}

func (c Config) mailhogService() *types.ServiceConfig {
	if !c.runMailhogService() {
		return nil
	}

	return &types.ServiceConfig{
		Name:        SvcMailhog,
		Environment: c.mailhogServiceEnvs().dockerServiceConfigEnv(),
		Restart:     types.RestartPolicyAlways,
		Image:       c.serviceDockerImage(SvcMailhog, svcMailhogDefaultImage),
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    mailhogSMTPPort,
				Published: fmt.Sprint(c.ports.SMTP()),
				Protocol:  "tcp",
			},
			{
				Mode:      "ingress",
				Target:    8025,
				Published: fmt.Sprint(c.ports.Mailhog()),
				Protocol:  "tcp",
			},
		},
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: MailHogDataDirGiBranchScopedPath(c.gitBranch),
				Target: "/maildir",
			},
		},
	}
}
