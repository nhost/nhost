package create

const (
	defaultTemplate      = "nextjs-shadcn"
	defaultTemplatesRepo = "https://github.com/nhost/nhost"
	defaultTemplatesRef  = "main"
)

// template describes a starter template that `nhost create` can scaffold.
type template struct {
	name        string
	display     string
	description string
}

var templates = []template{ //nolint:gochecknoglobals
	{
		name:        "nextjs-shadcn",
		display:     "Next.js + shadcn/ui",
		description: "Next.js (App Router) + Tailwind CSS + shadcn/ui with email OTP auth",
	},
	{
		name:        "react",
		display:     "React (Vite)",
		description: "Vite + React + TypeScript SPA with email OTP auth",
	},
	{
		name:        "react-native",
		display:     "React Native (Expo)",
		description: "Expo (React Native) + Expo Router with email OTP auth",
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
