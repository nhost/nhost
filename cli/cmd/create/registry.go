package create

const (
	defaultTemplate      = "nextjs-shadcn"
	defaultTemplatesRepo = "https://github.com/nhost/nhost"
	defaultTemplatesRef  = "main"
)

// Template describes a starter template that `nhost create` can scaffold.
type Template struct {
	Name        string
	Display     string
	Framework   string
	Description string
}

var templates = []Template{ //nolint:gochecknoglobals
	{
		Name:        "nextjs-shadcn",
		Display:     "Next.js + shadcn/ui",
		Framework:   "nextjs",
		Description: "Next.js (App Router) + Tailwind CSS + shadcn/ui with email OTP auth",
	},
}

func lookupTemplate(name string) (Template, bool) {
	for _, t := range templates {
		if t.Name == name {
			return t, true
		}
	}

	return Template{}, false //nolint:exhaustruct
}

func templateNames() []string {
	names := make([]string, 0, len(templates))
	for _, t := range templates {
		names = append(names, t.Name)
	}

	return names
}
