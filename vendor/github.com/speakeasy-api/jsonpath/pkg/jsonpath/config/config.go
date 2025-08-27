package config

type Option func(*config)

// WithPropertyNameExtension enables the use of the "~" character to access a property key.
// It is not enabled by default as this is outside of RFC 9535, but is important for several use-cases
func WithPropertyNameExtension() Option {
	return func(cfg *config) {
		cfg.propertyNameExtension = true
	}
}

type Config interface {
	PropertyNameEnabled() bool
}

type config struct {
	propertyNameExtension bool
}

func (c *config) PropertyNameEnabled() bool {
	return c.propertyNameExtension
}

func New(opts ...Option) Config {
	cfg := &config{}
	for _, opt := range opts {
		opt(cfg)
	}
	return cfg
}
