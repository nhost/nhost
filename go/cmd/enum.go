package cmd

import (
	"fmt"
	"strings"

	"github.com/urfave/cli/v2"
)

// EnumValue is a flag.Value that can be used to restrict the
// values of a flag to a list of allowed values.
type EnumValue struct {
	Enum     []string
	Default  string
	selected string
}

func (e *EnumValue) Get() string {
	if e.selected == "" {
		return e.Default
	}

	return e.selected
}

func (e *EnumValue) Set(value string) error {
	for _, enum := range e.Enum {
		if enum == value {
			e.selected = value
			return nil
		}
	}

	return fmt.Errorf("allowed values are %s", strings.Join(e.Enum, ", ")) //nolint: err113
}

func (e *EnumValue) String() string {
	return e.Get()
}

func GetEnumValue(c *cli.Context, flagName string) string {
	g := GetGeneric[EnumValue](c, flagName)
	if g == nil {
		return ""
	}

	return g.Get()
}

func GetGeneric[T any](c *cli.Context, name string) *T {
	g := c.Generic(name)
	if g == nil {
		return nil
	}

	if v, ok := g.(*T); ok {
		return v
	}

	return nil
}
