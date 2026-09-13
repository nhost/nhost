package main

import (
	"fmt"
	"strings"

	"github.com/urfave/cli/v3"
)

// flagKind classifies a service's native flag by how the engine re-exposes and
// back-translates it. A bool flag carries no value, a slice flag may repeat,
// and everything else is a single scalar forwarded verbatim to the service's
// own CLI (which keeps authority over its real type, defaults, and validation).
type flagKind int

const (
	kindScalar flagKind = iota
	kindBool
	kindSlice
)

// classifyFlag reduces any urfave flag type to one of three shapes using the
// generic DocGeneration interfaces, so the engine does not have to enumerate
// every concrete flag type (String, Int, Duration, Generic, ...). Multi-value
// flags are slices; flags that take no value are bools; the rest are scalars.
func classifyFlag(f cli.Flag) flagKind {
	if mv, ok := f.(cli.DocGenerationMultiValueFlag); ok && mv.IsMultiValueFlag() {
		return kindSlice
	}

	if dg, ok := f.(cli.DocGenerationFlag); ok && !dg.TakesValue() {
		return kindBool
	}

	return kindScalar
}

// flagUsage returns a flag's help text, or "" for flags that do not expose it.
func flagUsage(f cli.Flag) string {
	if dg, ok := f.(cli.DocGenerationFlag); ok {
		return dg.GetUsage()
	}

	return ""
}

// prefixedName is the engine-level flag name for a service's native flag, e.g.
// service "auth" + flag "api-prefix" => "auth-api-prefix".
func prefixedName(service, name string) string {
	return service + "-" + name
}

// prefixedEnv is the engine-level env var for a service's native flag, e.g.
// service "auth" + flag "api-prefix" => "AUTH_API_PREFIX".
func prefixedEnv(service, name string) string {
	return strings.ToUpper(service + "_" + strings.ReplaceAll(name, "-", "_"))
}

// prefixedCategory is the help category the prefixed flags are grouped under.
func prefixedCategory(service string) string {
	switch service {
	case "graphql":
		return "GraphQL service"
	default:
		return strings.ToUpper(service[:1]) + service[1:] + " service"
	}
}

// servicePrefixedFlags re-exposes a service's native flags on the engine under
// its own namespace. Flags in skip are consolidated into engine globals (or
// owned by the engine, e.g. the listener) and are therefore not re-exposed;
// flags in hidden are still accepted but hidden from help to keep the surface
// readable. Required is deliberately not propagated: requiredness is enforced
// by the service's own CLI only when the service is actually enabled, so a
// disabled service never forces its required flags onto the engine.
func servicePrefixedFlags(
	service string, src []cli.Flag, skip, hidden map[string]bool,
) []cli.Flag {
	out := make([]cli.Flag, 0, len(src))
	category := prefixedCategory(service)

	for _, f := range src {
		name := f.Names()[0]
		if skip[name] {
			continue
		}

		pname := prefixedName(service, name)
		env := cli.EnvVars(prefixedEnv(service, name))
		usage := flagUsage(f)
		hide := hidden[name]

		switch classifyFlag(f) {
		case kindBool:
			out = append(out, &cli.BoolFlag{ //nolint:exhaustruct
				Name: pname, Usage: usage, Category: category,
				Sources: env, Hidden: hide,
			})
		case kindSlice:
			out = append(out, &cli.StringSliceFlag{ //nolint:exhaustruct
				Name: pname, Usage: usage, Category: category,
				Sources: env, Hidden: hide,
			})
		case kindScalar:
			out = append(out, &cli.StringFlag{ //nolint:exhaustruct
				Name: pname, Usage: usage, Category: category,
				Sources: env, Hidden: hide,
			})
		}
	}

	return out
}

// servicePassthroughArgs turns the prefixed flags the caller actually set back
// into the service's native argument list (e.g. "--auth-api-prefix /x" =>
// ["--api-prefix", "/x"]). Only flags set on the engine command are forwarded,
// so the service's own defaults and env sources still apply to the rest, and
// engine globals fill any remaining shared values via applySharedConfig.
func servicePassthroughArgs(
	service string, cmd *cli.Command, src []cli.Flag, skip map[string]bool,
) []string {
	var args []string

	for _, f := range src {
		name := f.Names()[0]
		if skip[name] {
			continue
		}

		pname := prefixedName(service, name)
		if !cmd.IsSet(pname) {
			continue
		}

		switch classifyFlag(f) {
		case kindBool:
			args = append(args, fmt.Sprintf("--%s=%t", name, cmd.Bool(pname)))
		case kindSlice:
			for _, v := range cmd.StringSlice(pname) {
				args = append(args, "--"+name, v)
			}
		case kindScalar:
			args = append(args, "--"+name, cmd.String(pname))
		}
	}

	return args
}
