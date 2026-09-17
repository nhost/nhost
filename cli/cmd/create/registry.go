package create

const (
	defaultTemplate      = "nextjs-shadcn"
	defaultTemplatesRepo = "https://github.com/nhost/nhost"

	// devVersion is what -X main.Version holds outside a release build; a
	// release build carries the released version (see cli/project.nix).
	devVersion = "0.0.0-dev"
	// releaseTagPrefix maps a CLI version to the tag it was released from,
	// the same mapping cli/get.sh uses to download a binary.
	releaseTagPrefix = "cli@"
	devTemplatesRef  = "main"
)

// defaultTemplatesRef returns the git ref templates are fetched from when the
// caller did not choose one. A released binary reads templates from its own
// release tag, so the CLI and the template it scaffolds are always the pair
// that was tested together at that commit; a template change that needs a
// newer CLI cannot reach an already-installed one. Only dev builds, which are
// always current with the templates in their own tree, track main.
func defaultTemplatesRef(version string) string {
	if version == "" || version == devVersion {
		return devTemplatesRef
	}

	return releaseTagPrefix + version
}

// template describes a starter template that `nhost create` can scaffold.
// display is what the picker lists, so it is the stack and nothing else: a line
// per template that fits on one.
type template struct {
	name    string
	display string
}

var templates = []template{ //nolint:gochecknoglobals
	{
		name:    "nextjs-shadcn",
		display: "Next.js + shadcn/ui",
	},
	{
		name:    "react-native",
		display: "React Native (Expo)",
	},
}

func lookupTemplate(name string) (template, bool) {
	for _, t := range templates {
		if t.name == name {
			return t, true
		}
	}

	return template{}, false //nolint:exhaustruct
}

func templateNames() []string {
	names := make([]string, 0, len(templates))
	for _, t := range templates {
		names = append(names, t.name)
	}

	return names
}
