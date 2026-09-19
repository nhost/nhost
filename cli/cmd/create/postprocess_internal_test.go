package create

import (
	"path"
	"testing"
)

// The one entry here that is load-bearing beyond tidiness is .env.example:
// every scaffolded project's documented first step is copying it to
// .env.local, so dropping it breaks a project before its first command.
func TestSkippedFile(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		file    string
		skipped bool
	}{
		{name: "next type shim", file: "next-env.d.ts", skipped: true},
		{name: "tsbuildinfo", file: "tsconfig.tsbuildinfo", skipped: true},
		{name: "bare env", file: ".env", skipped: true},
		{name: "local env", file: ".env.local", skipped: true},
		{name: "production env", file: ".env.production", skipped: true},
		{name: "backend secrets", file: ".secrets", skipped: true},
		{name: "macos metadata", file: ".DS_Store", skipped: true},
		{name: "example env ships", file: ".env.example", skipped: false},
		{name: "source file starting with env", file: ".environment.ts", skipped: false},
		{name: "gitignore", file: ".gitignore", skipped: false},
		{name: "config", file: "next.config.ts", skipped: false},
		{name: "source", file: "page.tsx", skipped: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := skippedFile(tc.file); got != tc.skipped {
				t.Errorf("skippedFile(%q) = %v, want %v", tc.file, got, tc.skipped)
			}
		})
	}
}

// out/ and coverage/ are anchored to the app root by the template's own
// .gitignore, so matching them at any depth would silently drop a route
// segment called out.
func TestSkippedDir(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		rel     string
		skipped bool
	}{
		{name: "dependencies", rel: "frontend/node_modules", skipped: true},
		{name: "nested dependencies", rel: "backend/functions/node_modules", skipped: true},
		{name: "build output", rel: "frontend/.next", skipped: true},
		{name: "vcs", rel: ".git", skipped: true},
		{name: "vercel", rel: "frontend/.vercel", skipped: true},
		{name: "backend state", rel: "backend/.nhost", skipped: true},
		{name: "anchored export", rel: "frontend/out", skipped: true},
		{name: "anchored coverage", rel: "frontend/coverage", skipped: true},
		{name: "route segment called out", rel: "frontend/src/app/out", skipped: false},
		{name: "source directory called coverage", rel: "frontend/src/coverage", skipped: false},
		{name: "app source", rel: "frontend/src/app", skipped: false},
		{name: "backend metadata", rel: "backend/nhost/metadata", skipped: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := skippedDir(tc.rel, path.Base(tc.rel)); got != tc.skipped {
				t.Errorf("skippedDir(%q) = %v, want %v", tc.rel, got, tc.skipped)
			}
		})
	}
}
