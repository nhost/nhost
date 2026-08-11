package clidocs

import "testing"

func TestSplitBadges(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		usage      string
		wantBadges string
		wantDesc   string
	}{
		{"none", "Create a deployment", "", "Create a deployment"},
		{
			"experimental",
			"[EXPERIMENTAL] Create a deployment",
			`<span class="cli-badge cli-badge-experimental">Experimental</span>`,
			"Create a deployment",
		},
		{
			"beta",
			"Start the environment (BETA)",
			`<span class="cli-badge cli-badge-beta">Beta</span>`,
			"Start the environment",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			gotBadges, gotDesc := splitBadges(tt.usage)
			if gotBadges != tt.wantBadges {
				t.Errorf("badges = %q, want %q", gotBadges, tt.wantBadges)
			}

			if gotDesc != tt.wantDesc {
				t.Errorf("desc = %q, want %q", gotDesc, tt.wantDesc)
			}
		})
	}
}

func TestCodeify(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   string
		want string
	}{
		{"placeholder kept literal in code", "use <placeholder> now", "use `<placeholder>` now"},
		{"angle brackets in free text escaped", "compare a < b > c", "compare a &lt; b &gt; c"},
		{"path becomes code", "see /etc/app for details", "see `/etc/app` for details"},
		{"trailing period stays outside code", "look in /var/log.", "look in `/var/log`."},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := codeify(tt.in); got != tt.want {
				t.Errorf("codeify(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestCodeKeepsAnglesLiteral(t *testing.T) {
	t.Parallel()

	if got := code("<foo>"); got != "`<foo>`" {
		t.Errorf("code(%q) = %q, want %q", "<foo>", got, "`<foo>`")
	}
}
