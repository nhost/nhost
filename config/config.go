package config

import (
	"bytes"
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/nhost/be/services/mimir/schema/appconfig"
	"github.com/nhost/cli/internal/generichelper"
	"github.com/nhost/cli/util"
	"github.com/pelletier/go-toml/v2"
)

var (
	MarshalFunc   = toml.Marshal
	unmarshalFunc = toml.Unmarshal
)

func ValidateAndResolve(conf any, secrets model.Secrets) (*model.ConfigConfig, error) {
	var c model.ConfigConfig

	switch conf.(type) {
	case *model.ConfigConfig:
		c = *conf.(*model.ConfigConfig)
	case []byte:
		if err := unmarshalFunc(conf.([]byte), &c); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("invalid config type")
	}

	sch, err := schema.New()
	if err != nil {
		return nil, err
	}

	tomlConf, err := MarshalFunc(c)
	if err != nil {
		return nil, err
	}

	if err := validateConfigFormat(sch, tomlConf, unmarshalFunc); err != nil {
		return nil, err
	}

	return appconfig.Config(sch, &c, secrets)
}

func DefaultConfigAndSecrets() (confData *model.ConfigConfig, secretsData model.Secrets, err error) {
	defaultConf, err := defaultConfig()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate default config: %w", err)
	}

	return defaultConf, DefaultSecrets(), nil
}

func defaultConfig() (*model.ConfigConfig, error) {
	s, err := schema.New()
	if err != nil {
		return nil, err
	}

	c := &model.ConfigConfig{
		Hasura: defaultHasuraConfig(),
	}

	if c, err = s.Fill(c); err != nil {
		return nil, err
	}

	if err = s.ValidateConfig(c); err != nil {
		return nil, err
	}

	return c, nil
}

func DefaultSecrets() model.Secrets {
	return model.Secrets{
		{
			Name:  "HASURA_GRAPHQL_ADMIN_SECRET",
			Value: util.ADMIN_SECRET,
		},
		{
			Name:  "HASURA_GRAPHQL_JWT_SECRET",
			Value: util.JWT_KEY,
		},
		{
			Name:  "NHOST_WEBHOOK_SECRET",
			Value: util.WEBHOOK_SECRET,
		},
	}
}

// validateConfigFormat validates the config format, making sure that it doesn't contain arbitrary fields.
func validateConfigFormat(sch *schema.Schema, conf []byte, unmarshalFunc func(data []byte, v any) error) error {
	var c map[string]any

	if err := unmarshalFunc(conf, &c); err != nil {
		return err
	}

	return sch.ValidateConfig(c)
}

func defaultHasuraConfig() *model.ConfigHasura {
	return &model.ConfigHasura{
		AdminSecret:   "{{ secrets.HASURA_GRAPHQL_ADMIN_SECRET }}",
		WebhookSecret: "{{ secrets.NHOST_WEBHOOK_SECRET }}",
		JwtSecrets: []*model.ConfigJWTSecret{
			{
				Type: generichelper.Pointerify("HS256"),
				Key:  generichelper.Pointerify("{{ secrets.HASURA_GRAPHQL_JWT_SECRET }}"),
			},
		},
	}
}

func DumpSecrets(s model.Secrets) []byte {
	buf := bytes.NewBuffer(nil)

	for _, secret := range s {
		buf.WriteString(secret.GetName() + "=" + secret.GetValue() + "\n")
	}

	return buf.Bytes()
}
