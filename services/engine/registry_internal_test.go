package main

import "testing"

func TestEngineOwnedServiceFlagsAreSkipped(t *testing.T) {
	t.Parallel()

	targets := []struct {
		service string
		flag    string
	}{
		{service: "graphql", flag: "http-read-timeout"},
		{service: "graphql", flag: "http-write-timeout"},
		{service: "graphql", flag: "http-idle-timeout"},
		{service: "graphql", flag: "profile-address"},
		{service: "storage", flag: "pprof-bind"},
	}

	registry := serviceRegistry()
	engineFlags := serveFlags()

	for _, target := range targets {
		t.Run(target.service+"/"+target.flag, func(t *testing.T) {
			t.Parallel()

			def := registry[target.service]
			if !def.skip[target.flag] {
				t.Fatalf("%s flag %q is not in the engine skip set", target.service, target.flag)
			}

			foundPrimary := false
			for _, flag := range def.command().Flags {
				if flag.Names()[0] == target.flag {
					foundPrimary = true

					break
				}
			}

			if !foundPrimary {
				t.Fatalf(
					"%s skip name %q is not a primary service flag",
					target.service,
					target.flag,
				)
			}

			engineName := prefixedName(target.service, target.flag)
			for _, flag := range engineFlags {
				for _, name := range flag.Names() {
					if name == engineName {
						t.Fatalf("engine still exposes --%s", engineName)
					}
				}
			}
		})
	}

	if serviceRegistry()["storage"].hidden["pprof-bind"] {
		t.Fatal("storage pprof-bind remains hidden instead of skipped")
	}
}
